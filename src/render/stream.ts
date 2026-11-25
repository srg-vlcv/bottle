import { BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Vector3 } from 'three';

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FS = /* glsl */ `
uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
void main(){
  float flow = 0.5 + 0.5 * sin(vUv.y * 22.0 - uTime * 16.0);
  float edge = smoothstep(0.0, 0.3, vUv.x) * (1.0 - smoothstep(0.7, 1.0, vUv.x));
  float core = 0.9 + 0.3 * (1.0 - abs(vUv.x - 0.5) * 2.0);
  gl_FragColor = vec4(uColor * core * (0.88 + 0.2 * flow), 0.95 * (0.35 + 0.65 * edge));
  #include <colorspace_fragment>
}`;

const SEG = 18;

/** Струя: лента вдоль параболы свободного падения (квадратичная кривая Безье), сужается к концу. */
export class Stream {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly pos = new Float32Array((SEG + 1) * 2 * 3);
  private readonly p = new Vector3();

  constructor() {
    const geo = new BufferGeometry();
    const uv = new Float32Array((SEG + 1) * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      uv.set([0, i / SEG, 1, i / SEG], i * 4);
      if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = new Mesh(geo, new ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new Color() }, uTime: { value: 0 } },
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  /** p0 — край горлышка, p1 — точка падения на поверхность. Начальная скорость горизонтальная. */
  set(p0: Vector3, p1: Vector3, color: Color, width: number, time: number): void {
    const cx = (p0.x + p1.x) / 2, cy = p0.y;
    let px = 0, py = 0;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, u = 1 - t;
      const x = u * u * p0.x + 2 * u * t * cx + t * t * p1.x;
      const y = u * u * p0.y + 2 * u * t * cy + t * t * p1.y;
      // касательная -> нормаль в плоскости экрана
      const dx = 2 * u * (cx - p0.x) + 2 * t * (p1.x - cx), dy = 2 * u * (cy - p0.y) + 2 * t * (p1.y - cy);
      const l = Math.hypot(dx, dy) || 1; px = -dy / l; py = dx / l;
      const w = (width * (1 - 0.35 * t)) / 2;
      this.pos.set([x + px * w, y + py * w, p0.z, x - px * w, y - py * w, p0.z], i * 6);
    }
    (this.mesh.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    this.mesh.material.uniforms.uColor!.value.copy(color);
    this.mesh.material.uniforms.uTime!.value = time;
    this.mesh.visible = true;
    this.p.copy(p1);
  }

  hide(): void { this.mesh.visible = false; }

  dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
