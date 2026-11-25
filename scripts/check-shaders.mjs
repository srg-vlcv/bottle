// Компилирует и линкует все GLSL-шейдеры проекта в headless Chromium (WebGL2), имитируя префикс three.js.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const sh = await import('../src/render/shaders.ts');
const jobs = [
  { name: 'GLASS', vs: sh.GLASS_VS, fs: sh.GLASS_FS },
  { name: 'LIQUID', vs: sh.LIQ_VS, fs: sh.LIQ_FS },
  { name: 'CAP', vs: sh.CAP_VS, fs: sh.CAP_FS },
  { name: 'LIP', vs: sh.LIP_VS, fs: sh.LIP_FS },
  { name: 'BASE', vs: sh.BASE_VS, fs: sh.BASE_FS },
  { name: 'CORK', vs: sh.CORK_VS, fs: sh.CORK_FS },
  { name: 'SHELF', vs: sh.SHELF_VS, fs: sh.SHELF_FS },
];
// струя и частицы (без интерполяции) читаем из исходников
for (const f of ['src/render/stream.ts', 'src/render/particles.ts']) {
  const src = readFileSync(f, 'utf8');
  const o = {};
  for (const m of src.matchAll(/const (VS|FS) = \/\* glsl \*\/ `([\s\S]*?)`;/g)) o[m[1]] = m[2];
  jobs.push({ name: f, vs: o.VS, fs: o.FS });
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const results = await page.evaluate((jobs) => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return [{ name: 'webgl2', ok: false, log: 'WebGL2 недоступен' }];
  const VP = `#version 300 es
precision highp float; precision highp int;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix; uniform mat4 modelMatrix;
in vec3 position; in vec3 normal; in vec2 uv;
#define attribute in
#define varying out
`;
  const FP = `#version 300 es
precision highp float; precision highp int;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define varying in
`;
  const strip = (s) => s.replace('#include <colorspace_fragment>', '');
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return [s, gl.getShaderParameter(s, gl.COMPILE_STATUS), gl.getShaderInfoLog(s)]; };
  return jobs.map((j) => {
    const [vs, vok, vlog] = compile(gl.VERTEX_SHADER, VP + j.vs);
    const [fs, fok, flog] = compile(gl.FRAGMENT_SHADER, FP + strip(j.fs));
    if (!vok || !fok) return { name: j.name, ok: false, log: `${vok ? '' : 'VS: ' + vlog}\n${fok ? '' : 'FS: ' + flog}` };
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    return { name: j.name, ok: gl.getProgramParameter(p, gl.LINK_STATUS), log: gl.getProgramInfoLog(p) };
  });
}, jobs);
await browser.close();
let bad = 0;
for (const r of results) { console.log(r.ok ? 'OK  ' : 'FAIL', r.name, r.ok ? '' : '\n' + r.log); if (!r.ok) bad++; }
process.exit(bad ? 1 : 0);
