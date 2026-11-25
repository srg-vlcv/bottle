import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, DoubleSide, Mesh, MeshBasicMaterial, ShaderMaterial, OrthographicCamera, PlaneGeometry, Raycaster, RingGeometry,
  Scene, SRGBColorSpace, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { Board, Move } from '../core/types';
import { isComplete } from '../core/rules';
import { segmentsOf, totalAmount, withDelta } from '../core/segments';
import type { Theme } from '../content/themes/types';
import { easeInOut, easeOutBack, easeOutBounce, linear, Tweens } from './anim';
import { B, BottleView } from './bottleView';
import { SHELF_FS, SHELF_VS } from './shaders';
import { HAND_H, HAND_TIP, HAND_W, drawHand } from './handArt';
import { chooseLayout } from './layout';
import { LOCK_H, LOCK_W, drawLock } from './lockArt';
import { Particles, PK } from './particles';
import { Stream } from './stream';

const SPACING = 1.32;
const ROW_GAP = 3.55;
const LIFT = 0.4;
/** Бутылка при переливании выходит на передний план, чтобы не пересекаться с соседями. */
const FRONT_Z = 1.6; // горлышко + радиус ободка (0.4) должны быть впереди передней грани полки (z=0.6): 1.6 − 0.4 > 0.6
/** Камера чуть сверху — видны поверхность жидкости, горлышки и верх полок. */
const ELEV = 0.26;
/** Объект в плоскости z=FRONT_Z кажется ниже на FRONT_Z·tan(ELEV): компенсируем по высоте. */
const ZC = Math.tan(ELEV);

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

function shadowTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
}

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
}

/** Маркер подсказки: капля с номером хода (1 — откуда, 2 — куда). */
function markerTexture(num: string, fill: string): CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const g = c.getContext('2d')!;
  g.beginPath(); g.moveTo(64, 156); g.lineTo(26, 92); g.arc(64, 62, 46, Math.PI * 0.8, Math.PI * 0.2, false); g.closePath();
  g.fillStyle = fill; g.fill(); g.lineWidth = 7; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 60px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(num, 64, 64);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
}

/** Рука-указатель для обучения (рисунок — в handArt.ts). */
function handTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = HAND_W; c.height = HAND_H;
  drawHand(c.getContext('2d')!);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
}

/** Замок для запечатанных бутылок (рисунок — в lockArt.ts). */
function lockTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = LOCK_W; c.height = LOCK_H;
  drawLock(c.getContext('2d')!);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
}

/** Угол наклона бутылки при переливании: чем меньше жидкости, тем сильнее наклон. */
const pourAngle = (fill01: number): number => 0.75 + 0.35 * (1 - Math.min(1, Math.max(0, fill01)));

const lighten = (c: Color, k: number): Color => c.clone().lerp(new Color(1, 1, 1), k);

export interface PourHooks { onStream?: (durationSec: number) => void }

export class GameScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly tweens = new Tweens();
  private readonly raycaster = new Raycaster();
  private readonly stream = new Stream();
  private readonly particles = new Particles();
  private readonly shadowTex = shadowTexture();
  private readonly glowTex = glowTexture();
  private readonly causticGeo = new PlaneGeometry(1.7, 1.0);
  private causticMats: MeshBasicMaterial[] = [];
  private idleShine = 4;
  private readonly handTex = handTexture();
  private readonly lockTex = lockTexture();
  private lockSprites: Array<Sprite | null> = [];
  private pointer: Sprite | null = null;
  private pointerToken = 0;
  private readonly shadowGeo = new PlaneGeometry(1.75, 1.3);
  private readonly shelfGeo = new BoxGeometry(1, 0.16, 1);
  private shelfMat: ShaderMaterial;
  private readonly hintTex = [markerTexture('1', '#ff8a1f'), markerTexture('2', '#2fb463')];
  private views: BottleView[] = [];
  private props: Mesh[] = [];
  private shadowMats: MeshBasicMaterial[] = [];
  private rest: Vector3[] = [];
  private hint: { sprites: Sprite[]; ids: number[] } | null = null;
  private palette: Color[] = [];
  private theme: Theme;
  private current: Board | null = null;
  private readonly ambient = new Particles(280, { depthTest: true, renderOrder: -5 });
  private ambientColors: Color[] = [];
  private ambAcc = 0;
  private rows = 1;
  private perRow = 1;
  private shift = 0;
  private shiftX = 0;
  private relayoutPending = false;
  private readonly target = new Vector3();
  private colorblind = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  private frames = 0;
  private frameAcc = 0;
  private dprCap: number;
  private readonly ro: ResizeObserver;
  private lastTapAt = 0;
  busy = false;

  constructor(private readonly container: HTMLElement, theme: Theme, private readonly onTap: (i: number) => void) {
    this.theme = theme;
    this.palette = theme.palette.map((h) => new Color(h));
    this.shelfMat = this.makeShelfMat(theme);
    this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.stream.mesh, this.particles.points, this.ambient.points);
    this.setAmbient(theme);

    this.renderer.domElement.addEventListener('pointerdown', this.onPointer);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private makeShelfMat(theme: Theme): ShaderMaterial {
    return new ShaderMaterial({ vertexShader: SHELF_VS, fragmentShader: SHELF_FS, uniforms: { uColor: { value: new Color(theme.shelf) } } });
  }

  private setAmbient(theme: Theme): void {
    this.ambientColors = theme.ambientColors.map((h) => new Color(h));
    this.ambAcc = 0;
  }

  /** Смена темы: палитра, стекло, полки, пузырьки, фоновые частицы. Бутылки пересобираются из текущей доски. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.palette = theme.palette.map((h) => new Color(h));
    this.shelfMat.dispose();
    this.shelfMat = this.makeShelfMat(theme);
    this.setAmbient(theme);
    if (this.current) this.setBoard(this.current);
  }

  /** Фоновые частицы за бутылками (снег / пузыри / листья / искры): рождаются у края экрана и плывут через него. */
  private emitAmbient(dt: number): void {
    const kind = this.theme.ambient;
    if (kind === 'none' || this.ambientColors.length === 0) return;
    const rate = kind === 'snow' ? 14 : kind === 'embers' ? 9 : kind === 'bubbles' ? 7 : 4;
    this.ambAcc += dt * rate;
    const halfW = this.camera.right * 1.05;
    const top = this.target.y + (this.camera.top * 1.05) / Math.cos(ELEV), bottom = this.target.y + (this.camera.bottom * 1.05) / Math.cos(ELEV);
    while (this.ambAcc >= 1) {
      this.ambAcc -= 1;
      const c = this.ambientColors[Math.floor(Math.random() * this.ambientColors.length)]!;
      const x = this.target.x + rnd(-halfW, halfW), z = -3;
      if (kind === 'snow') this.ambient.emit(PK.Soft, x, top, z, rnd(-0.35, 0.35), rnd(-1.1, -0.45), c, rnd(0.07, 0.17), rnd(9, 13), 0, 0, 0);
      else if (kind === 'leaves') this.ambient.emit(PK.Confetti, x, top, z, rnd(-0.5, 0.5), rnd(-1.0, -0.5), c, rnd(0.22, 0.34), rnd(10, 14), 0, 0, rnd(-2.2, 2.2));
      else if (kind === 'bubbles') this.ambient.emit(PK.Bubble, x, bottom, z, rnd(-0.15, 0.15), rnd(0.5, 1.1), c, rnd(0.12, 0.34), rnd(9, 13), 0, 0, 0);
      else this.ambient.emit(PK.Sparkle, x, bottom + rnd(0, 2), z, rnd(-0.25, 0.25), rnd(0.5, 1.2), c, rnd(0.1, 0.22), rnd(4, 7), 0, 0, 0);
    }
  }

  /** Соотношение сторон контейнера (ширина / высота). */
  get aspect(): number { return Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight); }

  /**
   * Раскладка по рядам. Портрет (телефон) — до 5 бутылок на полку. Широкий экран (ПК) — перебираем число рядов
   * и берём то, при котором бутылки получаются крупнее всего.
   */
  private layoutFor(n: number): [number, number] {
    return chooseLayout(n, this.aspect, { spacing: SPACING, rowGap: ROW_GAP, bottleH: B.H, elev: ELEV });
  }

  // ---------- построение сцены ----------
  setBoard(board: Board): void {
    this.current = board;
    this.clearHint();
    for (const v of this.views) { this.scene.remove(v.root); v.dispose(); }
    for (const p of this.props) this.scene.remove(p);
    for (const m of this.shadowMats) m.dispose();
    for (const m of this.causticMats) m.dispose();
    for (const l of this.lockSprites) if (l) { this.scene.remove(l); l.material.dispose(); }
    this.lockSprites = [];
    this.views = []; this.props = []; this.rest = []; this.shadowMats = []; this.causticMats = [];
    const n = board.bottles.length;
    [this.rows, this.perRow] = this.layoutFor(n);

    for (let i = 0; i < n; i++) {
      const bt = board.bottles[i]!;
      const v = new BottleView(i, bt.cap, this.palette, this.theme.glassTint, this.theme.bubble);
      const row = Math.floor(i / this.perRow);
      const inRow = Math.min(this.perRow, n - row * this.perRow);
      const col = i - row * this.perRow;
      const p = new Vector3((col - (inRow - 1) / 2) * SPACING, -row * ROW_GAP, 0);
      this.rest.push(p);
      v.root.position.copy(p);
      v.setColorblind(this.colorblind);
      v.setSegments(segmentsOf(bt));
      v.cork.visible = isComplete(bt);
      this.scene.add(v.root);
      this.lockSprites.push(this.makeLock(bt.locked === true, v, p));
      this.views.push(v);

      // мягкая тень на верхней грани полки
      const mat = new MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false });
      const sh = new Mesh(this.shadowGeo, mat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(p.x + 0.12, p.y + 0.01, 0);
      this.scene.add(sh); this.props.push(sh); this.shadowMats.push(mat);

      // цветной отсвет на полке: свет, прошедший через жидкость (смещён по направлению света)
      const cm = new MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
      const cs = new Mesh(this.causticGeo, cm);
      cs.rotation.x = -Math.PI / 2; cs.position.set(p.x + 0.35, p.y + 0.014, 0.45);
      this.scene.add(cs); this.props.push(cs); this.causticMats.push(cm);
      this.updateCaustic(i, bt);
    }
    for (let r = 0; r < this.rows; r++) {
      const shelf = new Mesh(this.shelfGeo, this.shelfMat);
      shelf.scale.set(this.perRow * SPACING + 0.6, 1, 1.6);
      shelf.position.set(0, -r * ROW_GAP - 0.09, -0.2); // верх полки чуть ниже дна бутылок: без совпадающих плоскостей
      this.scene.add(shelf); this.props.push(shelf);
    }
    this.fit();
  }

  /** Печать: восковая пробка на горлышке + большой замок поверх бутылки. */
  private makeLock(locked: boolean, v: BottleView, p: Vector3): Sprite | null {
    v.setLocked(locked);
    if (!locked) return null;
    const sp = new Sprite(new SpriteMaterial({ map: this.lockTex, transparent: true, depthTest: false, opacity: 0.92 }));
    sp.scale.set(0.78, 0.9, 1); sp.position.set(p.x, p.y + B.H * 0.42, 0); sp.renderOrder = 18;
    this.scene.add(sp); return sp;
  }

  /** После отката/рестарта: печати в доске могли вернуться или исчезнуть. */
  private refreshLocks(board: Board): void {
    board.bottles.forEach((bt, i) => {
      const v = this.views[i]; const p = this.rest[i]; if (!v || !p) return;
      const old = this.lockSprites[i];
      if (old) { this.scene.remove(old); old.material.dispose(); }
      this.lockSprites[i] = this.makeLock(bt.locked === true, v, p);
      if (!bt.locked) v.cork.visible = isComplete(bt);
    });
  }

  /** Подсветить бутылку (например, ключ к печати) двумя пульсациями. */
  pulseBottle(i: number): void {
    const v = this.views[i]; if (!v) return;
    void this.tweens.run(1.2, (k) => { v.extraGlow = 0.5 * Math.max(0, Math.sin(k * Math.PI * 2)); if (k === 1) v.extraGlow = 0; }, linear);
  }

  /** Слой «?» открылся: вспышка и искры у поверхности. */
  private revealFx(i: number, color: Color): void {
    const v = this.views[i]; const p = this.rest[i]; if (!v || !p) return;
    void this.tweens.run(0.6, (k) => { v.glow = 0.5 * Math.sin(Math.PI * k); }, linear).then(() => { v.glow = 0; });
    const c = lighten(color, 0.5);
    for (let k = 0; k < 14; k++) this.particles.emit(PK.Sparkle, p.x + rnd(-0.35, 0.35), p.y + rnd(0.6, 1.9), 0, rnd(-0.5, 0.5), rnd(0.3, 1.3), c, rnd(0.18, 0.3), rnd(0.6, 1.1), 0.5, 0.4, 0);
  }

  /** Печать снята: восковая пробка подлетает и исчезает, расходится кольцо, летят искры. */
  private unlockFx(i: number): void {
    const v = this.views[i]; const p = this.rest[i]; if (!v || !p) return;
    const old = this.lockSprites[i];
    if (old) { this.lockSprites[i] = null; void this.tweens.run(0.5, (k) => { old.scale.set(0.78 * (1 + 0.5 * k), 0.9 * (1 + 0.5 * k), 1); old.material.opacity = 0.92 * (1 - k); old.position.y += 0.02; }, easeInOut).then(() => { this.scene.remove(old); old.material.dispose(); }); }
    void this.tweens.run(0.5, (k) => { v.cork.position.y = B.H + 1.6 * k; v.cork.rotation.z = k * 2.4; v.cork.scale.setScalar(1 - 0.6 * k); }, easeInOut).then(() => {
      v.cork.position.y = B.H; v.cork.rotation.z = 0; v.cork.scale.setScalar(1); v.setLocked(false); v.cork.visible = false;
    });
    this.ring(p.x, p.y + B.H * 0.5, new Color('#ff6b6b'));
    for (let k = 0; k < 18; k++) this.particles.emit(PK.Sparkle, p.x + rnd(-0.5, 0.5), p.y + rnd(0.3, B.H), 0, rnd(-1.2, 1.2), rnd(0.5, 2.2), new Color('#ffb4a8'), rnd(0.2, 0.34), rnd(0.8, 1.3), 1.5, 0.5, 0);
  }

  /** Цвет и сила отсвета зависят от нижнего слоя и степени заполнения бутылки. */
  private updateCaustic(i: number, bt: Board['bottles'][number]): void {
    const m = this.causticMats[i]; if (!m) return;
    const bottom = bt.layers[0];
    if (bottom === undefined) { m.opacity = 0; return; }
    m.color.copy(this.palette[bottom % this.palette.length]!);
    m.opacity = 0.18 + 0.3 * (bt.layers.length / bt.cap);
  }

  /** Мгновенно обновить жидкость по доске (после отмены/рестарта). */
  syncBoard(board: Board): void {
    this.current = board;
    this.clearHint();
    if (board.bottles.length !== this.views.length) { this.setBoard(board); return; }
    board.bottles.forEach((b, i) => {
      const v = this.views[i]!;
      v.setSegments(segmentsOf(b)); this.updateCaustic(i, b);
      v.cork.visible = isComplete(b);
      v.root.position.copy(this.rest[i]!); v.glow = 0;
    });
    this.refreshLocks(board);
  }

  setColorblind(on: boolean): void { this.colorblind = on; for (const v of this.views) v.setColorblind(on); }

  /** Сдвиг содержимого по вертикали (доля высоты экрана): в меню бутылки поднимаются выше кнопок. */
  setShift(frac: number, fracX = 0): void { this.shift = frac; this.shiftX = fracX; this.fit(); }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(this.dprCap);
    this.renderer.setSize(w, h, false);
    this.fit();
    this.relayoutIfNeeded();
  }

  private relayoutIfNeeded(): void {
    if (!this.current) return;
    const [r, p] = this.layoutFor(this.current.bottles.length);
    if (r === this.rows && p === this.perRow) { this.relayoutPending = false; return; }
    if (this.busy) { this.relayoutPending = true; return; } // не перестраиваем во время переливания
    this.setBoard(this.current);
  }

  private fit(): void {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const aspect = w / h;
    const contentW = this.perRow * SPACING + 0.8;
    const contentH = ((this.rows - 1) * ROW_GAP + B.H + 0.6) * Math.cos(ELEV) + 1.0 * Math.sin(ELEV);
    const viewH = Math.max(contentH / 0.8, contentW / aspect / 0.94); // 0.8 — доля высоты между верхней и нижней панелями
    const cy = -((this.rows - 1) * ROW_GAP) / 2 + B.H / 2;
    this.camera.left = (-viewH * aspect) / 2; this.camera.right = (viewH * aspect) / 2;
    this.camera.top = viewH / 2; this.camera.bottom = -viewH / 2;
    const target = this.target.set(-viewH * aspect * this.shiftX, cy - viewH * (0.02 + this.shift), 0);
    this.camera.position.set(target.x, target.y + 30 * Math.sin(ELEV), 30 * Math.cos(ELEV));
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.particles.setScale(this.renderer.domElement.height / viewH);
    this.ambient.setScale(this.renderer.domElement.height / viewH);
  }

  // ---------- ввод ----------
  private onPointer = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastTapAt < 120) return; // защита от двойного тапа
    this.lastTapAt = now;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.views.map((v) => v.hit), false);
    const idx = hits[0]?.object.userData.bottleIndex as number | undefined;
    if (idx !== undefined) this.onTap(idx);
  };

  // ---------- анимации ----------
  /** Положение бутылки: zk — доля выхода вперёд (0..1), lk — доля подъёма. Высота компенсирует наклон камеры (позиция на экране не «прыгает»). */
  private place(v: BottleView, r: Vector3, zk: number, lk: number): void {
    v.root.position.set(r.x, r.y + ZC * FRONT_Z * zk + LIFT * lk, FRONT_Z * zk);
  }

  /**
   * Выбранная бутылка выходит на передний план и поднимается. ВАЖНО: сначала вперёд, потом вверх — иначе горлышко
   * на пару кадров врезается в полку ряда выше (зубчатый обрез на стыке).
   */
  select(i: number): void {
    const v = this.views[i]; if (!v) return;
    const r = this.rest[i]!;
    void this.tweens.run(0.28, (k) => {
      this.place(v, r, easeInOut(Math.min(1, k / 0.45)), easeOutBack(Math.max(0, (k - 0.2) / 0.8)));
      v.glow = 0.22 * k;
    }, linear);
  }

  /** Возврат: сначала опускается, и только потом уходит назад (по тому же правилу). */
  deselect(i: number): Promise<void> {
    const v = this.views[i]; if (!v) return Promise.resolve();
    const r = this.rest[i]!;
    return this.tweens.run(0.26, (k) => {
      this.place(v, r, 1 - easeInOut(Math.max(0, (k - 0.6) / 0.4)), 1 - easeInOut(Math.min(1, k / 0.65)));
      v.glow = 0.22 * (1 - k);
      if (k === 1) v.root.position.copy(r);
    }, linear);
  }

  shake(i: number, amp = 0.12): void {
    const v = this.views[i]; if (!v) return;
    const x0 = this.rest[i]!.x;
    void this.tweens.run(0.32, (k) => { v.root.position.x = x0 + Math.sin(k * Math.PI * 6) * amp * (1 - k); if (k === 1) v.root.position.x = x0; }, linear);
  }

  get bottleCount(): number { return this.views.length; }

  /** Подсказка: прыгающие маркеры «1 → 2» над бутылками + свечение; висит, пока игрок не сделает ход. */
  showHint(from: number, to: number): void {
    this.clearHint();
    const sprites = [from, to].map((_, k) => {
      const s = new Sprite(new SpriteMaterial({ map: this.hintTex[k]!, transparent: true, depthTest: false }));
      s.center.set(0.5, 0); s.scale.set(0.8, 1.0, 1); s.renderOrder = 20;
      this.scene.add(s); return s;
    });
    this.hint = { sprites, ids: [from, to] };
  }

  clearHint(): void {
    this.clearPointer();
    if (!this.hint) return;
    for (const s of this.hint.sprites) { this.scene.remove(s); s.material.dispose(); }
    for (const i of this.hint.ids) { const v = this.views[i]; if (v) v.extraGlow = 0; }
    this.hint = null;
  }

  /**
   * Обучение: рука по кругу показывает «нажми сюда → потом сюда». Живёт, пока игрок не нажмёт на любую бутылку.
   */
  showPointer(from: number, to: number): void {
    this.clearPointer();
    const a = this.rest[from], b = this.rest[to];
    if (!a || !b) return;
    const sprite = new Sprite(new SpriteMaterial({ map: this.handTex, transparent: true, depthTest: false }));
    sprite.center.set(HAND_TIP.x, 1 - HAND_TIP.y); sprite.scale.set(0.9, 1.125, 1); sprite.renderOrder = 25;
    this.scene.add(sprite); this.pointer = sprite;
    const token = ++this.pointerToken;
    const at = (v: Vector3, lift: number): Vector3 => new Vector3(v.x, v.y + B.H * 0.45 - lift, 0);
    const loop = async (): Promise<void> => {
      while (token === this.pointerToken) {
        const p0 = at(a, 0), p1 = at(b, 0);
        sprite.position.copy(p0); sprite.position.y -= 0.6; (sprite.material as SpriteMaterial).opacity = 0;
        await this.tweens.run(0.35, (k) => { sprite.position.y = p0.y - 0.6 * (1 - k); (sprite.material as SpriteMaterial).opacity = k; }, easeInOut);
        if (token !== this.pointerToken) return;
        await this.tweens.run(0.22, (k) => { sprite.scale.set(0.9 * (1 - 0.15 * Math.sin(k * Math.PI)), 1.125 * (1 - 0.15 * Math.sin(k * Math.PI)), 1); }, linear); // «тап»
        this.ring(p0.x, p0.y, new Color('#ffffff'));
        await this.tweens.run(0.7, (k) => { sprite.position.lerpVectors(p0, p1, k); }, easeInOut);
        if (token !== this.pointerToken) return;
        await this.tweens.run(0.22, (k) => { sprite.scale.set(0.9 * (1 - 0.15 * Math.sin(k * Math.PI)), 1.125 * (1 - 0.15 * Math.sin(k * Math.PI)), 1); }, linear);
        this.ring(p1.x, p1.y, new Color('#ffffff'));
        await this.tweens.run(0.3, (k) => { (sprite.material as SpriteMaterial).opacity = 1 - k; }, linear);
        await this.tweens.wait(0.6);
      }
    };
    void loop();
  }

  private clearPointer(): void {
    this.pointerToken++;
    if (!this.pointer) return;
    this.scene.remove(this.pointer); (this.pointer.material as SpriteMaterial).dispose(); this.pointer = null;
  }

  /** Счётчики рендера для отладки утечек (если растут от уровня к уровню — где-то нет dispose). */
  stats(): { calls: number; triangles: number; geometries: number; textures: number } {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

  // ---------- эффекты ----------
  /** Расширяющееся светящееся кольцо. */
  private ring(x: number, y: number, color: Color): void {
    const mat = new MeshBasicMaterial({ color: lighten(color, 0.45), transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: DoubleSide });
    const geo = new RingGeometry(0.9, 1, 64);
    const m = new Mesh(geo, mat);
    m.renderOrder = 15; m.position.set(x, y, 0);
    this.scene.add(m);
    void this.tweens.run(0.7, (k) => { m.scale.setScalar(0.4 + 2.2 * k); mat.opacity = 0.9 * (1 - k) * (1 - k); }, easeInOut).then(() => {
      this.scene.remove(m); geo.dispose(); mat.dispose();
    });
  }

  /** Бутылка собрана: пробка с отскоком, проход блика по стеклу, кольцо, искры, вспышка жидкости. */
  completeFx(i: number, color: Color): void {
    const v = this.views[i]; const p = this.rest[i];
    if (!v || !p) return;
    v.cork.visible = true;
    void this.tweens.run(0.5, (k) => { v.cork.position.y = B.H + 0.9 * (1 - k); }, easeOutBounce).then(() => { v.cork.position.y = B.H; });
    void this.tweens.wait(0.18).then(() => this.tweens.run(0.75, (k) => { v.setSweep(k); v.glow = 0.45 * Math.sin(Math.PI * k); }, easeInOut)).then(() => { v.setSweep(-1); v.glow = 0; });
    this.ring(p.x, p.y + B.H * 0.5, color);
    const spark = lighten(color, 0.55);
    for (let k = 0; k < 16; k++) {
      this.particles.emit(PK.Sparkle, p.x + rnd(-0.55, 0.55), p.y + rnd(0.2, B.H), 0, rnd(-0.25, 0.25), rnd(0.35, 1.1), spark, rnd(0.2, 0.36), rnd(0.9, 1.5), -0.15, 0.4, 0);
    }
  }

  /** Победа: пушки конфетти с двух сторон + дождь сверху + волна блика по всем бутылкам. */
  celebrate(board: Board): void {
    const cx = this.target.x, left = cx + this.camera.left * 0.96, right = cx + this.camera.right * 0.96;
    const bottom = this.target.y + (this.camera.bottom * 0.78) / Math.cos(ELEV);
    const top = this.target.y + (this.camera.top * 0.95) / Math.cos(ELEV);
    const gold = new Color('#ffd54a'), white = new Color('#ffffff');
    const cols = [...this.palette, gold, white];
    const cannon = (x: number, dir: number) => {
      for (let k = 0; k < 55; k++) {
        const c = cols[Math.floor(Math.random() * cols.length)]!;
        this.particles.emit(PK.Confetti, x, bottom, 0, dir * rnd(1.5, 5.5), rnd(6, 11.5), c, rnd(0.2, 0.34), rnd(2.2, 3.2), 7, 1.3, rnd(-9, 9));
      }
      for (let k = 0; k < 10; k++) this.particles.emit(PK.Sparkle, x, bottom, 0, dir * rnd(0.5, 3), rnd(2, 6), gold, rnd(0.25, 0.4), rnd(0.6, 1.1), 3, 1, 0);
    };
    for (let w = 0; w < 3; w++) {
      void this.tweens.wait(w * 0.28).then(() => { cannon(left, 1); cannon(right, -1); });
    }
    void this.tweens.wait(0.5).then(() => {
      for (let k = 0; k < 60; k++) {
        const c = cols[Math.floor(Math.random() * cols.length)]!;
        this.particles.emit(PK.Confetti, rnd(left, right), top + rnd(0, 1.5), 0, rnd(-0.6, 0.6), rnd(-2.5, -0.8), c, rnd(0.18, 0.3), rnd(2.4, 3.6), 0.8, 0.6, rnd(-6, 6));
      }
    });
    board.bottles.forEach((b, i) => {
      if (!isComplete(b)) return;
      void this.tweens.wait(0.1 + i * 0.07).then(() => this.tweens.run(0.7, (k) => this.views[i]?.setSweep(k), easeInOut)).then(() => this.views[i]?.setSweep(-1));
    });
  }

  /** Лёгкое «оживление» (для меню): случайная бутылка покачивается. */
  nudge(): void { if (this.views.length) this.shake(Math.floor(Math.random() * this.views.length), 0.06); }

  /**
   * Переливание: подъём/перенос → наклон → струя по параболе с синхронным убыванием/прибавлением → возврат.
   * Край горлышка жёстко зафиксирован над приёмником: позиция бутылки пересчитывается от угла наклона.
   */
  async pour(before: Board, m: Move, after: Board, hooks: PourHooks = {}): Promise<void> {
    this.busy = true;
    this.clearHint();
    const src = this.views[m.from]!, tgt = this.views[m.to]!;
    src.cork.visible = false;
    const s0 = segmentsOf(before.bottles[m.from]!), t0 = segmentsOf(before.bottles[m.to]!);
    const srcRest = this.rest[m.from]!, tgtRest = this.rest[m.to]!;
    const dir = tgtRest.x >= srcRest.x ? 1 : -1;
    const color = this.palette[m.color % this.palette.length]!;
    const capS = before.bottles[m.from]!.cap;
    const r = B.NECK_R + 0.05;

    const rim = new Vector3(tgtRest.x - dir * 0.32, tgtRest.y + B.H + 0.45 + FRONT_Z * ZC, FRONT_Z);
    const rootFor = (theta: number, out: Vector3): Vector3 =>
      out.set(rim.x - dir * r * Math.cos(theta), rim.y + r * Math.sin(theta) - B.H, FRONT_Z);

    const a0 = pourAngle(before.bottles[m.from]!.layers.length / capS);
    const from = src.root.position.clone();
    const to = rootFor(a0, new Vector3());

    // 1) перенос + наклон
    await this.tweens.run(0.45, (k) => {
      src.root.position.lerpVectors(from, to, k);
      src.tilt.rotation.z = -dir * a0 * k;
      src.glow = 0.22 * (1 - k);
    }, easeInOut);

    // 2) струя + уровни + эффекты падения
    const dur = Math.min(1.25, Math.max(0.45, 0.42 + 0.25 * m.count));
    hooks.onStream?.(dur);
    const p0 = new Vector3(), p1 = new Vector3();
    const dropColor = lighten(color, 0.12), bubColor = lighten(color, 0.5);
    let lastT = this.time, dropAcc = 0, bubAcc = 0;
    await this.tweens.run(dur, (k) => {
      const dt = Math.max(0, this.time - lastT); lastT = this.time;
      const moved = m.count * k;
      const ss = withDelta(s0, m.color, -moved), ts = withDelta(t0, m.color, moved);
      src.setSegments(ss); tgt.setSegments(ts);
      const theta = pourAngle(totalAmount(ss) / capS);
      src.tilt.rotation.z = -dir * theta;
      rootFor(theta, src.root.position);
      const surfaceY = tgtRest.y + B.BOTTOM + totalAmount(ts) * tgt.layerLen;
      p0.set(rim.x, rim.y - 0.02, FRONT_Z);
      p1.set(tgtRest.x, surfaceY + FRONT_Z * ZC, FRONT_Z);
      const ramp = Math.min(1, k * 7) * Math.min(1, (1 - k) * 7 + 0.25);
      this.stream.set(p0, p1, color, 0.09 * ramp, this.time);

      // в приёмнике: кольца на поверхности, короткие брызги-«корона», пузырьки, которые уходят вглубь и всплывают
      tgt.setRipple(0, ramp);
      dropAcc += dt * 26 * ramp; bubAcc += dt * 16 * ramp;
      while (dropAcc >= 1) {
        dropAcc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.particles.emit(PK.Drop, p1.x + side * rnd(0, 0.08), surfaceY + 0.02, 0, side * rnd(0.35, 1.15), rnd(1.1, 2.3), dropColor, rnd(0.05, 0.095), rnd(0.32, 0.5), 9, 0, 0);
      }
      while (bubAcc >= 1) {
        bubAcc -= 1;
        this.particles.emit(PK.Bubble, p1.x + rnd(-0.2, 0.2), surfaceY - rnd(0.05, 0.25), 0, rnd(-0.12, 0.12), rnd(0.5, 1.0), bubColor, rnd(0.07, 0.13), rnd(0.35, 0.6), -0.3, 0, 0);
      }
    }, linear);
    this.stream.hide();
    this.current = after;
    src.setSegments(segmentsOf(after.bottles[m.from]!));
    tgt.setSegments(segmentsOf(after.bottles[m.to]!));
    this.updateCaustic(m.from, after.bottles[m.from]!); this.updateCaustic(m.to, after.bottles[m.to]!);

    // 3) возврат
    const back0 = src.root.position.clone(), ang0 = src.tilt.rotation.z;
    const y0c = back0.y - ZC * back0.z; // высота без компенсации наклона камеры
    await this.tweens.run(0.42, (k) => {
      const ke = easeInOut(k), zk = 1 - easeInOut(Math.max(0, (k - 0.72) / 0.28)); // назад по z — только в конце
      const z = back0.z * zk;
      src.root.position.set(back0.x + (srcRest.x - back0.x) * ke, y0c + (srcRest.y - y0c) * ke + ZC * z, z);
      src.tilt.rotation.z = ang0 * (1 - ke);
    }, linear);
    src.root.position.copy(srcRest); src.tilt.rotation.z = 0;

    // механики: открылся слой «?» / снята печать
    const fb = after.bottles[m.from]!;
    if ((fb.hidden ?? 0) < (before.bottles[m.from]!.hidden ?? 0)) this.revealFx(m.from, this.palette[(fb.layers[fb.layers.length - 1] ?? 0) % this.palette.length]!);
    for (const j of m.unlocked ?? []) this.unlockFx(j);

    // бутылка могла стать «собранной» (в том числе приёмник) — эффект завершения
    if (isComplete(after.bottles[m.to]!)) this.completeFx(m.to, color);
    this.busy = false;
  }

  // ---------- цикл ----------
  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now; this.time += dt;
    this.tweens.update(dt);
    for (const v of this.views) v.update(dt, this.time);
    // Тень бутылки гаснет, когда бутылка далеко от своего места на полке.
    for (let i = 0; i < this.views.length; i++) {
      const rp = this.rest[i]!, pp = this.views[i]!.root.position;
      this.shadowMats[i]!.opacity = Math.max(0, 1 - Math.hypot(pp.x - rp.x, pp.y - rp.y) / 0.9);
    }
    if (this.hint) {
      const bob = Math.sin(this.time * 6) * 0.12, pulse = 0.18 + 0.18 * Math.sin(this.time * 6);
      this.hint.ids.forEach((id, k) => {
        const rp = this.rest[id]; const v = this.views[id]; if (!rp || !v) return;
        this.hint!.sprites[k]!.position.set(rp.x, rp.y + B.H + 0.1 + bob, 0);
        v.extraGlow = pulse;
      });
    }
    if (this.relayoutPending && !this.busy) this.relayoutIfNeeded();
    this.idleShine -= dt;
    if (this.idleShine <= 0 && !this.busy && this.views.length > 0) { // изредка по стеклу проходит блик
      this.idleShine = rnd(6, 10);
      this.views.forEach((v, i) => void this.tweens.wait(i * 0.09).then(() => this.tweens.run(0.9, (k) => v.setSweep(k), easeInOut)).then(() => v.setSweep(-1)));
    }
    this.emitAmbient(dt);
    this.ambient.update(dt);
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);

    // Адаптивное качество: при просадке FPS снижаем DPR.
    this.frames++; this.frameAcc += dt;
    if (this.frames >= 90) {
      if (this.frameAcc / this.frames > 1 / 40 && this.dprCap > 1) { this.dprCap = Math.max(1, this.dprCap - 0.25); this.resize(); }
      this.frames = 0; this.frameAcc = 0;
    }
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointer);
    this.clearHint();
    for (const v of this.views) v.dispose();
    for (const m of this.shadowMats) m.dispose();
    for (const t of this.hintTex) t.dispose();
    this.handTex.dispose(); this.lockTex.dispose();
    for (const l of this.lockSprites) if (l) l.material.dispose();
    this.stream.dispose(); this.particles.dispose(); this.ambient.dispose();
    this.shadowTex.dispose(); this.glowTex.dispose(); this.causticGeo.dispose(); for (const m of this.causticMats) m.dispose(); this.shadowGeo.dispose(); this.shelfGeo.dispose();
    this.shelfMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
