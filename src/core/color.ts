/** Различимость цветов: расстояние в CIELAB (ΔE76). Нужно, чтобы палитры тем оставались читаемыми. */
export function hexToLab(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const lin = (i: number): number => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const r = lin(0), g = lin(2), b = lin(4);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (v: number): number => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: string, b: string): number {
  const p = hexToLab(a), q = hexToLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Минимальное попарное расстояние в палитре. */
export function minPairDeltaE(palette: readonly string[]): number {
  let m = Infinity;
  for (let i = 0; i < palette.length; i++) for (let j = i + 1; j < palette.length; j++) m = Math.min(m, deltaE(palette[i]!, palette[j]!));
  return m;
}
