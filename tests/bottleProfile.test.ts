import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, INNER, INNER_TOP_Y, OUTER, innerRadiusGlsl, smoothProfile } from '../src/render/bottleProfile';

/** Радиус профиля на высоте y (линейная интерполяция по сглаженному профилю). */
const radiusAt = (pts: Array<[number, number]>, y: number): number => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i]!, [r1, y1] = pts[i + 1]!;
    if (y >= y0 && y <= y1) return y1 === y0 ? r0 : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return NaN;
};

test('профили идут снизу вверх, радиусы неотрицательны, сглаживание не выходит за разумные пределы', () => {
  for (const prof of [OUTER, INNER]) {
    for (let i = 1; i < prof.length; i++) assert.ok(prof[i]![1] >= prof[i - 1]![1], 'высота не убывает');
    const sm = smoothProfile(prof);
    assert.ok(sm.every(([r]) => r >= 0 && r <= B.R + 0.03), 'радиус в пределах бутылки');
    assert.ok(sm.every(([, y]) => y >= -0.01 && y <= B.H + 0.05));
  }
});

test('жидкость везде внутри стекла (оболочка жидкости не пробивает стенку)', () => {
  const outer = smoothProfile(OUTER, 400), inner = smoothProfile(INNER, 400);
  for (let y = B.BOTTOM + 0.02; y < INNER_TOP_Y - 0.01; y += 0.02) {
    const ro = radiusAt(outer, y), ri = radiusAt(inner, y);
    if (Number.isNaN(ro) || Number.isNaN(ri)) continue;
    assert.ok(ri < ro - 0.01, `y=${y.toFixed(2)}: внутри ${ri.toFixed(3)} >= снаружи ${ro.toFixed(3)}`);
  }
});

test('полная бутылка (4 слоя) помещается в прямую часть стенки; ободок выше жидкости', () => {
  assert.ok(B.FILL_TOP <= B.BODY_TOP, 'жидкость не заходит на плечо');
  assert.ok(B.H > INNER_TOP_Y);
  assert.ok(B.NECK_R < B.R);
  assert.ok((B.FILL_TOP - B.BOTTOM) / 4 > 0.3, 'слой не слишком тонкий');
});

test('GLSL-таблица радиуса генерируется и покрывает весь внутренний профиль', () => {
  const g = innerRadiusGlsl();
  assert.match(g, /float innerR\(float y\)/);
  assert.equal((g.match(/if \(y </g) ?? []).length, INNER.length - 2);
});
