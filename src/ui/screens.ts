import { BALANCE, type BonusId } from '../config/balance';
import { CHEST_TIERS, CHESTS, COIN_PRICES, PRODUCTS, type ChestTier, type Reward } from '../config/shop';
import { DAILY_CYCLE } from '../config/daily';
import { CHAPTERS } from '../content/chapters';
import { THEMES } from '../content/themes';
import { ACHIEVEMENTS, isUnlocked as isAchUnlocked } from '../core/achievements';
import type { DailyEvent } from '../core/events';
import type { DailyStatus } from '../core/daily';
import { chapterLevel, freeLevel, type PlayLevel } from '../content/levels';
import { FREE_PLAY_RANGES, type FreePlayCategory } from '../core/freeplay';
import { chapterLevelIds } from '../content/levels';
import { chapterDone, freeDone, isDone, isUnlocked } from '../core/progress';
import type { Save } from '../core/save';
import { getLang, t } from '../services/i18n';
import type { CatalogItem, LeaderEntry } from '../services/yandexSdk';
import { bonusLabel, chestIcon, rewardLabel } from './rewards';
import { COIN, GEM, button, el, modal, starsHtml } from './dom';

const CATS: FreePlayCategory[] = ['easy', 'medium', 'hard', 'expert'];

// ------------------------------------------------------------------ главное меню
export interface MenuCtx {
  save: Save; hasProgress: boolean;
  onPlay(): void; onChapters(): void; onFree(): void; onShop(): void; onSettings(): void;
  onDaily(): void; onEvent(): void; onAchievements(): void; onRating(): void;
  dailyReady: boolean; eventReady: boolean;
}

export function buildMenu(c: MenuCtx): HTMLElement {
  const s = el('div', 'screen menu');
  const cur = el('div', 'pill menu-cur', `${COIN} ${c.save.coins} &nbsp; ${GEM} ${c.save.rare}`);
  const title = el('div', 'game-title');
  title.append(el('div', 'logo', t('title')), el('div', 'sub', t('subtitle')));
  const list = el('div', 'menu-list');
  const pair = el('div', 'menu-pair');
  pair.append(button(t('chapters'), c.onChapters, 'big-btn blue'), button(t('freePlay'), c.onFree, 'big-btn blue'));
  list.append(button(c.hasProgress ? t('continue') : t('play'), c.onPlay, 'big-btn green'), pair);
  const row = el('div', 'menu-row');
  const mini = (label: string, fn: () => void, dot = false): HTMLElement => {
    const b = el('button', 'small-btn', `<span>${label}</span>${dot ? '<i class="dot"></i>' : ''}`);
    b.addEventListener('click', fn); return b;
  };
  row.append(mini(t('shop'), c.onShop), mini(t('daily'), c.onDaily, c.dailyReady), mini(t('event'), c.onEvent, c.eventReady),
    mini(t('achievements'), c.onAchievements), mini(t('rating'), c.onRating));
  list.append(row, button(t('settings'), c.onSettings, 'big-btn ghost'));
  s.append(cur, title, list);
  return s;
}

// ------------------------------------------------------------------ стартовый экран (нужен жест игрока перед звуком)
/** Заставка с полоской загрузки; по её окончании появляется кнопка «Начать» — звук и музыка стартуют только после нажатия. */
export function buildSplash(c: { onStart(): void; loadMs?: number }): HTMLElement {
  const ms = c.loadMs ?? 900;
  const s = el('div', 'screen menu splash');
  s.style.setProperty('--dur', `${ms}ms`);
  const title = el('div', 'game-title'); title.append(el('div', 'logo', t('title')), el('div', 'sub', t('subtitle')));
  const list = el('div', 'menu-list');
  const bar = el('div', 'loadbar', '<i></i>');
  const start = button(t('start'), c.onStart, 'big-btn green start');
  start.style.display = 'none';
  list.append(bar, start);
  s.append(title, list);
  window.setTimeout(() => { bar.style.display = 'none'; start.style.display = ''; }, ms);
  return s;
}

// ------------------------------------------------------------------ сетка уровней (общая)
interface Cell { label: string; stars: number; unlocked: boolean; onPick(): void }

function grid(cells: Cell[]): HTMLElement {
  const g = el('div', 'grid');
  for (const c of cells) {
    const d = el('button', `cell${c.unlocked ? '' : ' locked'}${c.stars ? ' done' : ''}`);
    d.disabled = !c.unlocked;
    d.innerHTML = c.unlocked ? `<b>${c.label}</b><span class="st">${starsHtml(c.stars)}</span>` : `<b>🔒</b>`;
    d.addEventListener('click', c.onPick);
    g.append(d);
  }
  return g;
}

const header = (title: string, onBack: () => void): HTMLElement => {
  const h = el('div', 'screen-head');
  h.append(button('‹', onBack, 'round'), el('div', 'screen-title', title), el('div', 'round ghost-spacer'));
  return h;
};

// ------------------------------------------------------------------ главы
export interface LevelsCtx { save: Save; chapterId: number; onBack(): void; onChapter(id: number): void; onPick(l: PlayLevel): void }

export function buildLevelSelect(c: LevelsCtx): HTMLElement {
  const s = el('div', 'screen panel');
  s.append(header(t('chapters'), c.onBack));
  const tabs = el('div', 'tabs');
  const chapterOpen = (id: number): boolean => id === 1 || chapterDone(c.save.progress, chapterLevelIds(id - 1)); // глава открывается после предыдущей
  for (const ch of CHAPTERS) {
    const open = ch.implemented && chapterOpen(ch.id);
    const b = el('button', `tab${ch.id === c.chapterId ? ' on' : ''}${open ? '' : ' off'}`, `${open ? '' : '🔒 '}${t('chapter')} ${ch.id}`);
    b.addEventListener('click', () => c.onChapter(ch.id));
    tabs.append(b);
  }
  s.append(tabs);
  const ch = CHAPTERS.find((x) => x.id === c.chapterId)!;
  s.append(el('div', 'chapter-name', t(ch.titleKey)));
  if (!ch.implemented) { s.append(el('div', 'soon-box', t('soon'))); return s; }
  if (!chapterOpen(ch.id)) { s.append(el('div', 'soon-box', `${t('chapterLocked')} ${ch.id - 1}`)); return s; }
  const ids = chapterLevelIds(ch.id);
  const done = ids.filter((id) => isDone(c.save.progress, id)).length;
  s.append(el('div', 'chapter-prog', `${done} / ${ids.length}${chapterDone(c.save.progress, ids) ? ' ✓' : ''}`));
  s.append(grid(ids.map((id, i) => ({
    label: String(i + 1), stars: c.save.progress[id] ?? 0, unlocked: isUnlocked(c.save.progress, ids, i),
    onPick: () => c.onPick(chapterLevel(ch.id, i)!),
  }))));
  return s;
}

// ------------------------------------------------------------------ свободная игра = выбор сложности
export interface FreeCtx { save: Save; cat: FreePlayCategory | null; onBack(): void; onCat(c: FreePlayCategory | null): void; onPick(l: PlayLevel): void }

export function buildFreeSelect(c: FreeCtx): HTMLElement {
  const s = el('div', 'screen panel');
  if (c.cat) {
    const cat = c.cat;
    s.append(header(t(`cat.${cat}`), () => c.onCat(null)));
    const done = freeDone(c.save.progress, cat);
    const r = FREE_PLAY_RANGES[cat];
    s.append(el('div', 'chapter-name', `${r.min}${cat === 'expert' ? '+' : '–' + r.max} ${t('bottlesWord')}`));
    s.append(el('div', 'chapter-prog', `${t('done')}: ${done}`));
    const count = done + 12; // открыт следующий + задел вперёд (закрытые)
    const cells: Cell[] = [];
    for (let n = 1; n <= count; n++) {
      cells.push({ label: String(n), stars: c.save.progress[`free:${cat}:${n}`] ?? 0, unlocked: n <= done + 1, onPick: () => c.onPick(freeLevel(cat, n)) });
    }
    s.append(grid(cells));
    return s;
  }
  s.append(header(t('freePlay'), c.onBack));
  const list = el('div', 'cat-list');
  for (const cat of CATS) {
    const r = FREE_PLAY_RANGES[cat];
    const card = el('button', `cat-card ${cat}`);
    card.innerHTML = `<div class="cat-name">${t(`cat.${cat}`)}</div><div class="cat-desc">${t(`cat.${cat}.d`)}</div>` +
      `<div class="cat-meta"><span>${r.min}${cat === 'expert' ? '+' : '–' + r.max} ${t('bottlesWord')}</span><span>${t('done')}: ${freeDone(c.save.progress, cat)}</span></div>`;
    card.addEventListener('click', () => c.onCat(cat));
    list.append(card);
  }
  s.append(list);
  return s;
}

// ------------------------------------------------------------------ модалки
const toggle = (label: string, on: boolean, fn: (v: boolean) => void): HTMLElement => {
  const row = el('div', 'set-row'); row.append(el('span', '', label));
  const sw = el('button', `switch${on ? ' on' : ''}`, '<i></i>');
  sw.addEventListener('click', () => { on = !on; sw.classList.toggle('on', on); fn(on); });
  row.append(sw); return row;
};

export interface SettingsCtx { save: Save; onLang(l: 'ru' | 'en'): void; onSound(v: boolean): void; onMusic(v: boolean): void; onColorblind(v: boolean): void; onVibration(v: boolean): void; lang: 'ru' | 'en' }

export function showSettings(root: HTMLElement, c: SettingsCtx, onClose: () => void): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', t('settings')));
    const langRow = el('div', 'set-row'); langRow.append(el('span', '', t('language')));
    const seg = el('div', 'seg');
    for (const l of ['ru', 'en'] as const) {
      const b = el('button', l === c.lang ? 'on' : '', l.toUpperCase());
      b.addEventListener('click', () => { close(); c.onLang(l); });
      seg.append(b);
    }
    langRow.append(seg);
    card.append(langRow,
      toggle(t('sound'), c.save.settings.sound, c.onSound),
      toggle(t('music'), c.save.settings.music, c.onMusic),
      toggle(t('vibration'), c.save.settings.vibration, c.onVibration),
      toggle(t('colorblind'), c.save.settings.colorblind, c.onColorblind),
      button(t('close'), () => { close(); onClose(); }));
  });
}

export function showPause(root: HTMLElement, a: { onResume(): void; onRestart(): void; onSettings(): void; onMenu(): void }): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', t('pause')),
      button(t('resume'), () => { close(); a.onResume(); }, 'btn wide green'),
      button(t('restart'), () => { close(); a.onRestart(); }, 'btn wide'),
      button(t('settings'), () => { close(); a.onSettings(); }, 'btn wide'),
      button(t('toMenu'), () => { close(); a.onMenu(); }, 'btn wide ghost'));
  });
}

export interface WinInfo { stars: number; coins: number; chapterReward: number | null; chapterChest: ChestTier | null; hasNext: boolean; /** Событие дня: вместо звёзд показываем полученные награды. */ rewards?: readonly Reward[] }

export function showWin(root: HTMLElement, o: WinInfo, a: { onNext(): void; onMenu(): void }): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', o.chapterReward !== null ? t('chapterDone') : t('win')));
    if (o.rewards) {
      const cards = el('div', 'reward-cards');
      o.rewards.forEach((r, i) => { const c = el('div', 'reward-card', rewardLabel(r)); c.style.animationDelay = `${i * 0.15}s`; cards.append(c); });
      card.append(el('div', 'muted', t('eventTitle')), cards);
    } else card.append(el('div', 'stars big', starsHtml(o.stars).replace(/width="12" height="12"/g, 'width="40" height="40"')), el('div', 'reward', `${COIN} +${o.coins}`));
    if (o.chapterReward !== null) card.append(el('div', 'reward', `${t('chapterReward')}: ${GEM} +${o.chapterReward}`));
    if (o.chapterChest) card.append(el('div', 'reward chest-line', `${chestIcon(o.chapterChest, 44)} ${t(`chest.${o.chapterChest}`)}`));
    card.append(button(o.hasNext ? t('next') : t('toMenu'), () => { close(); if (o.hasNext) a.onNext(); else a.onMenu(); }, 'btn wide green'));
    if (o.hasNext) card.append(button(t('toMenu'), () => { close(); a.onMenu(); }, 'btn wide ghost'));
  });
}

/** Бонус закончился: показываем, когда он восстановится сам, и предлагаем рекламу (если не на кулдауне). */
export function showOutOfBonus(root: HTMLElement, o: { name: string; regenText: string | null; adCooldownText: string | null; onAd(): void; priceRare: number; canBuy: boolean; onBuy(): void }): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', `${t('outOf')}: ${o.name}`));
    if (o.regenText) card.append(el('div', 'muted', `${t('regenIn')} ${o.regenText}`));
    const ad = button(o.adCooldownText ? `${t('adIn')} ${o.adCooldownText}` : `▶ ${t('watchAd')} (${t('bonusGetFree')})`, () => { close(); o.onAd(); }, 'btn wide green');
    if (o.adCooldownText) { ad.disabled = true; ad.classList.add('off'); }
    const buy = button(`${t('buy')} · ${GEM} ${o.priceRare}`, () => { close(); o.onBuy(); }, 'btn wide');
    if (!o.canBuy) { buy.disabled = true; buy.classList.add('off'); }
    card.append(ad, buy, button(t('close'), close, 'btn wide ghost'));
  });
}

// ------------------------------------------------------------------ магазин
export type ShopTab = 'chests' | 'bonuses' | 'themes' | 'currency';
const SHOP_TABS: ShopTab[] = ['chests', 'bonuses', 'themes', 'currency'];

export interface ShopCtx {
  save: Save; tab: ShopTab;
  /** null — цены ещё грузятся; [] — платежи недоступны. */
  catalog: CatalogItem[] | null;
  onBack(): void; onTab(t: ShopTab): void;
  onBuyChest(tier: ChestTier): void; onOpenChest(tier: ChestTier): void;
  onBuyBonus(id: BonusId, currency: 'rare' | 'coins'): void; onBuyProduct(id: string): void;
  onBuyTheme(id: string, currency: 'rare' | 'coins'): void; onApplyTheme(id: string): void;
}

export function buildShop(c: ShopCtx): HTMLElement {
  const s = el('div', 'screen panel');
  const head = header(t('shop'), c.onBack);
  head.lastElementChild!.replaceWith(el('div', 'pill', `${COIN} ${c.save.coins} &nbsp; ${GEM} ${c.save.rare}`));
  s.append(head);
  const tabs = el('div', 'tabs');
  for (const tab of SHOP_TABS) {
    const b = el('button', `tab${tab === c.tab ? ' on' : ''}`, t(`tab.${tab}`));
    b.addEventListener('click', () => c.onTab(tab)); tabs.append(b);
  }
  s.append(tabs);
  const list = el('div', 'shop-list');
  const card = (icon: string, title: string, sub: string, actions: HTMLElement[]): HTMLElement => {
    const d = el('div', 'shop-card');
    const info = el('div', 'shop-info'); info.append(el('div', 'shop-title', title), el('div', 'shop-sub', sub));
    const act = el('div', 'shop-actions'); act.append(...actions);
    d.append(el('div', 'shop-icon', icon), info, act);
    return d;
  };
  const btn = (label: string, fn: () => void, enabled = true, cls = 'btn mini'): HTMLButtonElement => {
    const b = button(label, fn, cls); if (!enabled) { b.disabled = true; b.classList.add('off'); } return b;
  };

  if (c.tab === 'chests') {
    for (const tier of CHEST_TIERS) {
      const owned = c.save.chests[tier];
      list.append(card(chestIcon(tier, 60), t(`chest.${tier}`), `${t('itemsInChest')}: ${CHESTS[tier].rolls} · ${t('owned')}: ${owned}`, [
        btn(owned > 0 ? `${t('open')} (${owned})` : t('odds'), () => c.onOpenChest(tier), true, owned > 0 ? 'btn mini green' : 'btn mini ghost'),
        btn(`${GEM} ${CHESTS[tier].priceRare}`, () => c.onBuyChest(tier), c.save.rare >= CHESTS[tier].priceRare),
      ]));
    }
  } else if (c.tab === 'bonuses') {
    for (const id of ['undo', 'hint', 'extraBottle'] as const) {
      const acts = [btn(`${GEM} ${BALANCE.bonuses[id].priceRare}`, () => c.onBuyBonus(id, 'rare'), c.save.rare >= BALANCE.bonuses[id].priceRare)];
      const coin = COIN_PRICES[id];
      if (coin !== undefined) acts.push(btn(`${COIN} ${coin}`, () => c.onBuyBonus(id, 'coins'), c.save.coins >= coin));
      list.append(card(`<span class="big-ico">${id === 'undo' ? '↶' : id === 'hint' ? '💡' : '🧪'}</span>`, bonusLabel(id), `${t('owned')}: ${c.save.bonuses[id]}`, acts));
    }
  } else if (c.tab === 'themes') {
    const lang = getLang();
    for (const th of THEMES) {
      const owned = c.save.themes.owned.includes(th.id), active = c.save.themes.active === th.id;
      const sw = `<div class="swatch" style="background:linear-gradient(180deg,${th.css.col1},${th.css.col2})">${th.palette.slice(0, 6).map((h) => `<i style="background:${h}"></i>`).join('')}</div>`;
      const acts: HTMLElement[] = owned
        ? [btn(active ? `✓ ${t('selected')}` : t('apply'), () => c.onApplyTheme(th.id), !active, active ? 'btn mini ghost' : 'btn mini green')]
        : [btn(`${GEM} ${th.priceRare}`, () => c.onBuyTheme(th.id, 'rare'), c.save.rare >= th.priceRare), btn(`${COIN} ${th.priceCoins}`, () => c.onBuyTheme(th.id, 'coins'), c.save.coins >= th.priceCoins)];
      list.append(card(sw, th.name[lang], th.desc[lang], acts));
    }
  } else {
    list.append(el('div', 'muted center', t('currencyHint')));
    if (c.catalog === null) list.append(el('div', 'soon-box', t('loadingShop')));
    else if (c.catalog.length === 0) list.append(el('div', 'soon-box', t('paymentsOff')));
    else {
      const lang = getLang();
      for (const p of PRODUCTS) {
        const price = c.catalog.find((i) => i.id === p.id)?.priceText;
        if (price === undefined) continue; // товара нет в консоли — не показываем
        const icon = p.rewards.some((r) => r.kind === 'chest') ? chestIcon((p.rewards.find((r) => r.kind === 'chest') as { tier: ChestTier }).tier, 60) : `<span class="big-ico">${GEM}</span>`;
        list.append(card(icon, p.title[lang], p.rewards.map(rewardLabel).join(' · '), [btn(price, () => c.onBuyProduct(p.id), true, 'btn mini green')]));
      }
    }
  }
  s.append(list);
  return s;
}

export function showStuck(root: HTMLElement, a: { onUndo(): void; onExtra(): void; onRestart(): void; outOfMoves?: boolean }): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', a.outOfMoves ? t('outOfMoves') : t('noMoves')), el('div', 'muted', a.outOfMoves ? t('outOfMovesHint') : t('stuckHint')),
      button(t('undo'), () => { close(); a.onUndo(); }, 'btn wide'),
      button(t('extra'), () => { close(); a.onExtra(); }, 'btn wide'),
      button(t('restart'), () => { close(); a.onRestart(); }, 'btn wide ghost'));
  });
}


// ------------------------------------------------------------------ ежедневная награда
const shortRewards = (rs: readonly Reward[]): string => rs.map(rewardLabel).join('<br>');

export function showDaily(root: HTMLElement, o: { status: DailyStatus; onClaim(): readonly Reward[] | null; onClose(): void }): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', t('dailyTitle')), el('div', 'muted', `${t('streak')}: ${o.status.canClaim ? o.status.streakAfter - 1 : o.status.streakAfter}`));
    const grid7 = el('div', 'daily-grid');
    const tiles: HTMLElement[] = DAILY_CYCLE.map((rs, i) => {
      const day = i + 1;
      const done = o.status.canClaim ? day < o.status.dayInCycle : day <= o.status.dayInCycle;
      const tile = el('div', `daily-tile${done ? ' claimed' : ''}${day === o.status.dayInCycle && o.status.canClaim ? ' current' : ''}${day === DAILY_CYCLE.length ? ' last' : ''}`);
      tile.innerHTML = `<b>${t('dayN')} ${day}</b><div class="daily-r">${shortRewards(rs)}</div><span class="tick">✓</span>`;
      return tile;
    });
    grid7.append(...tiles);
    const cards = el('div', 'reward-cards');
    const btn = button(o.status.canClaim ? t('claimReward') : t('comeBack'), () => {
      if (!o.status.canClaim) return;
      const got = o.onClaim();
      if (!got) return;
      tiles[o.status.dayInCycle - 1]!.classList.remove('current'); tiles[o.status.dayInCycle - 1]!.classList.add('claimed', 'just');
      got.forEach((r, i) => { const c = el('div', 'reward-card', rewardLabel(r)); c.style.animationDelay = `${i * 0.15}s`; cards.append(c); });
      btn.textContent = t('great'); o.status = { ...o.status, canClaim: false };
      btn.onclick = () => { close(); o.onClose(); };
    }, 'btn wide green');
    if (!o.status.canClaim) { btn.disabled = true; btn.classList.add('off'); }
    card.append(grid7, cards, btn, button(t('close'), () => { close(); o.onClose(); }, 'btn wide ghost'));
  });
}

// ------------------------------------------------------------------ событие дня
export function showEvent(root: HTMLElement, o: { ev: DailyEvent; moveLimit: number | null; done: boolean; onPlay(): void }): void {
  modal(root, (card, close) => {
    card.append(el('h2', '', t('eventTitle')));
    const cards = el('div', 'reward-cards');
    for (const r of o.ev.rewards) cards.append(el('div', 'reward-card', rewardLabel(r)));
    const info = el('div', 'odds');
    info.append(el('div', 'odds-row', `<span>${t('eventBottles')}</span><b>${o.ev.spec.colors + o.ev.spec.empties}</b>`),
      el('div', 'odds-row', `<span>${t('eventLimit')}</span><b>${o.moveLimit === null ? t('eventNoLimit') : o.moveLimit}</b>`));
    card.append(el('div', 'muted', t('rewardWord')), cards, info, el('div', 'muted', o.done ? t('eventDone') : t('eventHarder')));
    const play = button(t('play'), () => { close(); o.onPlay(); }, 'btn wide green');
    if (o.done) { play.disabled = true; play.classList.add('off'); }
    card.append(play, button(t('close'), close, 'btn wide ghost'));
  });
}

// ------------------------------------------------------------------ достижения
export function buildAchievements(c: { save: Save; onBack(): void }): HTMLElement {
  const s = el('div', 'screen panel');
  s.append(header(t('achievements'), c.onBack));
  const lang = getLang();
  const done = ACHIEVEMENTS.filter((a) => isAchUnlocked(c.save, a.id)).length;
  s.append(el('div', 'chapter-prog', `${done} / ${ACHIEVEMENTS.length}`));
  const list = el('div', 'shop-list');
  for (const a of ACHIEVEMENTS) {
    const ok = isAchUnlocked(c.save, a.id), p = Math.min(a.target, a.progress(c.save));
    const row = el('div', `shop-card ach${ok ? ' ok' : ''}`);
    row.innerHTML = `<div class="shop-icon"><span class="big-ico">${ok ? '🏆' : '🔒'}</span></div>
      <div class="shop-info"><div class="shop-title">${a.title[lang]}</div><div class="shop-sub">${a.desc[lang]}</div>
      <div class="bar-bg"><div class="bar-fg" style="width:${(p / a.target) * 100}%"></div></div>
      <div class="shop-sub">${ok ? t('achvDone') : `${p} / ${a.target}`} · ${a.reward.map(rewardLabel).join(', ')}</div></div>`;
    list.append(row);
  }
  s.append(list);
  return s;
}

// ------------------------------------------------------------------ рейтинг
export function buildLeaderboard(c: { entries: LeaderEntry[] | null | 'loading'; authorized: boolean; onBack(): void; onAuth(): void }): HTMLElement {
  const s = el('div', 'screen panel');
  s.append(header(t('lbTitle'), c.onBack));
  if (!c.authorized) { s.append(el('div', 'soon-box', t('lbSignIn')), button(t('lbSignInBtn'), c.onAuth, 'btn wide green')); }
  if (c.entries === 'loading') s.append(el('div', 'soon-box', t('loadingShop')));
  else if (c.entries === null) s.append(el('div', 'soon-box', t('lbUnavailable')));
  else if (c.entries.length === 0) s.append(el('div', 'soon-box', t('lbEmpty')));
  else {
    const list = el('div', 'lb-list');
    for (const e of c.entries) list.append(el('div', `lb-row${e.me ? ' me' : ''}`, `<span class="lb-rank">${e.rank}</span><span class="lb-name">${e.me ? t('lbMe') + ' · ' : ''}${e.name}</span><b>${e.score} ★</b>`));
    s.append(list);
  }
  return s;
}
