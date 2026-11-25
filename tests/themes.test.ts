import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minPairDeltaE } from '../src/core/color';
import { THEMES, getTheme } from '../src/content/themes';

test('тем минимум 5, id уникальны, стартовая бесплатна, остальные платные', () => {
  assert.ok(THEMES.length >= 5);
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
  assert.equal(THEMES[0]!.priceRare + THEMES[0]!.priceCoins, 0);
  for (const t of THEMES.slice(1)) assert.ok(t.priceRare > 0 && t.priceCoins > 0, t.id);
  assert.equal(getTheme('nope').id, THEMES[0]!.id);
});

test('палитры: 12 цветов, все попарно различимы (ΔE ≥ 20)', () => {
  for (const t of THEMES) {
    assert.equal(t.palette.length, 12, t.id);
    assert.ok(minPairDeltaE(t.palette) >= 20, `${t.id}: ${minPairDeltaE(t.palette).toFixed(1)}`);
  }
});

test('у каждой темы есть тексты RU/EN, музыка и корректные цвета', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const t of THEMES) {
    assert.ok(t.name.ru && t.name.en && t.desc.ru && t.desc.en, t.id);
    assert.ok(t.music.scale.length >= 5 && t.music.pad.length >= 3, t.id);
    for (const c of [...t.palette, t.shelf, t.glassTint, t.bubble, ...Object.values(t.css), ...t.ambientColors]) assert.match(c, hex, `${t.id}: ${c}`);
    if (t.ambient !== 'none') assert.ok(t.ambientColors.length > 0, t.id);
  }
});
