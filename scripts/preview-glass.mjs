// Превью стекла и жидкости БЕЗ three: тот же профиль и те же GLSL, сырой WebGL2 в headless Chromium.
// Запуск: tsx scripts/preview-glass.mjs [фон.png] [выход.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const prof = await import('../src/render/bottleProfile.ts');
const sh = await import('../src/render/shaders.ts');
const { LAB } = await import('../src/content/themes/lab.ts');
const { B, OUTER, INNER, LIP_R, LIP_TUBE, smoothProfile } = prof;

const bgPath = process.argv[2];
const out = process.argv[3] ?? '/tmp/preview_glass.png';
const bgData = bgPath ? 'data:image/png;base64,' + readFileSync(bgPath).toString('base64') : '';

// ---------- геометрия ----------
function lathe(points, seg = 64) {
  const pts = smoothProfile(points); const n = pts.length;
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = dy, ny = -dx; // наружу
    for (let j = 0; j <= seg; j++) {
      const ph = (j / seg) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
      pos.push(pts[i][0] * s, pts[i][1], pts[i][0] * c); nrm.push(nx * s, ny, nx * c);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = (i + 1) * (seg + 1) + j, d = a + 1, c = b + 1;
    idx.push(a, d, b, b, d, c);
  }
  return { pos, nrm, idx };
}
function latheRaw(pts, seg = 40) {
  const n = pts.length, pos = [], nrm = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    for (let j = 0; j <= seg; j++) { const ph = (j / seg) * Math.PI * 2, sn = Math.sin(ph), cs = Math.cos(ph); pos.push(pts[i][0] * sn, pts[i][1], pts[i][0] * cs); nrm.push(dy * sn, -dx, dy * cs); }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = (i + 1) * (seg + 1) + j, d = a + 1, c = b + 1; idx.push(a, d, b, b, d, c); }
  return { pos, nrm, idx };
}
function torus(R, r, seg = 48, tseg = 14) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= tseg; j++) {
    const u = (i / seg) * Math.PI * 2, v = (j / tseg) * Math.PI * 2;
    const cx = Math.cos(u) * R, cz = Math.sin(u) * R;
    const nx = Math.cos(u) * Math.cos(v), ny = Math.sin(v), nz = Math.sin(u) * Math.cos(v);
    pos.push(cx + nx * r, ny * r, cz + nz * r); nrm.push(nx, ny, nz);
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < tseg; j++) {
    const a = i * (tseg + 1) + j, b = (i + 1) * (tseg + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { pos, nrm, idx };
}
function disc(rad, seg = 48, flat = true) { // в плоскости XZ (лежит на y=0)
  const pos = [0, 0, 0], nrm = [0, 1, 0], idx = [];
  for (let j = 0; j <= seg; j++) { const ph = (j / seg) * Math.PI * 2; pos.push(Math.cos(ph) * rad, 0, Math.sin(ph) * rad); nrm.push(0, 1, 0); }
  for (let j = 1; j <= seg; j++) idx.push(0, j + 1, j);
  return { pos, nrm, idx };
}
function quadXY(h) { return { pos: [-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0], nrm: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], idx: [0, 1, 2, 0, 2, 3] }; }

function box() {
  const f = [[[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
    [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]];
  const pos = [], nrm = [], idx = [];
  f.forEach((q, i) => { const n = q[0]; for (let k = 1; k <= 4; k++) { pos.push(q[k][0] / 2, q[k][1] / 2, q[k][2] / 2); nrm.push(...n); } idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
  return { pos, nrm, idx };
}
const geo = {
  cork: latheRaw([[0, -0.18], [B.NECK_R - 0.06, -0.18], [B.NECK_R + 0.06, 0.18], [0, 0.18]]),
  box: box(),
  outer: lathe(OUTER), inner: lathe(INNER), lip: torus(LIP_R, LIP_TUBE),
  base: disc(INNER[3][0] + 0.02), cap: quadXY(1.4),
};
const hex = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));

const data = {
  shaders: { GLASS: [sh.GLASS_VS, sh.GLASS_FS], CORK: [sh.CORK_VS, sh.CORK_FS], LIP: [sh.LIP_VS, sh.LIP_FS], SHELF: [sh.SHELF_VS, sh.SHELF_FS], LIQ: [sh.LIQ_VS, sh.LIQ_FS], CAP: [sh.CAP_VS, sh.CAP_FS], BASE: [sh.BASE_VS.replace('position.xy', 'position.xz'), sh.BASE_FS] },
  CX: process.env.PV_CX, LIFT: process.env.PV_LIFT, lipR: LIP_R + LIP_TUBE, MECH: process.env.PV_MECH, W: process.env.PV_W, CY: process.env.PV_CY, geo, B, baseR: INNER[3][0] + 0.02, shelf: hex(LAB.shelf), palette: LAB.palette.map(hex), tint: hex(LAB.glassTint), bubble: hex(LAB.bubble), layerLen: (B.FILL_TOP - B.BOTTOM) / 4, bgData,
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
await page.setContent(`<body style="margin:0;background:#101a30"><div id=w style="position:relative;width:1000px;height:760px;${bgData ? `background:url(${bgData}) center/cover;` : 'background:linear-gradient(180deg,#3b4f7c,#18223c);'}"><canvas id=c width=1000 height=760 style="position:absolute;inset:0"></canvas></div></body>`);
const log = await page.evaluate((d) => {
  const cv = document.getElementById('c');
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) return 'no webgl2';
  const VP = `#version 300 es\nprecision highp float; precision highp int;\nuniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix; uniform mat4 modelMatrix;\nin vec3 position; in vec3 normal; in vec2 uv;\n#define attribute in\n#define varying out\n`;
  const FP = `#version 300 es\nprecision highp float; precision highp int;\nout highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n#define varying in\n`;
  const fix = (s) => s.replace('#include <colorspace_fragment>', 'gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(1.0/2.2));');
  const prog = {};
  let err = '';
  for (const [k, [vs, fs]] of Object.entries(d.shaders)) {
    const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) err += k + ': ' + gl.getShaderInfoLog(s); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VP + vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FP + fix(fs)));
    gl.bindAttribLocation(p, 0, 'position'); gl.bindAttribLocation(p, 1, 'normal'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) err += k + ' link: ' + gl.getProgramInfoLog(p);
    prog[k] = p;
  }
  if (err) return err;
  const mesh = (g) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = (arr, loc) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); };
    vb(g.pos, 0); vb(g.nrm, 1);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.idx), gl.STATIC_DRAW);
    return { vao, n: g.idx.length };
  };
  const M = Object.fromEntries(Object.entries(d.geo).map(([k, g]) => [k, mesh(g)]));

  // камера: ортографическая, наклон как в игре (ELEV = 0.26)
  const E = 0.26, cs = Math.cos(E), sn = Math.sin(E);
  const W = +(d.W ?? 7.6), H = W * 760 / 1000, cy = +(d.CY ?? 3.0), cx = +(d.CX ?? 0);
  const proj = [2 / W, 0, 0, 0, 0, 2 / H, 0, 0, 0, 0, -2 / 60, 0, 0, 0, -1, 1];
  const nm = [1, 0, 0, 0, cs, sn, 0, -sn, cs]; // вращение для нормалей (колонки)
  const mv = (x, y, z) => { // view * translate(x,y,z), смещение камеры к цели (0,cy,0)
    const ty = y - cy; return [1, 0, 0, 0, 0, cs, sn, 0, 0, -sn, cs, 0, x - cx, ty * cs - z * sn, ty * sn + z * cs - 30, 1];
  };
  gl.viewport(0, 0, 1000, 760); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  const use = (name, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const p = prog[name]; gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'projectionMatrix'), false, proj);
    const m = mv(x, y, z); for (let i = 0; i < 4; i++) { m[i] *= sx; m[4 + i] *= sy; m[8 + i] *= sz; }
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'modelViewMatrix'), false, m);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'modelMatrix'), false, [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, x, y, z, 1]);
    gl.uniformMatrix3fv(gl.getUniformLocation(p, 'normalMatrix'), false, nm);
    return p;
  };
  const u1 = (p, n, v) => gl.uniform1f(gl.getUniformLocation(p, n), v);
  const u3 = (p, n, v) => gl.uniform3fv(gl.getUniformLocation(p, n), v);
  const qc = document.createElement('canvas'); qc.width = 128; qc.height = 64;
  { const g = qc.getContext('2d'); g.font = 'bold 58px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText('?', 64, 34); g.fillStyle = '#fff'; g.fillText('?', 64, 34); }
  const qtex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, qtex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, qc); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const draw = (m, mode = gl.TRIANGLES) => { gl.bindVertexArray(m.vao); gl.drawElements(mode, m.n, gl.UNSIGNED_INT, 0); };

  // раскладка как в эталоне: верхний ряд 5, нижний 5 (одна пустая)
  const P = d.palette;
  const MECH = d.MECH;
  const rows = MECH ? [
    [[7, 2, 0], [3, 4, 1], [5, 2, 6, 3], [2, 6, 3, 1], [0, 3, 4]],
    [[4, 4, 1], [6, 2, 5], [], [1, 5, 4, 1], [6, 3, 7]],
  ] : [
    [[7, 2, 0], [3, 4, 1], [5], [2, 6, 3, 1], [0, 3, 4]],
    [[4, 2, 1], [6, 2, 5], [], [1, 5, 4], [6, 3, 7]],
  ];
  const sp = 1.32, pitch = 3.55;
  const tint = d.tint;
  const bottles = [];
  const lift = (d.LIFT ?? '').split(',').map(Number);
  rows.forEach((row, r) => row.forEach((layers, c) => {
    const b = { x: (c - 2) * sp, y: (1 - r) * pitch, z: 0, layers, hidden: 0, locked: false };
    if (MECH) { if (r === 0 && c === 0) b.hidden = 2; if (r === 0 && c === 2) b.hidden = 3; if (r === 1 && c === 1) b.hidden = 1; if (r === 1 && c === 3) b.locked = true; if (r === 0 && c === 4) b.locked = true; }
    if (lift.length === 4 && lift[0] === r && lift[1] === c) { b.z = lift[2]; b.y += lift[3] + lift[2] * Math.tan(0.26); }
    bottles.push(b);
  }));
  gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.depthMask(true);
  for (let r = 0; r < 2; r++) { const p = use('SHELF', 0, (1 - r) * pitch - 0.08, -0.2, 5 * sp + 0.6, 0.16, 1.6); u3(p, 'uColor', d.shelf); draw(M.box); }
  for (const b of bottles) {
    // жидкость (непрозрачная, alpha-to-coverage) + поверхность
    const segs = [];
    b.layers.forEach((c, i) => { if (i < b.hidden) { segs.push({ c, n: 1, hid: 1 }); return; } const l = segs[segs.length - 1]; if (l && !l.hid && l.c === c) l.n++; else segs.push({ c, n: 1, hid: 0 }); });
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(true); gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    if (segs.length) {
      let p = use('LIQ', b.x, b.y, b.z);
      const cols = new Float32Array(30), tops = new Float32Array(10), ids = new Float32Array(10), hids = new Float32Array(10); let acc = 0;
      segs.forEach((s, i) => { acc += s.n * d.layerLen; cols.set(s.hid ? [0.016, 0.012, 0.06] : P[s.c % P.length], i * 3); tops[i] = acc; ids[i] = s.c; hids[i] = s.hid; });
      gl.uniform3fv(gl.getUniformLocation(p, 'uColors'), cols); gl.uniform1fv(gl.getUniformLocation(p, 'uTop'), tops); gl.uniform1fv(gl.getUniformLocation(p, 'uIds'), ids); gl.uniform1fv(gl.getUniformLocation(p, 'uHid'), hids); gl.uniform1i(gl.getUniformLocation(p, 'uQ'), 0);
      gl.uniform1i(gl.getUniformLocation(p, 'uCount'), segs.length); u3(p, 'uUp', [0, 1, 0]); u1(p, 'uBottomY', d.B.BOTTOM); u1(p, 'uTime', 1.3); u1(p, 'uGlow', 0); u1(p, 'uCB', 0); u3(p, 'uBubble', d.bubble);
      draw(M.inner);
      p = use('CAP', b.x, b.y, b.z);
      u3(p, 'uOrigin', [0, d.B.BOTTOM + acc, 0]); u3(p, 'uU', [1, 0, 0]); u3(p, 'uV', [0, 0, -1]); u3(p, 'uTopColor', P[segs[segs.length - 1].c % P.length]);
      u1(p, 'uBottomY', d.B.BOTTOM); u1(p, 'uTime', 1.3); u1(p, 'uGlow', 0); u1(p, 'uRipple', 0); gl.uniform2f(gl.getUniformLocation(p, 'uHit'), 0, 0);
      draw(M.cap);
    }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    // стекло
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.CULL_FACE);
    const glass = (back) => { const p = use('GLASS', b.x, b.y, b.z); u3(p, 'uTint', tint); u1(p, 'uBack', back ? 1 : 0); u1(p, 'uSweep', -1); };
    gl.cullFace(gl.FRONT); glass(true); draw(M.outer);
    gl.disable(gl.CULL_FACE);
    let p = use('BASE', b.x, b.y + d.B.BOTTOM - 0.02, b.z); u3(p, 'uTint', tint); u1(p, 'uRadius', d.baseR); draw(M.base);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); glass(false); draw(M.outer);
    if (b.locked) { gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.CULL_FACE); const cp = use('CORK', b.x, b.y + d.B.H + 0.04, b.z); u1(cp, 'uWax', 1); draw(M.cork); gl.enable(gl.BLEND); gl.depthMask(false); gl.enable(gl.CULL_FACE); }
    p = use('LIP', b.x, b.y + d.B.H - 0.01, b.z); u3(p, 'uTint', tint); u1(p, 'uR', d.lipR); draw(M.lip);
  }
  return 'ok';
}, data).catch((e) => String(e));
console.log('render:', log);
await page.screenshot({ path: out });
await browser.close();
