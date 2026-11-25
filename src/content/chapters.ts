import type { LevelSpec } from '../core/types';

export type Mechanic = 'hiddenLayers' | 'mixedCapacity' | 'sealed';

export interface LevelDef {
  id: string; // 'ch1:l7'
  spec: LevelSpec;
  seed: string;
  /** Ключ i18n подсказки-обучения (рука-подсказка и т.п.). */
  tutorial?: string;
  boss?: boolean;
  minPar?: number;
}

export interface Chapter {
  id: number;
  titleKey: string;
  mechanics: Mechanic[];
  levels: LevelDef[];
  implemented: boolean; // false = шаблон-заглушка с рабочей генерацией
}

const CAP = 4;
const mk = (ch: number, n: number, colors: number, empties: number, extra: Partial<LevelDef> = {}): LevelDef => ({
  id: `ch${ch}:l${n}`,
  spec: { colors, empties, capacity: CAP },
  seed: `ch${ch}:l${n}`,
  ...extra,
});

/** Глава 1 «Первый день в лаборатории»: [цвета, пустые]. */
const CH1_TABLE: Array<[number, number, Partial<LevelDef>?]> = [
  [2, 2, { tutorial: 'tut.firstPour', minPar: 2 }],
  [2, 1, { minPar: 2 }],
  [3, 2],
  [3, 2, { tutorial: 'tut.undo' }],
  [3, 1],
  [4, 2, { tutorial: 'tut.hint' }],
  [4, 2],
  [4, 2, { tutorial: 'tut.extraBottle' }],
  [5, 2],
  [5, 2],
  [5, 2],
  [6, 2],
  [6, 2],
  [6, 2],
  [7, 2],
  [7, 2],
  [7, 2],
  [8, 2, { boss: true }],
];

const chapter1: Chapter = {
  id: 1,
  titleKey: 'chapter.1.title',
  mechanics: [],
  implemented: true,
  levels: CH1_TABLE.map(([c, e, x], i) => mk(1, i + 1, c, e, x ?? {})),
};

type Row2 = [colors: number, hidden: number, extra?: Partial<LevelDef>];
type Row3 = [caps: number[], extra?: Partial<LevelDef>];
type Row4 = [colors: number, empties: number, hidden: number, sealed: number, extra?: Partial<LevelDef>];

const spec = (o: Partial<LevelSpec> & { colors: number; empties: number }): LevelSpec => ({ capacity: CAP, ...o });
const levelOf = (ch: number, n: number, sp: LevelSpec, extra: Partial<LevelDef> = {}): LevelDef => ({ id: `ch${ch}:l${n}`, spec: sp, seed: `ch${ch}:l${n}`, ...extra });
const boss = (colors: number): Partial<LevelDef> => ({ boss: true, minPar: Math.floor(colors * 2.2) });

/** Глава 2 «Тайна наставника»: слои «?» — открываются, когда становятся верхними. */
const CH2: Row2[] = [
  [4, 1, { tutorial: 'tut.hidden' }], [4, 2], [4, 3], [5, 2], [5, 3], [5, 4], [5, 5],
  [6, 3], [6, 4], [6, 5], [6, 6], [7, 4], [7, 5], [7, 6], [7, 7], [8, 5], [8, 6], [8, 7], [8, 8], [9, 6, boss(9)],
];

/** Глава 3 «Запретные эссенции»: бутылки разной вместимости — каждый цвет должен лечь в «свою» по объёму. */
const CH3: Row3[] = [
  [[2, 3, 4], { tutorial: 'tut.mixed' }], [[2, 4, 4]], [[3, 3, 5]], [[2, 3, 4, 5]], [[3, 4, 4, 5]], [[2, 3, 5, 5]], [[2, 4, 5, 6]],
  [[3, 3, 4, 6]], [[2, 3, 4, 5, 6]], [[3, 4, 4, 5, 6]], [[2, 3, 3, 5, 6]], [[2, 3, 4, 5, 5, 6]], [[2, 3, 4, 4, 5, 6]],
  [[3, 3, 4, 5, 5, 6]], [[2, 3, 4, 5, 6, 6]], [[2, 3, 3, 4, 5, 6]], [[2, 2, 3, 3, 4, 4, 5]], [[2, 3, 3, 4, 5, 6, 6]],
  [[3, 3, 4, 4, 5, 5, 6]], [[2, 3, 3, 4, 5, 6, 6], boss(7)],
];

/** Глава 4 «Последний эксперимент»: запечатанные бутылки (+ слои «?»). */
const CH4: Row4[] = [
  [5, 2, 0, 1, { tutorial: 'tut.sealed' }], [5, 2, 0, 1], [5, 2, 2, 1], [6, 2, 0, 1], [6, 2, 2, 1], [6, 2, 0, 2], [6, 3, 2, 2],
  [7, 2, 0, 2], [7, 3, 3, 2], [7, 3, 0, 3], [7, 3, 3, 3], [8, 3, 0, 2], [8, 3, 4, 2], [8, 3, 2, 3], [8, 3, 4, 3], [8, 3, 0, 4],
  [8, 3, 3, 4], [9, 3, 0, 3], [9, 3, 4, 3], [9, 3, 5, 4], [9, 3, 6, 4], [9, 3, 5, 4, boss(9)],
];

const chapter2: Chapter = {
  id: 2, titleKey: 'chapter.2.title', mechanics: ['hiddenLayers'], implemented: true,
  levels: CH2.map(([colors, hidden, x], i) => levelOf(2, i + 1, spec({ colors, empties: 2, hidden }), x ?? {})),
};
const chapter3: Chapter = {
  id: 3, titleKey: 'chapter.3.title', mechanics: ['mixedCapacity'], implemented: true,
  levels: CH3.map(([caps, x], i) => levelOf(3, i + 1, spec({ colors: caps.length, empties: 2, caps, emptyCap: Math.max(...caps) }), x ?? {})),
};
const chapter4: Chapter = {
  id: 4, titleKey: 'chapter.4.title', mechanics: ['sealed', 'hiddenLayers'], implemented: true,
  levels: CH4.map(([colors, empties, hidden, sealed, x], i) => levelOf(4, i + 1, spec({ colors, empties, hidden, sealed }), x ?? {})),
};

export const CHAPTERS: Chapter[] = [chapter1, chapter2, chapter3, chapter4];
