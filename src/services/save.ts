import { defaultSave, mergeSaves, migrate, type Save } from '../core/save';
import type { GameSdk } from './yandexSdk';

const LS_KEY = 'bottles.save.v1';
const CLOUD_LAZY_MS = 25_000;   // обычные изменения: облако не чаще, чем раз в ~25 с
const CLOUD_URGENT_MS = 1_500;  // важные (награды, покупки, конец уровня): почти сразу
const CLOUD_MIN_GAP_MS = 1_100; // не чаще раза в секунду — лимит setData у Яндекса

/** 'local' — только localStorage (ход в уровне, часы); 'later' — облако через ~25 с; 'urgent' — облако через ~1.5 с. */
export type SaveMode = 'local' | 'later' | 'urgent';

/**
 * Сохранения. localStorage пишется на каждое изменение (это дёшево), а облако Яндекса — редко и пачками:
 * изменения накапливаются и уходят одним запросом; перед сворачиванием/закрытием — принудительно.
 */
export class SaveManager {
  data: Save = defaultSave();
  private timer: number | null = null;
  private due = 0;
  private dirty = false;
  private lastCloud = 0;

  constructor(private readonly sdk: GameSdk) {}

  async load(): Promise<void> {
    let local: Save = defaultSave();
    try { const raw = localStorage.getItem(LS_KEY); if (raw) local = migrate(JSON.parse(raw)); } catch { /* ignore */ }
    let cloud: Save = defaultSave();
    try { const raw = await this.sdk.loadData(); if (raw) cloud = migrate(raw); } catch { /* ignore */ }
    this.data = mergeSaves(local, cloud);
  }

  /** Изменить сохранение. */
  update(fn: (s: Save) => Save, mode: SaveMode = 'later'): void {
    this.data = { ...fn(this.data), updatedAt: Date.now() };
    this.writeLocal();
    if (mode === 'local') return;
    this.dirty = true;
    this.schedule(mode === 'urgent' ? CLOUD_URGENT_MS : CLOUD_LAZY_MS);
  }

  private writeLocal(): void { try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch { /* ignore */ } }

  private schedule(ms: number): void {
    const due = Date.now() + ms;
    if (this.timer !== null && this.due <= due) return; // уже запланировано раньше
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.due = due;
    this.timer = window.setTimeout(() => { this.timer = null; void this.flushCloud(); }, ms);
  }

  /** Принудительно записать всё сейчас (сворачивание, закрытие, покупки). */
  async flush(): Promise<void> {
    this.writeLocal();
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    this.dirty = true;
    await this.flushCloud();
  }

  private async flushCloud(): Promise<void> {
    if (!this.dirty) return;
    const wait = this.lastCloud + CLOUD_MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.dirty = false;
    this.lastCloud = Date.now();
    try { await this.sdk.saveData(this.data); } catch { this.dirty = true; this.schedule(CLOUD_LAZY_MS); }
  }
}
