import { ANALYTICS } from '../config/analytics';

export interface AnalyticsEvent { name: string; t: number; data?: Record<string, string | number | boolean> }
export interface LevelStat { starts: number; wins: number; quits: number; stuck: number; moves: number; best: number }

const EV_KEY = 'bottles.analytics.events';
const LV_KEY = 'bottles.analytics.levels';

/** Лёгкая аналитика: кольцевой буфер событий + статистика по уровням (где бросают и где застревают). */
export class Analytics {
  private events: AnalyticsEvent[] = [];
  private levels: Record<string, LevelStat> = {};
  debug = false;

  constructor() {
    try { this.events = JSON.parse(localStorage.getItem(EV_KEY) ?? '[]'); this.levels = JSON.parse(localStorage.getItem(LV_KEY) ?? '{}'); } catch { /* ignore */ }
  }

  track(name: string, data?: Record<string, string | number | boolean>): void {
    const ev: AnalyticsEvent = { name, t: Date.now(), ...(data ? { data } : {}) };
    this.events.push(ev);
    if (this.events.length > ANALYTICS.maxBuffered) this.events.splice(0, this.events.length - ANALYTICS.maxBuffered);
    const id = typeof data?.id === 'string' ? data.id : null;
    if (id && name.startsWith('level_')) this.bump(id, name, data);
    this.persist();
    const ym = (window as unknown as { ym?: (id: number, method: string, goal: string, params?: unknown) => void }).ym;
    if (ANALYTICS.metricaId && typeof ym === 'function') ym(ANALYTICS.metricaId, 'reachGoal', name, data);
    if (this.debug) console.debug('[analytics]', name, data ?? '');
  }

  private bump(id: string, name: string, data?: Record<string, string | number | boolean>): void {
    const s = (this.levels[id] ??= { starts: 0, wins: 0, quits: 0, stuck: 0, moves: 0, best: 0 });
    const moves = typeof data?.moves === 'number' ? data.moves : 0;
    if (name === 'level_start') s.starts++;
    else if (name === 'level_win') { s.wins++; s.moves += moves; s.best = s.best === 0 ? moves : Math.min(s.best, moves); }
    else if (name === 'level_quit') s.quits++;
    else if (name === 'level_stuck') s.stuck++;
  }

  private persist(): void {
    try { localStorage.setItem(EV_KEY, JSON.stringify(this.events)); localStorage.setItem(LV_KEY, JSON.stringify(this.levels)); } catch { /* ignore */ }
  }

  levelStats(): Record<string, LevelStat> { return this.levels; }
  recent(n = 50): AnalyticsEvent[] { return this.events.slice(-n); }
}
