/** Геометрия бутылки без зависимости от three: используется и игрой, и превью-рендером. */
export const MAX_SEGS = 10;

/** Размеры в мировых единицах. Низкая широкая бутылка с коротким горлышком и толстым закатанным ободком. */
export const B = {
  H: 2.95,          // центр ободка (pivot наклона)
  R: 0.52,          // внешний радиус корпуса
  NECK_R: 0.36,     // радиус горлышка
  BOTTOM: 0.16,     // уровень дна жидкости (толстое стеклянное дно)
  FILL_TOP: 2.12,   // верх жидкости в полной бутылке
  BODY_TOP: 2.2,    // конец прямой стенки (начало плеча)
} as const;
export const K = 0.9; // внутренний радиус / внешний (толщина стенки)
export const LIP_R = B.NECK_R + 0.04;
export const LIP_TUBE = 0.058;

/** Внешний профиль стекла, снизу вверх: [радиус, высота]. */
export const OUTER: Array<[number, number]> = [
  [0, 0], [0.3, 0], [0.46, 0.025], [0.515, 0.13], [0.52, 0.3], [0.52, B.BODY_TOP], [0.505, 2.34], [0.46, 2.46],
  [0.4, 2.56], [0.365, 2.66], [B.NECK_R, 2.74], [B.NECK_R, 2.86], [B.NECK_R + 0.012, 2.92],
];
/** Внутренний профиль (оболочка жидкости). */
export const INNER: Array<[number, number]> = [
  [0, B.BOTTOM], [0.27, B.BOTTOM], [0.41, 0.18], [0.462, 0.26], [0.468, 0.34], [0.468, B.BODY_TOP], [0.455, 2.33], [0.415, 2.45], [0.36, 2.55],
];

/** Сплайн Catmull-Rom (те же формулы, что у three.SplineCurve) — одинаковая форма в игре и в превью. */
export function smoothProfile(pts: Array<[number, number]>, divisions = 80): Array<[number, number]> {
  const cr = (t: number, p0: number, p1: number, p2: number, p3: number): number => {
    const v0 = (p2 - p0) * 0.5, v1 = (p3 - p1) * 0.5, t2 = t * t, t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
  };
  const out: Array<[number, number]> = [];
  const n = pts.length;
  for (let d = 0; d <= divisions; d++) {
    const p = (n - 1) * (d / divisions);
    const i = Math.floor(p), w = p - i;
    const a = pts[i === 0 ? i : i - 1]!, b = pts[i]!, c = pts[Math.min(i + 1, n - 1)]!, e = pts[Math.min(i + 2, n - 1)]!;
    out.push([Math.max(0, cr(w, a[0], b[0], c[0], e[0])), cr(w, a[1], b[1], c[1], e[1])]);
  }
  return out;
}

/** GLSL-функция радиуса внутренней стенки по высоте (кусочно-линейная по INNER) — для обрезки поверхности жидкости. */
export function innerRadiusGlsl(): string {
  const f = (v: number): string => v.toFixed(4);
  let body = '';
  for (let i = 1; i < INNER.length - 1; i++) {
    const [r0, y0] = INNER[i]!, [r1, y1] = INNER[i + 1]!;
    body += `  if (y < ${f(y1)}) return mix(${f(r0)}, ${f(r1)}, clamp((y - ${f(y0)}) / ${f(y1 - y0)}, 0.0, 1.0));\n`;
  }
  return `float innerR(float y){\n${body}  return ${f(INNER[INNER.length - 1]![0])};\n}`;
}
export const INNER_TOP_Y = INNER[INNER.length - 1]![1];
