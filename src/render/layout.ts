/**
 * Раскладка бутылок по рядам. Телефон (портрет): до 5 бутылок на полку. Широкий экран: перебираем число рядов
 * и берём то, при котором бутылки получаются крупнее всего (меньше всего «мира» помещается в кадр).
 */
export interface LayoutParams { spacing: number; rowGap: number; bottleH: number; elev: number }

export function viewHeightFor(rows: number, perRow: number, aspect: number, p: LayoutParams): number {
  const contentW = perRow * p.spacing + 0.8;
  const contentH = ((rows - 1) * p.rowGap + p.bottleH + 0.6) * Math.cos(p.elev) + Math.sin(p.elev);
  return Math.max(contentH / 0.8, contentW / aspect / 0.94); // 0.8 — доля высоты между панелями, 0.94 — доля ширины
}

export function chooseLayout(n: number, aspect: number, p: LayoutParams): [rows: number, perRow: number] {
  if (aspect < 0.85) {
    const rows = n <= 4 ? 1 : n <= 10 ? 2 : n <= 15 ? 3 : 4;
    return [rows, Math.ceil(n / rows)];
  }
  const maxPer = aspect < 1.3 ? 7 : 10;
  const minRows = Math.ceil(n / maxPer);
  let best: [number, number] = [minRows, Math.ceil(n / minRows)], bestH = Infinity;
  for (let r = minRows; r <= Math.min(n, 5); r++) {
    const per = Math.ceil(n / r);
    const h = viewHeightFor(r, per, aspect, p);
    if (h < bestH - 1e-6) { bestH = h; best = [r, per]; }
  }
  return best;
}
