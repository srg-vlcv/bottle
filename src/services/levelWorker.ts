/** Воркер: генерация уровней и тяжёлые вызовы солвера вне основного потока. */
import { generateLevel } from '../core/generator';
import { deadlockState, hint } from '../core/solver';
import type { Board, LevelSpec } from '../core/types';

export type WorkerReq =
  | { id: number; type: 'gen'; spec: LevelSpec; seed: string; minPar?: number }
  | { id: number; type: 'hint'; board: Board }
  | { id: number; type: 'dead'; board: Board };

const ctx = self as unknown as { onmessage: ((e: { data: WorkerReq }) => void) | null; postMessage(m: unknown): void };

ctx.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'gen') ctx.postMessage({ id: m.id, ok: true, value: generateLevel(m.spec, m.seed, { minPar: m.minPar }) });
    else if (m.type === 'hint') ctx.postMessage({ id: m.id, ok: true, value: hint(m.board) });
    else ctx.postMessage({ id: m.id, ok: true, value: deadlockState(m.board) });
  } catch (err) {
    ctx.postMessage({ id: m.id, ok: false, error: String(err) });
  }
};
