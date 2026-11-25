import { B, INNER_TOP_Y, MAX_SEGS, innerRadiusGlsl } from './bottleProfile';

/** GLSL-шейдеры бутылки (чистые строки: их компилирует и игра, и скрипты проверки/превью). */
const GLASS_SH0 = B.BODY_TOP.toFixed(3);   // плечо: начало
const GLASS_SH1 = (2.62).toFixed(3);        // плечо: конец
const NECK_Y = (2.74).toFixed(3);

// ---------------------------------------------------------------- стекло
export const GLASS_VS = /* glsl */ `
varying vec3 vN; varying float vY;
void main(){ vN = normalize(normalMatrix * normal); vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Стекло как на эталоне: почти прозрачное, тонкий яркий контур, широкие вертикальные блики на стенках, блик на плече,
// толстое дно и закатанный ободок, проход блика при заполнении.
export const GLASS_FS = /* glsl */ `
uniform vec3 uTint; uniform float uBack; uniform float uSweep; varying vec3 vN; varying float vY;
void main(){
  vec3 n = normalize(vN); if (uBack > 0.5) n = -n;
  float ang = 1.0 - abs(n.z);
  float haze = pow(ang, 1.3);                                   // лёгкая дымка к краям
  float side = smoothstep(0.3, 0.75, abs(n.x));                 // контур только на боковых кромках: без «пунктира» на горизонтальных изгибах
  float line = pow(ang, 2.6) * side;                           // тонкий контур по силуэту
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 sky = mix(vec3(0.62, 0.74, 0.9), vec3(1.0), smoothstep(-0.3, 0.9, r.y));
  float fadeY = smoothstep(0.25, 0.75, vY) * (1.0 - smoothstep(${GLASS_SH0}, ${GLASS_SH1}, vY));
  float sR = smoothstep(0.40, 0.52, n.x) * (1.0 - smoothstep(0.64, 0.78, n.x));       // широкая полоса справа
  float sL = smoothstep(-0.74, -0.64, n.x) * (1.0 - smoothstep(-0.54, -0.42, n.x));   // полоса слева
  float edge = smoothstep(0.90, 0.985, abs(n.x));                                    // яркая кромка
  float shoulder = smoothstep(${GLASS_SH0}, ${(B.BODY_TOP + 0.12).toFixed(3)}, vY) * (1.0 - smoothstep(${(2.62 - 0.04).toFixed(3)}, ${(2.62 + 0.1).toFixed(3)}, vY));
  float base = 1.0 - smoothstep(0.0, 0.34, vY);                                       // толстое дно
  float lipZone = smoothstep(${NECK_Y}, ${(2.74 + 0.12).toFixed(3)}, vY);
  // дисперсия на кромке: слева холодная, справа тёплая; мелкие «искры» на плече, у дна и на стенке
  vec3 fringe = mix(vec3(0.55, 0.85, 1.0), vec3(1.0, 0.86, 0.7), step(0.0, n.x));
  float glints = smoothstep(0.05, 0.0, length(vec2((n.x - 0.6) * 0.9, vY - 2.3))) + smoothstep(0.04, 0.0, length(vec2((n.x - 0.56) * 0.9, vY - 0.55)))
               + smoothstep(0.04, 0.0, length(vec2((n.x + 0.64) * 0.9, vY - 1.75))) * 0.8;
  float depthK = uBack > 0.5 ? 0.3 : 1.0;                       // задняя стенка: блики и контуры слабее — понятно, где перед, где зад
  line *= depthK; edge *= depthK; shoulder *= depthK; glints *= depthK;
  vec3 col = mix(uTint * 0.9, sky, haze * 0.7) + fringe * line * 0.28 + glints * 0.9 + (sR * 1.0 + sL * 0.75) * fadeY * 0.7 + edge * 0.75 + shoulder * 0.16 + base * 0.12;
  float a = 0.04 + haze * 0.14 + line * 0.7 + (sR * 0.95 + sL * 0.65) * fadeY * 0.55 + edge * 0.55 + shoulder * 0.08 + base * 0.26 + lipZone * 0.22 + glints * 0.7;
  float band = uSweep >= 0.0 ? smoothstep(0.16, 0.0, abs((vY * 0.28 + n.x * 0.55) - (uSweep * 2.2 - 0.5))) : 0.0;
  col += band * 0.9; a += band * 0.6;
  if (uBack > 0.5) { col *= 0.78; a *= 0.7; }
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
  #include <colorspace_fragment>
}`;

// Ободок горлышка: стекло здесь толще и плотнее — меньше просвета, зеленоватый оттенок на кромке, яркие блики от окна и неба.
export const LIP_VS = /* glsl */ `
varying vec3 vN; varying vec3 vL;
void main(){ vN = normalize(normalMatrix * normal); vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const LIP_FS = /* glsl */ `
uniform vec3 uTint; uniform float uR; varying vec3 vN; varying vec3 vL;
void main(){
  vec3 n = normalize(vN);
  float ang = 1.0 - abs(n.z);
  // «ближняя» часть кольца — та, что обращена к камере (локальный z > 0); дальняя видна сквозь стекло и должна быть слабее
  float nearSide = smoothstep(-0.25, 0.45, vL.z / uR);
  vec3 thick = mix(uTint * 0.8, vec3(0.6, 0.85, 0.83), 0.55);
  vec3 rv = reflect(vec3(0.0, 0.0, -1.0), n);
  float sp1 = pow(max(dot(rv, normalize(vec3(-0.45, 0.75, 0.55))), 0.0), 18.0);
  float sp2 = pow(max(dot(rv, normalize(vec3(0.6, 0.5, 0.6))), 0.0), 28.0);
  float top = smoothstep(0.3, 0.95, n.y);
  vec3 col = mix(thick, vec3(0.95, 0.98, 1.0), top * 0.55 + ang * 0.35) + (sp1 * 1.1 + sp2 * 0.7) * mix(0.25, 1.0, nearSide);
  col *= mix(0.62, 1.0, nearSide);
  float a = (0.4 + ang * 0.36 + top * 0.16 + sp1 * 0.6 + sp2 * 0.4) * mix(0.5, 1.0, nearSide);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.94));
  #include <colorspace_fragment>
}`;

// Стеклянное дно внутри бутылки: плоский диск с яркой кольцевой кромкой и лёгкой «вмятиной» в центре.
export const BASE_VS = /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const BASE_FS = /* glsl */ `
uniform vec3 uTint; uniform float uRadius; varying vec2 vP;
void main(){
  float d = length(vP) / uRadius;
  if (d > 1.0) discard;
  float ring = smoothstep(0.66, 0.8, d) * (1.0 - smoothstep(0.9, 1.0, d));
  float rimLine = smoothstep(0.93, 0.985, d);
  float dimple = 1.0 - smoothstep(0.0, 0.62, d);
  vec3 col = mix(uTint, vec3(1.0), 0.45 * ring + 0.35 * rimLine) - vec3(0.06) * dimple;
  float a = 0.07 + ring * 0.42 + rimLine * 0.3 + dimple * 0.05;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- жидкость
export const LIQ_VS = /* glsl */ `
varying vec3 vLocal; varying vec3 vN;
void main(){ vLocal = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Поверхность горизонтальна в МИРОВЫХ координатах: плоскость задаётся через uUp (мировая «вверх» в локальных координатах,
// с учётом плеска). Пороги слоёв — вдоль оси бутылки, умножаются на uUp.y (для цилиндра это сохраняет объём).
// Край плоскости сглаживается через alpha-to-coverage (без «лесенки»), внутри — пузырьки и узоры для дальтоников.
export const LIQ_FS = /* glsl */ `
uniform vec3 uColors[${MAX_SEGS}]; uniform float uTop[${MAX_SEGS}]; uniform float uIds[${MAX_SEGS}]; uniform int uCount;
uniform float uHid[${MAX_SEGS}]; uniform sampler2D uQ;
uniform vec3 uUp; uniform float uBottomY; uniform float uTime; uniform float uGlow; uniform float uCB; uniform vec3 uBubble;
varying vec3 vLocal; varying vec3 vN;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float bubbleLayer(vec2 p, float scale, float speed, float t, float seed){
  vec2 q = p * scale + vec2(seed * 13.7, -t * speed);
  vec2 id = floor(q); vec2 f = fract(q) - 0.5;
  float h = hash(id + seed);
  vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.45;
  float r = 0.10 + 0.13 * h;
  float d = length(f - off);
  float present = step(h, 0.28);
  float body = smoothstep(r, r - 0.05, d) * 0.3;
  float rim = smoothstep(0.035, 0.0, abs(d - r)) * 0.9;
  float glint = smoothstep(r * 0.45, 0.0, length(f - off - vec2(-r * 0.35, r * 0.35))) * 0.9;
  return present * (body + rim + glint);
}

// 12 узоров — по одному на цвет палитры (режим дальтоников)
float pattern(vec2 p, float id){
  int k = int(id + 0.5) - (int(id + 0.5) / 12) * 12;
  if (k == 0) return 0.0;
  if (k == 1) return step(0.5, fract((p.x + p.y) * 5.0));
  if (k == 2) return step(length(fract(p * 6.0) - 0.5), 0.2);
  if (k == 3) return step(0.5, fract(p.y * 6.0));
  if (k == 4) return step(0.5, fract(p.x * 6.0));
  if (k == 5) return step(0.5, fract(p.x * 4.0) + fract(p.y * 4.0)) * step(fract(p.x * 4.0) + fract(p.y * 4.0), 1.5);
  if (k == 6) return max(step(0.82, fract((p.x + p.y) * 5.0)), step(0.82, fract((p.x - p.y) * 5.0)));
  if (k == 7) return step(abs(length(fract(p * 4.0) - 0.5) - 0.28), 0.06);
  if (k == 8) return step(0.5, fract(p.y * 5.0 + abs(fract(p.x * 4.0) - 0.5) * 1.6));
  if (k == 9) return step(0.15, abs(fract((p.x + p.y) * 3.0) - 0.5)) * 0.0 + step(abs(fract(p.x * 4.0) - 0.5) + abs(fract(p.y * 4.0) - 0.5), 0.3);
  if (k == 10) return step(length(fract(p * 11.0) - 0.5), 0.14);
  vec2 g = abs(fract(p * 5.0) - 0.5);
  return step(min(g.x, g.y), 0.07) * step(max(g.x, g.y), 0.28);
}

void main(){
  if (uCount == 0) discard;
  float k = max(uUp.y, 0.05);
  float h = dot(vLocal - vec3(0.0, uBottomY, 0.0), uUp);
  float total = uTop[uCount - 1] * k;
  float edgeA = 1.0 - smoothstep(total - 0.007, total + 0.007, h);
  if (edgeA < 0.02) discard;

  vec3 col = uColors[0]; float pid = uIds[0]; float hid = uHid[0];
  float lo = 0.0; float hi = uTop[0] * k;
  for (int i = 1; i < ${MAX_SEGS}; i++) {
    if (i >= uCount) break;
    float b = uTop[i - 1] * k;
    float m = smoothstep(b - 0.035, b + 0.035, h);
    col = mix(col, uColors[i], m);
    if (m > 0.5) { pid = uIds[i]; hid = uHid[i]; lo = b; hi = uTop[i] * k; }
  }
  float g = clamp((h - lo) / max(hi - lo, 0.001), 0.0, 1.0);
  vec3 base = col;
  col *= 0.84 + 0.22 * g;                                          // верх слоя светлее, низ глубже

  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float vol = 1.0 - abs(n.z);                                      // 0 в центре, 1 у силуэта
  float nl = dot(n, normalize(vec3(-0.4, 0.6, 0.7))) * 0.5 + 0.5;
  col *= 0.74 + 0.46 * nl;
  // «глубина цвета»: у краёв насыщеннее и темнее, в центре — мягкое свечение, на силуэте — тонкая светлая кромка
  float lum0 = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, mix(vec3(lum0), col, 1.35) * 0.82, smoothstep(0.35, 1.0, vol) * 0.8);
  col += base * 0.12 * (1.0 - vol);
  col += col * pow(vol, 3.0) * 0.35;
  // глянцевые полосы на жидкости (в такт бликам стекла)
  float specR = smoothstep(0.42, 0.52, n.x) * (1.0 - smoothstep(0.62, 0.74, n.x));
  float specL = smoothstep(-0.72, -0.62, n.x) * (1.0 - smoothstep(-0.52, -0.40, n.x));
  col += vec3(1.0) * (specR * 0.26 + specL * 0.18) * (gl_FrontFacing ? 1.0 : 0.0);
  // тонкая светлая линия на границах слоёв (мениск)
  for (int i = 0; i < ${MAX_SEGS}; i++) {
    if (i >= uCount - 1) break;
    col += vec3(0.9) * (1.0 - smoothstep(0.0, 0.018, abs(h - uTop[i] * k))) * 0.2;
  }
  if (hid > 0.5) {
    // загадочный слой «?»: тёмная фиолетовая дымка с мерцанием и знаком вопроса на лицевой стороне
    float shimmer = 0.5 + 0.5 * sin(vLocal.y * 9.0 + uTime * 1.6 + vLocal.x * 5.0);
    col = vec3(0.13, 0.11, 0.25) * (0.85 + 0.3 * g) * (0.68 + 0.52 * nl) + vec3(0.06, 0.04, 0.13) * shimmer;
    col += col * pow(vol, 3.0) * 0.3;
    float q = gl_FrontFacing ? texture(uQ, vec2(vLocal.x / 0.936 + 0.5, (h - lo) / max(hi - lo, 0.001))).a : 0.0;
    col = mix(col, vec3(0.96, 0.92, 1.0), q * 0.92);
  }
  if (!gl_FrontFacing) col *= 0.8;

  vec3 rgt = normalize(vec3(uUp.y, -uUp.x, 0.0001));
  vec2 pw = vec2(dot(vLocal, rgt), dot(vLocal, uUp));      // координаты в «мировой» плоскости: пузырьки поднимаются вертикально
  float bub = bubbleLayer(pw, 6.0, 0.45, uTime, 0.0) + 0.8 * bubbleLayer(pw, 10.0, 0.7, uTime, 1.0);
  bub *= smoothstep(0.0, 0.14, total - h) * (1.0 - step(0.5, hid));                 // у поверхности «лопаются»
  col = mix(col, uBubble, clamp(bub, 0.0, 1.0) * 0.55);

  if (uCB > 0.5) {
    float m = pattern(vLocal.xy * 1.7, pid);
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, lum > 0.3 ? col * 0.38 : col * 1.9 + 0.12, m * 0.7);
  }
  col += col * uGlow;
  gl_FragColor = vec4(col, edgeA);
  #include <colorspace_fragment>
}`;

// Поверхность жидкости (эллипс при взгляде сверху-сбоку): плоский квадрат в плоскости уровня, обрезанный по сечению бутылки.
export const CAP_VS = /* glsl */ `
uniform vec3 uOrigin; uniform vec3 uU; uniform vec3 uV; varying vec3 vLocal;
void main(){ vec3 lp = uOrigin + position.x * uU + position.y * uV; vLocal = lp; gl_Position = projectionMatrix * modelViewMatrix * vec4(lp, 1.0); }`;
export const CAP_FS = /* glsl */ `
${innerRadiusGlsl()}
uniform vec3 uTopColor; uniform float uBottomY; uniform float uTime; uniform float uGlow; uniform float uRipple; uniform vec2 uHit;
varying vec3 vLocal;
void main(){
  float y = vLocal.y;
  float rA = innerR(y) - 0.004;
  float r = length(vLocal.xz);
  float inside = 1.0 - smoothstep(rA - 0.02, rA, r);
  if (y < uBottomY || y > ${INNER_TOP_Y} || inside < 0.02) discard;
  vec3 col = uTopColor * 1.12;
  col += uTopColor * 0.4 * smoothstep(rA - 0.14, rA, r);                       // мениск у стенки
  col += vec3(0.4) * smoothstep(0.3, 0.0, length(vLocal.xz - vec2(-0.14, 0.1))); // блик
  float d = length(vLocal.xz - uHit);
  col += uRipple * (0.5 + 0.5 * sin(d * 46.0 - uTime * 14.0)) * exp(-d * 4.5) * 0.5; // кольца от струи
  col += 0.025 * sin(vLocal.x * 20.0 + uTime * 2.1) + 0.02 * sin(vLocal.z * 23.0 - uTime * 1.7);
  col += col * uGlow;
  gl_FragColor = vec4(col, inside);
  #include <colorspace_fragment>
}`;

// Пробка с пятнами и лёгким затенением.
export const CORK_VS = /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const CORK_FS = /* glsl */ `
uniform float uWax; varying vec3 vN; varying vec3 vP;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){
  vec3 n = normalize(vN);
  float sp = hash(floor(vP * 42.0));
  vec3 cork = mix(vec3(0.80, 0.57, 0.33), vec3(0.58, 0.38, 0.2), step(0.8, sp));
  vec3 wax = mix(vec3(0.74, 0.08, 0.12), vec3(0.52, 0.04, 0.08), smoothstep(0.2, 0.9, 0.5 + 0.5 * sin(vP.y * 18.0 + vP.x * 7.0)));
  vec3 base = mix(cork, wax, uWax);
  float sh = 0.62 + 0.5 * (dot(n, normalize(vec3(-0.4, 0.7, 0.6))) * 0.5 + 0.5);
  float spec = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), n), normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 22.0) * uWax;
  gl_FragColor = vec4(base * sh + spec * 0.7, 1.0);
  #include <colorspace_fragment>
}`;


// Полка: процедурное дерево (волокна, мелкая крапинка), верхняя грань светлее, светлая кромка спереди.
export const SHELF_VS = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec3 vO;
void main(){ vO = position; vW = (modelMatrix * vec4(position, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const SHELF_FS = /* glsl */ `
uniform vec3 uColor; varying vec3 vW; varying vec3 vN; varying vec3 vO;
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float warp = sin(vW.x * 1.7) * 1.6 + sin(vW.x * 5.3 + vW.z) * 0.5;
  float grain = sin(vW.z * 38.0 + warp + h2(floor(vec2(vW.x * 0.6, vW.z * 2.0))) * 6.28) * 0.5 + 0.5;
  float ring = smoothstep(0.7, 1.0, sin(vW.z * 9.0 + warp * 2.0 + vW.x * 0.9) * 0.5 + 0.5);
  float fine = h2(floor(vec2(vW.x * 70.0, vW.z * 18.0)));
  float board = floor(vW.x * 0.34);
  float tone = 0.9 + 0.16 * h2(vec2(board, 1.7));                      // доски чуть отличаются по тону
  float seam = 1.0 - smoothstep(0.0, 0.025, abs(fract(vW.x * 0.34) - 0.0));
  vec3 c = uColor * tone * (0.74 + 0.2 * grain + 0.1 * ring + 0.05 * fine);
  float top = clamp(vN.y, 0.0, 1.0), front = clamp(vN.z, 0.0, 1.0);
  c *= 0.5 + 0.78 * top + 0.1 * front;
  c *= 1.0 - 0.35 * seam;
  c += vec3(0.1, 0.085, 0.06) * smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(vW.x * 0.55 + 0.6)) * top; // мягкий блик света
  float lip = smoothstep(0.36, 0.5, abs(vO.z)) * top;                    // светлая кромка верхней грани
  c += vec3(0.12, 0.1, 0.07) * lip;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
