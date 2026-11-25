import type { Bottle } from './types';

/** Непрерывный блок жидкости для отрисовки. hidden — слой «?» (цвет игроку неизвестен). */
export interface Seg { color: number; amount: number; hidden?: boolean }

/** Бутылка -> блоки (amount в слоях, во время анимации может быть дробным). Скрытые слои не склеиваются. */
export function segmentsOf(b: Bottle): Seg[] {
  const out: Seg[] = [];
  const h = b.hidden ?? 0;
  b.layers.forEach((c, i) => {
    if (i < h) { out.push({ color: c, amount: 1, hidden: true }); return; }
    const last = out[out.length - 1];
    if (last && !last.hidden && last.color === c) last.amount += 1; else out.push({ color: c, amount: 1 });
  });
  return out;
}

/** Прибавить (delta>0) или убрать (delta<0) жидкость сверху; исходный массив не меняется. */
export function withDelta(segs: Seg[], color: number, delta: number): Seg[] {
  const out = segs.map((s) => ({ ...s }));
  if (delta >= 0) {
    const last = out[out.length - 1];
    if (last && !last.hidden && last.color === color) last.amount += delta; else if (delta > 0) out.push({ color, amount: delta });
  } else {
    let rem = -delta;
    while (rem > 1e-6 && out.length) {
      const last = out[out.length - 1]!;
      if (last.hidden) break; // скрытые слои при переливании не трогаем
      const take = Math.min(last.amount, rem);
      last.amount -= take; rem -= take;
      if (last.amount <= 1e-6) out.pop();
    }
  }
  return out;
}

export const totalAmount = (segs: Seg[]): number => segs.reduce((a, s) => a + s.amount, 0);
