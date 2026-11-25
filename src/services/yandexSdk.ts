import { PRODUCTS } from '../config/shop';
import type { Save } from '../core/save';

export type AdResult = { ok: true; rewarded: boolean } | { ok: false; error: string };

export interface Purchase { productID: string; purchaseToken: string }
export interface CatalogItem { id: string; priceText: string }
export interface LeaderEntry { rank: number; name: string; score: number; me: boolean }

export interface GameSdk {
  readonly isMock: boolean;
  init(): Promise<void>;
  lang(): 'ru' | 'en';
  loadingReady(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Награда выдаётся ТОЛЬКО при rewarded === true (onRewarded). */
  showRewarded(): Promise<AdResult>;
  showFullscreen(): Promise<boolean>;
  loadData(): Promise<unknown>;
  saveData(data: Save): Promise<void>;
  serverTime(): number;
  payments: {
    /** Цены из консоли Яндекса; пустой массив — платежи недоступны. */
    getCatalog(): Promise<CatalogItem[]>;
    getPurchases(): Promise<Purchase[]>;
    purchase(productID: string): Promise<Purchase>;
    consume(purchaseToken: string): Promise<void>;
  };
  setLeaderboardScore(name: string, score: number): Promise<void>;
  /** null — рейтинг недоступен. */
  getLeaderboard(name: string): Promise<LeaderEntry[] | null>;
  isAuthorized(): boolean;
  openAuth(): Promise<boolean>;
}

/** Мок: имитирует ysdk локально, управляем поведением из тестов/e2e. */
export class MockSdk implements GameSdk {
  readonly isMock = true;
  cloud: unknown = null;
  nextAd: AdResult = { ok: true, rewarded: true };
  nextPurchaseError: string | null = null;
  pending: Purchase[] = [];
  language: 'ru' | 'en' = 'ru';
  log: string[] = [];
  scores: Record<string, number> = {};
  private seq = 0;

  async init(): Promise<void> { this.log.push('init'); }
  lang(): 'ru' | 'en' { return this.language; }
  loadingReady(): void { this.log.push('ready'); }
  gameplayStart(): void { this.log.push('gp:start'); }
  gameplayStop(): void { this.log.push('gp:stop'); }
  async showRewarded(): Promise<AdResult> { this.log.push('ad:rewarded'); return this.nextAd; }
  async showFullscreen(): Promise<boolean> { this.log.push('ad:fullscreen'); return true; }
  async loadData(): Promise<unknown> { return this.cloud; }
  async saveData(data: Save): Promise<void> { this.cloud = JSON.parse(JSON.stringify(data)); }
  serverTime(): number { return Date.now(); }
  payments = {
    getCatalog: async (): Promise<CatalogItem[]> => PRODUCTS.map((p) => ({ id: p.id, priceText: `${p.suggestedPriceYan} ЯН` })),
    getPurchases: async (): Promise<Purchase[]> => this.pending.slice(),
    purchase: async (productID: string): Promise<Purchase> => {
      if (this.nextPurchaseError) { const e = this.nextPurchaseError; this.nextPurchaseError = null; throw new Error(e); }
      const p = { productID, purchaseToken: `mock-${++this.seq}` };
      this.pending.push(p);
      return p;
    },
    consume: async (token: string): Promise<void> => { this.pending = this.pending.filter((p) => p.purchaseToken !== token); },
  };
  async setLeaderboardScore(name: string, score: number): Promise<void> { this.scores[name] = score; }
  authorized = true;
  isAuthorized(): boolean { return this.authorized; }
  async openAuth(): Promise<boolean> { this.authorized = true; return true; }
  async getLeaderboard(name: string): Promise<LeaderEntry[] | null> {
    const names = ['Мария К.', 'Алексей', 'Ольга', 'Сергей П.', 'Наталья', 'Дмитрий', 'Елена', 'Андрей'];
    const mine = this.scores[name] ?? 0;
    const rows = names.map((n, i) => ({ name: n, score: 180 - i * 17, me: false }));
    rows.push({ name: 'Вы', score: mine, me: true });
    return rows.sort((a, b) => b.score - a.score).map((r, i) => ({ rank: i + 1, ...r }));
  }
}

/** Обёртка над настоящим YaGames. Загружается платформой через /sdk.js. */
export class YandexSdk implements GameSdk {
  readonly isMock = false;
  private ysdk: any;
  private player: any;
  private paymentsApi: any;

  async init(): Promise<void> {
    this.ysdk = await (window as any).YaGames.init();
    this.player = await this.ysdk.getPlayer().catch(() => null);
    this.paymentsApi = await this.ysdk.getPayments({ signed: false }).catch(() => null);
  }
  lang(): 'ru' | 'en' {
    const l: string = this.ysdk?.environment?.i18n?.lang ?? 'ru';
    return ['ru', 'be', 'kk', 'uk', 'uz'].includes(l) ? 'ru' : 'en';
  }
  loadingReady(): void { this.ysdk?.features?.LoadingAPI?.ready?.(); }
  gameplayStart(): void { this.ysdk?.features?.GameplayAPI?.start?.(); }
  gameplayStop(): void { this.ysdk?.features?.GameplayAPI?.stop?.(); }
  showRewarded(): Promise<AdResult> {
    return new Promise((resolve) => {
      let rewarded = false;
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => { rewarded = true; },
          onClose: () => resolve({ ok: true, rewarded }),
          onError: (e: unknown) => resolve({ ok: false, error: String(e) }),
        },
      });
    });
  }
  showFullscreen(): Promise<boolean> {
    return new Promise((resolve) => {
      this.ysdk.adv.showFullscreenAdv({ callbacks: { onClose: (shown: boolean) => resolve(shown), onError: () => resolve(false) } });
    });
  }
  async loadData(): Promise<unknown> { return this.player ? (await this.player.getData().catch(() => null)) : null; }
  async saveData(data: Save): Promise<void> { await this.player?.setData(data, false).catch(() => undefined); }
  serverTime(): number { return this.ysdk?.serverTime?.() ?? Date.now(); }
  payments = {
    getCatalog: async (): Promise<CatalogItem[]> => {
      if (!this.paymentsApi) return [];
      const items: Array<{ id: string; price?: string }> = await this.paymentsApi.getCatalog();
      return items.map((i) => ({ id: i.id, priceText: i.price ?? '' }));
    },
    getPurchases: async (): Promise<Purchase[]> => (this.paymentsApi ? await this.paymentsApi.getPurchases() : []),
    purchase: async (id: string): Promise<Purchase> => this.paymentsApi.purchase({ id }),
    consume: async (token: string): Promise<void> => { await this.paymentsApi?.consumePurchase(token); },
  };
  isAuthorized(): boolean { return typeof this.player?.getMode === 'function' ? this.player.getMode() !== 'lite' : false; }
  async openAuth(): Promise<boolean> {
    try { await this.ysdk.auth.openAuthDialog(); this.player = await this.ysdk.getPlayer(); return this.isAuthorized(); } catch { return false; }
  }
  async setLeaderboardScore(name: string, score: number): Promise<void> {
    if (!this.isAuthorized()) return; // в рейтинг пишут только авторизованные игроки
    await this.ysdk?.leaderboards?.setScore?.(name, score).catch(() => undefined);
  }
  async getLeaderboard(name: string): Promise<LeaderEntry[] | null> {
    try {
      const r = await this.ysdk.leaderboards.getEntries(name, { quantityTop: 15, includeUser: this.isAuthorized(), quantityAround: 2 });
      const me = this.isAuthorized() ? this.player?.getUniqueID?.() : undefined;
      return (r.entries as Array<{ rank: number; score: number; player?: { publicName?: string; uniqueID?: string } }>).map((e) => ({
        rank: e.rank, score: e.score, name: e.player?.publicName || '—', me: me !== undefined && e.player?.uniqueID === me,
      }));
    } catch { return null; }
  }
}

/** Выбор реализации: на платформе есть window.YaGames, локально — мок. */
export function createSdk(): GameSdk {
  return typeof window !== 'undefined' && (window as any).YaGames ? new YandexSdk() : new MockSdk();
}
