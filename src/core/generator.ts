import type { Board, Bottle, Color, LevelSpec } from './types';
import { createRng, shuffle } from './rng';
import { isComplete } from './rules';
import { solve } from './solver';

/** Версия алгоритма генерации: меняйте при любых правках генератора — запечённые уровни (content/baked.ts) станут «устаревшими». */
export const GENERATOR_VERSION = 2;

/** Ключ запечённого уровня: версия + параметры. Если параметры уровня изменились, запечённая копия игнорируется. */
export const bakedKey = (spec: LevelSpec, minPar?: number): string => JSON.stringify([GENERATOR_VERSION, spec, minPar ?? null]);

export interface GeneratedLevel {
  board: Board;
  /** Длина найденного решения (оптимального, если хватило лимита, иначе приближённого). */
  par: number;
  parIsOptimal: boolean;
  attempt: number;
}

export interface GenOptions {
  minPar?: number;
  maxAttempts?: number;
  checkNodes?: number;
  parNodes?: number;
}

/**
 * Детерминированно по seed: случайная раскладка -> обязательная проверка солвером.
 * Неразрешимые/слишком лёгкие раскладки отбрасываются, следующая попытка берёт производный seed.
 * Поддерживает: разную вместимость (spec.caps), скрытые слои «?» (spec.hidden), запечатанные бутылки (spec.sealed).
 */
export function generateLevel(spec: LevelSpec, seed: string, opts: GenOptions = {}): GeneratedLevel {
  const caps = spec.caps ?? Array<number>(spec.colors).fill(spec.capacity);
  const colors = caps.length;
  const emptyCap = spec.emptyCap ?? Math.max(...caps);
  const sealedCount = spec.sealed ?? 0;
  const minPar = opts.minPar ?? Math.max(2, colors);
  const maxAttempts = opts.maxAttempts ?? (sealedCount > 0 ? 200 : 60);
  const checkNodes = opts.checkNodes ?? (sealedCount > 0 ? 120_000 : 30_000);
  const parNodes = opts.parNodes ?? 40_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRng(`${seed}#${attempt}`);
    const units: Color[] = [];
    for (let c = 0; c < colors; c++) for (let k = 0; k < caps[c]!; k++) units.push(c);
    shuffle(units, rng);

    // бутылки с цветом: вместимость j-й = caps[j]; пустые — emptyCap
    const bottles: Bottle[] = [];
    let pos = 0;
    for (let j = 0; j < colors; j++) { bottles.push({ cap: caps[j]!, layers: units.slice(pos, pos + caps[j]!) }); pos += caps[j]!; }
    for (let e = 0; e < spec.empties; e++) bottles.push({ cap: emptyCap, layers: [] });

    // Уже собранные бутылки в стартовой раскладке — слишком просто.
    if (colors >= 3 && bottles.some((b) => b.layers.length > 0 && isComplete(b))) continue;

    // «?»: у выбранных бутылок скрыты все слои, кроме верхнего
    const order = shuffle(Array.from({ length: colors }, (_, i) => i), rng);
    for (const i of order.slice(0, Math.min(spec.hidden ?? 0, colors))) bottles[i] = { ...bottles[i]!, hidden: bottles[i]!.layers.length - 1 };

    // печати: запечатанные бутылки открываются, когда собрана бутылка-ключ (ключ — незапечатанная)
    if (sealedCount > 0) {
      const sealedIdx = order.slice(0, sealedCount);
      const keys = order.slice(sealedCount);
      if (keys.length === 0) continue;
      for (const i of sealedIdx) bottles[i] = { ...bottles[i]!, locked: true, lockedBy: keys[Math.floor(rng() * keys.length)]! };
    }
    const board: Board = { bottles };

    const quick = solve(board, { weight: 3, maxNodes: checkNodes });
    if (quick.status !== 'solved') continue;

    const exact = solve(board, { weight: 1, maxNodes: parNodes });
    const par = exact.status === 'solved' ? exact.moves.length : quick.moves.length;
    if (par < minPar) continue;
    return { board, par, parIsOptimal: exact.status === 'solved', attempt };
  }
  throw new Error(`generateLevel: не удалось сгенерировать уровень для seed=${seed}`);
}

/** Звёзды по числу ходов относительно par. Пороги — в config. */
export function starsFor(moves: number, par: number, three: number, two: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(par * three)) return 3;
  if (moves <= Math.ceil(par * two)) return 2;
  return 1;
}
