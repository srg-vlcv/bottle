import { bakedLevel } from '../content/baked';
import { generateLevel, type GeneratedLevel } from '../core/generator';
import { deadlockState, hint } from '../core/solver';
import type { Board, LevelSpec, Move } from '../core/types';
import type { WorkerReq } from './levelWorker';

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Resolver = { resolve: (v: unknown) => void; reject: (e: unknown) => void; req: WorkerReq };

/** Один воркер + синхронный запасной вариант, если воркер недоступен. */
class Channel {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Resolver>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./levelWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown; error?: string }>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.value); else p.reject(new Error(e.data.error));
      };
      this.worker.onerror = () => { // воркер упал — досчитываем всё синхронно
        this.worker = null;
        for (const p of this.pending.values()) this.runSync(p.req).then(p.resolve, p.reject);
        this.pending.clear();
      };
    } catch { this.worker = null; }
  }

  private runSync(req: WorkerReq): Promise<unknown> {
    try {
      if (req.type === 'gen') return Promise.resolve(generateLevel(req.spec, req.seed, { minPar: req.minPar }));
      if (req.type === 'hint') return Promise.resolve(hint(req.board));
      return Promise.resolve(deadlockState(req.board));
    } catch (e) { return Promise.reject(e); }
  }

  call<T>(req: DistOmit<WorkerReq, 'id'>): Promise<T> {
    const full = { ...req, id: ++this.seq } as WorkerReq;
    if (!this.worker) return this.runSync(full) as Promise<T>;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(full.id, { resolve: resolve as (v: unknown) => void, reject, req: full });
      this.worker!.postMessage(full);
    });
  }
}

/** Генерация (с кэшем и предзагрузкой) и интерактивные запросы — в разных воркерах, чтобы подсказка не ждала генерацию. */
export class SolverService {
  private readonly gen = new Channel();
  private readonly live = new Channel();
  private readonly cache = new Map<string, Promise<GeneratedLevel>>();

  level(spec: LevelSpec, seed: string, minPar?: number): Promise<GeneratedLevel> {
    const baked = bakedLevel(spec, seed, minPar); // сюжетные уровни готовы заранее — без ожидания
    if (baked) return Promise.resolve(baked);
    let p = this.cache.get(seed);
    if (!p) {
      p = this.gen.call<GeneratedLevel>({ type: 'gen', spec, seed, minPar });
      p.catch(() => this.cache.delete(seed));
      this.cache.set(seed, p);
    }
    return p;
  }

  prefetch(spec: LevelSpec, seed: string, minPar?: number): void { void this.level(spec, seed, minPar).catch(() => undefined); }

  hint(board: Board): Promise<Move | null> { return this.live.call<Move | null>({ type: 'hint', board }); }

  deadlock(board: Board): Promise<'ok' | 'deadlock' | 'unknown'> { return this.live.call({ type: 'dead', board }); }
}
