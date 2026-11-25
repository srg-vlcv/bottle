/** Вибрация на мобильных (где поддерживается). Выключается в настройках. */
export class Haptics {
  enabled = true;
  private v(p: number | number[]): void { if (!this.enabled) return; try { navigator.vibrate?.(p); } catch { /* не поддерживается */ } }
  select(): void { this.v(8); }
  error(): void { this.v([18, 40, 18]); }
  pour(): void { this.v(14); }
  complete(): void { this.v([22, 40, 22]); }
  win(): void { this.v([40, 60, 40, 60, 90]); }
  bonus(): void { this.v(16); }
}
