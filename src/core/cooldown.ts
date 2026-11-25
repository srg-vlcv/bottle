/**
 * Кулдаун рекламного бонуса. Хранится абсолютным timestamp'ом. Защита от перевода часов назад:
 * эффективное время = max(последнее известное + монотонный прирост сессии, текущее/серверное время).
 */
export interface CooldownSave {
  nextAvailableAt: number; // ms epoch
  lastKnownTime: number; // ms epoch
}

export interface ClockSources {
  /** Серверное время, если есть, иначе Date.now(). */
  wall(): number;
  /** Монотонные часы (performance.now). */
  mono(): number;
}

export class CooldownClock {
  private lastKnown: number;
  private monoMark: number;
  nextAvailableAt: number;

  constructor(private readonly src: ClockSources, save: CooldownSave) {
    this.lastKnown = save.lastKnownTime;
    this.nextAvailableAt = save.nextAvailableAt;
    this.monoMark = src.mono();
  }

  /** Эффективное «сейчас»: не идёт назад даже при переводе системных часов. */
  now(): number {
    const m = this.src.mono();
    const advanced = this.lastKnown + Math.max(0, m - this.monoMark);
    this.monoMark = m;
    this.lastKnown = Math.max(advanced, this.src.wall());
    return this.lastKnown;
  }

  remainingMs(): number { return Math.max(0, this.nextAvailableAt - this.now()); }
  ready(): boolean { return this.remainingMs() === 0; }

  /** Вызывать ТОЛЬКО после успешного onRewarded. */
  start(cooldownMs: number): void { this.nextAvailableAt = this.now() + cooldownMs; }

  toSave(): CooldownSave { return { nextAvailableAt: this.nextAvailableAt, lastKnownTime: this.lastKnown }; }
}

export function formatMMSS(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
