export type Ease = (t: number) => number;
export const linear: Ease = (t) => t;
export const easeInOut: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack: Ease = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

interface Job { t: number; d: number; fn: (k: number) => void; ease: Ease; done: () => void }

/** Крошечный твинер на промисах; обновляется из render-цикла. */
export class Tweens {
  private jobs: Job[] = [];

  run(duration: number, fn: (k: number) => void, ease: Ease = easeInOut): Promise<void> {
    return new Promise((resolve) => {
      if (duration <= 0) { fn(1); resolve(); return; }
      this.jobs.push({ t: 0, d: duration, fn, ease, done: resolve });
    });
  }

  wait(seconds: number): Promise<void> { return this.run(seconds, () => undefined, linear); }

  update(dt: number): void {
    const jobs = this.jobs;
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i]!;
      j.t += dt;
      const k = Math.min(1, j.t / j.d);
      j.fn(j.ease(k));
      if (k >= 1) { jobs.splice(i, 1); j.done(); }
    }
  }
}

export const easeOutBounce: Ease = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
  x -= 2.625 / d1; return n1 * x * x + 0.984375;
};
