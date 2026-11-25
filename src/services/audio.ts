/** Процедурный звук на WebAudio: ни одного аудиофайла в сборке. */
export class AudioService {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private sound = true;
  private music = true;
  private muted = false;
  private musicTimer: number | null = null;
  private nextNoteAt = 0;
  private step = 0;
  private style = { scale: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33], pad: [130.81, 146.83, 110, 98], wave: 'sine' as OscillatorType };

  /** Контекст можно создавать только после жеста пользователя. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
      // музыка: общий bus + «реверб» из обратной связи задержки
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.35; this.musicBus.connect(this.master);
      const delay = this.ctx.createDelay(1); delay.delayTime.value = 0.34;
      const fb = this.ctx.createGain(); fb.gain.value = 0.42;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      this.musicBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyGain();
    }
    void this.ctx.resume();
    this.syncMusic();
  }

  setSound(on: boolean): void { this.sound = on; this.applyGain(); }
  setMusic(on: boolean): void { this.music = on; this.syncMusic(); }
  /** Тембр и ноты фоновой музыки по теме. */
  setMusicStyle(style: { scale: number[]; pad: number[]; wave: OscillatorType }): void { this.style = style; }
  /** Полный mute: на время рекламы и когда вкладка скрыта. */
  setMuted(m: boolean): void {
    this.muted = m; this.applyGain();
    if (this.ctx) { if (m) void this.ctx.suspend(); else void this.ctx.resume(); }
  }

  private applyGain(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.sound ? 0.7 : 0;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, bus: GainNode = this.sfx): void {
    const c = this.ctx!; const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(at: number, dur: number, freq: number, q: number, gain: number, lfoHz = 0, lfoDepth = 0): void {
    const c = this.ctx!; const t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.08, dur / 3));
    g.gain.setValueAtTime(gain, t + Math.max(0.01, dur - 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    if (lfoHz > 0) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = lfoHz; lg.gain.value = lfoDepth; lfo.connect(lg); lg.connect(f.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    src.start(t); src.stop(t + dur + 0.05);
  }

  private ready(): boolean { return !!this.ctx && this.sound && !this.muted; }

  click(): void { if (this.ready()) this.tone(720, 0, 0.05, 'triangle', 0.14); }
  select(): void { if (this.ready()) { this.tone(520, 0, 0.07, 'sine', 0.16); this.tone(780, 0.04, 0.08, 'sine', 0.12); } }
  error(): void { if (this.ready()) this.tone(170, 0, 0.16, 'sawtooth', 0.1, 110); }
  /**
   * Вода: мягкий широкополосный «шшш» без резонанса + много коротких капельных «блюпов» (синус с быстрым подъёмом тона),
   * высота которых растёт по мере наполнения, и редкие низкие «глюки». Никакой модуляции фильтра — именно она давала «пилу».
   */
  pour(dur: number): void {
    if (!this.ready()) return;
    this.noise(0, dur, 1300, 0.35, 0.035);
    for (let t = 0.02; t < dur - 0.04; t += 0.016 + Math.random() * 0.03) {
      const prog = t / dur;
      const f = 430 + prog * 520 + Math.random() * 280;
      this.tone(f, t, 0.05 + Math.random() * 0.035, 'sine', 0.03 + Math.random() * 0.04, f * (1.45 + Math.random() * 0.5));
    }
    for (let t = 0.06; t < dur - 0.08; t += 0.12 + Math.random() * 0.1) {
      const f = 150 + (t / dur) * 130 + Math.random() * 60;
      this.tone(f, t, 0.1, 'sine', 0.07, f * 1.9);
    }
  }
  complete(): void { if (this.ready()) [1046, 1319, 1568].forEach((f, i) => this.tone(f, i * 0.07, 0.35, 'triangle', 0.13)); }
  win(): void {
    if (!this.ready()) return;
    [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone(f, i * 0.09, 0.5, 'triangle', 0.15));
    this.noise(0.1, 0.6, 5200, 1.2, 0.04);
  }
  bonus(): void { if (this.ready()) { this.tone(660, 0, 0.12, 'sine', 0.15); this.tone(990, 0.1, 0.2, 'sine', 0.15); } }

  // ---- музыка: спокойный генеративный амбиент (пентатоника + мягкие «подушки») ----
  private syncMusic(): void {
    if (!this.ctx) return;
    if (this.music && this.musicTimer === null) {
      this.nextNoteAt = this.ctx.currentTime + 0.2;
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 250);
    } else if (!this.music && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer); this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const c = this.ctx!;
    if (this.muted) return;
    const penta = this.style.scale;
    while (this.nextNoteAt < c.currentTime + 0.6) {
      const at = this.nextNoteAt - c.currentTime;
      if (this.step % 8 === 0) { // «подушка»: два расстроенных треугольника
        const root = this.style.pad[Math.floor(this.step / 8) % this.style.pad.length]!;
        this.tone(root, at, 3.6, 'triangle', 0.09, undefined, this.musicBus);
        this.tone(root * 1.5 * 1.004, at, 3.6, 'sine', 0.06, undefined, this.musicBus);
      }
      if (Math.random() < 0.7) this.tone(penta[Math.floor(Math.random() * penta.length)]!, at, 1.3, this.style.wave, 0.07, undefined, this.musicBus);
      this.step++; this.nextNoteAt += 0.5;
    }
  }
}
