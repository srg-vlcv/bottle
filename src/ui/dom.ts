export const COIN = '<svg viewBox="0 0 20 20" width="16" height="16" style="vertical-align:-3px"><circle cx="10" cy="10" r="9" fill="#f7c948" stroke="#c28a14" stroke-width="2"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#c28a14" stroke-width="1.5"/></svg>';
export const GEM = '<svg viewBox="0 0 20 20" width="16" height="16" style="vertical-align:-3px"><polygon points="10,1 18,7 10,19 2,7" fill="#4fd1ff" stroke="#1b86b3" stroke-width="1.5"/><polyline points="2,7 18,7 10,19 2,7 6,7 10,1 14,7" fill="none" stroke="#1b86b3" stroke-width="1"/></svg>';
export const STAR_ON = '<svg viewBox="0 0 20 20" width="12" height="12"><polygon points="10,1 12.6,7.2 19,7.6 14,11.8 15.7,18.2 10,14.7 4.3,18.2 6,11.8 1,7.6 7.4,7.2" fill="#ffd54a" stroke="#c28a14" stroke-width="1"/></svg>';
export const STAR_OFF = '<svg viewBox="0 0 20 20" width="12" height="12"><polygon points="10,1 12.6,7.2 19,7.6 14,11.8 15.7,18.2 10,14.7 4.3,18.2 6,11.8 1,7.6 7.4,7.2" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.25)" stroke-width="1"/></svg>';

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e;
};

export function button(label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = el('button', cls, label);
  b.addEventListener('click', onClick);
  return b;
}

export const starsHtml = (n: number): string => STAR_ON.repeat(n) + STAR_OFF.repeat(3 - n);

/** Модальное окно поверх root; возвращает функцию закрытия. */
export function modal(root: HTMLElement, build: (card: HTMLElement, close: () => void) => void): () => void {
  const m = el('div', 'modal'); const card = el('div', 'card'); m.append(card);
  const close = (): void => m.remove();
  build(card, close);
  root.append(m);
  return close;
}
