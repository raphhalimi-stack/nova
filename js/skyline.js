// SKYLINE — Haneul City : monde ouvert, grappin, missions. Jeu original pour NOVA.
import * as THREE from './three.module.min.js';
import { Input, Sound, Store, Modal, ListMenu, clamp, lerp, damp, rng, el, fmtClock, fmtDuration, isTV, isTouch, lowEnd } from './core.js';

THREE.ColorManagement.enabled = false;

/* ======================= constantes du monde ======================= */
const BLOCK = 58, ROAD = 20, CELL = BLOCK + ROAD, N = 11, HALF = (N * CELL) / 2, HR = ROAD / 2;
const LIMIT = HALF + HR - 1.5;
const SEED = 20261115;
const G = 32, R = 0.45, PH = 1.8;
const V3 = THREE.Vector3;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lineC = k => -HALF + k * CELL;

export const META = { id: 'skyline', title: 'SKYLINE', subtitle: 'Haneul City' };

const SUITS = {
  cyan: { name: 'Nova', col: 0x35e8ff, req: 'Tenue de base' },
  crimson: { name: 'Écarlate', col: 0xff3a5c, req: 'Atteins le niveau 5' },
  violet: { name: 'Ultraviolet', col: 0xa65bff, req: 'Termine 3 courses' },
  emerald: { name: 'Émeraude', col: 0x3dff9a, req: 'Libère les 6 zones' },
  gold: { name: 'Or céleste', col: 0xffc93d, req: 'Récupère les 50 éclats' },
  white: { name: 'Zénith', col: 0xf2f6ff, req: "Termine l'histoire" },
};
const UPG = [
  { id: 'range', name: 'Portée du grappin', desc: 'Accroche-toi plus loin, zip plus loin', max: 3, cost: [350, 800, 1600] },
  { id: 'swing', name: 'Balancement', desc: "Plus d'élan et une impulsion plus forte au lâcher", max: 3, cost: [300, 700, 1400] },
  { id: 'speed', name: 'Course', desc: 'Cours et grimpe plus vite', max: 3, cost: [250, 600, 1200] },
  { id: 'health', name: 'Armure', desc: 'Augmente ta santé maximale', max: 3, cost: [400, 900, 1800] },
  { id: 'power', name: 'Puissance', desc: 'Frappes plus fortes', max: 3, cost: [350, 850, 1700] },
  { id: 'regen', name: 'Nano-régénération', desc: 'Récupère ta santé plus vite', max: 3, cost: [300, 700, 1500] },
  { id: 'jumps', name: 'Triple saut', desc: 'Un saut de plus en l’air', max: 1, cost: [1200] },
];
const ZONE_NAMES = ['Sinchon-ro', "Docks d'Ihwa", 'Marché Byeol', 'Tours Juno', 'Quartier Mirae', 'Gare Haneul'];
const RACE_NAMES = ['Ligne droite', 'Toits brûlants', 'Le grand huit', 'Canyon de verre', 'Vertige'];
const JOB_NAMES = ['Colis médical', 'Pièces détachées', 'Bouquet express', 'Disque crypté'];

/* ======================= génération de la ville ======================= */
function genCity() {
  const r = rng(SEED);
  const boxes = [], blocks = [], trees = [], roofs = [], signs = [], ac = [], antennas = [];
  const grid = Array.from({ length: N * N }, () => []);
  const mask = new Uint8Array(N * N * 4);
  const c = (N - 1) / 2;
  const parks = new Set();
  while (parks.size < 7) { const i = (r() * N) | 0, j = (r() * N) | 0; if (Math.abs(i - c) + Math.abs(j - c) > 1) parks.add(i + j * N); }
  const tints = [[0.36, 0.38, 0.42], [0.3, 0.33, 0.4], [0.42, 0.38, 0.33], [0.24, 0.26, 0.31], [0.46, 0.46, 0.48], [0.28, 0.31, 0.37], [0.38, 0.33, 0.36]];
  const addBox = (minX, maxX, minZ, maxZ, minY, maxY, bi, bj, tint, kind = 'b') => {
    const b = { minX, maxX, minZ, maxZ, minY, maxY, tint, seed: r(), kind, bi, bj, id: boxes.length };
    boxes.push(b); grid[bi + bj * N].push(b); return b;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = lineC(i) + HR, z0 = lineC(j) + HR;
    const dist = Math.hypot(i - c, j - c) / (c * 1.414);
    const idx = i + j * N;
    if (i === c && j === c) {
      blocks.push({ i, j, type: 'plaza', x0, z0 });
      mask[idx * 4 + 1] = 255;
      const cx = x0 + BLOCK / 2, cz = z0 + BLOCK / 2;
      addBox(cx - 14, cx + 14, cz - 14, cz + 14, 0, 220, i, j, [0.32, 0.4, 0.52], 'tower');
      addBox(cx - 10, cx + 10, cz - 10, cz + 10, 220, 235, i, j, [0.16, 0.18, 0.24], 'crown');
      addBox(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6, 235, 285, i, j, [0.5, 0.52, 0.58], 'spire');
      continue;
    }
    if (parks.has(idx)) {
      blocks.push({ i, j, type: 'park', x0, z0 });
      mask[idx * 4] = 255;
      for (let k = 0; k < 26; k++) trees.push([x0 + 5 + r() * (BLOCK - 10), z0 + 5 + r() * (BLOCK - 10), 0.7 + r() * 0.7]);
      addBox(x0 + BLOCK / 2 - 4, x0 + BLOCK / 2 + 4, z0 + BLOCK / 2 - 4, z0 + BLOCK / 2 + 4, 0, 4, i, j, [0.5, 0.45, 0.4], 'kiosk');
      continue;
    }
    blocks.push({ i, j, type: 'city', x0, z0 });
    const pats = [[1, 1], [2, 1], [1, 2], [2, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
    const [cols, rows] = pats[(r() * pats.length) | 0];
    const lw = BLOCK / cols, ld = BLOCK / rows;
    for (let a = 0; a < cols; a++) for (let bq = 0; bq < rows; bq++) {
      const sb = 1.5 + r() * 2.2;
      let w = lw - sb * 2, d = ld - sb * 2;
      if (w < 7 || d < 7) continue;
      const cx = x0 + lw * (a + 0.5) + (r() - 0.5) * sb, cz = z0 + ld * (bq + 0.5) + (r() - 0.5) * sb;
      const base = lerp(165, 24, Math.pow(dist, 0.75));
      let h = r() < 0.1 ? 7 + r() * 6 : clamp(base * (0.4 + r() * 0.9), 10, 205);
      const tint = tints[(r() * tints.length) | 0];
      const b = addBox(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0, h, i, j, tint);
      let top = b;
      if (h > 48 && r() < 0.55) {
        const s = 0.55 + r() * 0.25;
        top = addBox(cx - (w * s) / 2, cx + (w * s) / 2, cz - (d * s) / 2, cz + (d * s) / 2, h, h + h * (0.12 + r() * 0.25), i, j, tint.map(v => v * 0.92));
      }
      roofs.push(top);
      // détails de toit
      const nAc = (r() * 3) | 0;
      for (let k = 0; k < nAc; k++) {
        const tw = top.maxX - top.minX, td = top.maxZ - top.minZ;
        if (tw < 9 || td < 9) break;
        ac.push([top.minX + 2 + r() * (tw - 4), top.maxY, top.minZ + 2 + r() * (td - 4), 1.2 + r() * 1.4, 0.8 + r() * 1.2]);
      }
      if (top.maxY > 110 && r() < 0.6) antennas.push([(top.minX + top.maxX) / 2 + (r() - 0.5) * 3, top.maxY, (top.minZ + top.maxZ) / 2 + (r() - 0.5) * 3, 8 + r() * 14]);
      // enseignes : faces qui donnent sur la rue
      const faces = [];
      if (b.minX - x0 < 7) faces.push([-1, 0]); if (x0 + BLOCK - b.maxX < 7) faces.push([1, 0]);
      if (b.minZ - z0 < 7) faces.push([0, -1]); if (z0 + BLOCK - b.maxZ < 7) faces.push([0, 1]);
      if (faces.length && h > 16 && r() < 0.62) {
        const [nx, nz] = faces[(r() * faces.length) | 0];
        const along = nx !== 0 ? [b.minZ + 2, b.maxZ - 2] : [b.minX + 2, b.maxX - 2];
        const t = along[r() < 0.5 ? 0 : 1] + (r() - 0.5) * 2;
        const y = 7 + r() * Math.min(h - 14, 26);
        const fx = nx !== 0 ? (nx > 0 ? b.maxX : b.minX) + nx * 1.5 : t;
        const fz = nz !== 0 ? (nz > 0 ? b.maxZ : b.minZ) + nz * 1.5 : t;
        signs.push({ v: true, x: fx, y: y + 4, z: fz, rot: Math.atan2(nz, nx) + 0 /* lame perpendiculaire */, w: 2.6, h: 8, idx: (r() * 8) | 0, seed: r(), nx, nz });
      }
      if (faces.length && top === b && h > 18 && h < 95 && r() < 0.35) {
        const [nx, nz] = faces[(r() * faces.length) | 0];
        const cx2 = (b.minX + b.maxX) / 2, cz2 = (b.minZ + b.maxZ) / 2;
        const half = nx !== 0 ? (b.maxX - b.minX) / 2 : (b.maxZ - b.minZ) / 2;
        signs.push({ v: false, x: cx2 + nx * (half - 1.2), y: h + 3.6, z: cz2 + nz * (half - 1.2), rot: Math.atan2(nx, nz), w: Math.min(15, (nx !== 0 ? b.maxZ - b.minZ : b.maxX - b.minX) - 2), h: 5.2, idx: (r() * 8) | 0, seed: r(), nx, nz });
      }
    }
  }
  // éclats d'énergie : 36 sur les toits, 14 flottants au-dessus des carrefours
  const shards = [];
  const tall = roofs.filter(b => b.maxY > 20).sort(() => r() - 0.5);
  for (let k = 0; k < 36 && k < tall.length; k++) { const b = tall[k]; shards.push([(b.minX + b.maxX) / 2, b.maxY + 1.6, (b.minZ + b.maxZ) / 2]); }
  while (shards.length < 50) { const a = 1 + ((r() * (N - 1)) | 0), bq = 1 + ((r() * (N - 1)) | 0); shards.push([lineC(a), 26 + r() * 50, lineC(bq)]); }
  // zones de drones
  const zoneIdx = [[2, 3], [9, 2], [3, 9], [8, 8], [5, 1], [1, 6]];
  const zones = zoneIdx.map(([a, bq], k) => ({ id: k, name: ZONE_NAMES[k], x: lineC(a), z: lineC(bq), tier: k < 2 ? 0 : k < 4 ? 1 : 2 }));
  // courses : marche aléatoire sur les carrefours, en hauteur
  const races = [];
  const starts = [[5, 7], [2, 1], [8, 5], [3, 5], [7, 9]];
  for (let k = 0; k < 5; k++) {
    let [a, bq] = starts[k]; let dir = k % 4;
    const pts = []; const len = 10 + k * 2;
    const start = new V3(lineC(a), 0, lineC(bq));
    let prevH = 12;
    for (let s = 0; s < len; s++) {
      if (r() < 0.35) dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
      let na = a + [1, 0, -1, 0][dir], nb = bq + [0, 1, 0, -1][dir];
      if (na < 1 || na > N - 1 || nb < 1 || nb > N - 1) { dir = (dir + 2) % 4; na = a + [1, 0, -1, 0][dir]; nb = bq + [0, 1, 0, -1][dir]; }
      const mid = new V3((lineC(a) + lineC(na)) / 2, 0, (lineC(bq) + lineC(nb)) / 2);
      const hgt = clamp(prevH + (r() - 0.35) * (14 + k * 6), 8, 30 + k * 14);
      mid.y = hgt; pts.push(mid);
      a = na; bq = nb; prevH = hgt;
      const node = new V3(lineC(a), clamp(hgt + (r() - 0.4) * 12, 8, 30 + k * 14), lineC(bq)); pts.push(node);
      prevH = node.y;
    }
    let L = start.distanceTo(pts[0]); for (let s = 1; s < pts.length; s++) L += pts[s].distanceTo(pts[s - 1]);
    races.push({ id: k, name: RACE_NAMES[k], start, pts, gold: Math.round(L / 31), silver: Math.round(L / 24), bronze: Math.round(L / 17) });
  }
  // livraisons
  const jobs = [];
  const rr = roofs.filter(b => b.maxY > 12 && b.maxY < 120);
  for (let k = 0; k < 4; k++) {
    let a, bq, d = 0, tries = 0;
    do { a = rr[(r() * rr.length) | 0]; bq = rr[(r() * rr.length) | 0]; d = Math.hypot((a.minX + a.maxX) / 2 - (bq.minX + bq.maxX) / 2, (a.minZ + a.maxZ) / 2 - (bq.minZ + bq.maxZ) / 2); tries++; } while ((d < 260 || d > 520) && tries < 200);
    const from = new V3((a.minX + a.maxX) / 2, a.maxY, (a.minZ + a.maxZ) / 2), to = new V3((bq.minX + bq.maxX) / 2, bq.maxY, (bq.minZ + bq.maxZ) / 2);
    jobs.push({ id: k, name: JOB_NAMES[k], from, to, time: Math.round(d / 15 + 25) });
  }
  const tower = boxes.find(b => b.kind === 'crown');
  return { boxes, grid, blocks, trees, signs, ac, antennas, mask, shards, zones, races, jobs, tower };
}

/* ======================= collisions & rayons ======================= */
function rayBox(ox, oy, oz, dx, dy, dz, b, maxT, out) {
  let tmin = 0, tmax = maxT, nx = 0, ny = 0, nz = 0;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return false; }
  else { let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx, n = -1; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; n = 1; } if (t1 > tmin) { tmin = t1; nx = n; ny = 0; nz = 0; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return false; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) return false; }
  else { let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy, n = -1; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; n = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = n; nz = 0; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return false; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return false; }
  else { let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz, n = -1; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; n = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = 0; nz = n; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return false; }
  if (tmin <= 0) return false;
  out.t = tmin; out.nx = nx; out.ny = ny; out.nz = nz; out.box = b;
  return true;
}
const _hit = { t: 0, nx: 0, ny: 0, nz: 0, box: null };

/* ======================= shaders ======================= */
const LIGHT_UNI = () => ({
  uSunDir: { value: new V3(0.3, 0.8, 0.4).normalize() }, uSunCol: { value: new THREE.Color(1, 1, 1) },
  uSky: { value: new THREE.Color(0.4, 0.5, 0.7) }, uGround: { value: new THREE.Color(0.15, 0.14, 0.13) },
  uNight: { value: 0 }, uFogCol: { value: new THREE.Color(0.5, 0.6, 0.7) }, uFogNear: { value: 80 }, uFogFar: { value: 700 }, uTime: { value: 0 },
});
const BUILD_VS = `
attribute float aSeed;
varying vec3 vWP; varying vec3 vN; varying vec3 vCol; varying float vSeed; varying float vFog;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vCol = instanceColor; vSeed = aSeed;
  vec4 mv = viewMatrix * wp; vFog = -mv.z; gl_Position = projectionMatrix * mv;
}`;
const BUILD_FS = `
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround; uniform float uNight;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
varying vec3 vWP; varying vec3 vN; varying vec3 vCol; varying float vSeed; varying float vFog;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec3 n = normalize(vN);
  float diff = max(dot(n,uSunDir),0.0);
  vec3 amb = mix(uGround,uSky,n.y*0.5+0.5);
  vec3 col;
  if(n.y > 0.5){
    col = vCol*0.62*(amb + uSunCol*diff);
    vec2 g = fract(vWP.xz/3.0); col *= 0.92 + 0.08*step(0.06,min(g.x,g.y));
  } else if(n.y < -0.5){ col = vCol*0.2; }
  else {
    float u = abs(n.x) > 0.5 ? vWP.z : vWP.x;
    vec2 cell = vec2(u/3.4, vWP.y/4.2);
    vec2 f = fract(cell); vec2 id = floor(cell);
    float win = step(0.16,f.x)*step(f.x,0.84)*step(0.2,f.y)*step(f.y,0.8);
    float lobby = 1.0 - step(4.2, vWP.y);
    vec2 fw = fwidth(cell);
    float aa = clamp(1.4 - max(fw.x, fw.y)*2.2, 0.0, 1.0);
    win = mix(0.4, win, aa) * (1.0 - lobby);
    float rnd = h21(id + vec2(vSeed*91.7, n.x*13.0 + n.z*7.0));
    vec3 wall = vCol*(amb + uSunCol*diff*0.95);
    vec3 glassDay = mix(vec3(0.16,0.2,0.27), uSky, 0.45)*(0.55 + 0.7*diff) + uSunCol*pow(diff,8.0)*0.25;
    float lit = mix(0.36, step(0.6, rnd), aa) * uNight;
    vec3 warm = rnd > 0.9 ? vec3(0.55,0.85,1.0) : (rnd > 0.86 ? vec3(1.0,0.6,0.8) : vec3(1.0,0.78,0.48));
    warm = mix(vec3(0.95,0.78,0.55), warm, aa);
    vec3 glass = mix(glassDay*(1.0 - uNight*0.8), warm*1.1, lit);
    col = mix(wall, glass, win*0.92);
    col = mix(col, vec3(1.0,0.86,0.62)*0.85, lobby*uNight*0.55*step(0.35,fract(u/7.0)));
    col *= 0.62 + 0.38*smoothstep(0.0,7.0,vWP.y);
  }
  float fog = smoothstep(uFogNear,uFogFar,vFog);
  gl_FragColor = vec4(mix(col,uFogCol,fog),1.0);
}`;
const GROUND_VS = `varying vec3 vWP; varying float vFog;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vec4 mv = viewMatrix*wp; vFog=-mv.z; gl_Position = projectionMatrix*mv; }`;
const GROUND_FS = `
uniform sampler2D uMask; uniform float uHalf; uniform float uCell; uniform float uRoad; uniform float uN;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround; uniform float uNight;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
varying vec3 vWP; varying float vFog;
float hash(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
void main(){
  vec2 p = vWP.xz + uHalf;
  vec2 id = floor(p/uCell); vec2 f = p - id*uCell;
  float hr = uRoad*0.5;
  vec2 dc = min(f, uCell - f);
  bool rx = dc.x < hr; bool rz = dc.y < hr;
  vec3 col; float lamp = 0.0;
  if(rx || rz){
    col = vec3(0.075,0.08,0.09) + hash(floor(p*2.0))*0.018;
    if(rx && !rz){
      if(dc.x < 0.13 && fract(p.y/7.0) < 0.55) col = vec3(0.75,0.62,0.2);
      if(abs(dc.x-(hr-0.9)) < 0.1) col = vec3(0.5);
      if(dc.y > hr && dc.y < hr+3.2 && fract(dc.x/1.15) < 0.5 && dc.x < hr-1.4) col = vec3(0.62);
    } else if(rz && !rx){
      if(dc.y < 0.13 && fract(p.x/7.0) < 0.55) col = vec3(0.75,0.62,0.2);
      if(abs(dc.y-(hr-0.9)) < 0.1) col = vec3(0.5);
      if(dc.x > hr && dc.x < hr+3.2 && fract(dc.y/1.15) < 0.5 && dc.y < hr-1.4) col = vec3(0.62);
    }
    if(!(rx && rz)){
      float along = rx ? vWP.z : vWP.x; float lat = rx ? dc.x : dc.y;
      float la = along - (floor((along-18.0)/36.0 + 0.5)*36.0 + 18.0);
      float ll = lat - (hr-1.4);
      lamp = exp(-(la*la + ll*ll*2.5)/70.0);
    }
  } else {
    vec4 m = texture2D(uMask, (clamp(id,0.0,uN-1.0)+0.5)/uN);
    float e = min(dc.x,dc.y) - hr;
    col = vec3(0.3,0.3,0.31);
    vec2 tl = fract(p/2.0); if(min(tl.x,tl.y) < 0.04) col *= 0.86;
    if(e > 3.5){
      if(m.r > 0.5) col = vec3(0.11,0.23,0.1)*(0.8 + 0.4*hash(floor(p*0.7)));
      else if(m.g > 0.5) { col = vec3(0.34,0.34,0.36)*(0.9 + 0.1*mod(floor(p.x/4.0)+floor(p.y/4.0),2.0)); float rr = length(p - (id+0.5)*uCell); col += vec3(0.1,0.5,0.6)*uNight*0.5*smoothstep(1.0,0.0,abs(rr-24.0)); }
      else col = vec3(0.2,0.2,0.215);
    }
    if(e < 0.35) col = vec3(0.46);
  }
  vec3 amb = uGround*0.6 + uSky*0.5;
  vec3 lit = col*(amb + uSunCol*max(uSunDir.y,0.0)) + vec3(1.0,0.74,0.42)*lamp*uNight*0.6;
  float fog = smoothstep(uFogNear,uFogFar,vFog);
  gl_FragColor = vec4(mix(lit,uFogCol,fog),1.0);
}`;
const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FS = `
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunDir; uniform float uNight; uniform float uDusk; uniform float uTime;
varying vec3 vDir;
float h31(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uZen, pow(clamp(h,0.0,1.0),0.55));
  if(h < 0.0) col = uHor*0.85;
  float s = max(dot(d,uSunDir),0.0);
  col += vec3(1.0,0.6,0.3)*pow(s,6.0)*0.35*uDusk + vec3(1.0,0.95,0.85)*smoothstep(0.9993,0.9997,s)*(1.0-uNight);
  float m = max(dot(d,-uSunDir),0.0);
  col += vec3(0.85,0.9,1.0)*smoothstep(0.9990,0.9994,m)*uNight + vec3(0.3,0.4,0.6)*pow(m,40.0)*0.25*uNight;
  if(h > 0.02){
    vec3 q = floor(d*260.0);
    float st = step(0.9965, h31(q));
    float tw = 0.6 + 0.4*sin(uTime*2.0 + h31(q+1.0)*40.0);
    col += vec3(st*tw)*uNight*smoothstep(0.02,0.25,h);
  }
  gl_FragColor = vec4(col,1.0);
}`;
const SIGN_VS = `attribute vec4 aRect; attribute float aSeed; varying vec2 vUv; varying float vFog; varying float vSeed;
void main(){ vUv = aRect.xy + uv*aRect.zw; vSeed = aSeed; vec4 mv = viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0); vFog = -mv.z; gl_Position = projectionMatrix*mv; }`;
const SIGN_FS = `uniform sampler2D uMap; uniform float uNight; uniform float uTime; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
varying vec2 vUv; varying float vFog; varying float vSeed;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb;
  float fl = step(0.93, fract(sin(floor(uTime*9.0 + vSeed*50.0)*12.9898)*43758.5)) * step(0.8, vSeed);
  c *= (0.5 + 0.8*uNight) * (1.0 - fl*0.8);
  float fog = smoothstep(uFogNear, uFogFar*1.35, vFog);
  gl_FragColor = vec4(mix(c,uFogCol,fog),1.0);
}`;
const WATER_FS = `uniform vec3 uFogCol; uniform vec3 uSky; uniform float uTime; uniform float uNight; uniform float uFogNear; uniform float uFogFar;
varying vec3 vWP; varying float vFog;
void main(){
  float w = sin(vWP.x*0.08+uTime*0.7)*sin(vWP.z*0.07-uTime*0.5);
  vec3 col = mix(vec3(0.02,0.05,0.08), uSky*0.6, 0.35+0.15*w);
  float sp = pow(max(0.0, sin(vWP.x*0.9+uTime*2.0)*sin(vWP.z*0.8-uTime*1.6)), 30.0);
  col += sp*mix(vec3(0.6), vec3(1.0,0.75,0.4), uNight)*0.4;
  float fog = smoothstep(uFogNear,uFogFar,vFog);
  gl_FragColor = vec4(mix(col,uFogCol,fog),1.0);
}`;
const BEAM_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const BEAM_FS = `uniform vec3 uCol; uniform float uTime; varying vec2 vUv;
void main(){ float a = pow(1.0-vUv.y,1.6)*0.6; a *= 0.75 + 0.25*sin(vUv.y*60.0 - uTime*5.0); gl_FragColor = vec4(uCol*a,1.0); }`;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}
function signAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#06070b'; x.fillRect(0, 0, 1024, 1024);
  const font = "'Sora','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  const H = ['NOVA', '노래방', '24H', '치킨', 'HANEUL', 'PC방', '카페', 'SKY BAR'];
  const V = ['노바', '서울', '약국', '호텔', '식당', '편의점', '당구', '하늘'];
  const cols = ['#ff3df2', '#36e9ff', '#ffd23d', '#ff6a3d', '#7dff6b', '#a46bff', '#ff8ad8', '#3dffc5'];
  const rects = { H: [], V: [] };
  const neon = (txt, cx, cy, size, col) => {
    x.font = `800 ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = col; x.shadowBlur = 26; x.fillStyle = col; x.fillText(txt, cx, cy);
    x.shadowBlur = 8; x.fillStyle = '#ffffff'; x.globalAlpha = 0.85; x.fillText(txt, cx, cy); x.globalAlpha = 1; x.shadowBlur = 0;
  };
  H.forEach((t, i) => {
    const X = (i % 2) * 512, Y = Math.floor(i / 2) * 160, col = cols[i];
    x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 18;
    x.strokeRect(X + 14, Y + 14, 484, 132); x.shadowBlur = 0;
    neon(t, X + 256, Y + 82, t.length > 5 ? 78 : 96, col);
    rects.H.push([X / 1024, 1 - (Y + 160) / 1024, 512 / 1024, 160 / 1024]);
  });
  V.forEach((t, i) => {
    const X = i * 128, Y = 640, col = cols[(i + 3) % 8];
    x.strokeStyle = col; x.lineWidth = 5; x.shadowColor = col; x.shadowBlur = 16; x.strokeRect(X + 10, Y + 10, 108, 364); x.shadowBlur = 0;
    const ch = [...t]; const step = 330 / ch.length;
    ch.forEach((cc, k) => neon(cc, X + 64, Y + 30 + step * (k + 0.5), Math.min(84, step * 0.9), col));
    rects.V.push([X / 1024, 1 - (Y + 384) / 1024, 128 / 1024, 384 / 1024]);
  });
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  return { tex, rects };
}
function mergeGeos(list) {
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/* ======================= histoire ======================= */
const STORY = [
  null, // 0 = tutoriel
  { title: 'Premier signal', obj: { type: 'zone', zone: 0 }, start: (g) => [`Un premier groupe de drones a pris le quartier ${ZONE_NAMES[0]}. Va les déloger.`], end: ['Le quartier respire à nouveau. AXIOM va réagir, reste mobile.'], cr: 300, xp: 150 },
  { title: 'Colis prioritaire', obj: { type: 'job', job: 0 }, start: () => ['Un médecin attend un colis de l’autre côté de la ville. Récupère-le au point vert, livre-le avant la fin du chrono.'], end: ['Livré à temps. Tu fais un sacré coursier volant.'], cr: 350, xp: 160 },
  { title: "Course d'essai", obj: { type: 'race', race: 0 }, start: () => [`Je veux mesurer ta vitesse. Passe tous les anneaux de la course « ${RACE_NAMES[0]} ». Une médaille suffit.`], end: ['Pas mal du tout. Tu pourras retenter les courses pour décrocher l’or.'], cr: 400, xp: 200 },
  { title: 'Le voleur', obj: { type: 'chase' }, start: () => ['Alerte ! Un drone d’AXIOM vient de voler des données. Rattrape-le et frappe-le trois fois !'], end: ['Données récupérées. Elles parlent d’une « Sentinelle » au sommet de la Tour Nova…'], cr: 450, xp: 220 },
  { title: 'Zones rouges', obj: { type: 'zones', zones: [1, 2] }, start: () => [`AXIOM renforce deux quartiers : ${ZONE_NAMES[1]} et ${ZONE_NAMES[2]}. Libère-les tous les deux.`], end: ['Leur réseau s’affaiblit. Il me faut de l’énergie pour percer leur pare-feu.'], cr: 600, xp: 300 },
  { title: 'Éclats de ciel', obj: { type: 'shards', count: 10 }, start: () => ['Les éclats d’énergie sur les toits alimentent ta combinaison. Récupères-en 10 au total.'], end: ['Énergie suffisante. Je perce le pare-feu de la tour… C’est ouvert.'], cr: 500, xp: 250 },
  { title: 'Ascension', obj: { type: 'reach' }, start: () => ['Monte au sommet de la Tour Nova, le point le plus haut de la ville. Bonne grimpe.'], end: ['Tu y es. Attention… quelque chose arrive.'], cr: 400, xp: 200 },
  { title: 'Sentinelle', obj: { type: 'boss' }, start: () => ['La Sentinelle, le cerveau d’AXIOM, se cache au sommet de la Tour Nova. Va la chercher.'], end: ['Tu l’as eue ! Haneul City est libre. Merci, NOVA.', 'La ville a encore besoin de toi : il reste des zones, des courses et des éclats. Vise les 100 %.'], cr: 1500, xp: 800 },
];
const TUTO = [
  { obj: () => 'Déplace-toi et saute deux fois', line: () => `Commence simple : bouge et saute. Appuie deux fois sur ${Input.glyph('jump')} pour un double saut.` },
  { obj: () => `Maintiens ${Input.glyph('swing')} pour te balancer, relâche pour t’envoler`, line: () => 'Le grappin s’accroche aux bâtiments. Maintiens, prends de l’élan, relâche au bon moment.' },
  { obj: () => `Vise un mur ou un toit et appuie sur ${Input.glyph('zip')}`, line: () => 'Le zip te tire en ligne droite vers ce que tu vises. Le viseur s’allume quand c’est à portée.' },
  { obj: () => "Atteins le toit d'un immeuble", line: () => 'Monte sur un toit. Tu peux aussi courir droit vers un mur pour l’escalader.' },
  { obj: () => `Élimine les 3 drones d'entraînement (${Input.glyph('attack')})`, line: () => `J’envoie trois drones d’entraînement. Frappe, enchaîne les coups, esquive avec ${Input.glyph('dash')}.` },
];

/* ======================= le jeu ======================= */
export class Skyline {
  constructor(root, { onExit }) {
    this.root = root; this.onExit = onExit;
    this.city = genCity();
    this.save = this.loadSave();
    this.time = 0; this.hitstop = 0; this.shake = 0; this.menu = null;
    this.drones = []; this.projectiles = []; this.act = null; this.chase = null; this.boss = null;
    this.dialogQ = []; this.dialogT = 0;
    this.quality = Store.settings.quality === 'auto' ? ((isTV || lowEnd) ? 'low' : isTouch ? 'medium' : 'high') : Store.settings.quality;
    this.initRenderer(); this.initWorld(); this.initPlayer(); this.initHUD();
    if (isTouch || Input.device === 'touch') this.initTouch();
    this.applySave();
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize);
    this.onVis = () => { if (document.hidden && !this.menu) this.openPause(); if (document.hidden) this.saveGame(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
    this.last = performance.now(); this.running = true;
    this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0;
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    Sound.playMusic('game');
    if (this.save.story === 0 && this.save.tut === 0) {
      this.say(['Ici IRIS. Tu m’entends ? Parfait. Bienvenue à Haneul City.', 'Les drones d’AXIOM contrôlent la ville. Toi, tu as la combinaison NOVA et un grappin. C’est un bon début.', TUTO[0].line()]);
    } else this.toast('Partie reprise', 'Bon retour à Haneul City', 'cyan');
  }

  /* ---------- sauvegarde ---------- */
  newSave() {
    return { v: 1, pos: [0, 0, 41], yaw: 0, health: 100, credits: 0, xp: 0, level: 1, up: { range: 0, swing: 0, speed: 0, health: 0, power: 0, regen: 0, jumps: 0 }, suit: 'cyan', suits: ['cyan'], shards: [], races: {}, zones: {}, zonesEver: [], jobs: {}, story: 0, tut: 0, playTime: 0, tod: 0.69, stats: { drones: 0, dist: 0, deliveries: 0, chases: 0, races: 0 }, created: Date.now() };
  }
  loadSave() {
    const s = Store.getGame('skyline');
    if (!s || !s.state) return this.newSave();
    const d = this.newSave();
    const st = Object.assign(d, s.state);
    st.up = Object.assign(this.newSave().up, s.state.up || {});
    st.stats = Object.assign(this.newSave().stats, s.state.stats || {});
    return st;
  }
  completion() {
    const s = this.save;
    const medals = Object.values(s.races).reduce((a, t) => a + (t ? 1 : 0), 0);
    const goldish = this.city.races.reduce((a, rc) => { const t = s.races[rc.id]; return a + (t ? (t <= rc.gold ? 3 : t <= rc.silver ? 2 : 1) : 0); }, 0);
    const jobs = Object.keys(s.jobs).length;
    return Math.round((s.shards.length / 50) * 30 + (s.zonesEver.length / 6) * 20 + (goldish / 15) * 15 + (jobs / 4) * 10 + (Math.min(s.story, 9) / 9) * 25) + (medals > 99 ? 1 : 0);
  }
  saveGame() {
    const s = this.save, P = this.P;
    if (P && P.state !== 'dead') { s.pos = [P.pos.x, Math.max(0, P.pos.y), P.pos.z]; s.health = P.health; }
    s.yaw = this.cam ? this.cam.yaw : 0;
    s.tod = this.tod;
    Store.setGame('skyline', { state: JSON.parse(JSON.stringify(s)), summary: { level: s.level, completion: this.completion(), playTime: s.playTime, story: s.story, shards: s.shards.length, zones: s.zonesEver.length, credits: s.credits, chapter: s.story === 0 ? 'Premiers pas' : (STORY[s.story] ? STORY[s.story].title : 'Histoire terminée') } });
    this.lastSave = this.time;
  }
  applySave() {
    const s = this.save;
    this.P.pos.set(s.pos[0], s.pos[1], s.pos[2]);
    this.P.health = Math.min(s.health || this.maxHealth(), this.maxHealth());
    this.cam.yaw = s.yaw || 0;
    this.tod = s.tod;
    this.setSuit(s.suit);
    this.P.safe.copy(this.P.pos);
    if (s.story === 0 && s.tut >= 4) this.spawnTraining();
    this.storyStarted = false;
  }

  /* ---------- stats dérivées ---------- */
  maxHealth() { return [100, 130, 165, 200][this.save.up.health]; }
  range() { return [75, 100, 125, 150][this.save.up.range]; }
  runSpeed() { return [10.5, 12, 13.5, 15][this.save.up.speed]; }
  power() { return [1, 1.3, 1.65, 2][this.save.up.power]; }
  maxJumps() { return 2 + this.save.up.jumps; }
  regen() { return [[6, 10], [4.5, 16], [3.5, 24], [2.5, 32]][this.save.up.regen]; }

  /* ---------- rendu ---------- */
  initRenderer() {
    const q = this.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: q === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.prTarget = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'medium' ? Math.min(devicePixelRatio, 1.5) : (isTV ? 0.6 : Math.min(devicePixelRatio, 0.85));
    this.pr = this.prTarget; this.renderer.setPixelRatio(this.pr);
    this.root.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'game-canvas';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.3, 2200);
    this.fogFar = q === 'low' ? (isTV ? 320 : 430) : q === 'medium' ? 620 : 820;
    this.scene.fog = new THREE.Fog(0x8899aa, 60, this.fogFar);
    this.hemi = new THREE.HemisphereLight(0x8899bb, 0x222018, 1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.sun.position.set(1, 2, 1); this.scene.add(this.sun);
    this.U = LIGHT_UNI();
    this.glowTex = glowTexture();
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.menu && !Modal.active && Input.device !== 'touch' && !isTouch && document.pointerLockElement !== this.renderer.domElement) {
        try { const p = this.renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      }
    });
  }
  resize() {
    const w = this.root.clientWidth || innerWidth, h = this.root.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.W = w; this.H = h;
    this.root.classList.toggle('portrait', h > w);
  }

  initWorld() {
    const C = this.city, U = this.U, sc = this.scene, lowQ = this.quality === 'low';
    // ciel
    this.skyU = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: U.uSunDir, uNight: U.uNight, uDusk: { value: 0 }, uTime: U.uTime };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; sc.add(this.sky);
    // bâtiments
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0);
    const bm = new THREE.ShaderMaterial({ uniforms: U, vertexShader: BUILD_VS, fragmentShader: BUILD_FS, extensions: { derivatives: true } });
    const im = new THREE.InstancedMesh(bg, bm, C.boxes.length);
    const seeds = new Float32Array(C.boxes.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    C.boxes.forEach((b, i) => {
      m4.makeScale(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ); m4.setPosition((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2);
      im.setMatrixAt(i, m4); col.setRGB(b.tint[0], b.tint[1], b.tint[2]); im.setColorAt(i, col); seeds[i] = b.seed;
    });
    bg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    im.computeBoundingSphere(); sc.add(im); this.buildings = im;
    // sol
    const tex = new THREE.DataTexture(C.mask, N, N, THREE.RGBAFormat); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter;
    const gU = Object.assign({ uMask: { value: tex }, uHalf: { value: HALF }, uCell: { value: CELL }, uRoad: { value: ROAD }, uN: { value: N } }, U);
    const gg = new THREE.PlaneGeometry(2 * (HALF + HR), 2 * (HALF + HR)); gg.rotateX(-Math.PI / 2);
    sc.add(new THREE.Mesh(gg, new THREE.ShaderMaterial({ uniforms: gU, vertexShader: GROUND_VS, fragmentShader: GROUND_FS })));
    // eau + quai
    const wg = new THREE.PlaneGeometry(5000, 5000); wg.rotateX(-Math.PI / 2); wg.translate(0, -2, 0);
    sc.add(new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: U, vertexShader: GROUND_VS, fragmentShader: WATER_FS })));
    const wallM = new THREE.MeshLambertMaterial({ color: 0x3a3c42 });
    const E = HALF + HR;
    [[0, -E, 2 * E + 2, 1], [0, E, 2 * E + 2, 1], [-E, 0, 1, 2 * E], [E, 0, 1, 2 * E]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), wallM); m.position.set(x, -0.9, z); sc.add(m); });
    // lampadaires
    const lamps = [];
    for (let k = 0; k <= N; k++) {
      const L = lineC(k);
      for (let a = -HALF + 18; a < HALF; a += 36) {
        const nearInter = Math.abs(((a + HALF) % CELL + CELL) % CELL) < HR + 1 || CELL - (((a + HALF) % CELL + CELL) % CELL) < HR + 1;
        if (nearInter) continue;
        for (const s of [-1, 1]) { lamps.push([L + s * (HR - 1.4), a, s, 0]); lamps.push([a, L + s * (HR - 1.4), s, 1]); }
      }
    }
    const pole = mergeGeos([new THREE.CylinderGeometry(0.11, 0.15, 7, 6).translate(0, 3.5, 0), new THREE.BoxGeometry(1.6, 0.14, 0.14).translate(-0.7, 6.9, 0)]);
    const poles = new THREE.InstancedMesh(pole, new THREE.MeshLambertMaterial({ color: 0x2b2e35 }), lamps.length);
    const bulbPos = new Float32Array(lamps.length * 3), bulbCol = new Float32Array(lamps.length * 3);
    const q = new THREE.Quaternion(), sv = new V3(1, 1, 1), yv = new V3(0, 1, 0);
    lamps.forEach((l, i) => {
      const [x, z, s, ax] = l;
      // le bras pointe vers la chaussée
      const ang = ax === 0 ? (s > 0 ? 0 : Math.PI) : (s > 0 ? -Math.PI / 2 : Math.PI / 2);
      q.setFromAxisAngle(yv, ang); m4.compose(new V3(x, 0, z), q, sv); poles.setMatrixAt(i, m4);
      const bx = x + Math.cos(ang) * -1.4, bz = z - Math.sin(ang) * -1.4;
      bulbPos.set([bx, 6.75, bz], i * 3); bulbCol.set([1, 0.78, 0.5], i * 3);
    });
    sc.add(poles);
    const bulbGeo = new THREE.BufferGeometry(); bulbGeo.setAttribute('position', new THREE.BufferAttribute(bulbPos, 3)); bulbGeo.setAttribute('color', new THREE.BufferAttribute(bulbCol, 3));
    this.bulbMat = new THREE.PointsMaterial({ size: 3.2, map: this.glowTex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    sc.add(new THREE.Points(bulbGeo, this.bulbMat));
    // arbres
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 3, 6).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({ color: 0x3b2b1e }), C.trees.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 0).translate(0, 4.6, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), C.trees.length);
    C.trees.forEach(([x, z, s], i) => {
      m4.makeScale(s, s, s); m4.setPosition(x, 0, z); trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4);
      col.setRGB(0.12 + Math.random() * 0.08, 0.3 + Math.random() * 0.15, 0.1 + Math.random() * 0.05); crown.setColorAt(i, col);
    });
    sc.add(trunk, crown);
    // climatiseurs
    const acM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x5a5d66 }), C.ac.length || 1);
    C.ac.forEach(([x, y, z, w, h], i) => { m4.makeScale(w, h, w * 0.8); m4.setPosition(x, y, z); acM.setMatrixAt(i, m4); });
    acM.count = C.ac.length; sc.add(acM);
    // antennes + feux rouges
    const antM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 5).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x777b85 }), C.antennas.length + 1);
    const redPos = [];
    C.antennas.forEach(([x, y, z, h], i) => { m4.makeScale(1, h, 1); m4.setPosition(x, y, z); antM.setMatrixAt(i, m4); redPos.push(x, y + h + 0.3, z); });
    const tw = C.tower; redPos.push((tw.minX + tw.maxX) / 2, 286, (tw.minZ + tw.maxZ) / 2);
    antM.count = C.antennas.length; sc.add(antM);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(redPos, 3));
    this.redMat = new THREE.PointsMaterial({ size: 7, map: this.glowTex, color: 0xff2030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    sc.add(new THREE.Points(rg, this.redMat));
    // tour Nova : anneau holographique
    const tcx = (tw.minX + tw.maxX) / 2, tcz = (tw.minZ + tw.maxZ) / 2;
    this.towerTop = new V3(tcx, tw.maxY, tcz);
    this.holo = new THREE.Group();
    const holoMat = new THREE.MeshBasicMaterial({ color: 0x35e8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(9 + k * 4, 0.22, 6, 64), holoMat); t.rotation.x = Math.PI / 2; t.position.y = k * 6; this.holo.add(t); }
    this.holo.position.set(tcx, 252, tcz); sc.add(this.holo);
    // enseignes néon
    const atlas = signAtlas();
    const sg = new THREE.PlaneGeometry(1, 1);
    const sm = new THREE.ShaderMaterial({ uniforms: { uMap: { value: atlas.tex }, uNight: U.uNight, uTime: U.uTime, uFogCol: U.uFogCol, uFogNear: U.uFogNear, uFogFar: U.uFogFar }, vertexShader: SIGN_VS, fragmentShader: SIGN_FS, side: THREE.DoubleSide });
    const si = new THREE.InstancedMesh(sg, sm, C.signs.length || 1);
    const rects = new Float32Array(C.signs.length * 4), sseed = new Float32Array(C.signs.length);
    C.signs.forEach((s, i) => {
      // lame verticale : perpendiculaire à la façade ; panneau : face à la rue
      const rot = s.v ? Math.atan2(-s.nx, s.nz) + Math.PI / 2 : s.rot;
      q.setFromAxisAngle(yv, rot); m4.compose(new V3(s.x, s.y, s.z), q, new V3(s.w, s.h, 1)); si.setMatrixAt(i, m4);
      rects.set(s.v ? atlas.rects.V[s.idx] : atlas.rects.H[s.idx], i * 4); sseed[i] = s.seed;
    });
    sg.setAttribute('aRect', new THREE.InstancedBufferAttribute(rects, 4));
    sg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sseed, 1));
    si.count = C.signs.length; sc.add(si);
    // voitures
    this.initCars(lowQ ? 28 : 56);
    // éclats
    const shG = new THREE.OctahedronGeometry(0.75, 0);
    this.shardMesh = new THREE.InstancedMesh(shG, new THREE.MeshBasicMaterial({ color: 0x9ffcff }), 50);
    sc.add(this.shardMesh);
    const sgp = new THREE.BufferGeometry(); sgp.setAttribute('position', new THREE.Float32BufferAttribute(C.shards.flat(), 3));
    this.shardGlowGeo = sgp;
    sc.add(new THREE.Points(sgp, new THREE.PointsMaterial({ size: 6, map: this.glowTex, color: 0x40e8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })));
    // faisceaux (objectifs)
    this.beamGeo = new THREE.CylinderGeometry(1.4, 1.4, 320, 12, 1, true); this.beamGeo.translate(0, 160, 0);
    this.beams = [];
    this.wpBeam = this.makeBeam(0x35e8ff); this.wpBeam.scale.set(1.3, 1, 1.3);
    // anneaux de course
    const ringG = new THREE.TorusGeometry(5, 0.38, 8, 36);
    this.rings = [0, 1, 2].map(k => { const m = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: k ? 0x886622 : 0xffd23d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; sc.add(m); return m; });
    // particules
    this.initParticles(lowQ ? 260 : 600);
    // projectiles
    this.projGeo = new THREE.BufferGeometry(); this.projGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.projPts = new THREE.Points(this.projGeo, new THREE.PointsMaterial({ size: 2.6, map: this.glowTex, color: 0xff3048, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.projPts.frustumCulled = false; sc.add(this.projPts);
    // matériaux drones
    this.droneMat = new THREE.MeshPhongMaterial({ color: 0x23262e, shininess: 70, specular: 0x667788 });
    this.droneEye = new THREE.MeshBasicMaterial({ color: 0xff2a3c });
    this.droneRing = new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    // balises d'activités
    this.zoneBeams = C.zones.map(z => { const b = this.makeBeam(0xff3048); b.position.set(z.x, 0, z.z); return b; });
    this.raceBeams = C.races.map(rc => { const b = this.makeBeam(0xffd23d); b.position.copy(rc.start); b.scale.set(1.6, 0.25, 1.6); return b; });
    this.jobBeams = C.jobs.map(j => { const b = this.makeBeam(0x3dff9a); b.position.copy(j.from); b.scale.set(1.2, 0.3, 1.2); return b; });
    this.dropBeam = this.makeBeam(0x3dff9a); this.dropBeam.visible = false;
    this.buildMinimap();
  }
  makeBeam(color) {
    const m = new THREE.Mesh(this.beamGeo, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(color) }, uTime: this.U.uTime }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false; this.scene.add(m); this.beams.push(m); return m;
  }

  initCars(n) {
    const r = rng(77);
    this.cars = [];
    const body = new THREE.BoxGeometry(4.3, 1.05, 2).translate(0, 0.75, 0);
    const cab = new THREE.BoxGeometry(2.3, 0.75, 1.75).translate(-0.3, 1.62, 0);
    this.carBody = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.carCab = new THREE.InstancedMesh(cab, new THREE.MeshLambertMaterial({ color: 0x15181f }), n);
    const pal = [[0.8, 0.1, 0.12], [0.9, 0.9, 0.92], [0.08, 0.08, 0.1], [0.15, 0.3, 0.7], [0.9, 0.7, 0.1], [0.5, 0.52, 0.55], [0.1, 0.45, 0.35]];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const axis = r() < 0.5 ? 0 : 1, line = (r() * (N + 1)) | 0;
      this.cars.push({ axis, line, pos: -HALF + r() * 2 * HALF, dir: r() < 0.5 ? 1 : -1, speed: 9 + r() * 7, x: 0, z: 0, rot: 0 });
      const p = pal[(r() * pal.length) | 0]; col.setRGB(p[0], p[1], p[2]); this.carBody.setColorAt(i, col);
    }
    this.carBody.frustumCulled = this.carCab.frustumCulled = false;
    this.scene.add(this.carBody, this.carCab);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
    const lc = new Float32Array(n * 4 * 3);
    for (let i = 0; i < n; i++) { lc.set([1, 0.95, 0.8, 1, 0.95, 0.8, 1, 0.1, 0.1, 1, 0.1, 0.1], i * 12); }
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    this.carLightMat = new THREE.PointsMaterial({ size: 1.6, map: this.glowTex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.carLights = new THREE.Points(lg, this.carLightMat); this.carLights.frustumCulled = false; this.scene.add(this.carLights);
  }
  updateCars(dt) {
    const m4 = this.m4 || (this.m4 = new THREE.Matrix4()), q = new THREE.Quaternion(), yv = new V3(0, 1, 0), one = new V3(1, 1, 1), p = new V3();
    const lp = this.carLights.geometry.attributes.position;
    this.cars.forEach((c, i) => {
      const prev = c.pos;
      c.pos += c.dir * c.speed * dt;
      // carrefour franchi ?
      const k0 = Math.floor((prev + HALF) / CELL), k1 = Math.floor((c.pos + HALF) / CELL);
      const crossed = c.dir > 0 ? (k1 > k0 ? k1 : -1) : (k1 < k0 ? k0 : -1);
      if (crossed >= 0 || c.pos < -HALF || c.pos > HALF) {
        const k = clamp(crossed >= 0 ? crossed : Math.round((c.pos + HALF) / CELL), 0, N);
        const atEdge = (c.dir > 0 && k >= N) || (c.dir < 0 && k <= 0);
        const rr = Math.random();
        if (atEdge || rr < 0.45) {
          const old = c.line; c.line = k; c.axis = 1 - c.axis; c.pos = lineC(old);
          c.dir = old <= 0 ? 1 : old >= N ? -1 : (Math.random() < 0.5 ? 1 : -1);
        }
      }
      const L = lineC(c.line);
      if (c.axis === 0) { c.x = c.pos; c.z = L + c.dir * 3.4; c.rot = c.dir > 0 ? 0 : Math.PI; }
      else { c.z = c.pos; c.x = L - c.dir * 3.4; c.rot = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
      q.setFromAxisAngle(yv, c.rot); p.set(c.x, 0, c.z); m4.compose(p, q, one);
      this.carBody.setMatrixAt(i, m4); this.carCab.setMatrixAt(i, m4);
      const fx = Math.cos(c.rot), fz = -Math.sin(c.rot), sx = -fz, sz = fx;
      lp.setXYZ(i * 4, c.x + fx * 2.2 + sx * 0.7, 0.8, c.z + fz * 2.2 + sz * 0.7);
      lp.setXYZ(i * 4 + 1, c.x + fx * 2.2 - sx * 0.7, 0.8, c.z + fz * 2.2 - sz * 0.7);
      lp.setXYZ(i * 4 + 2, c.x - fx * 2.2 + sx * 0.7, 0.9, c.z - fz * 2.2 + sz * 0.7);
      lp.setXYZ(i * 4 + 3, c.x - fx * 2.2 - sx * 0.7, 0.9, c.z - fz * 2.2 - sz * 0.7);
    });
    this.carBody.instanceMatrix.needsUpdate = this.carCab.instanceMatrix.needsUpdate = true;
    lp.needsUpdate = true;
  }

  initParticles(n) {
    this.pN = n; this.pI = 0;
    this.pp = new Float32Array(n * 3); this.pc = new Float32Array(n * 3);
    this.pv = new Float32Array(n * 3); this.pl = new Float32Array(n); this.pml = new Float32Array(n); this.pbase = new Float32Array(n * 3); this.pg = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pp, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    this.partPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: this.glowTex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.partPts.frustumCulled = false; this.scene.add(this.partPts);
    for (let i = 0; i < n; i++) this.pp[i * 3 + 1] = -999;
  }
  burst(pos, count, color, speed = 8, life = 0.7, grav = 10) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.pI; this.pI = (this.pI + 1) % this.pN;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), s = speed * (0.3 + Math.random() * 0.7);
      this.pp[i * 3] = pos.x; this.pp[i * 3 + 1] = pos.y; this.pp[i * 3 + 2] = pos.z;
      this.pv[i * 3] = Math.sin(ph) * Math.cos(th) * s; this.pv[i * 3 + 1] = Math.cos(ph) * s; this.pv[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      this.pl[i] = this.pml[i] = life * (0.6 + Math.random() * 0.6); this.pg[i] = grav;
      this.pbase[i * 3] = c.r; this.pbase[i * 3 + 1] = c.g; this.pbase[i * 3 + 2] = c.b;
    }
  }
  ringBurst(pos, color, radius = 1, n = 36, speed = 18) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.pI; this.pI = (this.pI + 1) % this.pN; const a = (k / n) * Math.PI * 2;
      this.pp[i * 3] = pos.x + Math.cos(a) * radius; this.pp[i * 3 + 1] = pos.y + 0.3; this.pp[i * 3 + 2] = pos.z + Math.sin(a) * radius;
      this.pv[i * 3] = Math.cos(a) * speed; this.pv[i * 3 + 1] = 1; this.pv[i * 3 + 2] = Math.sin(a) * speed;
      this.pl[i] = this.pml[i] = 0.5; this.pg[i] = 0;
      this.pbase[i * 3] = c.r; this.pbase[i * 3 + 1] = c.g; this.pbase[i * 3 + 2] = c.b;
    }
  }
  updateParticles(dt) {
    for (let i = 0; i < this.pN; i++) {
      if (this.pl[i] <= 0) continue;
      this.pl[i] -= dt;
      const k = i * 3;
      if (this.pl[i] <= 0) { this.pp[k + 1] = -999; continue; }
      this.pv[k + 1] -= this.pg[i] * dt;
      const dr = Math.exp(-2.2 * dt); this.pv[k] *= dr; this.pv[k + 1] *= dr; this.pv[k + 2] *= dr;
      this.pp[k] += this.pv[k] * dt; this.pp[k + 1] += this.pv[k + 1] * dt; this.pp[k + 2] += this.pv[k + 2] * dt;
      const f = this.pl[i] / this.pml[i];
      this.pc[k] = this.pbase[k] * f; this.pc[k + 1] = this.pbase[k + 1] * f; this.pc[k + 2] = this.pbase[k + 2] * f;
    }
    this.partPts.geometry.attributes.position.needsUpdate = true; this.partPts.geometry.attributes.color.needsUpdate = true;
  }

  /* ---------- joueur ---------- */
  initPlayer() {
    const P = this.P = {
      pos: new V3(0, 0, 41), vel: new V3(), state: 'air', grounded: false, groundBox: null, jumps: 0, coyote: 0,
      wallN: new V3(), wallBox: null, wallT: 0, touchWall: false, anchor: new V3(), rope: 0, zipTo: new V3(), zipN: new V3(), zipBox: null,
      facing: 0, health: 100, regenT: 0, iframes: 0, dashCd: 0, attackCd: 0, combo: 0, comboT: 0, punchT: 0, flipT: 0, phase: 0,
      lunge: null, safe: new V3(0, 0, 41), safeT: 0, swingTime: 0, prevY: 0, deadT: 0, fallPeak: 0,
    };
    // modèle original : combinaison sombre à lignes lumineuses
    const body = new THREE.MeshPhongMaterial({ color: 0x1a1d26, shininess: 60, specular: 0x445566 });
    const dark = new THREE.MeshPhongMaterial({ color: 0x0b0d12, shininess: 30 });
    this.accent = new THREE.MeshBasicMaterial({ color: 0x35e8ff });
    const g = this.pm = new THREE.Group();
    const hips = this.pHips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.36, 4, 10), body); torso.position.y = 0.42; torso.scale.z = 0.78; hips.add(torso);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.03), this.accent); s1.position.set(0.08, 0.5, 0.19); s1.rotation.z = 0.35; hips.add(s1);
    const s2 = s1.clone(); s2.position.x = -0.08; s2.rotation.z = -0.35; hips.add(s2);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 20), this.accent); belt.rotation.x = Math.PI / 2; belt.position.y = 0.16; belt.scale.y = 0.8; hips.add(belt);
    const head = this.pHead = new THREE.Group(); head.position.y = 0.95; hips.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), body));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.075, 0.06), this.accent); visor.position.set(0, 0.03, 0.17); head.add(visor);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.22), this.accent); fin.position.set(0, 0.19, -0.02); head.add(fin);
    const limb = (x, y, len, rad, mat, hand) => {
      const piv = new THREE.Group(); piv.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 8), mat); m.position.y = -len / 2 - rad * 0.6; piv.add(m);
      if (hand) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), this.accent); h.position.y = -len - rad * 1.6; piv.add(h); piv.userData.hand = h; }
      else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.32), dark); b.position.set(0, -len - rad * 1.2, 0.05); piv.add(b); const st = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.03), this.accent); st.position.set(0, -len * 0.45, rad * 0.95); piv.add(st); }
      hips.add(piv); return piv;
    };
    this.armL = limb(-0.34, 0.68, 0.48, 0.075, body, true);
    this.armR = limb(0.34, 0.68, 0.48, 0.075, body, true);
    this.legL = limb(-0.13, 0.02, 0.66, 0.095, body, false);
    this.legR = limb(0.13, 0.02, 0.66, 0.095, body, false);
    this.scene.add(g);
    // corde
    this.ropeM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), this.accent);
    this.ropeGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x35e8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ropeM.visible = this.ropeGlow.visible = false; this.ropeM.frustumCulled = this.ropeGlow.frustumCulled = false;
    this.scene.add(this.ropeM, this.ropeGlow);
    this.packM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.3), new THREE.MeshLambertMaterial({ color: 0x3dff9a, emissive: 0x0a4a2a })); this.packM.position.set(0, 0.45, -0.3); hips.add(this.packM); this.packM.visible = false;
    this.cam = { yaw: 0, pitch: -0.18, dist: 6.5, pos: new V3(0, 5, 50), idle: 0, fov: 70 };
    this.tod = 0.74;
    this.zip = null;
  }
  setSuit(id) {
    if (!SUITS[id]) id = 'cyan';
    this.save.suit = id;
    this.accent.color.setHex(SUITS[id].col); this.ropeGlow.material.color.setHex(SUITS[id].col);
  }

  /* collisions joueur/bâtiments */
  collide(P) {
    const i = Math.floor((P.pos.x + HALF) / CELL), j = Math.floor((P.pos.z + HALF) / CELL);
    P.touchWall = false;
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) {
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      for (const bx of this.city.grid[a + b * N]) {
        const p = P.pos;
        if (p.x + R <= bx.minX || p.x - R >= bx.maxX || p.z + R <= bx.minZ || p.z - R >= bx.maxZ) continue;
        if (p.y >= bx.maxY || p.y + PH <= bx.minY) continue;
        if (P.prevY >= bx.maxY - 0.08 && P.vel.y <= 0.01) { p.y = bx.maxY; P.vel.y = 0; P.grounded = true; P.groundBox = bx; continue; }
        if (p.y + PH - 0.1 < bx.minY + 0.5 && P.vel.y > 0) { p.y = bx.minY - PH; P.vel.y = 0; continue; }
        const l = p.x + R - bx.minX, rr = bx.maxX - (p.x - R), f = p.z + R - bx.minZ, bk = bx.maxZ - (p.z - R);
        const m = Math.min(l, rr, f, bk);
        if (m === l) { p.x -= l; P.wallN.set(-1, 0, 0); if (P.vel.x > 0) P.vel.x = 0; }
        else if (m === rr) { p.x += rr; P.wallN.set(1, 0, 0); if (P.vel.x < 0) P.vel.x = 0; }
        else if (m === f) { p.z -= f; P.wallN.set(0, 0, -1); if (P.vel.z > 0) P.vel.z = 0; }
        else { p.z += bk; P.wallN.set(0, 0, 1); if (P.vel.z < 0) P.vel.z = 0; }
        P.touchWall = true; P.wallBox = bx;
      }
    }
    if (P.pos.y <= 0) { P.pos.y = 0; if (P.vel.y < 0) P.vel.y = 0; P.grounded = true; P.groundBox = null; }
    P.pos.x = clamp(P.pos.x, -LIMIT, LIMIT); P.pos.z = clamp(P.pos.z, -LIMIT, LIMIT);
  }
  raycast(o, d, maxT, out) {
    let best = maxT, found = false;
    for (const b of this.city.boxes) {
      if (rayBox(o.x, o.y, o.z, d.x, d.y, d.z, b, best, _hit)) { best = _hit.t; out.t = _hit.t; out.nx = _hit.nx; out.ny = _hit.ny; out.nz = _hit.nz; out.box = _hit.box; found = true; }
    }
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; out.t = t; out.nx = 0; out.ny = 1; out.nz = 0; out.box = null; found = true; } }
    return found;
  }
  insideBox(x, y, z, pad = 0) {
    const i = Math.floor((x + HALF) / CELL), j = Math.floor((z + HALF) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    for (const b of this.city.grid[i + j * N]) if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad && y < b.maxY + pad && y > b.minY - pad) return b;
    return null;
  }
  findAnchor(dirX, dirZ) {
    const P = this.P, o = new V3(P.pos.x, P.pos.y + 1.4, P.pos.z), d = new V3(), out = {};
    const range = this.range();
    let best = null, bestS = -1e9;
    const elev = [0.95, 0.75, 1.15, 0.55, 1.35], yaws = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1];
    const base = Math.atan2(dirX, dirZ);
    for (const e of elev) for (const yo of yaws) {
      const a = base + yo; d.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
      if (!this.raycast(o, d, range, out) || !out.box) continue;
      const hy = o.y + d.y * out.t;
      if (hy < P.pos.y + 5) continue;
      const s = -Math.abs(out.t - 34) * 0.6 - Math.abs(yo) * 18 - Math.abs(e - 0.95) * 8;
      if (s > bestS) { bestS = s; best = new V3(o.x + d.x * out.t, hy, o.z + d.z * out.t); }
    }
    return best;
  }

  updatePlayer(dt) {
    const P = this.P, I = Input, cam = this.cam;
    if (P.state === 'dead') {
      P.deadT -= dt;
      if (P.deadT <= 0) this.respawn();
      return;
    }
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mvx = rx * I.ax.mx + fx * I.ax.my, mvz = rz * I.ax.mx + fz * I.ax.my, mm = Math.hypot(mvx, mvz);
    P.dashCd -= dt; P.attackCd -= dt; P.iframes -= dt; P.comboT -= dt; P.punchT -= dt; P.flipT -= dt; P.coyote -= dt; P.regenT -= dt;
    if (P.comboT <= 0) P.combo = 0;
    // régénération
    const [rd, rs] = this.regen();
    if (P.regenT <= 0 && P.health < this.maxHealth()) P.health = Math.min(this.maxHealth(), P.health + rs * dt);
    // --- actions ---
    if (I.pressed('swing') && P.state !== 'zip') {
      let dx = mm > 0.2 ? mvx / mm : fx, dz = mm > 0.2 ? mvz / mm : fz;
      const hv = Math.hypot(P.vel.x, P.vel.z); if (mm < 0.2 && hv > 8) { dx = P.vel.x / hv; dz = P.vel.z / hv; }
      const a = this.findAnchor(dx, dz);
      if (a) {
        P.anchor.copy(a); P.rope = P.pos.distanceTo(a) * 0.9; P.state = 'swing'; P.swingStart = this.time;
        if (hv < 10) { P.vel.x += dx * 7; P.vel.z += dz * 7; }
        P.vel.y = Math.max(P.vel.y, -6);
        Sound.sfx('shoot'); Input.rumble(0.2, 0.4, 60);
        this.onTutoEvent('swingStart');
      } else { Sound.sfx('fizzle'); this.ropeFail = 0.25; }
    }
    if (P.state === 'swing' && !I.down('swing')) this.releaseSwing();
    if (I.pressed('zip') && this.zipTarget && P.state !== 'zip') {
      const z = this.zipTarget; P.zipTo.copy(z.p); P.zipN.copy(z.n); P.zipBox = z.box; P.state = 'zip'; Sound.sfx('zip'); Input.rumble(0.3, 0.5, 120);
      this.onTutoEvent('zip');
    } else if (I.pressed('zip') && !this.zipTarget) Sound.sfx('fizzle');
    if (I.pressed('dash') && P.dashCd <= 0 && P.state !== 'zip') {
      let dx = mm > 0.2 ? mvx / mm : Math.sin(P.facing), dz = mm > 0.2 ? mvz / mm : Math.cos(P.facing);
      if (P.state === 'climb') { dx = P.wallN.x; dz = P.wallN.z; }
      if (P.state === 'swing' || P.state === 'climb') P.state = 'air';
      P.vel.x = dx * 24 + P.vel.x * 0.3; P.vel.z = dz * 24 + P.vel.z * 0.3; P.vel.y = Math.max(P.vel.y, P.grounded ? 3 : 4);
      P.dashCd = 0.85; P.iframes = 0.3; Sound.sfx('dash');
      this.burst(new V3(P.pos.x, P.pos.y + 1, P.pos.z), 14, this.accent.color.getHex(), 5, 0.4, 0);
    }
    if (I.pressed('attack') && P.attackCd <= 0) this.attack();
    // --- états ---
    P.prevY = P.pos.y;
    const wasGround = P.grounded;
    if (P.state === 'zip') {
      const d = new V3().subVectors(P.zipTo, P.pos); const L = d.length();
      const sp = 62 * dt;
      if (L <= sp + 0.6) {
        P.pos.copy(P.zipTo);
        if (P.zipN.y > 0.5) { P.state = 'air'; P.vel.set(d.x / L * 6, 7, d.z / L * 6); }
        else if (P.zipBox) { P.state = 'climb'; P.wallN.copy(P.zipN); P.wallBox = P.zipBox; P.vel.set(0, 0, 0); }
        else { P.state = 'air'; P.vel.set(0, 5, 0); }
      } else { P.vel.copy(d).multiplyScalar(62 / L); P.pos.addScaledVector(d, sp / L); }
      P.grounded = false;
      P.facing = Math.atan2(d.x, d.z);
      return this.afterMove(dt, wasGround);
    }
    if (P.state === 'lunge') {
      const tg = P.lunge;
      if (!tg || tg.dead) { P.state = 'air'; }
      else {
        const d = new V3().subVectors(tg.pos, P.pos).add(new V3(0, -0.8, 0)); const L = d.length();
        if (L < 2.2) { P.state = 'air'; P.vel.set(0, 5, 0); this.hitDrone(tg); }
        else { P.vel.copy(d).multiplyScalar(48 / L); P.pos.addScaledVector(P.vel, dt); P.facing = Math.atan2(d.x, d.z); P.grounded = false; this.lungeT = (this.lungeT || 0) + dt; if (this.lungeT > 0.7) P.state = 'air'; return this.afterMove(dt, wasGround); }
      }
    }
    if (P.state === 'climb') {
      const bx = P.wallBox;
      if (!bx) { P.state = 'air'; }
      else {
        const sp = this.runSpeed() * 0.85 * (I.down('sprint') ? 1.4 : 1);
        const up = I.ax.my, tx = -P.wallN.z, tz = P.wallN.x;
        const side = (mvx * tx + mvz * tz);
        P.pos.y += up * sp * dt;
        P.pos.x += tx * side * sp * 0.7 * dt; P.pos.z += tz * side * sp * 0.7 * dt;
        // coller au mur
        if (P.wallN.x > 0.5) P.pos.x = bx.maxX + R; else if (P.wallN.x < -0.5) P.pos.x = bx.minX - R;
        else if (P.wallN.z > 0.5) P.pos.z = bx.maxZ + R; else P.pos.z = bx.minZ - R;
        P.vel.set(0, 0, 0); P.facing = Math.atan2(-P.wallN.x, -P.wallN.z);
        P.phase += Math.abs(up) * dt * 9 + Math.abs(side) * dt * 6;
        const offSide = P.wallN.x !== 0 ? (P.pos.z < bx.minZ - 0.2 || P.pos.z > bx.maxZ + 0.2) : (P.pos.x < bx.minX - 0.2 || P.pos.x > bx.maxX + 0.2);
        if (P.pos.y >= bx.maxY - 1.0) { // passage sur le toit
          P.pos.y = bx.maxY + 0.05; P.pos.x -= P.wallN.x * 1.4; P.pos.z -= P.wallN.z * 1.4; P.state = 'air'; P.vel.set(-P.wallN.x * 4, 6, -P.wallN.z * 4); Sound.sfx('jump');
        } else if (I.pressed('jump')) {
          P.state = 'air'; P.vel.set(P.wallN.x * 11 + mvx * 4, 14, P.wallN.z * 11 + mvz * 4); P.jumps = 1; Sound.sfx('jump');
        } else if (offSide || P.pos.y <= 0.01 && up < 0) { P.state = 'air'; P.vel.set(P.wallN.x * 3, 0, P.wallN.z * 3); }
        else if (I.ax.my < -0.6) { this.climbDrop = (this.climbDrop || 0) + dt; if (this.climbDrop > 0.25) { P.state = 'air'; P.vel.set(P.wallN.x * 5, 0, P.wallN.z * 5); } }
        else this.climbDrop = 0;
        P.grounded = false;
        if (P.state === 'climb') return this.afterMove(dt, wasGround, true);
      }
    }
    if (P.state === 'swing') {
      P.swingTime += dt;
      const swingLv = this.save.up.swing;
      P.vel.y -= G * dt;
      P.vel.x += mvx * (16 + swingLv * 4) * dt; P.vel.z += mvz * (16 + swingLv * 4) * dt;
      P.vel.multiplyScalar(Math.exp(-0.05 * dt));
      P.rope = Math.max(6, P.rope - 4 * dt);
      const sp = P.vel.length(); if (sp > 68) P.vel.multiplyScalar(68 / sp);
      this.integrate(dt);
      const d = new V3().subVectors(P.pos, P.anchor), L = d.length();
      if (L > P.rope) { d.multiplyScalar(1 / L); P.pos.copy(P.anchor).addScaledVector(d, P.rope); const rad = P.vel.dot(d); if (rad > 0) P.vel.addScaledVector(d, -rad); }
      if (P.pos.y > P.anchor.y - 1.5 || (P.grounded && this.time - P.swingStart > 0.2)) this.releaseSwing(true);
      const hv = Math.hypot(P.vel.x, P.vel.z); if (hv > 1) P.facing = Math.atan2(P.vel.x, P.vel.z);
      return this.afterMove(dt, wasGround);
    }
    // sol / air
    if (P.grounded) { P.jumps = 0; P.coyote = 0.12; }
    const speed = this.runSpeed() * (I.down('sprint') ? 1.6 : 1);
    if (P.grounded) {
      const k = 1 - Math.exp(-14 * dt);
      P.vel.x += (mvx * speed - P.vel.x) * k; P.vel.z += (mvz * speed - P.vel.z) * k;
    } else {
      const hv0 = Math.hypot(P.vel.x, P.vel.z);
      P.vel.x += mvx * 18 * dt; P.vel.z += mvz * 18 * dt;
      const hv1 = Math.hypot(P.vel.x, P.vel.z), cap = Math.max(hv0, speed);
      if (hv1 > cap) { P.vel.x *= cap / hv1; P.vel.z *= cap / hv1; }
      P.vel.x *= Math.exp(-0.15 * dt); P.vel.z *= Math.exp(-0.15 * dt);
    }
    if (I.pressed('jump')) {
      if (P.grounded || P.coyote > 0) { P.vel.y = 14; P.grounded = false; P.coyote = 0; P.jumps = 1; Sound.sfx('jump'); this.onTutoEvent('jump'); }
      else if (P.jumps < this.maxJumps()) { P.vel.y = 12.5; P.jumps = Math.max(P.jumps, 1) + 1; P.flipT = 0.45; Sound.sfx('jump'); this.onTutoEvent('jump'); this.burst(P.pos.clone(), 10, this.accent.color.getHex(), 4, 0.35, 0); }
    }
    P.vel.y -= G * dt; if (P.vel.y < -75) P.vel.y = -75;
    this.integrate(dt);
    // escalade automatique : pousser vers un mur
    if (P.touchWall && P.wallBox && mm > 0.4 && (mvx * -P.wallN.x + mvz * -P.wallN.z) > 0.55 && P.wallBox.maxY - P.pos.y > 1.2) {
      P.wallT += dt;
      if (!P.grounded || P.wallT > 0.12) { P.state = 'climb'; P.vel.set(0, 0, 0); P.wallT = 0; this.climbDrop = 0; }
    } else P.wallT = 0;
    if (P.state !== 'climb') P.state = P.grounded ? 'ground' : 'air';
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (hv > 0.5) P.facing = Math.atan2(P.vel.x, P.vel.z);
    P.phase += hv * dt * 0.85;
    this.afterMove(dt, wasGround);
  }
  integrate(dt) {
    const P = this.P;
    const steps = Math.max(1, Math.ceil(P.vel.length() * dt / 0.35));
    const h = dt / steps;
    P.grounded = false;
    for (let s = 0; s < steps; s++) { P.prevY = P.pos.y; P.pos.addScaledVector(P.vel, h); this.collide(P); }
  }
  afterMove(dt, wasGround, climbing) {
    const P = this.P;
    if (!P.grounded) P.fallPeak = Math.min(P.fallPeak, P.vel.y);
    if (P.grounded && !wasGround && !climbing) {
      const impact = -P.fallPeak;
      if (impact > 38) this.slam();
      else if (impact > 14) { Sound.sfx('land'); this.burst(P.pos.clone().add(new V3(0, 0.2, 0)), 6, 0x999999, 3, 0.3, 0); }
      P.fallPeak = 0;
    }
    if (P.grounded) P.fallPeak = 0;
    // point sûr
    P.safeT -= dt;
    if (P.grounded && P.safeT <= 0 && !this.dronesNear(40)) { P.safe.copy(P.pos); P.safeT = 2; }
    // coup en vol (balancement rapide = coup de pied)
    const sp = P.vel.length();
    if (sp > 24 && (P.state === 'swing' || P.state === 'zip' || P.state === 'air')) {
      for (const d of this.drones) if (!d.dead && d.pos.distanceTo(P.pos) < 2.4 + d.radius && (d.kickCd || 0) <= 0) { d.kickCd = 0.6; this.damageDrone(d, 22 * this.power(), P.vel.clone().normalize().multiplyScalar(18)); Sound.sfx('crit'); this.hitstop = 0.06; this.shake = Math.max(this.shake, 0.4); }
    }
    this.save.stats.dist += sp * dt;
  }
  releaseSwing(auto) {
    const P = this.P;
    if (P.state !== 'swing') return;
    P.state = 'air';
    const lv = this.save.up.swing;
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (!auto) { P.vel.y += 7 + lv * 2; if (hv > 1) { P.vel.x += (P.vel.x / hv) * (3 + lv); P.vel.z += (P.vel.z / hv) * (3 + lv); } Sound.sfx('release'); }
    if (this.time - P.swingStart > 0.6) this.onTutoEvent('swingRelease');
  }
  slam() {
    const P = this.P;
    Sound.sfx('slam'); this.shake = 0.9; Input.rumble(1, 1, 300);
    this.ringBurst(P.pos, this.accent.color.getHex(), 1, 48, 22);
    this.burst(P.pos.clone().add(new V3(0, 0.5, 0)), 20, 0xaaaaaa, 7, 0.6, 6);
    for (const d of this.drones) if (!d.dead && d.pos.distanceTo(P.pos) < 11) this.damageDrone(d, 30 * this.power(), new V3().subVectors(d.pos, P.pos).setY(0).normalize().multiplyScalar(14).setY(10));
  }
  dronesNear(r) { for (const d of this.drones) if (!d.dead && d.kind !== 'training' && d.pos.distanceTo(this.P.pos) < r) return true; return false; }

  attack() {
    const P = this.P;
    const fx = -Math.sin(this.cam.yaw), fz = -Math.cos(this.cam.yaw);
    let best = null, bs = 1e9;
    for (const d of this.drones) {
      if (d.dead) continue;
      const v = new V3().subVectors(d.pos, P.pos); const L = v.length();
      if (L > 19 + d.radius) continue;
      const dot = (v.x * fx + v.z * fz) / Math.max(0.01, Math.hypot(v.x, v.z));
      if (dot < 0.15 && L > 4 + d.radius) continue;
      const s = L * (1.6 - dot);
      if (s < bs) { bs = s; best = d; }
    }
    P.attackCd = 0.24; P.punchT = 0.22;
    if (best && P.pos.distanceTo(best.pos) > 2.6 + best.radius) { P.state = 'lunge'; P.lunge = best; this.lungeT = 0; Sound.sfx('dash'); }
    else if (best) this.hitDrone(best);
    else Sound.sfx('release');
  }
  hitDrone(d) {
    const P = this.P;
    P.combo = P.comboT > 0 ? P.combo + 1 : 1; P.comboT = 1.1; P.punchT = 0.22;
    const fin = P.combo % 3 === 0;
    const dmg = 12 * this.power() * (1 + 0.15 * Math.min(P.combo - 1, 4)) * (fin ? 1.8 : 1) * (d.vulnerable ? 2 : 1);
    const dir = new V3().subVectors(d.pos, P.pos).normalize();
    this.damageDrone(d, dmg, dir.multiplyScalar(fin ? 20 : 7));
    if (!P.grounded) P.vel.y = Math.max(P.vel.y, 5);
    P.vel.x *= 0.3; P.vel.z *= 0.3;
    Sound.sfx(fin ? 'crit' : 'hit'); this.hitstop = fin ? 0.09 : 0.045; this.shake = Math.max(this.shake, fin ? 0.45 : 0.2); Input.rumble(fin ? 0.9 : 0.5, 0.6, fin ? 140 : 70);
    this.showCombo();
  }
  damageDrone(d, dmg, knock) {
    if (d.dead) return;
    d.hp -= dmg; d.flash = 0.12; if (knock && d.kind !== 'boss') d.kv.add(knock);
    d.stagger = d.kind === 'boss' ? 0 : 0.35;
    this.burst(d.pos.clone(), 10, 0xffffff, 9, 0.35, 4);
    if (d.hp <= 0) this.killDrone(d);
  }
  takeDamage(n) {
    const P = this.P;
    if (P.iframes > 0 || P.state === 'dead') return;
    P.health -= n; P.regenT = this.regen()[0]; P.iframes = 0.45;
    Sound.sfx('hurt'); this.shake = Math.max(this.shake, 0.35); Input.rumble(0.8, 0.3, 160);
    this.hud.vig.classList.remove('hit'); void this.hud.vig.offsetWidth; this.hud.vig.classList.add('hit');
    if (P.health <= 0) this.die();
  }
  die() {
    const P = this.P;
    P.state = 'dead'; P.deadT = 2.6; P.health = 0; this.ropeM.visible = this.ropeGlow.visible = false;
    Sound.sfx('fail'); this.center('K.O.', 'Retour au dernier point sûr…', 2.4);
    if (this.act) this.failActivity('Activité interrompue');
    if (this.boss && !this.boss.dead) { this.boss.hp = this.boss.maxHp; this.removeDrone(this.boss); this.boss = null; this.drones.filter(d => d.summon).forEach(d => this.removeDrone(d)); }
  }
  respawn() {
    const P = this.P;
    P.pos.copy(P.safe); P.vel.set(0, 0, 0); P.state = 'air'; P.health = this.maxHealth(); P.iframes = 2;
    this.burst(P.pos.clone().add(new V3(0, 1, 0)), 30, this.accent.color.getHex(), 8, 0.8, 0);
  }

  /* ---------- drones ---------- */
  spawnDrone(pos, kind = 'normal', opts = {}) {
    const g = new THREE.Group();
    const scale = kind === 'boss' ? 3.2 : kind === 'thief' ? 1.1 : 1;
    const mat = this.droneMat.clone();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat); body.scale.y = 0.75; g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), kind === 'thief' ? new THREE.MeshBasicMaterial({ color: 0xffd23d }) : kind === 'training' ? new THREE.MeshBasicMaterial({ color: 0x35e8ff }) : this.droneEye.clone()); eye.position.set(0, 0, 0.68); g.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 28), kind === 'training' ? new THREE.MeshBasicMaterial({ color: 0x35e8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }) : this.droneRing); ring.rotation.x = Math.PI / 2; g.add(ring);
    if (kind === 'thief') { const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshLambertMaterial({ color: 0xffd23d, emissive: 0x553300 })); box.position.y = -0.9; g.add(box); }
    if (kind === 'boss') { for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 5), mat); const a = k * Math.PI / 2; sp.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); sp.rotation.z = -Math.cos(a) * Math.PI / 2; sp.rotation.x = Math.sin(a) * Math.PI / 2; g.add(sp); } }
    g.scale.setScalar(scale); g.position.copy(pos); this.scene.add(g);
    const hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ color: kind === 'training' ? 0x35e8ff : 0xff3048, depthTest: false, transparent: true, fog: false }));
    hpBar.scale.set(1.6, 0.14, 1); hpBar.position.y = 1.45; hpBar.renderOrder = 5; g.add(hpBar); hpBar.visible = false;
    const tier = opts.tier || 0;
    const hp = kind === 'boss' ? 700 : kind === 'thief' ? 50 : kind === 'training' ? 20 : 34 + tier * 12;
    const d = { g, body, eye, ring, hpBar, mat, kind, tier, pos: g.position, vel: new V3(), kv: new V3(), hp, maxHp: hp, radius: 0.9 * scale, dead: false, state: 'patrol', fireT: 1.5 + Math.random() * 2, ang: Math.random() * 6.28, flash: 0, stagger: 0, home: pos.clone(), zone: opts.zone, path: opts.path, pathI: 0, summon: opts.summon, t: 0, slamT: 9, telegraph: 0 };
    this.drones.push(d);
    return d;
  }
  removeDrone(d) { d.dead = true; this.scene.remove(d.g); const i = this.drones.indexOf(d); if (i >= 0) this.drones.splice(i, 1); }
  killDrone(d) {
    d.dead = true;
    Sound.sfx('boom'); this.burst(d.pos.clone(), d.kind === 'boss' ? 90 : 34, 0xff7a30, d.kind === 'boss' ? 26 : 14, 0.9, 6); this.burst(d.pos.clone(), 14, 0xffffff, 6, 0.4, 0);
    this.shake = Math.max(this.shake, d.kind === 'boss' ? 1.2 : 0.35);
    this.scene.remove(d.g); this.drones.splice(this.drones.indexOf(d), 1);
    if (d.kind !== 'training') this.save.stats.drones++;
    if (d.kind === 'normal' || d.summon) { this.addXP(18 + d.tier * 6); this.addCredits(15 + d.tier * 10, true); }
    if (d.kind === 'training') this.onTutoEvent('trainingKill');
    if (d.zone != null) this.checkZone(d.zone);
    if (d.kind === 'thief') this.chaseDone(true);
    if (d.kind === 'boss') this.bossDone();
  }
  updateDrones(dt) {
    const P = this.P, pc = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
    for (const d of [...this.drones]) {
      if (d.dead) continue;
      d.t += dt; d.flash -= dt; d.stagger -= dt; d.kickCd = (d.kickCd || 0) - dt;
      const toP = new V3().subVectors(pc, d.pos), dist = toP.length();
      let target = null, speed = 13;
      if (d.kind === 'training') {
        target = d.home.clone().add(new V3(Math.sin(d.t + d.ang) * 2, Math.sin(d.t * 1.7) * 0.6, Math.cos(d.t * 0.8 + d.ang) * 2));
        speed = 4;
      } else if (d.kind === 'thief') {
        const p = d.path[d.pathI];
        target = p; speed = clamp(17 + (40 - dist) * -0.05, 15, 24);
        if (d.pos.distanceTo(p) < 4) { d.pathI = (d.pathI + 1) % d.path.length; }
      } else if (d.kind === 'boss') {
        this.updateBoss(d, dt, toP, dist); continue;
      } else {
        const z = this.city.zones[d.zone] || { x: d.home.x, z: d.home.z };
        const pz = Math.hypot(P.pos.x - z.x, P.pos.z - z.z);
        if (d.state === 'patrol') {
          d.ang += dt * 0.4;
          target = new V3(z.x + Math.cos(d.ang) * 22, 18 + Math.sin(d.t + d.ang) * 6, z.z + Math.sin(d.ang) * 22);
          if (dist < 55 && pz < 120 && P.state !== 'dead') { d.state = 'engage'; }
          speed = 9;
        } else {
          d.ang += dt * 0.6;
          const off = new V3(Math.cos(d.ang) * 11, 4 + Math.sin(d.t * 1.3) * 2.5, Math.sin(d.ang) * 11);
          target = pc.clone().add(off);
          if (pz > 150 || P.state === 'dead') d.state = 'patrol';
          // tir
          d.fireT -= dt;
          if (d.fireT < 0.55 && d.telegraph <= 0 && dist < 60) { d.telegraph = 0.55; Sound.sfx('beep'); }
          if (d.fireT <= 0) {
            d.fireT = 2.1 + Math.random() * 1.4 - d.tier * 0.3; d.telegraph = 0;
            if (dist < 60) this.fire(d.pos, pc.clone().addScaledVector(P.vel, dist / 40), 34 + d.tier * 4, 8 + d.tier * 3);
          }
          if (d.telegraph > 0) d.telegraph -= dt;
        }
      }
      // éviter les immeubles
      const inB = this.insideBox(target.x, target.y, target.z, 3); if (inB) target.y = inB.maxY + 5;
      if (d.stagger <= 0) {
        const dv = new V3().subVectors(target, d.pos); const L = dv.length();
        const want = L > 0.1 ? dv.multiplyScalar(Math.min(speed, L * 2) / L) : dv.set(0, 0, 0);
        d.vel.lerp(want, 1 - Math.exp(-3 * dt));
      }
      d.pos.addScaledVector(d.vel, dt).addScaledVector(d.kv, dt);
      d.kv.multiplyScalar(Math.exp(-4 * dt));
      const inside = this.insideBox(d.pos.x, d.pos.y, d.pos.z, 0.8); if (inside) d.pos.y = inside.maxY + 1.2;
      if (d.pos.y < 1.5) d.pos.y = 1.5;
      this.animDrone(d, dt, toP);
      if (d.kind === 'thief' && dist > 280) this.chaseDone(false);
    }
  }
  animDrone(d, dt, toP) {
    d.ring.rotation.z += dt * (d.kind === 'boss' ? 1.5 : 4);
    d.g.rotation.y = Math.atan2(toP.x, toP.z);
    d.mat.emissive.setHex(d.flash > 0 ? 0xff4040 : 0x000000);
    const tele = d.telegraph > 0 || (d.kind === 'boss' && d.slamTele > 0);
    d.eye.scale.setScalar(tele ? 1.6 + Math.sin(d.t * 40) * 0.3 : 1);
    if (d.hp < d.maxHp && d.kind !== 'boss') { d.hpBar.visible = true; d.hpBar.scale.x = 1.6 * Math.max(0, d.hp / d.maxHp); }
  }
  fire(from, to, speed, dmg) {
    const v = new V3().subVectors(to, from).normalize().multiplyScalar(speed);
    if (this.projectiles.length < 60) this.projectiles.push({ p: from.clone(), v, life: 3.2, dmg });
    Sound.sfx('enemyShot');
  }
  updateProjectiles(dt) {
    const P = this.P, pc = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
    const arr = this.projGeo.attributes.position.array;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.p.addScaledVector(pr.v, dt); pr.life -= dt;
      let dead = pr.life <= 0 || pr.p.y < 0 || this.insideBox(pr.p.x, pr.p.y, pr.p.z);
      if (!dead && pr.p.distanceTo(pc) < 1.15 && P.state !== 'dead') {
        if (P.iframes > 0 && P.dashCd > 0.5) { this.burst(pr.p.clone(), 6, 0x35e8ff, 5, 0.3, 0); } // esquive parfaite
        else this.takeDamage(pr.dmg);
        dead = true;
      }
      if (dead) { this.burst(pr.p.clone(), 5, 0xff3048, 4, 0.25, 0); this.projectiles.splice(i, 1); }
    }
    for (let i = 0; i < 60; i++) {
      const pr = this.projectiles[i];
      if (pr) { arr[i * 3] = pr.p.x; arr[i * 3 + 1] = pr.p.y; arr[i * 3 + 2] = pr.p.z; } else arr[i * 3 + 1] = -999;
    }
    this.projGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- boss ---------- */
  spawnBoss() {
    const t = this.towerTop;
    this.boss = this.spawnDrone(new V3(t.x, t.y + 14, t.z + 10), 'boss');
    this.boss.volleyT = 3; this.boss.slamT = 9; this.boss.phase = 0; this.boss.summoned = 0;
    this.hud.boss.classList.add('show');
    this.say(['La voilà ! Esquive ses tirs, frappe-la quand elle s’écrase au sol : c’est là qu’elle est vulnérable.']);
  }
  updateBoss(d, dt, toP, dist) {
    const t = this.towerTop, P = this.P, pc = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
    d.vulnerable = false;
    if (d.state === 'dive') {
      d.diveT -= dt;
      if (d.diveT > 0) { d.pos.lerp(d.diveTo, 1 - Math.exp(-7 * dt)); }
      else if (!d.impacted) {
        d.impacted = true; Sound.sfx('slam'); this.shake = 1; this.ringBurst(d.diveTo, 0xff3048, 2, 60, 26);
        if (P.pos.distanceTo(d.diveTo) < 7) this.takeDamage(24);
        d.recover = 2.2;
      } else {
        d.recover -= dt; d.vulnerable = true;
        if (d.recover <= 0) { d.state = 'patrol'; d.impacted = false; }
      }
    } else {
      d.ang += dt * 0.45;
      const target = new V3(t.x + Math.cos(d.ang) * 15, t.y + 11 + Math.sin(d.t) * 2, t.z + Math.sin(d.ang) * 15);
      d.pos.lerp(target, 1 - Math.exp(-1.6 * dt));
      d.volleyT -= dt; d.slamT -= dt;
      if (d.volleyT <= 0 && dist < 90) {
        d.volleyT = d.hp < d.maxHp * 0.5 ? 2.2 : 3.1;
        const base = new V3().subVectors(pc, d.pos).normalize();
        for (let k = -2; k <= 2; k++) { const v = base.clone().applyAxisAngle(new V3(0, 1, 0), k * 0.16); this.fire(d.pos, d.pos.clone().add(v), 32, 11); }
      }
      if (d.slamT <= 0 && dist < 60) {
        d.slamTele = 1.1; d.slamT = 9;
      }
      if (d.slamTele > 0) { d.slamTele -= dt; if (d.slamTele <= 0) { d.state = 'dive'; d.diveTo = new V3(P.pos.x, P.pos.y + 1.8, P.pos.z); d.diveT = 0.45; } }
    }
    // renforts
    const ratio = d.hp / d.maxHp;
    if ((ratio < 0.66 && d.summoned === 0) || (ratio < 0.33 && d.summoned === 1)) {
      d.summoned++;
      for (let k = 0; k < 2; k++) this.spawnDrone(new V3(t.x + (k ? 12 : -12), t.y + 8, t.z), 'normal', { tier: 2, summon: true, zone: null });
      this.toast('Renforts !', 'La Sentinelle appelle des drones', 'red');
    }
    this.animDrone(d, dt, toP);
    this.hud.bossBar.style.width = (Math.max(0, d.hp) / d.maxHp * 100) + '%';
    if (P.pos.distanceTo(t) > 220) { this.removeDrone(d); this.boss = null; this.hud.boss.classList.remove('show'); this.drones.filter(x => x.summon).forEach(x => this.removeDrone(x)); }
  }
  bossDone() {
    this.hud.boss.classList.remove('show');
    this.drones.filter(x => x.summon).forEach(x => this.killDrone(x));
    this.boss = null;
    this.completeStory();
  }

  /* ---------- zones, courses, livraisons, poursuites ---------- */
  zoneInfested(z) { const t = this.save.zones[z.id]; return !t || Date.now() - t > 15 * 60 * 1000; }
  updateZones() {
    const P = this.P;
    for (const z of this.city.zones) {
      const inf = this.zoneInfested(z);
      this.zoneBeams[z.id].visible = inf;
      const d = Math.hypot(P.pos.x - z.x, P.pos.z - z.z);
      const alive = this.drones.filter(x => x.zone === z.id && !x.dead);
      if (inf && d < 170 && !z.spawned && this.save.tut >= 5) {
        z.spawned = true;
        const n = 4 + z.tier;
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; this.spawnDrone(new V3(z.x + Math.cos(a) * 20, 20 + Math.random() * 8, z.z + Math.sin(a) * 20), 'normal', { zone: z.id, tier: z.tier }); }
        z.total = n;
      }
      if (z.spawned && d > 280) { alive.forEach(x => this.removeDrone(x)); z.spawned = false; }
    }
  }
  checkZone(id) {
    const z = this.city.zones[id];
    const alive = this.drones.filter(x => x.zone === id && !x.dead).length;
    if (alive === 0 && z.spawned) {
      z.spawned = false;
      this.save.zones[id] = Date.now();
      if (!this.save.zonesEver.includes(id)) this.save.zonesEver.push(id);
      this.addCredits(220 + z.tier * 110); this.addXP(120 + z.tier * 40);
      Sound.sfx('mission'); this.center('ZONE LIBÉRÉE', z.name, 2.6);
      if (this.save.zonesEver.length >= 6) this.unlockSuit('emerald');
      this.checkStory(); this.saveGame();
    }
  }
  nearInteract() {
    if (this.act || this.P.state === 'dead') return null;
    const P = this.P;
    for (const rc of this.city.races) if (P.pos.distanceTo(rc.start) < 7) return { type: 'race', o: rc, label: `Lancer la course « ${rc.name} »` };
    for (const j of this.city.jobs) if (P.pos.distanceTo(j.from) < 6) return { type: 'job', o: j, label: `Prendre le colis « ${j.name} »` };
    return null;
  }
  startRace(rc) {
    this.act = { type: 'race', o: rc, idx: 0, t: 0, count: 3 };
    Sound.sfx('beep');
    this.raceBeams.forEach(b => b.visible = false);
  }
  startJob(j) {
    this.act = { type: 'job', o: j, t: j.time };
    this.packM.visible = true; this.dropBeam.visible = true; this.dropBeam.position.copy(j.to);
    Sound.sfx('select'); this.toast('Colis récupéré', `Livre-le en ${j.time} s`, 'green');
  }
  failActivity(msg) {
    if (!this.act) return;
    if (this.act.type === 'job') { this.packM.visible = false; this.dropBeam.visible = false; }
    this.act = null; this.rings.forEach(r => r.visible = false);
    this.raceBeams.forEach(b => b.visible = true);
    Sound.sfx('fail'); this.center('ÉCHEC', msg, 2.2);
  }
  updateActivity(dt) {
    const a = this.act, P = this.P;
    if (!a) return;
    if (a.type === 'race') {
      const rc = a.o;
      if (a.count > 0) {
        const before = Math.ceil(a.count); a.count -= dt; const after = Math.ceil(a.count);
        if (after !== before) { if (after > 0) { Sound.sfx('beep'); this.center(String(after), rc.name, 0.8); } else { Sound.sfx('go'); this.center('GO !', '', 0.7); } }
        if (before === 3 && a.count > 2.9) this.center('3', rc.name, 0.8);
      } else a.t += dt;
      // anneaux
      for (let k = 0; k < 3; k++) {
        const p = rc.pts[a.idx + k], m = this.rings[k];
        if (!p) { m.visible = false; continue; }
        m.visible = true; m.position.copy(p);
        const nxt = rc.pts[a.idx + k + 1] || p, prv = rc.pts[a.idx + k - 1] || rc.start;
        m.lookAt(new V3().subVectors(nxt, prv).add(p));
        if (k === 0) m.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06);
      }
      const p = rc.pts[a.idx];
      if (a.count <= 0 && P.pos.clone().add(new V3(0, 0.9, 0)).distanceTo(p) < 6.2) {
        a.idx++; Sound.sfx('ring'); this.burst(p.clone(), 16, 0xffd23d, 8, 0.5, 0);
        if (a.idx >= rc.pts.length) this.finishRace();
      }
      if (a.t > rc.bronze * 2.2) this.failActivity('Trop lent… retente ta chance !');
    } else if (a.type === 'job') {
      a.t -= dt;
      if (P.pos.distanceTo(a.o.to) < 7) this.finishJob();
      else if (a.t <= 0) this.failActivity('Temps écoulé');
    }
  }
  finishRace() {
    const a = this.act, rc = a.o, t = a.t;
    const medal = t <= rc.gold ? 'or' : t <= rc.silver ? 'argent' : t <= rc.bronze ? 'bronze' : null;
    const prev = this.save.races[rc.id];
    const rank = x => !x ? 0 : x <= rc.gold ? 3 : x <= rc.silver ? 2 : x <= rc.bronze ? 1 : 0;
    const gained = Math.max(0, rank(t) - rank(prev));
    if (!prev || t < prev) this.save.races[rc.id] = +t.toFixed(2);
    this.act = null; this.rings.forEach(r => r.visible = false); this.raceBeams.forEach(b => b.visible = true);
    this.save.stats.races++;
    const cr = [0, 150, 300, 600].slice(rank(prev) + 1, rank(t) + 1).reduce((x, y) => x + y, 0) + 40;
    this.addCredits(cr); this.addXP(60 + gained * 50);
    Sound.sfx(medal ? 'mission' : 'fail');
    this.center(medal ? `MÉDAILLE ${medal.toUpperCase()}` : 'COURSE TERMINÉE', `${fmtClock(t)}${prev ? ` · record ${fmtClock(Math.min(prev, t))}` : ''}`, 3);
    if (Object.keys(this.save.races).length >= 3) this.unlockSuit('violet');
    this.onActivity('race', rc.id, !!medal);
    this.saveGame();
  }
  finishJob() {
    const j = this.act.o, left = this.act.t;
    this.act = null; this.packM.visible = false; this.dropBeam.visible = false;
    const first = !this.save.jobs[j.id];
    this.save.jobs[j.id] = (this.save.jobs[j.id] || 0) + 1; this.save.stats.deliveries++;
    this.addCredits(first ? 320 : 120 + Math.round(left * 2)); this.addXP(first ? 110 : 50);
    Sound.sfx('mission'); this.center('LIVRAISON RÉUSSIE', `${Math.ceil(left)} s d’avance`, 2.6);
    this.onActivity('job', j.id, true);
    this.saveGame();
  }
  startChase() {
    const P = this.P;
    const r = rng((Date.now() / 1000) | 0);
    let a = clamp(Math.round((P.pos.x + HALF) / CELL), 1, N - 1), b = clamp(Math.round((P.pos.z + HALF) / CELL), 1, N - 1);
    const path = [];
    for (let k = 0; k < 14; k++) {
      const dir = (r() * 4) | 0; a = clamp(a + [2, 0, -2, 0][dir], 1, N - 1); b = clamp(b + [0, 2, 0, -2][dir], 1, N - 1);
      path.push(new V3(lineC(a), 18 + r() * 22, lineC(b)));
    }
    const start = new V3(P.pos.x + Math.sin(this.cam.yaw) * -30, 22, P.pos.z + Math.cos(this.cam.yaw) * -30);
    const th = this.spawnDrone(start, 'thief', { path });
    this.chase = { d: th, t: 100 };
    Sound.sfx('beep'); this.toast('ALERTE', 'Un drone voleur s’enfuit : rattrape-le !', 'yellow');
  }
  chaseDone(ok) {
    if (!this.chase) return;
    const c = this.chase; this.chase = null;
    if (ok) { this.save.stats.chases++; this.addCredits(300); this.addXP(150); Sound.sfx('mission'); this.center('VOLEUR NEUTRALISÉ', 'Données récupérées', 2.4); this.onActivity('chase', 0, true); this.saveGame(); }
    else { if (c.d && !c.d.dead) this.removeDrone(c.d); Sound.sfx('fail'); this.center('IL S’EST ÉCHAPPÉ', 'Il reviendra…', 2); this.nextChase = this.time + 180; this.storyChaseT = this.time + 6; }
  }

  /* ---------- histoire & tutoriel ---------- */
  onTutoEvent(ev) {
    const s = this.save;
    if (s.story !== 0) return;
    this.tutoC = this.tutoC || { jumps: 0 };
    if (s.tut === 0 && ev === 'jump' && ++this.tutoC.jumps >= 2) this.tutoNext();
    else if (s.tut === 1 && ev === 'swingRelease') this.tutoNext();
    else if (s.tut === 2 && ev === 'zip') this.tutoNext();
    else if (s.tut === 4 && ev === 'trainingKill' && !this.drones.some(d => d.kind === 'training')) this.tutoNext();
  }
  tutoNext() {
    const s = this.save;
    s.tut++; Sound.sfx('ring');
    if (s.tut < 5) {
      this.say([TUTO[s.tut].line()]);
      if (s.tut === 4) this.spawnTraining();
    } else {
      s.story = 1; s.tut = 5;
      this.addXP(100); this.addCredits(200);
      this.say(['Excellent. Tu es prêt.', `Ouvre la carte avec ${Input.glyph('map')} pour voir les activités. Et améliore ta combinaison depuis le menu pause.`]);
      this.storyStarted = false;
      this.nextChase = this.time + 240;
    }
    this.saveGame();
  }
  spawnTraining() {
    const P = this.P;
    for (let k = 0; k < 3; k++) { const a = this.cam.yaw + Math.PI + (k - 1) * 0.6; this.spawnDrone(new V3(P.pos.x + Math.sin(a) * -12, P.pos.y + 3.5, P.pos.z + Math.cos(a) * -12), 'training'); }
  }
  checkStory() {
    const s = this.save, st = STORY[s.story];
    if (!st) return;
    if (!this.storyStarted) {
      this.storyStarted = true;
      if (this.lastStoryShown !== s.story) { this.lastStoryShown = s.story; this.say(st.start(this)); this.toast(`Contrat ${s.story} / 8`, st.title, 'cyan'); }
    }
    if (st.obj.type === 'chase' && !this.chase && this.time > (this.storyChaseT || 0)) { this.storyChaseT = this.time + 8; this.startChase(); }
    const o = st.obj;
    let done = false;
    if (o.type === 'zone') done = !this.zoneInfested(this.city.zones[o.zone]);
    else if (o.type === 'zones') done = o.zones.every(z => !this.zoneInfested(this.city.zones[z]));
    else if (o.type === 'job') done = !!this.storyFlag;
    else if (o.type === 'race') done = !!this.storyFlag || this.city.races[o.race] && this.save.races[o.race] <= this.city.races[o.race].bronze;
    else if (o.type === 'chase') done = !!this.storyFlag;
    else if (o.type === 'shards') done = s.shards.length >= o.count;
    else if (o.type === 'reach') done = this.P.grounded && this.P.pos.y > this.towerTop.y - 1 && Math.hypot(this.P.pos.x - this.towerTop.x, this.P.pos.z - this.towerTop.z) < 14;
    else if (o.type === 'boss') { if (!this.boss && this.P.pos.y > this.towerTop.y - 20 && Math.hypot(this.P.pos.x - this.towerTop.x, this.P.pos.z - this.towerTop.z) < 40) this.spawnBoss(); }
    if (done) this.completeStory();
  }
  onActivity(type, id, ok) {
    const st = STORY[this.save.story]; if (!st || !ok) return;
    if ((st.obj.type === 'job' && type === 'job' && id === st.obj.job) || (st.obj.type === 'race' && type === 'race' && id === st.obj.race) || (st.obj.type === 'chase' && type === 'chase')) { this.storyFlag = true; this.checkStory(); }
  }
  completeStory() {
    const s = this.save, st = STORY[s.story];
    if (!st) return;
    this.storyFlag = false; this.storyStarted = false;
    this.addCredits(st.cr); this.addXP(st.xp);
    Sound.sfx('mission'); this.center('CONTRAT TERMINÉ', st.title, 3);
    this.say(st.end);
    s.story++;
    if (s.story >= STORY.length) { this.unlockSuit('white'); }
    this.saveGame();
  }
  storyWaypoint() {
    const s = this.save;
    if (s.story === 0) return null;
    const st = STORY[s.story]; if (!st) return null;
    const o = st.obj, P = this.P;
    if (o.type === 'zone') { const z = this.city.zones[o.zone]; return { p: new V3(z.x, 0, z.z), label: z.name }; }
    if (o.type === 'zones') { const z = o.zones.map(i => this.city.zones[i]).find(z => this.zoneInfested(z)); return z ? { p: new V3(z.x, 0, z.z), label: z.name } : null; }
    if (o.type === 'job') { const j = this.city.jobs[o.job]; return this.act && this.act.type === 'job' ? null : { p: j.from.clone(), label: j.name }; }
    if (o.type === 'race') { const rc = this.city.races[o.race]; return this.act ? null : { p: rc.start.clone(), label: rc.name }; }
    if (o.type === 'chase') return this.chase ? { p: this.chase.d.pos.clone(), label: 'Drone voleur' } : null;
    if (o.type === 'shards') { let best = null, bd = 1e9; this.city.shards.forEach((sh, i) => { if (s.shards.includes(i)) return; const d = Math.hypot(sh[0] - P.pos.x, sh[2] - P.pos.z); if (d < bd) { bd = d; best = sh; } }); return best ? { p: new V3(best[0], best[1], best[2]), label: 'Éclat le plus proche' } : null; }
    if (o.type === 'reach' || o.type === 'boss') return { p: this.towerTop.clone(), label: 'Tour Nova' };
    return null;
  }
  objectiveText() {
    const s = this.save;
    if (this.act && this.act.type === 'race') { const rc = this.act.o; return { title: `Course · ${rc.name}`, text: `Anneau ${Math.min(this.act.idx + 1, rc.pts.length)} / ${rc.pts.length} · Or ${fmtClock(rc.gold)}` }; }
    if (this.act && this.act.type === 'job') return { title: `Livraison · ${this.act.o.name}`, text: 'Apporte le colis au point vert' };
    if (this.chase) return { title: 'Poursuite', text: 'Rattrape et frappe le drone voleur (3 coups)' };
    if (s.story === 0) return { title: 'Premiers pas', text: TUTO[s.tut] ? TUTO[s.tut].obj() : '' };
    const st = STORY[s.story];
    if (st) {
      const o = st.obj; let text = '';
      if (o.type === 'zone') text = `Libère la zone ${ZONE_NAMES[o.zone]}`;
      if (o.type === 'zones') text = `Libère ${o.zones.map(z => ZONE_NAMES[z] + (this.zoneInfested(this.city.zones[z]) ? '' : ' ✓')).join(' et ')}`;
      if (o.type === 'job') text = `Livre le colis « ${JOB_NAMES[o.job]} »`;
      if (o.type === 'race') text = `Termine la course « ${RACE_NAMES[o.race]} » avec une médaille`;
      if (o.type === 'chase') text = 'Rattrape le drone voleur';
      if (o.type === 'shards') text = `Récupère des éclats d'énergie (${s.shards.length} / ${o.count})`;
      if (o.type === 'reach') text = 'Atteins le sommet de la Tour Nova';
      if (o.type === 'boss') text = this.boss ? 'Détruis la Sentinelle' : 'Retourne au sommet de la Tour Nova';
      return { title: `Contrat ${s.story} · ${st.title}`, text };
    }
    return { title: 'Haneul City est libre', text: `Progression ${this.completion()} % · explore et complète les activités` };
  }

  /* ---------- progression ---------- */
  need(l) { return 120 + l * 80; }
  addXP(n) {
    const s = this.save; if (s.level >= 30) return;
    s.xp += n;
    while (s.level < 30 && s.xp >= this.need(s.level)) {
      s.xp -= this.need(s.level); s.level++;
      Sound.sfx('level'); this.toast(`Niveau ${s.level} !`, `+${50 * s.level} crédits`, 'cyan'); s.credits += 50 * s.level;
      if (s.level >= 5) this.unlockSuit('crimson');
    }
  }
  addCredits(n, quiet) { this.save.credits += Math.round(n); if (!quiet) Sound.sfx('coin'); this.popCredits(Math.round(n)); }
  unlockSuit(id) { if (this.save.suits.includes(id)) return; this.save.suits.push(id); this.toast('Nouvelle tenue !', `${SUITS[id].name} disponible dans le menu`, 'violet'); }
  updateShards(dt) {
    const s = this.save, P = this.P, m4 = this.m4 || (this.m4 = new THREE.Matrix4());
    const pc = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z), q = new THREE.Quaternion(), e = new THREE.Euler();
    const glow = this.shardGlowGeo.attributes.position;
    this.city.shards.forEach((sh, i) => {
      const got = s.shards.includes(i);
      if (!got && Math.abs(sh[0] - pc.x) < 2.4 && Math.abs(sh[2] - pc.z) < 2.4 && Math.abs(sh[1] - pc.y) < 2.6) {
        s.shards.push(i); Sound.sfx('shard'); this.burst(new V3(sh[0], sh[1], sh[2]), 24, 0x9ffcff, 7, 0.6, 0);
        this.addXP(30); this.addCredits(25, true);
        this.toast('Éclat d’énergie', `${s.shards.length} / 50`, 'cyan');
        if (s.shards.length >= 50) this.unlockSuit('gold');
        this.checkStory(); this.saveGame();
      }
      const has = s.shards.includes(i);
      e.set(0, this.time * 2 + i, 0.3); q.setFromEuler(e);
      m4.compose(new V3(sh[0], sh[1] + Math.sin(this.time * 2 + i) * 0.25, sh[2]), q, has ? new V3(0, 0, 0) : new V3(1, 1.3, 1));
      this.shardMesh.setMatrixAt(i, m4);
      glow.setY(i, has ? -999 : sh[1]);
    });
    this.shardMesh.instanceMatrix.needsUpdate = true; glow.needsUpdate = true;
  }

  /* ---------- environnement ---------- */
  updateSky(dt) {
    this.tod = (this.tod + dt / 720) % 1;
    const ang = (this.tod - 0.25) * Math.PI * 2;
    const sd = new V3(Math.cos(ang) * 0.85, Math.sin(ang), 0.42).normalize();
    const el = sd.y;
    const day = smooth(-0.1, 0.25, el), night = 1 - smooth(-0.2, 0.06, el), dusk = Math.exp(-Math.pow(el / 0.2, 2));
    const U = this.U;
    U.uNight.value = night; this.skyU.uDusk.value = dusk;
    const zen = new THREE.Color(0.015, 0.025, 0.07).lerp(new THREE.Color(0.2, 0.4, 0.78), day);
    const hor = new THREE.Color(0.05, 0.06, 0.13).lerp(new THREE.Color(0.62, 0.74, 0.9), day);
    hor.r += dusk * 0.55; hor.g += dusk * 0.2; hor.b += dusk * 0.02;
    this.skyU.uZen.value.copy(zen); this.skyU.uHor.value.copy(hor);
    U.uSunDir.value.copy(el > -0.05 ? sd : sd.clone().negate());
    const sc = el > -0.05 ? new THREE.Color(1, 0.6, 0.35).lerp(new THREE.Color(1, 0.96, 0.88), smooth(0, 0.4, el)).multiplyScalar(0.25 + day * 0.85) : new THREE.Color(0.16, 0.2, 0.34);
    U.uSunCol.value.copy(sc);
    U.uSky.value.copy(zen.clone().lerp(hor, 0.45).multiplyScalar(1.1).add(new THREE.Color(0.07, 0.07, 0.1)));
    U.uGround.value.setRGB(0.07 + 0.12 * day, 0.07 + 0.11 * day, 0.1 + 0.09 * day);
    U.uFogCol.value.copy(hor);
    this.scene.fog.color.copy(hor); this.scene.fog.far = this.fogFar; this.scene.fog.near = this.fogFar * 0.12;
    U.uFogNear.value = this.scene.fog.near; U.uFogFar.value = this.fogFar;
    this.hemi.color.copy(U.uSky.value); this.hemi.groundColor.copy(U.uGround.value); this.hemi.intensity = 1.1;
    this.sun.color.copy(sc); this.sun.position.copy(U.uSunDir.value);
    this.bulbMat.opacity = 0.15 + night * 0.85; this.carLightMat.opacity = 0.3 + night * 0.7;
    this.redMat.opacity = (Math.sin(this.time * 3) > 0.2 ? 1 : 0.15);
    this.nightF = night;
  }

  /* ---------- caméra ---------- */
  updateCamera(dt) {
    const c = this.cam, P = this.P, S = Store.settings;
    const look = Input.consumeLook();
    const inv = S.invertY ? -1 : 1;
    const lookIn = Math.abs(look.x) + Math.abs(look.y) + Math.abs(Input.ax.lx) + Math.abs(Input.ax.ly);
    c.yaw -= look.x * 0.0026 * S.sens; c.pitch -= look.y * 0.0026 * S.sens * inv;
    c.yaw -= Input.ax.lx * 2.7 * S.sens * dt; c.pitch -= Input.ax.ly * 1.9 * S.sens * dt * inv;
    // suivi automatique doux pendant le balancement (manette / tactile)
    if (lookIn < 0.01) c.idle += dt; else c.idle = 0;
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (Input.device !== 'kb' && c.idle > 0.8 && hv > 12 && (P.state === 'swing' || P.state === 'air')) {
      const target = Math.atan2(-P.vel.x, -P.vel.z);
      let d = target - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * (1 - Math.exp(-0.9 * dt));
    }
    c.pitch = clamp(c.pitch, -1.3, 0.95);
    const sp = P.vel.length();
    const fwd = new V3(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
    const right = new V3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    const target = new V3(P.pos.x, P.pos.y + 1.55, P.pos.z).addScaledVector(right, 0.5);
    let want = (P.state === 'climb' ? 5.5 : 6.3) + clamp(sp - 12, 0, 45) * 0.07;
    const back = fwd.clone().negate(), out = {};
    if (this.raycast(target, back, want + 0.4, out)) want = Math.max(1.2, out.t - 0.45);
    c.dist = want < c.dist ? want : damp(c.dist, want, 3, dt);
    const pos = target.clone().addScaledVector(back, c.dist);
    if (pos.y < 0.5) pos.y = 0.5;
    if (this.shake > 0) { const s = this.shake * 0.35; pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; pos.z += (Math.random() - 0.5) * s; this.shake = Math.max(0, this.shake - dt * 2.5); }
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().add(fwd));
    c.fov = damp(c.fov, 70 + clamp(sp - 16, 0, 40) * 0.42, 4, dt);
    this.camera.fov = c.fov; this.camera.updateProjectionMatrix();
    this.sky.position.copy(pos);
    // cible du zip : rayon depuis le centre de l'écran
    const zo = {};
    this.zipTarget = null;
    if (P.state !== 'dead' && this.raycast(pos, fwd, this.range() + c.dist, zo) && zo.box) {
      const hp = pos.clone().addScaledVector(fwd, zo.t);
      const d = hp.distanceTo(P.pos);
      if (d > 3 && d < this.range()) {
        const n = new V3(zo.nx, zo.ny, zo.nz);
        const p = n.y > 0.5 ? hp.clone().add(new V3(0, 0.05, 0)) : hp.clone().addScaledVector(n, R + 0.02).add(new V3(0, -0.9, 0));
        if (p.y < 0) p.y = 0;
        this.zipTarget = { p, n, box: zo.box };
      }
    }
  }

  /* ---------- animation du personnage ---------- */
  updateModel(dt) {
    const P = this.P, g = this.pm, h = this.pHips;
    g.position.copy(P.pos);
    g.visible = P.state !== 'dead' || P.deadT > 2.2;
    let df = P.facing - g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
    g.rotation.y += df * (1 - Math.exp(-14 * dt));
    const hv = Math.hypot(P.vel.x, P.vel.z);
    const set = (o, x, k = 14) => { o.rotation.x = damp(o.rotation.x, x, k, dt); };
    const setZ = (o, z, k = 14) => { o.rotation.z = damp(o.rotation.z, z, k, dt); };
    h.position.y = 0.95; h.rotation.z = damp(h.rotation.z, 0, 8, dt);
    if (P.state !== 'swing') { this.armR.rotation.y = damp(this.armR.rotation.y, 0, 14, dt); }
    if (P.flipT <= 0 && h.rotation.x > Math.PI) h.rotation.x -= Math.PI * 2;
    if (P.state === 'ground') {
      const k = clamp(hv / 10, 0, 1.4), s = Math.sin(P.phase * 1.25);
      set(this.legL, s * 0.85 * k); set(this.legR, -s * 0.85 * k);
      set(this.armL, -s * 0.7 * k); set(this.armR, s * 0.7 * k);
      setZ(this.armL, 0.08); setZ(this.armR, -0.08);
      h.position.y = 0.95 + Math.abs(Math.cos(P.phase * 1.25)) * 0.07 * k;
      set(h, hv > 14 ? 0.32 : hv * 0.012, 8);
    } else if (P.state === 'air' || P.state === 'lunge') {
      set(this.legL, -0.6); set(this.legR, 0.35); set(this.armL, -2.4, 8); set(this.armR, -0.6, 8);
      setZ(this.armL, 0.35); setZ(this.armR, -0.5);
      set(h, clamp(-P.vel.y * 0.02, -0.4, 0.5), 6);
    } else if (P.state === 'swing') {
      set(this.legL, 0.35); set(this.legR, 0.65); set(this.armL, -0.5); setZ(this.armL, 0.6);
      set(h, clamp(hv * 0.012, 0, 0.6), 6);
    } else if (P.state === 'climb') {
      const s = Math.sin(P.phase);
      set(this.armL, -2.6 + s * 0.5, 20); set(this.armR, -2.6 - s * 0.5, 20); setZ(this.armL, 0.2); setZ(this.armR, -0.2);
      set(this.legL, -0.6 - s * 0.4, 20); set(this.legR, -0.6 + s * 0.4, 20); set(h, -0.15, 8);
    } else if (P.state === 'zip') {
      set(h, 1.35, 10); set(this.armL, -2.9); set(this.armR, -2.9); set(this.legL, 0.15); set(this.legR, 0.05);
    }
    if (P.flipT > 0) h.rotation.x = (1 - P.flipT / 0.45) * Math.PI * 2;
    if (P.punchT > 0) { const k = P.combo % 2 ? this.armR : this.armL; k.rotation.x = -1.55; k.rotation.z = 0; }
    // bras du grappin tendu vers le point d'ancrage
    if (P.state === 'swing') {
      this.pm.updateMatrixWorld(true);
      const sh = new V3(); this.armR.getWorldPosition(sh);
      const dir = new V3().subVectors(P.anchor, sh).normalize();
      const inv = new THREE.Quaternion(); h.getWorldQuaternion(inv); inv.invert();
      dir.applyQuaternion(inv);
      this.armR.rotation.set(0, 0, 0); this.armR.quaternion.setFromUnitVectors(new V3(0, -1, 0), dir);
    }
    // corde
    const showRope = P.state === 'swing';
    this.ropeM.visible = this.ropeGlow.visible = showRope || (P.state === 'zip');
    if (this.ropeM.visible) {
      this.pm.updateMatrixWorld(true);
      const hand = new V3(); this.armR.userData.hand.getWorldPosition(hand);
      const to = P.state === 'zip' ? P.zipTo : P.anchor;
      const L = hand.distanceTo(to);
      for (const m of [this.ropeM, this.ropeGlow]) { m.position.copy(hand); m.lookAt(to); m.scale.set(1, 1, L); }
    }
  }

  /* ---------- HUD ---------- */
  initHUD() {
    const h = el('div', 'hud');
    h.innerHTML = `
      <div class="hud-tl">
        <div class="hud-lvl"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="ring-bg"/><circle cx="22" cy="22" r="19" class="ring-fg"/></svg><b></b></div>
        <div class="hud-bars"><div class="hp"><i></i></div><div class="xp"><i></i></div></div>
      </div>
      <div class="hud-tr"><div class="chip cr">₵ <b>0</b></div><div class="chip sh">◆ <b>0</b>/50</div><div class="chip tod"></div></div>
      <div class="hud-obj"><div class="t"></div><div class="d"></div><div class="dist"></div></div>
      <div class="hud-timer"></div>
      <canvas class="hud-map" width="200" height="200"></canvas>
      <div class="reticle"><i></i></div>
      <div class="lock"></div>
      <div class="wp-marker"><i></i><span></span></div>
      <div class="prompt"></div>
      <div class="toasts"></div>
      <div class="iris"><div class="iris-av"><span></span><span></span><span></span></div><div class="iris-txt"><b>IRIS</b><p></p></div></div>
      <div class="combo"><b></b><span>COMBO</span></div>
      <div class="center-msg"><b></b><span></span></div>
      <div class="boss-bar"><span>SENTINELLE</span><div><i></i></div></div>
      <div class="vig"></div>
      <div class="cr-pop"></div>
      <div class="fps"></div>
      <div class="rotate-hint">Tourne ton téléphone en paysage pour une meilleure expérience</div>`;
    this.root.appendChild(h);
    const q = s => h.querySelector(s);
    this.hud = { root: h, lvl: q('.hud-lvl b'), ring: q('.ring-fg'), hp: q('.hp i'), xp: q('.xp i'), cr: q('.cr b'), sh: q('.sh b'), tod: q('.tod'), objT: q('.hud-obj .t'), objD: q('.hud-obj .d'), objDist: q('.hud-obj .dist'), timer: q('.hud-timer'), map: q('.hud-map'), ret: q('.reticle'), lock: q('.lock'), wp: q('.wp-marker'), wpTxt: q('.wp-marker span'), prompt: q('.prompt'), toasts: q('.toasts'), iris: q('.iris'), irisP: q('.iris p'), combo: q('.combo'), comboB: q('.combo b'), center: q('.center-msg'), centerB: q('.center-msg b'), centerS: q('.center-msg span'), boss: q('.boss-bar'), bossBar: q('.boss-bar i'), vig: q('.vig'), crPop: q('.cr-pop'), fps: q('.fps') };
    this.mapCtx = this.hud.map.getContext('2d');
    this.hud.fps.style.display = Store.settings.fps ? 'block' : 'none';
  }
  buildMinimap() {
    const S = 640, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), E = HALF + HR, k = S / (2 * E + 60), o = 30;
    const tx = v => (v + E + o) * k;
    x.fillStyle = '#0a1a2a'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#1b1e26'; x.fillRect(tx(-E), tx(-E), 2 * E * k, 2 * E * k);
    for (const b of this.city.blocks) {
      x.fillStyle = b.type === 'park' ? '#1e3a22' : b.type === 'plaza' ? '#2a3a44' : '#2c303a';
      x.fillRect(tx(b.x0), tx(b.z0), BLOCK * k, BLOCK * k);
    }
    for (const b of this.city.boxes) {
      const hgt = clamp(b.maxY / 200, 0, 1);
      x.fillStyle = `rgb(${70 + hgt * 90 | 0},${76 + hgt * 92 | 0},${92 + hgt * 100 | 0})`;
      x.fillRect(tx(b.minX), tx(b.minZ), (b.maxX - b.minX) * k, (b.maxZ - b.minZ) * k);
    }
    this.mmCanvas = c; this.mmK = k; this.mmO = (E + o) * k;
  }
  drawMinimap() {
    const x = this.mapCtx, P = this.P, W = 200, s = this.mmK * 2.1, yaw = this.cam.yaw;
    x.clearRect(0, 0, W, W);
    x.save(); x.beginPath(); x.arc(100, 100, 98, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#081420'; x.fillRect(0, 0, W, W);
    x.translate(100, 100); x.rotate(yaw); x.scale(2.1, 2.1);
    x.translate(-(P.pos.x * this.mmK + this.mmO), -(P.pos.z * this.mmK + this.mmO));
    x.drawImage(this.mmCanvas, 0, 0);
    x.restore();
    const icon = (wx, wz, color, shape = 'dot', clampEdge = false, size = 5) => {
      let dx = (wx - P.pos.x) * s, dz = (wz - P.pos.z) * s;
      let px = dx * Math.cos(yaw) - dz * Math.sin(yaw), py = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      const L = Math.hypot(px, py);
      if (L > 90) { if (!clampEdge) return; px *= 90 / L; py *= 90 / L; }
      x.fillStyle = color; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2;
      x.beginPath();
      if (shape === 'diamond') { x.moveTo(100 + px, 100 + py - size - 2); x.lineTo(100 + px + size + 1, 100 + py); x.lineTo(100 + px, 100 + py + size + 2); x.lineTo(100 + px - size - 1, 100 + py); x.closePath(); }
      else x.arc(100 + px, 100 + py, size, 0, Math.PI * 2);
      x.stroke(); x.fill();
    };
    this.city.shards.forEach((sh, i) => { if (!this.save.shards.includes(i)) icon(sh[0], sh[2], '#7ff6ff', 'dot', false, 2.4); });
    this.city.zones.forEach(z => { if (this.zoneInfested(z)) icon(z.x, z.z, '#ff3048', 'dot', true, 5); });
    if (!this.act) { this.city.races.forEach(r => icon(r.start.x, r.start.z, '#ffd23d', 'dot', false, 4.5)); this.city.jobs.forEach(j => icon(j.from.x, j.from.z, '#3dff9a', 'dot', false, 4.5)); }
    for (const d of this.drones) if (!d.dead) icon(d.pos.x, d.pos.z, d.kind === 'thief' ? '#ffd23d' : '#ff6070', 'dot', d.kind === 'thief', 2.6);
    if (this.wp) icon(this.wp.p.x, this.wp.p.z, '#35e8ff', 'diamond', true, 6);
    // joueur
    x.save(); x.translate(100, 100); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 6); x.lineTo(0, 3); x.lineTo(-6, 6); x.closePath(); x.fill(); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2; x.beginPath(); x.arc(100, 100, 97, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '700 12px Sora, sans-serif'; x.textAlign = 'center';
    const nx = -Math.sin(yaw) * 84, ny = -Math.cos(yaw) * 84; x.fillText('N', 100 + nx, 104 + ny);
  }
  updateHUD(dt) {
    const H = this.hud, s = this.save, P = this.P;
    const maxH = this.maxHealth();
    H.hp.style.width = (Math.max(0, P.health) / maxH * 100) + '%';
    H.hp.parentElement.classList.toggle('low', P.health / maxH < 0.3);
    H.xp.style.width = (s.xp / this.need(s.level) * 100) + '%';
    H.lvl.textContent = s.level;
    H.ring.style.strokeDashoffset = 119.4 * (1 - s.xp / this.need(s.level));
    H.cr.textContent = s.credits.toLocaleString('fr-FR'); H.sh.textContent = s.shards.length;
    const hh = Math.floor(this.tod * 24), mm = Math.floor((this.tod * 24 - hh) * 60);
    H.tod.textContent = `${this.nightF > 0.5 ? '☾' : '☀'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    // objectif
    const ob = this.objectiveText();
    if (H.objT._v !== ob.title) { H.objT.innerHTML = ob.title; H.objT._v = ob.title; }
    if (H.objD._v !== ob.text) { H.objD.innerHTML = ob.text; H.objD._v = ob.text; }
    // point de passage
    let wp = null;
    if (this.act && this.act.type === 'race') { const p = this.act.o.pts[this.act.idx]; if (p) wp = { p, label: 'Anneau' }; }
    else if (this.act && this.act.type === 'job') wp = { p: this.act.o.to, label: 'Livraison' };
    else if (this.chase) wp = { p: this.chase.d.pos, label: 'Voleur' };
    else if (this.customWp) { wp = this.customWp; if (P.pos.distanceTo(wp.p) < 12) { this.customWp = null; } }
    else wp = this.storyWaypoint();
    this.wp = wp;
    this.wpBeam.visible = !!wp && !(this.act && this.act.type === 'race');
    if (wp) {
      this.wpBeam.position.set(wp.p.x, wp.p.y > 2 ? wp.p.y : 0, wp.p.z);
      const dist = P.pos.distanceTo(wp.p);
      H.objDist.textContent = `${Math.round(dist)} m · ${wp.label}`;
      const v = new V3(wp.p.x, wp.p.y + 2, wp.p.z).project(this.camera);
      let sx = v.x, sy = v.y; const behind = v.z > 1;
      if (behind) { sx = -sx; sy = -sy; }
      const off = behind || Math.abs(sx) > 0.92 || Math.abs(sy) > 0.88;
      if (off) { const k = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.86); sx /= k; sy /= k; if (behind && Math.abs(sy) < 0.86 && Math.abs(sx) < 0.9) sy = -0.86; }
      H.wp.style.transform = `translate(${(sx * 0.5 + 0.5) * this.W}px, ${(-sy * 0.5 + 0.5) * this.H}px)`;
      H.wp.style.display = 'block'; H.wpTxt.textContent = `${Math.round(dist)} m`;
    } else { H.wp.style.display = 'none'; H.objDist.textContent = ''; }
    // minuteur
    if (this.act && this.act.type === 'race') { H.timer.style.display = 'block'; H.timer.innerHTML = this.act.count > 0 ? '0:00.00' : fmtClock(this.act.t); }
    else if (this.act && this.act.type === 'job') { H.timer.style.display = 'block'; H.timer.innerHTML = `${Math.ceil(this.act.t)} s`; H.timer.classList.toggle('urgent', this.act.t < 10); }
    else if (this.chase) { H.timer.style.display = 'block'; H.timer.innerHTML = `Voleur : ${Math.round(this.chase.d.pos.distanceTo(P.pos))} m`; }
    else H.timer.style.display = 'none';
    // zone
    const zIn = this.city.zones.find(z => this.zoneInfested(z) && z.spawned && Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < 110);
    if (zIn && !this.act) { const alive = this.drones.filter(d => d.zone === zIn.id).length; H.timer.style.display = 'block'; H.timer.innerHTML = `<span class="red">ZONE ENVAHIE · ${zIn.name}</span> · drones ${zIn.total - alive}/${zIn.total}`; }
    // viseur
    H.ret.classList.toggle('on', !!this.zipTarget);
    H.ret.classList.toggle('swing', P.state === 'swing');
    // invite
    const ni = this.nearInteract();
    if (ni) { H.prompt.innerHTML = `${Input.glyph('interact')} ${ni.label}`; H.prompt.classList.add('show'); }
    else H.prompt.classList.remove('show');
    this.interactable = ni;
    // verrou de cible
    let tgt = null, bd = 19;
    for (const d of this.drones) { const L = d.pos.distanceTo(P.pos); if (!d.dead && L < bd) { bd = L; tgt = d; } }
    if (tgt) { const v = tgt.pos.clone().project(this.camera); if (v.z < 1) { H.lock.style.display = 'block'; H.lock.style.transform = `translate(${(v.x * 0.5 + 0.5) * this.W}px, ${(-v.y * 0.5 + 0.5) * this.H}px)`; } else H.lock.style.display = 'none'; }
    else H.lock.style.display = 'none';
    // combo
    if (P.comboT <= 0) H.combo.classList.remove('show');
    // IRIS
    if (this.dialogT > 0) { this.dialogT -= dt; if (this.dialogT <= 0) this.nextLine(); }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) H.center.classList.remove('show'); }
    this.mapTick = (this.mapTick || 0) + 1;
    if (this.mapTick % 2 === 0) this.drawMinimap();
  }
  showCombo() { const H = this.hud; if (this.P.combo < 2) return; H.comboB.textContent = '×' + this.P.combo; H.combo.classList.remove('show'); void H.combo.offsetWidth; H.combo.classList.add('show'); }
  popCredits(n) { const H = this.hud; H.crPop.textContent = `+${n} ₵`; H.crPop.classList.remove('show'); void H.crPop.offsetWidth; H.crPop.classList.add('show'); }
  toast(title, text, color = 'cyan') {
    const t = el('div', 'toast ' + color, `<b>${title}</b><span>${text}</span>`);
    this.hud.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
    while (this.hud.toasts.children.length > 3) this.hud.toasts.firstChild.remove();
  }
  center(big, small, dur = 2) { const H = this.hud; H.centerB.textContent = big; H.centerS.textContent = small; H.center.classList.remove('show'); void H.center.offsetWidth; H.center.classList.add('show'); this.centerT = dur; }
  say(lines) { this.dialogQ.push(...lines); if (this.dialogT <= 0) this.nextLine(); }
  nextLine() {
    const H = this.hud;
    if (!this.dialogQ.length) { H.iris.classList.remove('show'); return; }
    const l = this.dialogQ.shift();
    H.irisP.innerHTML = l; H.iris.classList.add('show'); Sound.sfx('radio');
    this.dialogT = 2.2 + l.replace(/<[^>]+>/g, '').length * 0.045;
  }

  /* ---------- commandes tactiles ---------- */
  initTouch() {
    const t = el('div', 'touch');
    t.innerHTML = `
      <div class="t-look"></div>
      <div class="t-stick"><div class="t-base"><div class="t-knob"></div></div></div>
      <div class="t-btns">
        <button data-a="swing" class="tb big swing">GRAPPIN</button>
        <button data-a="jump" class="tb big jump">SAUT</button>
        <button data-a="attack" class="tb atk">FRAPPE</button>
        <button data-a="zip" class="tb zip">ZIP</button>
        <button data-a="dash" class="tb dash">DASH</button>
        <button data-a="interact" class="tb act">ACTION</button>
      </div>
      <div class="t-top"><button data-a="map" class="tb sm">CARTE</button><button data-a="pause" class="tb sm">❚❚</button></div>`;
    this.root.appendChild(t);
    const T = Input.touch;
    t.querySelectorAll('.tb').forEach(b => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); T.btn[a] = true; T.tap[a] = true; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (er) {} Sound.unlock(); });
      const up = e => { T.btn[a] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    const stick = t.querySelector('.t-stick'), base = t.querySelector('.t-base'), knob = t.querySelector('.t-knob');
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; base.style.left = sx + 'px'; base.style.top = sy + 'px'; base.classList.add('on'); try { stick.setPointerCapture(e.pointerId); } catch (er) {} });
    stick.addEventListener('pointermove', e => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - sx, dy = e.clientY - sy; const L = Math.hypot(dx, dy), M = 56;
      if (L > M) { dx *= M / L; dy *= M / L; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      T.mx = dx / M; T.my = -dy / M;
    });
    const send = () => { sid = null; T.mx = T.my = 0; knob.style.transform = ''; base.classList.remove('on'); };
    stick.addEventListener('pointerup', send); stick.addEventListener('pointercancel', send);
    const look = t.querySelector('.t-look'); let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (er) {} });
    look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; T.dx += (e.clientX - lx) * 1.6; T.dy += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
    const lup = () => { lid = null; }; look.addEventListener('pointerup', lup); look.addEventListener('pointercancel', lup);
    this.touchEl = t; this.root.classList.add('has-touch');
  }

  /* ---------- menus ---------- */
  openPause() {
    if (this.menu) return;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    Sound.sfx('back');
    const ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-head"><div><div class="gm-kicker">SKYLINE · HANEUL CITY</div><h2 class="gm-title">Pause</h2></div><div class="gm-stats"></div></div><div class="gm-list"></div><div class="gm-foot"></div></div>`;
    this.root.appendChild(ov);
    this.menu = { el: ov, stack: [] };
    this.menuList = new ListMenu(ov.querySelector('.gm-list'), []);
    this.pushMenu('Pause', this.pauseItems());
    this.paintMenuHead();
  }
  paintMenuHead() {
    if (!this.menu) return;
    const s = this.save;
    this.menu.el.querySelector('.gm-stats').innerHTML = `<span>Niv. <b>${s.level}</b></span><span>₵ <b>${s.credits.toLocaleString('fr-FR')}</b></span><span>◆ <b>${s.shards.length}</b>/50</span><span><b>${this.completion()}</b> %</span>`;
    this.menu.el.querySelector('.gm-foot').innerHTML = `${Input.glyph('confirm')} Valider &nbsp; ${Input.glyph('back')} Retour &nbsp; ${Store.cloud === 'on' ? '☁ Sauvegarde synchronisée' : '💾 Sauvegarde locale'}`;
  }
  pushMenu(title, items) { this.menu.stack.push({ title, items, focus: 0 }); this.showMenuTop(); }
  showMenuTop() {
    const top = this.menu.stack[this.menu.stack.length - 1];
    this.menu.el.querySelector('.gm-title').textContent = top.title;
    this.menuList.focus = top.focus || 0; this.menuList.setItems(top.items);
  }
  popMenu() {
    const st = this.menu.stack; st.pop();
    if (!st.length) return this.closeMenu();
    this.showMenuTop();
  }
  closeMenu() {
    if (!this.menu) return;
    this.menu.el.remove(); this.menu = null; this.menuList = null; this.last = performance.now();
    Sound.sfx('select');
    if (this.mapEl) { this.mapEl.remove(); this.mapEl = null; }
  }
  pauseItems() {
    const items = [
      { label: 'Reprendre', act: () => this.closeMenu() },
      { label: 'Carte & activités', sub: 'Choisis une destination', act: () => { this.closeMenu(); this.openMap(); } },
      { label: 'Améliorations', sub: () => `${this.save.credits.toLocaleString('fr-FR')} crédits disponibles`, act: () => this.pushMenu('Améliorations', this.upgradeItems()) },
      { label: 'Tenues', sub: () => `${this.save.suits.length} / ${Object.keys(SUITS).length} débloquées`, act: () => this.pushMenu('Tenues', this.suitItems()) },
      { label: 'Statistiques', act: () => this.pushMenu('Statistiques', this.statItems()) },
      { label: 'Paramètres', act: () => this.pushMenu('Paramètres', this.settingItems()) },
    ];
    if (this.act || this.chase) items.splice(1, 0, { label: 'Abandonner l’activité', cls: 'warn', act: () => { if (this.chase) { const c = this.chase; this.chase = null; if (c.d && !c.d.dead) this.removeDrone(c.d); this.nextChase = this.time + 200; } this.failActivity('Activité abandonnée'); this.closeMenu(); } });
    items.push({ label: 'Sauvegarder et quitter vers NOVA', cls: 'exit', act: () => this.exit() });
    return items;
  }
  upgradeItems() {
    return UPG.map(u => ({
      label: u.name,
      sub: () => { const lv = this.save.up[u.id]; return `${u.desc} · ${lv >= u.max ? 'Niveau max' : `Prochain : ${u.cost[lv].toLocaleString('fr-FR')} ₵`}`; },
      get: () => { const lv = this.save.up[u.id]; return `<span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`; },
      disabled: () => this.save.up[u.id] >= u.max || this.save.credits < u.cost[this.save.up[u.id]],
      act: () => {
        const lv = this.save.up[u.id]; if (lv >= u.max) return;
        const c = u.cost[lv]; if (this.save.credits < c) return;
        this.save.credits -= c; this.save.up[u.id]++; Sound.sfx('level');
        if (u.id === 'health') this.P.health = this.maxHealth();
        this.paintMenuHead(); this.saveGame();
      },
    }));
  }
  suitItems() {
    return Object.entries(SUITS).map(([id, su]) => ({
      label: `<span class="swatch" style="background:#${su.col.toString(16).padStart(6, '0')}"></span>${su.name}`,
      sub: su.req,
      get: () => this.save.suit === id ? '<b class="eq">Équipée</b>' : this.save.suits.includes(id) ? 'Disponible' : '🔒',
      disabled: () => !this.save.suits.includes(id),
      act: () => { this.setSuit(id); this.saveGame(); },
    }));
  }
  statItems() {
    const s = this.save, st = s.stats;
    const best = this.city.races.map(rc => `${rc.name} : ${s.races[rc.id] ? fmtClock(s.races[rc.id]) : '—'}`).join('<br>');
    return [
      { label: 'Temps de jeu', get: () => fmtDuration(s.playTime) },
      { label: 'Progression', get: () => this.completion() + ' %' },
      { label: 'Drones détruits', get: () => st.drones },
      { label: 'Distance parcourue', get: () => (st.dist / 1000).toFixed(1) + ' km' },
      { label: 'Zones libérées', get: () => `${s.zonesEver.length} / 6` },
      { label: 'Livraisons', get: () => st.deliveries },
      { label: 'Voleurs attrapés', get: () => st.chases },
      { label: 'Records des courses', sub: best },
    ];
  }
  settingItems() {
    const S = Store.settings;
    const qual = ['auto', 'low', 'medium', 'high'], qn = { auto: 'Auto', low: 'Bas', medium: 'Moyen', high: 'Haut' };
    return [
      { label: 'Sensibilité caméra', get: () => S.sens.toFixed(1), left: () => { S.sens = Math.max(0.3, +(S.sens - 0.1).toFixed(1)); Store.touch(); }, right: () => { S.sens = Math.min(3, +(S.sens + 0.1).toFixed(1)); Store.touch(); } },
      { label: 'Inverser l’axe vertical', get: () => S.invertY ? 'Oui' : 'Non', left: () => { S.invertY = !S.invertY; Store.touch(); }, right: () => { S.invertY = !S.invertY; Store.touch(); } },
      { label: 'Musique', get: () => Math.round(S.music * 100) + ' %', left: () => { S.music = Math.max(0, +(S.music - 0.1).toFixed(1)); Sound.applyVolumes(); Store.touch(); }, right: () => { S.music = Math.min(1, +(S.music + 0.1).toFixed(1)); Sound.applyVolumes(); Store.touch(); } },
      { label: 'Effets sonores', get: () => Math.round(S.sfx * 100) + ' %', left: () => { S.sfx = Math.max(0, +(S.sfx - 0.1).toFixed(1)); Sound.applyVolumes(); Store.touch(); }, right: () => { S.sfx = Math.min(1, +(S.sfx + 0.1).toFixed(1)); Sound.applyVolumes(); Store.touch(); } },
      { label: 'Vibrations', get: () => S.rumble ? 'Oui' : 'Non', left: () => { S.rumble = !S.rumble; Store.touch(); }, right: () => { S.rumble = !S.rumble; Store.touch(); } },
      { label: 'Qualité graphique', sub: 'Appliquée au prochain lancement', get: () => qn[S.quality], left: () => { S.quality = qual[(qual.indexOf(S.quality) + 3) % 4]; Store.touch(); }, right: () => { S.quality = qual[(qual.indexOf(S.quality) + 1) % 4]; Store.touch(); } },
      { label: 'Afficher les FPS', get: () => S.fps ? 'Oui' : 'Non', left: () => { S.fps = !S.fps; this.hud.fps.style.display = S.fps ? 'block' : 'none'; Store.touch(); }, right: () => { S.fps = !S.fps; this.hud.fps.style.display = S.fps ? 'block' : 'none'; Store.touch(); } },
    ];
  }
  openMap() {
    if (this.menu) return;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    Sound.sfx('select');
    const ov = el('div', 'gmenu map');
    ov.innerHTML = `<div class="map-wrap glass"><canvas class="bigmap" width="720" height="720"></canvas><div class="map-side"><div class="gm-kicker">CARTE · HANEUL CITY</div><h2>Activités</h2><div class="gm-list"></div><div class="gm-foot"></div></div></div>`;
    this.root.appendChild(ov);
    this.menu = { el: ov, stack: [], map: true };
    this.menuList = new ListMenu(ov.querySelector('.gm-list'), []);
    const P = this.P, s = this.save;
    const acts = [];
    const swp = this.storyWaypoint(); if (swp) acts.push({ label: `★ ${STORY[s.story] ? STORY[s.story].title : 'Histoire'}`, sub: swp.label, p: swp.p, c: '#35e8ff' });
    this.city.zones.forEach(z => acts.push({ label: `Zone · ${z.name}`, sub: this.zoneInfested(z) ? `Envahie · niveau ${z.tier + 1}` : 'Libérée', p: new V3(z.x, 0, z.z), c: this.zoneInfested(z) ? '#ff3048' : '#557', done: !this.zoneInfested(z) }));
    this.city.races.forEach(rc => { const t = s.races[rc.id]; acts.push({ label: `Course · ${rc.name}`, sub: t ? `Record ${fmtClock(t)} · ${t <= rc.gold ? 'Or' : t <= rc.silver ? 'Argent' : t <= rc.bronze ? 'Bronze' : 'Sans médaille'}` : `Or en ${fmtClock(rc.gold)}`, p: rc.start, c: '#ffd23d' }); });
    this.city.jobs.forEach(j => acts.push({ label: `Livraison · ${j.name}`, sub: s.jobs[j.id] ? `Réussie ×${s.jobs[j.id]}` : `${j.time} s pour livrer`, p: j.from, c: '#3dff9a' }));
    acts.forEach(a => a.d = P.pos.distanceTo(a.p));
    const story = acts[0] && acts[0].label.startsWith('★') ? [acts.shift()] : [];
    acts.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.d - b.d);
    const list = [...story, ...acts];
    this.mapActs = list;
    this.menuList.setItems(list.map(a => ({ label: `<span class="dotc" style="background:${a.c}"></span>${a.label}`, sub: `${a.sub} · ${Math.round(a.d)} m`, act: () => { this.customWp = { p: a.p.clone(), label: a.label.replace(/<[^>]+>/g, '').replace('★ ', '') }; this.closeMenu(); this.toast('Destination définie', this.customWp.label, 'cyan'); } })));
    ov.querySelector('.gm-foot').innerHTML = `${Input.glyph('confirm')} Définir la destination &nbsp; ${Input.glyph('back')} Fermer`;
    this.bigMap = ov.querySelector('.bigmap');
    this.drawBigMap();
  }
  drawBigMap() {
    if (!this.bigMap) return;
    const x = this.bigMap.getContext('2d'), S = 720, k = S / 640;
    x.clearRect(0, 0, S, S); x.drawImage(this.mmCanvas, 0, 0, S, S);
    const tp = (wx, wz) => [(wx * this.mmK + this.mmO) * k, (wz * this.mmK + this.mmO) * k];
    const dot = (wx, wz, c, r = 6, ring) => { const [a, b] = tp(wx, wz); x.fillStyle = c; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); if (ring) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(a, b, r + 6, 0, 7); x.stroke(); } };
    this.city.shards.forEach((sh, i) => { if (!this.save.shards.includes(i)) dot(sh[0], sh[2], '#7ff6ff', 2.5); });
    const sel = this.mapActs && this.menuList ? this.mapActs[this.menuList.focus] : null;
    (this.mapActs || []).forEach(a => dot(a.p.x, a.p.z, a.c, 7, a === sel));
    const [px, pz] = tp(this.P.pos.x, this.P.pos.z);
    x.save(); x.translate(px, pz); x.rotate(-this.cam.yaw); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -12); x.lineTo(9, 9); x.lineTo(0, 4); x.lineTo(-9, 9); x.closePath(); x.fill(); x.restore();
    const [tx, tz] = tp(this.towerTop.x, this.towerTop.z); x.fillStyle = '#fff'; x.font = '700 15px Sora, sans-serif'; x.textAlign = 'center'; x.fillText('TOUR NOVA', tx, tz - 18);
  }
  updateMenu(nav) {
    if (!this.menu) return;
    const top = this.menu.stack[this.menu.stack.length - 1];
    const before = this.menuList.focus;
    this.menuList.update(nav);
    if (!this.menu || !this.menuList) return;
    if (top) top.focus = this.menuList.focus;
    if (this.menu && this.menu.map && before !== (this.menuList && this.menuList.focus)) this.drawBigMap();
    if (!this.menu) return;
    if (Input.pressed('back') || (Input.pressed('pause') && !this.menu.map) || (this.menu.map && Input.pressed('map'))) { if (this.menu.map) this.closeMenu(); else this.popMenu(); }
    else if (Input.pressed('pause') && this.menu.map) this.closeMenu();
    if (this.menu && !this.menu.map) this.paintMenuHead();
  }
  async exit() {
    this.saveGame();
    this.destroy();
    this.onExit && this.onExit();
  }
  destroy() {
    this.running = false;
    removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis);
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    Input.touch.mx = Input.touch.my = 0; Input.touch.btn = {};
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {}
    this.root.innerHTML = '';
  }

  /* ---------- boucle ---------- */
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (dt <= 0) dt = 0.016;
    Input.poll();
    const nav = Input.nav(dt);
    this.perf(dt);
    if (Modal.active) { Modal.active.update(nav); this.renderer.render(this.scene, this.camera); return; }
    if (this.menu) { this.updateMenu(nav); if (!this.running) return; this.U.uTime.value += dt * 0.3; this.renderer.render(this.scene, this.camera); return; }
    if (Input.pressed('pause')) { this.openPause(); return; }
    if (Input.pressed('map')) { this.openMap(); return; }
    if (Input.pressed('interact') && this.interactable) { const it = this.interactable; if (it.type === 'race') this.startRace(it.o); else if (it.type === 'job') this.startJob(it.o); }
    let sdt = dt; if (this.hitstop > 0) { this.hitstop -= dt; sdt = dt * 0.08; }
    this.update(sdt, dt);
    this.renderer.render(this.scene, this.camera);
  }
  update(dt, realDt) {
    this.time += dt; this.save.playTime += realDt;
    this.U.uTime.value = this.time;
    this.updateSky(dt);
    this.updatePlayer(dt);
    this.updateDrones(dt);
    this.updateProjectiles(dt);
    this.updateCamera(realDt);
    this.updateModel(dt);
    this.updateCars(dt);
    this.updateParticles(dt);
    this.updateShards(dt);
    this.updateZones();
    this.updateActivity(dt);
    if (this.save.story > 0) this.checkStory();
    if (this.save.story === 0 && this.save.tut === 3 && this.P.grounded && this.P.groundBox && this.P.pos.y > 8) this.tutoNext();
    if (this.save.story > 4 && !this.chase && !this.act && this.nextChase && this.time > this.nextChase) { this.startChase(); this.nextChase = this.time + 300 + Math.random() * 120; }
    this.holo.rotation.y += dt * 0.3; this.holo.children.forEach((c, i) => { c.rotation.z += dt * (i % 2 ? -0.4 : 0.6); });
    this.updateHUD(realDt);
    if (this.time - (this.lastSave || 0) > 25) this.saveGame();
  }
  perf(dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 1.5) {
      const fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0;
      if (Store.settings.fps) this.hud.fps.textContent = `${fps.toFixed(0)} FPS · ×${this.pr.toFixed(2)}`;
      if (fps < 42 && this.pr > 0.5) { this.pr = Math.max(0.5, this.pr - 0.1); this.renderer.setPixelRatio(this.pr); this.resize(); }
      else if (fps > 57 && this.pr < this.prTarget) { this.pr = Math.min(this.prTarget, this.pr + 0.05); this.renderer.setPixelRatio(this.pr); this.resize(); }
    }
  }
}

export function summaryFor(save) {
  return save && save.summary ? save.summary : null;
}
