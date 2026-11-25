// npm run bake: заранее генерирует все сюжетные уровни и записывает их в src/content/baked.ts.
// Игроку не приходится ждать генерации, а разрешимость и «par» проверены на этапе сборки.
import { writeFileSync } from 'node:fs';
import { CHAPTERS } from '../src/content/chapters';
import { bakedKey, generateLevel, type GeneratedLevel } from '../src/core/generator';

const out: Record<string, { key: string; level: GeneratedLevel }> = {};
let n = 0;
const t0 = Date.now();
for (const ch of CHAPTERS) {
  for (const lv of ch.levels) {
    out[lv.seed] = { key: bakedKey(lv.spec, lv.minPar), level: generateLevel(lv.spec, lv.seed, { minPar: lv.minPar }) };
    n++;
  }
  console.log(`chapter ${ch.id}: ${ch.levels.length} levels`);
}
const src = `// АВТОГЕНЕРАЦИЯ. Запустите \`npm run bake\`, когда меняете уровни глав или генератор.
import { bakedKey, type GeneratedLevel } from '../core/generator';
import type { LevelSpec } from '../core/types';

export const BAKED: Record<string, { key: string; level: GeneratedLevel }> = ${JSON.stringify(out)};

/** Запечённая копия уровня, если она актуальна (совпадает версия генератора и параметры). */
export function bakedLevel(spec: LevelSpec, seed: string, minPar?: number): GeneratedLevel | null {
  const e = BAKED[seed];
  return e && e.key === bakedKey(spec, minPar) ? e.level : null;
}
`;
writeFileSync(new URL('../src/content/baked.ts', import.meta.url), src);
console.log(`baked ${n} levels in ${Math.round((Date.now() - t0) / 1000)}s`);
