import { PRODUCTS, type Product, type Reward } from '../config/shop';
import { applyPurchase } from '../core/shop';
import type { Save } from '../core/save';
import type { CatalogItem, GameSdk, Purchase } from './yandexSdk';

export type BuyOutcome = { ok: true; rewards: readonly Reward[] } | { ok: false; reason: 'cancelled' | 'error' | 'unknown_product' | 'unavailable' };

/**
 * Покупки через Яндекс Платежи (consumable): покупка → начисление (идемпотентно по purchaseToken) → сохранение → consume.
 * Если игра закрылась между шагами — незавершённые покупки добираются при старте (recoverPending).
 */
export class PaymentsService {
  private catalogCache: CatalogItem[] | null = null;

  constructor(
    private readonly sdk: GameSdk,
    private readonly getSave: () => Save,
    private readonly update: (fn: (s: Save) => Save) => void,
    /** Дождаться записи сохранения: начисление должно быть сохранено ДО consume. */
    private readonly flush: () => Promise<void>,
  ) {}

  async catalog(): Promise<CatalogItem[]> {
    if (!this.catalogCache) this.catalogCache = await this.sdk.payments.getCatalog().catch(() => []);
    return this.catalogCache;
  }

  private product(id: string): Product | undefined { return PRODUCTS.find((p) => p.id === id); }

  /** Начисляет награду по покупке (один раз на токен), сохраняет, потом consume. Возвращает награды, если начислили сейчас. */
  private async settle(p: Purchase): Promise<readonly Reward[] | null> {
    const product = this.product(p.productID);
    if (!product) return null; // неизвестный товар не трогаем и не гасим — разберётся поддержка
    const r = applyPurchase(this.getSave(), p.purchaseToken, product.rewards);
    if (r.applied) { this.update(() => r.save); await this.flush(); }
    try { await this.sdk.payments.consume(p.purchaseToken); } catch { /* повторим при следующем старте — токен уже в processedPurchases */ }
    return r.applied ? product.rewards : null;
  }

  /** При старте: добрать незавершённые покупки. Возвращает, сколько начислено. */
  async recoverPending(): Promise<number> {
    let n = 0;
    const pending = await this.sdk.payments.getPurchases().catch(() => [] as Purchase[]);
    for (const p of pending) if (await this.settle(p)) n++;
    return n;
  }

  async buy(productId: string): Promise<BuyOutcome> {
    if (!this.product(productId)) return { ok: false, reason: 'unknown_product' };
    if ((await this.catalog()).length === 0) return { ok: false, reason: 'unavailable' };
    let purchase: Purchase;
    try { purchase = await this.sdk.payments.purchase(productId); } catch (e) {
      return { ok: false, reason: /cancel|close/i.test(String(e)) ? 'cancelled' : 'error' };
    }
    const rewards = await this.settle(purchase);
    return rewards ? { ok: true, rewards } : { ok: false, reason: 'error' };
  }
}
