import {
  AdditiveBlending, AmbientLight, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Group, HemisphereLight,
  OctahedronGeometry, SphereGeometry,
  Material, Mesh, MeshBasicMaterial, MeshPhongMaterial, PerspectiveCamera, PlaneGeometry, PointLight, Scene, Sprite, SpriteMaterial,
  SRGBColorSpace, Texture, WebGLRenderer,
} from 'three';
import type { ChestTier } from '../config/shop';
import { easeInOut, easeOutBack, easeOutBounce, linear, Tweens } from './anim';
import { Particles, PK } from './particles';

const STYLE: Record<ChestTier, { body: string; band: string; glow: string }> = {
  wood: { body: '#8a5a33', band: '#a1a8b4', glow: '#ffd27a' },
  silver: { body: '#5f6f93', band: '#e3e9f4', glow: '#a8d8ff' },
  gold: { body: '#a8651a', band: '#ffd54a', glow: '#fff0a0' },
};
const FOV = 32;
const CAM_DIST = 8.2;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

const radialTex = (inner: string, outer: string): CanvasTexture => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
};

/** Лучи света: веер клиньев с плавным затуханием к краю. */
const raysTex = (): CanvasTexture => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 128, a - w, a + w); g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(-128, -128, 256, 256);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; return tex;
};

/**
 * 3D-сундук из примитивов: падает с отскоком → покачивается → тряска → крышка с пружиной, вспышка, вращающиеся лучи,
 * взрыв искр/монет/конфетти. Отдельный лёгкий WebGL-контекст, создаётся только на время окна сундука.
 */
export class ChestScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  private readonly tweens = new Tweens();
  private readonly particles = new Particles(420);
  private readonly chest = new Group();
  private readonly lid = new Group();
  private readonly glowLight: PointLight;
  private readonly glow: Sprite;
  private readonly rays: Sprite;
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly ro: ResizeObserver;
  private readonly glowColor: Color;
  private raf = 0; private last = 0; private time = 0;
  private opened = false;
  private shake = 0;

  constructor(private readonly container: HTMLElement, tier: ChestTier) {
    const st = STYLE[tier];
    this.glowColor = new Color(st.glow);
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 2.6, CAM_DIST); this.camera.lookAt(0, 0.75, 0);

    this.scene.add(new AmbientLight(0xffffff, 1.0), new HemisphereLight(0xdfeaff, 0x5a3a22, 1.1));
    const sun = new DirectionalLight(0xffffff, 2.4); sun.position.set(3, 6, 5); this.scene.add(sun);
    this.glowLight = new PointLight(this.glowColor, 0, 10); this.glowLight.position.set(0, 1.7, 0.3); this.scene.add(this.glowLight);

    const keep = <T extends { dispose(): void }>(o: T): T => { this.disposables.push(o); return o; };
    const phong = (hex: string, shin = 40): MeshPhongMaterial => keep(new MeshPhongMaterial({ color: new Color(hex), shininess: shin, specular: new Color(0x555555), side: DoubleSide }));
    const box = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number): Mesh => {
      const mesh = new Mesh(keep(new BoxGeometry(w, h, d)), m); mesh.position.set(x, y, z); return mesh;
    };
    const body = phong(st.body, 25), band = phong(st.band, 90), dark = phong('#3a2412', 5), gold0 = phong('#ffe27a', 120);

    // корпус, ремни, обод
    this.chest.add(box(2.4, 1.2, 1.5, body, 0, 0.6, 0));
    for (const x of [-0.8, 0.8]) this.chest.add(box(0.22, 1.22, 1.56, band, x, 0.6, 0));
    this.chest.add(box(2.46, 0.14, 1.56, band, 0, 0.07, 0), box(2.46, 0.12, 1.56, band, 0, 1.14, 0));

    // доски (канавки), угловые накладки, заклёпки на ремнях
    const groove = phong('#2a190d', 5);
    for (const y of [0.34, 0.6, 0.86]) this.chest.add(box(2.41, 0.025, 1.51, groove, 0, y, 0));
    for (const x of [-1.2, 1.2]) for (const z of [-0.75, 0.75]) this.chest.add(box(0.12, 1.24, 0.12, band, x, 0.62, z));
    const rivetGeo = keep(new SphereGeometry(0.05, 10, 8));
    for (const x of [-0.8, 0.8]) for (const y of [0.22, 0.5, 0.78, 1.04]) { const rv = new Mesh(rivetGeo, gold0); rv.position.set(x, y, 0.79); this.chest.add(rv); }

    // сокровище внутри (видно только когда крышка открыта)
    const treasure = new Mesh(keep(new PlaneGeometry(2.3, 1.4)), keep(new MeshBasicMaterial({ color: new Color(st.glow) })));
    treasure.rotation.x = -Math.PI / 2; treasure.position.y = 1.19; this.chest.add(treasure);
    const gold = phong('#ffd54a', 100);
    const coinGeo = keep(new CylinderGeometry(0.16, 0.16, 0.04, 16));
    for (let i = 0; i < 14; i++) {
      const coin = new Mesh(coinGeo, gold);
      coin.position.set(rnd(-0.95, 0.95), 1.22 + rnd(0, 0.1), rnd(-0.5, 0.5));
      coin.rotation.set(rnd(-0.5, 0.5), rnd(0, 3), rnd(-0.5, 0.5)); this.chest.add(coin);
    }

    // крышка: полуцилиндр (купол) + ремни + замок + тёмная нижняя сторона; шарнир по задней кромке
    this.lid.position.set(0, 1.2, -0.75);
    const dome = new Mesh(keep(new CylinderGeometry(0.75, 0.75, 2.4, 32, 1, false, 0, Math.PI)), body);
    dome.rotation.z = Math.PI / 2; dome.position.set(0, 0, 0.75);
    const strapGeo = keep(new CylinderGeometry(0.77, 0.77, 0.22, 32, 1, true, 0, Math.PI));
    for (const x of [-0.8, 0.8]) { const s = new Mesh(strapGeo, band); s.rotation.z = Math.PI / 2; s.position.set(x, 0, 0.75); this.lid.add(s); }
    const under = new Mesh(keep(new PlaneGeometry(2.4, 1.5)), dark);
    under.rotation.x = Math.PI / 2; under.position.set(0, 0.005, 0.75);
    const gem = new Mesh(keep(new OctahedronGeometry(0.11)), phong(tier === 'gold' ? '#ff4d6d' : tier === 'silver' ? '#6ad0ff' : '#9be37a', 140));
    gem.position.set(0, 0.08, 1.6); gem.scale.set(1, 1.3, 0.8);
    this.lid.add(dome, under, box(0.36, 0.44, 0.14, band, 0, 0.02, 1.5), gem, box(0.04, 0.12, 0.02, dark, 0, -0.1, 1.58));
    this.chest.add(this.lid);

    // мягкая тень на полу
    const shadow = new Mesh(keep(new PlaneGeometry(4.2, 2.6)), keep(new MeshBasicMaterial({ map: keep(radialTex('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)')), transparent: true, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.01; this.scene.add(shadow);
    this.scene.add(this.chest);

    // свечение и лучи (аддитивные спрайты)
    const mkSprite = (tex: Texture): Sprite => {
      const m = keep(new SpriteMaterial({ map: keep(tex), color: this.glowColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      const s = new Sprite(m); s.position.set(0, 1.5, 0.3); s.scale.set(0.01, 0.01, 1); this.scene.add(s); return s;
    };
    this.glow = mkSprite(radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
    this.rays = mkSprite(raysTex());
    this.scene.add(this.particles.points);

    this.chest.position.y = 6; // за кадром — «упадёт» в dropIn()
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const visibleH = 2 * Math.tan((FOV * Math.PI) / 360) * CAM_DIST;
    this.particles.setScale(this.renderer.domElement.height / visibleH);
  }

  /** Падение с отскоком и «сплющиванием» при приземлении. */
  dropIn(): Promise<void> {
    return this.tweens.run(0.85, (k) => {
      this.chest.position.y = 6 * (1 - k);
      this.chest.scale.y = k > 0.55 && k < 0.75 ? 0.9 : 1;
    }, easeOutBounce).then(() => { this.chest.position.y = 0; this.chest.scale.y = 1; });
  }

  /** Тряска → открытие крышки → вспышка, лучи и взрыв частиц. Разрешается, когда крышка открыта. */
  async open(): Promise<void> {
    if (this.opened) return;
    this.opened = true;
    // 1) ожидание: нарастающая тряска и просвечивающее свечение
    await this.tweens.run(0.9, (k) => {
      this.shake = k;
      this.chest.rotation.z = Math.sin(k * Math.PI * 12) * 0.07 * k;
      this.glow.material.opacity = 0.5 * k; this.glow.scale.setScalar(0.4 + 1.8 * k);
      this.glowLight.intensity = 10 * k;
    }, linear);
    this.shake = 0; this.chest.rotation.z = 0;

    // 2) крышка с пружиной + вспышка
    const flash = this.tweens.run(0.6, (k) => {
      this.glow.material.opacity = 1 - 0.35 * k; this.glow.scale.setScalar(2.2 + 4.5 * (1 - (1 - k) * (1 - k)));
      this.glowLight.intensity = 36 - 20 * k;
      this.rays.material.opacity = 0.85 * Math.min(1, k * 3); this.rays.scale.setScalar(1 + 6.5 * k);
    }, easeInOut);
    this.burst();
    await this.tweens.run(0.55, (k) => { this.lid.rotation.x = -1.95 * k; }, easeOutBack);
    await flash;
    await this.tweens.wait(0.15);
  }

  private burst(): void {
    const c = this.glowColor.clone(), white = new Color('#ffffff'), gold = new Color('#ffd54a');
    for (let i = 0; i < 34; i++) this.particles.emit(PK.Sparkle, rnd(-0.9, 0.9), 1.4, 0.8, rnd(-2.4, 2.4), rnd(1.5, 5.5), c.clone().lerp(white, 0.5), rnd(0.2, 0.38), rnd(0.8, 1.5), 4, 0.8, 0);
    for (let i = 0; i < 26; i++) this.particles.emit(PK.Drop, rnd(-0.8, 0.8), 1.4, 0.8, rnd(-2.6, 2.6), rnd(3, 7), gold, rnd(0.07, 0.12), rnd(0.9, 1.4), 9, 0.2, 0);
    for (let i = 0; i < 40; i++) this.particles.emit(PK.Confetti, rnd(-0.9, 0.9), 1.4, 0.8, rnd(-3.4, 3.4), rnd(3, 8), new Color().setHSL(Math.random(), 0.85, 0.6), rnd(0.2, 0.32), rnd(1.6, 2.6), 6, 1.1, rnd(-9, 9));
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now; this.time += dt;
    this.tweens.update(dt);
    if (!this.opened) this.chest.rotation.y = Math.sin(this.time * 0.9) * 0.18; // лёгкое покачивание: виден объём
    else { this.chest.rotation.y *= 0.92; this.rays.material.rotation += dt * 0.5; }
    this.camera.position.x = this.shake * Math.sin(this.time * 60) * 0.03;
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.particles.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
