import {
  BackSide, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry,
  ShaderMaterial, TorusGeometry, Vector2, Vector3,
} from 'three';
import type { Seg } from '../core/segments';
import { B, INNER, LIP_R, LIP_TUBE, MAX_SEGS, OUTER, smoothProfile } from './bottleProfile';
import { BASE_FS, BASE_VS, CAP_FS, CAP_VS, CORK_FS, CORK_VS, GLASS_FS, GLASS_VS, LIP_FS, LIP_VS, LIQ_FS, LIQ_VS } from './shaders';

export { B, MAX_SEGS } from './bottleProfile';

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/** Знак «?» для скрытых слоёв (общая текстура на все бутылки; холст 2:1 — как слой на бутылке). */
let qTexture: CanvasTexture | null = null;
function questionTexture(): CanvasTexture {
  if (qTexture) return qTexture;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 58px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText('?', 64, 34);
  g.fillStyle = '#fff'; g.fillText('?', 64, 34);
  qTexture = new CanvasTexture(c);
  return qTexture;
}

const lathe = (pts: Array<[number, number]>, seg = 64): LatheGeometry =>
  new LatheGeometry(smoothProfile(pts).map(([x, y]) => new Vector2(x, y)), seg);

export class BottleView {
  readonly root = new Group();
  /** Вращение вокруг горлышка: pivot в (0, H, 0) относительно root. */
  readonly tilt = new Group();
  readonly cork: Mesh;
  private readonly body = new Group();
  private readonly liquid: Mesh<LatheGeometry, ShaderMaterial>;
  private readonly cap: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly glass: Mesh<LatheGeometry, ShaderMaterial>;
  private readonly glassBack: Mesh<LatheGeometry, ShaderMaterial>;
  private readonly lip: Mesh<TorusGeometry, ShaderMaterial>;
  private readonly base: Mesh<CircleGeometry, ShaderMaterial>;
  readonly hit: Mesh;
  private readonly colors = Array.from({ length: MAX_SEGS }, () => new Color());
  private readonly tops = new Array<number>(MAX_SEGS).fill(0);
  private readonly ids = new Array<number>(MAX_SEGS).fill(0);
  private readonly hid = new Array<number>(MAX_SEGS).fill(0);
  private lockedDim = 0;
  private readonly invM = new Matrix4();
  private readonly up = new Vector3();
  private readonly worldUp = new Vector3();
  private readonly capU = new Vector3();
  private readonly capV = new Vector3();
  private count = 0;
  // плеск: пружины по ускорению бутылки
  private px = 0; private py = 0; private pvx = 0; private pvy = 0; private inited = false;
  private sx = 0; private svx = 0; private sz = 0; private svz = 0;
  private ripple = 0; private rippleIn = 0; private hitX = 0;
  readonly layerLen: number;
  glow = 0;
  /** Дополнительное свечение (подсказка), суммируется с glow. */
  extraGlow = 0;

  constructor(readonly index: number, readonly cap_: number, private palette: Color[], tint: string, bubble = '#ffffff') {
    this.layerLen = (B.FILL_TOP - B.BOTTOM) / cap_;
    this.tilt.position.set(0, B.H, 0);
    this.body.position.set(0, -B.H, 0);
    this.root.add(this.tilt);
    this.tilt.add(this.body);

    this.liquid = new Mesh(lathe(INNER), new ShaderMaterial({
      vertexShader: LIQ_VS, fragmentShader: LIQ_FS, side: DoubleSide, alphaToCoverage: true,
      uniforms: {
        uColors: { value: this.colors }, uTop: { value: this.tops }, uIds: { value: this.ids }, uHid: { value: this.hid }, uQ: { value: questionTexture() }, uCount: { value: 0 },
        uUp: { value: new Vector3(0, 1, 0) }, uBottomY: { value: B.BOTTOM }, uTime: { value: 0 }, uGlow: { value: 0 }, uCB: { value: 0 }, uBubble: { value: new Color(bubble) },
      },
    }));
    this.liquid.renderOrder = 1;

    this.cap = new Mesh(new PlaneGeometry(2.8, 2.8), new ShaderMaterial({
      vertexShader: CAP_VS, fragmentShader: CAP_FS, side: DoubleSide, alphaToCoverage: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uOrigin: { value: new Vector3() }, uU: { value: new Vector3(1, 0, 0) }, uV: { value: new Vector3(0, 0, 1) },
        uTopColor: { value: new Color() }, uBottomY: { value: B.BOTTOM }, uTime: { value: 0 }, uGlow: { value: 0 },
        uRipple: { value: 0 }, uHit: { value: new Vector2() },
      },
    }));
    this.cap.renderOrder = 1;
    this.cap.frustumCulled = false;
    this.cap.visible = false;

    const outer = lathe(OUTER);
    const mkGlass = (back: boolean) => new ShaderMaterial({
      vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, side: back ? BackSide : 0,
      uniforms: { uTint: { value: new Color(tint) }, uBack: { value: back ? 1 : 0 }, uSweep: { value: -1 } },
    });
    this.glassBack = new Mesh(outer, mkGlass(true));
    this.glassBack.renderOrder = 1.5;
    this.glass = new Mesh(outer, mkGlass(false));
    this.glass.renderOrder = 2;
    this.lip = new Mesh(new TorusGeometry(LIP_R, LIP_TUBE, 14, 48), new ShaderMaterial({
      vertexShader: LIP_VS, fragmentShader: LIP_FS, transparent: true, depthWrite: false, uniforms: { uTint: { value: new Color(tint) }, uR: { value: LIP_R + LIP_TUBE } },
    }));
    this.lip.rotation.x = Math.PI / 2;
    this.lip.position.set(0, B.H - 0.01, 0);
    this.lip.renderOrder = 2;

    this.cork = new Mesh(new CylinderGeometry(B.NECK_R + 0.06, B.NECK_R - 0.06, 0.36, 32), new ShaderMaterial({ vertexShader: CORK_VS, fragmentShader: CORK_FS, uniforms: { uWax: { value: 0 } } }));
    this.cork.position.set(0, B.H + 0.04, 0);
    this.cork.renderOrder = 2.5;
    this.cork.visible = false;

    this.base = new Mesh(new CircleGeometry(INNER[3]![0] + 0.02, 48), new ShaderMaterial({
      vertexShader: BASE_VS, fragmentShader: BASE_FS, transparent: true, depthWrite: false,
      uniforms: { uTint: { value: new Color(tint) }, uRadius: { value: INNER[3]![0] + 0.02 } },
    }));
    this.base.rotation.x = -Math.PI / 2; this.base.position.set(0, B.BOTTOM - 0.02, 0); this.base.renderOrder = 1.8;

    this.body.add(this.liquid, this.cap, this.glassBack, this.base, this.glass, this.lip, this.cork);

    this.hit = new Mesh(new CylinderGeometry(B.R * 1.2, B.R * 1.2, B.H * 1.05), new MeshBasicMaterial({ visible: false }));
    this.hit.position.set(0, B.H / 2, 0);
    this.hit.userData.bottleIndex = index;
    this.root.add(this.hit);
  }

  setColorblind(on: boolean): void { this.liquid.material.uniforms.uCB!.value = on ? 1 : 0; }

  /** Запечатанная бутылка: красная восковая печать на горлышке и притемнённая жидкость. */
  setLocked(on: boolean): void {
    (this.cork.material as ShaderMaterial).uniforms.uWax!.value = on ? 1 : 0;
    this.lockedDim = on ? -0.2 : 0;
    if (on) this.cork.visible = true;
  }

  /** Проход блика по стеклу (0..1); -1 — выключен. */
  setSweep(v: number): void { this.glass.material.uniforms.uSweep!.value = v; }

  /** Волна от падающей струи: x — смещение точки падения от оси бутылки. */
  setRipple(x: number, strength: number): void { this.hitX = x; this.rippleIn = Math.max(this.rippleIn, strength); }

  /** Мировая позиция горлышка (pivot наклона). */
  mouthWorld(out: Vector3): Vector3 { return this.tilt.getWorldPosition(out); }

  setSegments(segs: Seg[]): void {
    let acc = 0;
    const n = Math.min(segs.length, MAX_SEGS);
    for (let i = 0; i < n; i++) {
      const s = segs[i]!;
      acc += s.amount * this.layerLen;
      if (s.hidden) this.colors[i]!.set('#241f44'); else this.colors[i]!.copy(this.palette[s.color % this.palette.length]!);
      this.tops[i] = acc; this.ids[i] = s.color; this.hid[i] = s.hidden ? 1 : 0;
    }
    this.count = n;
    this.liquid.material.uniforms.uCount!.value = n;
    if (n > 0) this.cap.material.uniforms.uTopColor!.value.copy(this.colors[n - 1]!);
    this.cap.visible = n > 0;
  }

  /** Вызывать каждый кадр после обновления позиций. */
  update(dt: number, time: number): void {
    this.root.updateMatrixWorld(true);
    const d = Math.max(dt, 1e-3);
    const x = this.root.position.x, y = this.root.position.y;
    if (!this.inited) { this.px = x; this.py = y; this.inited = true; }
    const vx = (x - this.px) / d, vy = (y - this.py) / d;
    const ax = clamp((vx - this.pvx) / d, -90, 90), ay = clamp((vy - this.pvy) / d, -90, 90);
    this.px = x; this.py = y; this.pvx = vx; this.pvy = vy;
    // плеск: поверхность отклоняется против ускорения и возвращается пружиной
    const tx = clamp(-ax * 0.008, -0.3, 0.3), tz = clamp(-ay * 0.004, -0.2, 0.2);
    this.svx += (-90 * (this.sx - tx) - 7 * this.svx) * d; this.sx += this.svx * d;
    this.svz += (-90 * (this.sz - tz) - 7 * this.svz) * d; this.sz += this.svz * d;

    this.worldUp.set(this.sx, 1, this.sz).normalize();
    this.invM.copy(this.liquid.matrixWorld).invert();
    this.up.copy(this.worldUp).transformDirection(this.invM);

    const u = this.liquid.material.uniforms;
    (u.uUp!.value as Vector3).copy(this.up);
    u.uTime!.value = time;
    const glow = this.glow + this.extraGlow + this.lockedDim;
    u.uGlow!.value = glow;

    // поверхность: плоскость через точку оси на высоте уровня, нормаль = «вверх»
    this.ripple = Math.max(this.rippleIn, this.ripple * Math.pow(0.03, d)); this.rippleIn = 0;
    if (this.count > 0) {
      const cu = this.cap.material.uniforms;
      const up = this.up;
      this.capU.set(up.y, -up.x, 0);
      if (this.capU.lengthSq() < 1e-6) this.capU.set(1, 0, 0);
      this.capU.normalize();
      this.capV.crossVectors(up, this.capU).normalize();
      (cu.uOrigin!.value as Vector3).set(0, B.BOTTOM + this.tops[this.count - 1]!, 0);
      (cu.uU!.value as Vector3).copy(this.capU);
      (cu.uV!.value as Vector3).copy(this.capV);
      cu.uTime!.value = time; cu.uGlow!.value = glow; cu.uRipple!.value = this.ripple;
      (cu.uHit!.value as Vector2).set(this.hitX, 0);
    }
  }

  dispose(): void {
    this.liquid.geometry.dispose(); this.liquid.material.dispose();
    this.cap.geometry.dispose(); this.cap.material.dispose();
    this.glass.geometry.dispose(); this.glass.material.dispose(); this.glassBack.material.dispose();
    this.lip.geometry.dispose(); this.lip.material.dispose();
    this.base.geometry.dispose(); this.base.material.dispose();
    this.cork.geometry.dispose(); (this.cork.material as ShaderMaterial).dispose();
    this.hit.geometry.dispose(); (this.hit.material as MeshBasicMaterial).dispose();
  }
}
