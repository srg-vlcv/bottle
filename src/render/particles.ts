import { BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three';

/** Виды частиц (рисуются шейдером, а не квадратными пикселями). */
export const PK = { Drop: 0, Sparkle: 1, Confetti: 2, Bubble: 3, Soft: 4 } as const;
export type PKind = (typeof PK)[keyof typeof PK];

const VS = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute float aKind; attribute float aRot; attribute vec3 aColor;
uniform float uPx;
varying vec3 vColor; varying float vAlpha; varying float vKind; varying float vRot;
void main(){
  vColor = aColor; vAlpha = aAlpha; vKind = aKind; vRot = aRot;
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FS = /* glsl */ `
varying vec3 vColor; varying float vAlpha; varying float vKind; varying float vRot;
void main(){
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float a = 0.0; vec3 col = vColor;
  int kind = int(vKind + 0.5);
  if (kind == 0) {            // капля: объёмный шарик с бликом
    float d = length(uv);
    a = smoothstep(1.0, 0.82, d);
    col = vColor * (0.72 + 0.5 * (1.0 - d)) + vec3(0.9) * smoothstep(0.38, 0.0, length(uv - vec2(-0.32, 0.34))) * 0.85;
  } else if (kind == 1) {     // искра: четырёхлучевая звезда со свечением
    vec2 d = abs(uv);
    float crs = max(exp(-d.x * 26.0) * exp(-d.y * 4.5), exp(-d.y * 26.0) * exp(-d.x * 4.5));
    float glow = exp(-length(uv) * 5.0);
    a = clamp(crs + glow * 0.55, 0.0, 1.0);
    col = mix(vColor, vec3(1.0), clamp(crs, 0.0, 1.0));
  } else if (kind == 2) {     // конфетти: вращающийся «бумажный» прямоугольник с переворотом
    float c = cos(vRot), s = sin(vRot);
    vec2 r = mat2(c, -s, s, c) * uv;
    float flut = abs(cos(vRot * 1.7));
    a = step(abs(r.x), 0.82) * step(abs(r.y), 0.36 * max(0.2, flut));
    col = vColor * (0.7 + 0.4 * flut);
  } else if (kind == 3) {     // пузырёк: кольцо + блик
    float d = length(uv);
    float ring = smoothstep(0.14, 0.0, abs(d - 0.8));
    float body = smoothstep(1.0, 0.8, d) * 0.12;
    float glint = smoothstep(0.32, 0.0, length(uv - vec2(-0.34, 0.34))) * 0.9;
    a = clamp(ring * 0.9 + body + glint, 0.0, 1.0);
    col = mix(vColor, vec3(1.0), 0.6);
  } else {                    // мягкий диск (снег, пыль)
    float d = length(uv);
    a = smoothstep(1.0, 0.15, d) * 0.9;
  }
  gl_FragColor = vec4(col, a * vAlpha);
  #include <colorspace_fragment>
}`;

/** Пул частиц в одном Points: капли, искры, конфетти, пузырьки. Без аллокаций на кадр. */
export class Particles {
  readonly points: Points;
  private readonly n: number;
  private readonly pos: Float32Array; private readonly col: Float32Array;
  private readonly size: Float32Array; private readonly alpha: Float32Array;
  private readonly kind: Float32Array; private readonly rot: Float32Array;
  private readonly vel: Float32Array; private readonly life: Float32Array; private readonly maxLife: Float32Array;
  private readonly grav: Float32Array; private readonly drag: Float32Array; private readonly rotVel: Float32Array;
  private readonly baseSize: Float32Array;
  private head = 0;
  private readonly geo = new BufferGeometry();
  private readonly mat: ShaderMaterial;

  constructor(n = 900, opts: { depthTest?: boolean; renderOrder?: number } = {}) {
    this.n = n;
    const f = (k: number) => new Float32Array(n * k);
    this.pos = f(3).fill(9999); this.col = f(3); this.size = f(1); this.alpha = f(1); this.kind = f(1); this.rot = f(1);
    this.vel = f(2); this.life = f(1); this.maxLife = f(1).fill(1); this.grav = f(1); this.drag = f(1); this.rotVel = f(1); this.baseSize = f(1);
    const attr = (name: string, arr: Float32Array, k: number) => this.geo.setAttribute(name, new BufferAttribute(arr, k));
    attr('position', this.pos, 3); attr('aColor', this.col, 3); attr('aSize', this.size, 1);
    attr('aAlpha', this.alpha, 1); attr('aKind', this.kind, 1); attr('aRot', this.rot, 1);
    this.mat = new ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: opts.depthTest ?? false,
      uniforms: { uPx: { value: 60 } },
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = opts.renderOrder ?? 12;
  }

  /** Размер частиц задаётся в мировых единицах; здесь — пикселей на единицу. */
  setScale(pxPerUnit: number): void { this.mat.uniforms.uPx!.value = pxPerUnit; }

  emit(kind: PKind, x: number, y: number, z: number, vx: number, vy: number, color: Color, size: number, life: number, gravity: number, drag = 0, rotVel = 0): void {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 2] = vx; this.vel[i * 2 + 1] = vy;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.kind[i] = kind; this.baseSize[i] = size; this.size[i] = size;
    this.life[i] = this.maxLife[i] = life; this.grav[i] = gravity; this.drag[i] = drag;
    this.rot[i] = Math.random() * 6.28; this.rotVel[i] = rotVel; this.alpha[i] = 1;
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i]!;
      if (l <= 0) continue;
      const nl = l - dt;
      this.life[i] = nl;
      if (nl <= 0) { this.alpha[i] = 0; this.pos[i * 3 + 1] = 9999; continue; }
      const dr = Math.max(0, 1 - this.drag[i]! * dt);
      this.vel[i * 2] = this.vel[i * 2]! * dr;
      this.vel[i * 2 + 1] = this.vel[i * 2 + 1]! * dr - this.grav[i]! * dt;
      this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 2]! * dt;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 2 + 1]! * dt;
      this.rot[i] = this.rot[i]! + this.rotVel[i]! * dt;
      const f = nl / this.maxLife[i]!; // 1 -> 0
      const k = this.kind[i]!;
      this.alpha[i] = Math.min(1, f * 3) * Math.min(1, (1 - f) * 14 + (k === PK.Confetti ? 1 : 0));
      const base = this.baseSize[i]!;
      this.size[i] = k === PK.Sparkle ? base * (0.55 + 0.45 * Math.sin(Math.PI * (1 - f))) : k === PK.Confetti ? base : base * (0.55 + 0.45 * f);
    }
    for (const name of ['position', 'aSize', 'aAlpha', 'aRot', 'aColor', 'aKind']) (this.geo.attributes[name] as BufferAttribute).needsUpdate = true;
  }

  dispose(): void { this.geo.dispose(); this.mat.dispose(); }
}
