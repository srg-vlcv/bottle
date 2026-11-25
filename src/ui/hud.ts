import { t } from '../services/i18n';
import { COIN, GEM, STAR_OFF, STAR_ON, el } from './dom';
import { ICON } from './icons';

export interface HudHandlers {
  undo(): void; hint(): void; extra(): void; restart(): void; ad(): void; pause(): void;
}

type BonusKey = 'undo' | 'hint' | 'extra';
interface BonusBtn { btn: HTMLElement; label: HTMLElement; cnt: HTMLElement; base: string }

/** DOM-HUD поверх canvas: верхняя панель (пауза, уровень/ходы, валюты), нижняя панель бонусов, подсказка, тосты. */
export class Hud {
  private readonly nodes: HTMLElement[] = [];
  private level = el('div', 'lv-title');
  private moves = el('div', 'lv-sub');
  private stars = el('div', 'lv-stars');
  private cur = el('div', 'pill');
  private tip = el('div', 'tip');
  private bonus = {} as Record<BonusKey, BonusBtn>;
  private adBtn = el('button', 'btn ad');
  private adLabel = el('span', '');
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement, h: HudHandlers) {
    const top = el('div', 'top');
    const pause = el('button', 'round', ICON.pause);
    pause.addEventListener('click', h.pause);
    const mid = el('div', 'pill mid'); mid.append(this.level, this.moves, this.stars);
    top.append(pause, mid, this.cur);

    const bar = el('div', 'bar');
    const mk = (key: BonusKey, ico: string, label: string, fn: () => void): HTMLElement => {
      const lab = el('span', '', label), cnt = el('span', 'cnt');
      const b = el('button', 'btn', `<span class="ico">${ico}</span>`);
      b.append(lab, cnt); b.addEventListener('click', fn);
      this.bonus[key] = { btn: b, label: lab, cnt, base: label };
      return b;
    };
    const restart = el('button', 'btn', `<span class="ico">${ICON.restart}</span><span>${t('restart')}</span>`);
    restart.addEventListener('click', h.restart);
    bar.append(mk('undo', ICON.undo, t('undo'), h.undo), mk('hint', ICON.hint, t('hint'), h.hint), mk('extra', ICON.flask, t('extra'), h.extra), restart);
    this.adBtn.innerHTML = `<span class="ico">${ICON.play}</span>`;
    this.adBtn.append(this.adLabel);
    this.adBtn.addEventListener('click', h.ad);
    bar.append(this.adBtn);
    this.tip.style.display = 'none';
    this.nodes.push(top, this.tip, bar);
    root.append(...this.nodes);
  }

  destroy(): void { for (const n of this.nodes) n.remove(); this.root.querySelector('.toast')?.remove(); }

  setLevel(label: string): void { this.level.textContent = label; }
  setMoves(n: number, limit?: number): void { this.moves.textContent = `${t('moves')}: ${n}${limit !== undefined ? ` / ${limit}` : ''}`; this.moves.classList.toggle('warn', limit !== undefined && limit - n <= 3); }
  setCurrencies(coins: number, rare: number): void { this.cur.innerHTML = `${COIN} ${coins} &nbsp; ${GEM} ${rare}`; }

  /** Запас бонуса; если он пуст и идёт восстановление — вместо названия показываем обратный отсчёт. */
  setBonus(key: BonusKey, count: number, regenText: string | null): void {
    const b = this.bonus[key];
    b.cnt.textContent = String(count);
    b.cnt.style.display = count > 0 ? '' : 'none';
    b.btn.classList.toggle('off', count === 0);
    b.label.textContent = count === 0 && regenText ? regenText : b.base;
  }

  /** Сколько звёзд игрок получил бы, закончив уровень сейчас (null — у уровня нет звёзд, например у события). */
  setStars(n: number | null): void { this.stars.innerHTML = n === null ? '' : STAR_ON.repeat(n) + STAR_OFF.repeat(3 - n); this.stars.style.display = n === null ? 'none' : ''; }

  setTip(text: string | null): void { this.tip.style.display = text ? 'block' : 'none'; this.tip.textContent = text ?? ''; }

  /** mmss = null → кнопка готова (пульсирует), иначе показываем обратный отсчёт. */
  setAdCooldown(mmss: string | null): void {
    this.adBtn.classList.toggle('cool', mmss !== null);
    this.adBtn.classList.toggle('ready', mmss === null);
    this.adLabel.innerHTML = mmss ?? `+1 ${ICON.flask.replace('width="26" height="26"', 'width="13" height="13"')}`;
  }

  toast(text: string, ms = 2200): void {
    this.root.querySelector('.toast')?.remove();
    const d = el('div', 'toast'); d.textContent = text; this.root.append(d);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => d.remove(), ms);
  }
}
