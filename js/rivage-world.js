// RIVAGE — génération du monde : île, végétation, géométries, shaders. Jeu original pour NOVA.
import * as THREE from './three.module.min.js';
import { rng, clamp, lerp } from './core.js';

export const SIZE = 768, G = 320, CELL = SIZE / G, HALF = SIZE / 2, GV = G + 1;
const V3 = THREE.Vector3;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const ISLANDS = {
  tropic: { name: 'Kaimana', sub: 'Île tropicale', desc: 'Lagon turquoise, jungle dense, nuits douces. La plus accueillante.', peak: 60, temp: 28, snow: 999, acc: '#3ddcc0',
    pal: { sand: [0.87, 0.79, 0.57], grass: [0.34, 0.53, 0.2], forest: [0.15, 0.35, 0.13], rock: [0.43, 0.41, 0.38], peak: [0.5, 0.48, 0.44], shallow: [0.1, 0.72, 0.68], deep: [0.02, 0.2, 0.36] } },
  volcan: { name: 'Cendre', sub: 'Île volcanique', desc: 'Sable noir, chaleur écrasante, fer abondant. Le volcan gronde.', peak: 125, temp: 33, snow: 999, acc: '#ff7a3d',
    pal: { sand: [0.19, 0.18, 0.19], grass: [0.3, 0.43, 0.18], forest: [0.18, 0.31, 0.13], rock: [0.22, 0.2, 0.2], peak: [0.3, 0.26, 0.25], shallow: [0.1, 0.5, 0.55], deep: [0.02, 0.13, 0.25] } },
  nord: { name: 'Frimas', sub: 'Île nordique', desc: 'Falaises, pins et neige. Le froid tue plus vite que la faim.', peak: 88, temp: 5, snow: 46, acc: '#9fd0ff',
    pal: { sand: [0.6, 0.6, 0.57], grass: [0.36, 0.45, 0.26], forest: [0.19, 0.31, 0.2], rock: [0.4, 0.42, 0.45], peak: [0.93, 0.95, 0.98], shallow: [0.16, 0.45, 0.5], deep: [0.02, 0.1, 0.2] } },
};

function mkNoise(seed) {
  const r = rng(seed), p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const g = (i, j) => p[(p[i & 255] + j) & 255] / 255;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
  };
}
const fbm = (n, x, y, o = 4) => { let a = 0, f = 1, w = 0.5, s = 0; for (let i = 0; i < o; i++) { a += n(x * f, y * f) * w; s += w; f *= 2.03; w *= 0.5; } return a / s; };

export class World {
  constructor(cfg) {
    this.cfg = cfg; this.isl = ISLANDS[cfg.island]; this.seed = cfg.seed;
    this.n = mkNoise(cfg.seed); this.n2 = mkNoise(cfg.seed + 77);
    this.h = new Float32Array(GV * GV); this.h0 = null;
    this.gen();
    this.h0 = new Float32Array(this.h);
    this.sites = this.findSites();
  }
  heightFn(x, z) {
    const n = this.n, I = this.isl, k = this.cfg.island;
    let d = Math.hypot(x, z) / (SIZE * 0.45);
    d *= 1 + (fbm(n, x * 0.0045 + 31, z * 0.0045 + 7, 3) - 0.5) * 0.7;
    const m = 1 - clamp(d, 0, 1);
    let h = lerp(-22, 2.6, smooth(0, 0.36, m));
    const inl = smooth(0.36, 0.95, m);
    const rid = 1 - Math.abs(2 * fbm(n, x * 0.007 + 3, z * 0.007 + 9, 4) - 1);
    const hills = fbm(n, x * 0.011 + 50, z * 0.011 + 80, 4);
    if (k === 'tropic') h += Math.pow(inl, 1.5) * (0.25 + 0.75 * hills) * I.peak * 1.15 + inl * rid * 9;
    else if (k === 'nord') h += Math.pow(inl, 1.1) * (0.2 + 0.8 * Math.pow(rid, 1.6)) * I.peak * 1.2 + smooth(0.4, 0.5, m) * 5;
    else {
      const dd = Math.hypot(x, z), c = clamp(1 - dd / 215, 0, 1);
      h += Math.pow(c, 1.7) * I.peak * 1.05 + inl * hills * 16;
      if (dd < 40) h -= smooth(40, 8, dd) * 34;
    }
    h += (fbm(n, x * 0.035, z * 0.035, 3) - 0.5) * 5 * smooth(0.42, 0.7, m);
    h += (n(x * 0.12, z * 0.12) - 0.5) * 0.5 * smooth(0.3, 0.5, m);
    return h;
  }
  gen() { for (let j = 0; j < GV; j++) for (let i = 0; i < GV; i++) this.h[i + j * GV] = this.heightFn(-HALF + i * CELL, -HALF + j * CELL); }
  getH(x, z) {
    const fx = clamp((x + HALF) / CELL, 0, G - 0.001), fz = clamp((z + HALF) / CELL, 0, G - 0.001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, h = this.h, a = i + j * GV;
    return lerp(lerp(h[a], h[a + 1], u), lerp(h[a + GV], h[a + GV + 1], u), v);
  }
  getH0(x, z) {
    const fx = clamp((x + HALF) / CELL, 0, G - 0.001), fz = clamp((z + HALF) / CELL, 0, G - 0.001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, h = this.h0, a = i + j * GV;
    return lerp(lerp(h[a], h[a + 1], u), lerp(h[a + GV], h[a + GV + 1], u), v);
  }
  slope(x, z) { const e = 1.5; const dx = this.getH(x + e, z) - this.getH(x - e, z), dz = this.getH(x, z + e) - this.getH(x, z - e); return Math.hypot(dx, dz) / (2 * e); }
  moist(x, z) { return fbm(this.n2, x * 0.012, z * 0.012, 3); }
  along(ang, pred, from = 20, to = HALF - 10, step = 2) { for (let r = from; r < to; r += step) { const x = Math.sin(ang) * r, z = Math.cos(ang) * r; if (pred(this.getH(x, z), x, z, r)) return [x, z]; } return null; }
  alongIn(ang, pred) { for (let r = HALF - 10; r > 10; r -= 2) { const x = Math.sin(ang) * r, z = Math.cos(ang) * r; if (pred(this.getH(x, z), x, z, r)) return [x, z]; } return [0, 0]; }
  findSites() {
    const beach = a => this.alongIn(a, h => h > 1.2);
    let best = -1e9, sx = 0, sz = 0;
    for (let j = 0; j < GV; j += 2) for (let i = 0; i < GV; i += 2) { const h = this.h[i + j * GV]; if (h > best) { best = h; sx = -HALF + i * CELL; sz = -HALF + j * CELL; } }
    const mid = (a, lo, hi) => this.along(a, (h, x, z) => h > lo && h < hi && this.slope(x, z) < 0.35, 60) || this.alongIn(a, h => h > lo);
    const sunk = this.along(2.1, h => h < -7 && h > -11, 80) || [Math.sin(2.1) * 300, Math.cos(2.1) * 300];
    return {
      spawn: beach(0.0), wreck: beach(1.25), den: mid(3.9, 12, 30), sunken: sunk, sanct: mid(5.3, 8, 26), summit: [sx, sz],
      springs: [mid(0.7, 6, 22), mid(2.8, 6, 22), mid(4.7, 6, 22)],
    };
  }
  colorAt(x, z, h, ny, out) {
    const P = this.isl.pal, dug = this.h0 ? this.getH0(x, z) - h : 0, sl = 1 - ny, m = this.moist(x, z);
    let c;
    if (h < 2.2) c = P.sand;
    else if (h < 3.6) { const t = (h - 2.2) / 1.4; c = [lerp(P.sand[0], P.grass[0], t), lerp(P.sand[1], P.grass[1], t), lerp(P.sand[2], P.grass[2], t)]; }
    else { const t = smooth(0.38, 0.62, m); c = [lerp(P.grass[0], P.forest[0], t), lerp(P.grass[1], P.forest[1], t), lerp(P.grass[2], P.forest[2], t)]; }
    let r = c[0], g = c[1], b = c[2];
    const rk = smooth(0.2, 0.42, sl) * (h > 2 ? 1 : 0.3);
    r = lerp(r, P.rock[0], rk); g = lerp(g, P.rock[1], rk); b = lerp(b, P.rock[2], rk);
    const top = this.cfg.island === 'nord' ? smooth(this.isl.snow - 6, this.isl.snow + 6, h + (m - 0.5) * 14) * (1 - smooth(0.45, 0.7, sl)) : smooth(this.isl.peak * 0.6, this.isl.peak * 0.9, h);
    r = lerp(r, P.peak[0], top); g = lerp(g, P.peak[1], top); b = lerp(b, P.peak[2], top);
    if (dug > 0.25) { const t = smooth(0.25, 2.2, dug), d2 = smooth(3, 9, dug); const R = lerp(0.36, 0.2, d2), Gc = lerp(0.3, 0.18, d2), B = lerp(0.24, 0.17, d2); r = lerp(r, R, t); g = lerp(g, Gc, t); b = lerp(b, B, t); }
    const v = 0.9 + this.n2(x * 0.4, z * 0.4) * 0.2;
    out[0] = r * v; out[1] = g * v; out[2] = b * v;
  }
  buildTerrain(lowQ) {
    const pos = new Float32Array(GV * GV * 3), nor = new Float32Array(GV * GV * 3), col = new Float32Array(GV * GV * 3);
    const st = lowQ ? 2 : 1, idx = [];
    for (let j = 0; j < G; j += st) for (let i = 0; i < G; i += st) { const a = i + j * GV, b = a + st, c = a + st * GV, d = c + st; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.geo = g; this.refresh(0, 0, G, G);
    g.boundingSphere = new THREE.Sphere(new V3(0, 30, 0), SIZE);
    return g;
  }
  refresh(i0, j0, i1, j1) {
    const pos = this.geo.attributes.position.array, nor = this.geo.attributes.normal.array, col = this.geo.attributes.color.array, h = this.h, c = [0, 0, 0];
    i0 = clamp(i0, 0, G); j0 = clamp(j0, 0, G); i1 = clamp(i1, 0, G); j1 = clamp(j1, 0, G);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = i + j * GV, k = a * 3, x = -HALF + i * CELL, z = -HALF + j * CELL;
      pos[k] = x; pos[k + 1] = h[a]; pos[k + 2] = z;
      const hl = h[i > 0 ? a - 1 : a], hr = h[i < G ? a + 1 : a], hd = h[j > 0 ? a - GV : a], hu = h[j < G ? a + GV : a];
      let nx = hl - hr, ny = 2 * CELL, nz = hd - hu; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
      nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      this.colorAt(x, z, h[a], ny, c); col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
    }
    for (const n of ['position', 'normal', 'color']) this.geo.attributes[n].needsUpdate = true;
  }
  // creuser : abaisse le terrain en douceur (pas de cubes)
  dig(x, z, r, d, limit = 14) {
    const i0 = Math.floor((x - r + HALF) / CELL), i1 = Math.ceil((x + r + HALF) / CELL), j0 = Math.floor((z - r + HALF) / CELL), j1 = Math.ceil((z + r + HALF) / CELL);
    for (let j = Math.max(1, j0); j <= Math.min(G - 1, j1); j++) for (let i = Math.max(1, i0); i <= Math.min(G - 1, i1); i++) {
      const vx = -HALF + i * CELL, vz = -HALF + j * CELL, dd = Math.hypot(vx - x, vz - z) / r;
      if (dd >= 1) continue;
      const a = i + j * GV, f = Math.cos(dd * Math.PI / 2);
      this.h[a] = Math.max(this.h0[a] - limit, this.h[a] - d * f * f);
    }
    if (this.geo) this.refresh(i0 - 1, j0 - 1, i1 + 1, j1 + 1);
    this.texDirty = true;
  }
  heightTex() {
    const data = new Uint16Array(GV * GV);
    const t = new THREE.DataTexture(data, GV, GV, THREE.RedFormat, THREE.HalfFloatType);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    this.tex = t; this.updateTex(); return t;
  }
  updateTex() { const d = this.tex.image.data, h = this.h; for (let i = 0; i < d.length; i++) d[i] = THREE.DataUtils.toHalfFloat(h[i]); this.tex.needsUpdate = true; this.texDirty = false; }
  // semis des objets récoltables
  scatter(lowQ) {
    const r = rng(this.seed + 5), k = this.cfg.island, out = [], S = this.sites;
    const far = (x, z, p, d) => Math.hypot(x - p[0], z - p[1]) > d;
    const ok = (x, z) => far(x, z, S.spawn, 7) && far(x, z, S.wreck, 12) && far(x, z, S.den, 10) && far(x, z, S.sanct, 13) && far(x, z, S.summit, 12) && S.springs.every(s => far(x, z, s, 5));
    const tries = 9000;
    for (let t = 0; t < tries; t++) {
      const x = (r() - 0.5) * SIZE * 0.92, z = (r() - 0.5) * SIZE * 0.92, h = this.getH(x, z);
      if (h < 1.6 || !ok(x, z)) continue;
      const sl = this.slope(x, z), m = this.moist(x, z), q = r();
      let type = null;
      if (h < 5 && sl < 0.3) { if (k !== 'nord' && q < 0.3) type = 'palm'; else if (q < 0.36) type = 'rock'; }
      else if (sl < 0.55 && h < this.isl.peak * 0.75) {
        const dens = smooth(0.3, 0.6, m);
        if (q < 0.1 + dens * 0.55) type = k === 'nord' ? (r() < 0.8 ? 'pine' : 'dead') : k === 'volcan' ? (h > 45 ? 'dead' : r() < 0.6 ? 'tree' : 'palm') : (r() < 0.75 ? 'tree' : 'palm');
        else if (q < 0.72 + dens * 0.05) type = r() < 0.5 ? 'bush' : r() < 0.7 ? 'fern' : 'aloe';
        else if (q < 0.84) type = r() < (k === 'volcan' ? 0.4 : 0.22) ? 'ironrock' : 'rock';
      } else if (q < 0.25) type = r() < (k === 'volcan' ? 0.45 : 0.25) ? 'ironrock' : 'rock';
      if (!type) continue;
      if (k === 'nord' && type === 'aloe') type = 'fern';
      out.push({ type, x, z, y: h, s: 0.75 + r() * 0.6, rot: r() * 6.28 });
    }
    // objets à ramasser
    for (let t = 0; t < 2600; t++) {
      const x = (r() - 0.5) * SIZE * 0.9, z = (r() - 0.5) * SIZE * 0.9, h = this.getH(x, z);
      if (h < 0.6 || this.slope(x, z) > 0.5 || !ok(x, z)) continue;
      const q = r();
      let type = h < 3 ? (q < 0.3 ? 'shell' : q < 0.55 ? 'stone' : q < 0.75 ? 'stick' : k !== 'nord' && q < 0.86 ? 'coconut' : null) : (q < 0.4 ? 'stick' : q < 0.7 ? 'stone' : q < 0.82 ? 'flint' : null);
      if (type) out.push({ type, x, z, y: h, s: 0.8 + r() * 0.5, rot: r() * 6.28, pick: true });
    }
    out.forEach((o, i) => o.id = i);
    return out;
  }
  grassPoints(n) {
    const r = rng(this.seed + 9), pts = [];
    for (let t = 0; t < n * 3 && pts.length < n; t++) { const x = (r() - 0.5) * SIZE * 0.9, z = (r() - 0.5) * SIZE * 0.9, h = this.getH(x, z); if (h > 3.2 && h < this.isl.peak * 0.6 && this.slope(x, z) < 0.5 && (this.cfg.island !== 'nord' || h < this.isl.snow - 4)) pts.push([x, h, z, 0.7 + r() * 0.8, r() * 6.28]); }
    return pts;
  }
}

/* ---------------- géométries (couleurs par sommet) ---------------- */
export function mergeC(parts) {
  const pos = [], nor = [], col = [];
  for (const [g0, hex, m, vary] of parts) {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = new THREE.Color(hex);
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
      const v = vary ? 1 - vary / 2 + Math.random() * vary : 1; col.push(c.r * v, c.g * v, c.b * v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
export { M as mat };
function blob(r, seed, squash = 1) {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, rr = rng(seed);
  const map = new Map();
  for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(2) + p.getY(i).toFixed(2) + p.getZ(i).toFixed(2); if (!map.has(key)) map.set(key, 0.78 + rr() * 0.44); const s = map.get(key); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * squash, p.getZ(i) * s); }
  return g;
}
export const GEO = {
  palm() {
    const parts = []; let x = 0, y = 0;
    for (let i = 0; i < 7; i++) { const lean = i * 0.045; parts.push([new THREE.CylinderGeometry(0.2 - i * 0.012, 0.23 - i * 0.012, 1.25, 7), i % 2 ? 0x6b5236 : 0x7a5f40, M(x, y + 0.6, 0, 0, 0, -lean)]); x += Math.sin(lean) * 1.2; y += Math.cos(lean) * 1.2; }
    for (let k = 0; k < 9; k++) {
      const f = new THREE.PlaneGeometry(1.0, 4.2, 2, 5), p = f.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 2.1) / 4.2; p.setXYZ(i, p.getX(i) * (1 - t * 0.75) , t * 4.6 * Math.cos(t * 0.9), Math.abs(p.getX(i)) * -0.3 - t * t * 1.5); }
      f.rotateX(Math.PI / 2 * 0.72);
      parts.push([f, k % 2 ? 0x2f7a2c : 0x3b8f33, M(x, y, 0, 0, (k / 9) * 6.283 + 0.2, 0), 0.25]);
    }
    for (let k = 0; k < 3; k++) parts.push([new THREE.SphereGeometry(0.2, 7, 6), 0x5a4426, M(x + Math.cos(k * 2.1) * 0.3, y - 0.3, Math.sin(k * 2.1) * 0.3)]);
    return mergeC(parts);
  },
  tree() {
    const parts = [[new THREE.CylinderGeometry(0.22, 0.42, 5.2, 8), 0x4d3a26, M(0, 2.6, 0)], [new THREE.CylinderGeometry(0.1, 0.18, 2.4, 6), 0x4d3a26, M(0.7, 4.6, 0, 0, 0, -0.8)], [new THREE.CylinderGeometry(0.1, 0.18, 2.2, 6), 0x4d3a26, M(-0.6, 4.9, 0.3, 0.4, 0, 0.8)]];
    [[0, 6.6, 0, 2.5], [1.7, 5.7, 0.3, 1.7], [-1.5, 6.0, 0.6, 1.8], [0.2, 5.6, -1.6, 1.6], [0.1, 7.9, 0.2, 1.6]].forEach((b, i) => parts.push([blob(b[3], 10 + i, 0.8), i % 2 ? 0x24632a : 0x2e7631, M(b[0], b[1], b[2]), 0.3]));
    return mergeC(parts);
  },
  pine() {
    const parts = [[new THREE.CylinderGeometry(0.14, 0.34, 4, 7), 0x4a382a, M(0, 2, 0)]];
    for (let i = 0; i < 5; i++) parts.push([new THREE.ConeGeometry(2.3 - i * 0.38, 2.4, 9), i % 2 ? 0x1f4f33 : 0x275c3b, M(0, 3 + i * 1.35, 0, 0, i * 0.7, 0), 0.25]);
    return mergeC(parts);
  },
  dead() {
    return mergeC([[new THREE.CylinderGeometry(0.12, 0.34, 4.6, 7), 0x5b5148, M(0, 2.3, 0, 0, 0, 0.06)], [new THREE.CylinderGeometry(0.05, 0.12, 2.2, 5), 0x5b5148, M(0.7, 3.6, 0, 0, 0, -0.9)], [new THREE.CylinderGeometry(0.04, 0.1, 1.8, 5), 0x5b5148, M(-0.5, 4.2, 0.2, 0.3, 0, 0.9)], [new THREE.CylinderGeometry(0.03, 0.08, 1.4, 5), 0x5b5148, M(0.1, 4.9, -0.4, -0.7, 0, 0.1)]]);
  },
  rock(hex = 0x7b7873, seed = 3) { return mergeC([[blob(1.1, seed, 0.72), hex, M(0, 0.45, 0), 0.22], [blob(0.6, seed + 1, 0.7), hex, M(0.95, 0.2, 0.4), 0.22]]); },
  ironrock() { return mergeC([[blob(1.1, 21, 0.72), 0x6f6a66, M(0, 0.45, 0), 0.18], [blob(0.42, 22, 0.8), 0xb5622e, M(0.5, 0.75, 0.45), 0.2], [blob(0.36, 23, 0.8), 0xc06c33, M(-0.55, 0.6, -0.3), 0.2], [blob(0.3, 24, 0.8), 0xa9562a, M(0.1, 1.0, -0.5), 0.2]]); },
  bush() { const p = [[blob(0.75, 31, 0.75), 0x2c6b2c, M(0, 0.5, 0), 0.3], [blob(0.55, 32, 0.75), 0x357a33, M(0.55, 0.4, 0.2), 0.3]]; for (let i = 0; i < 9; i++) p.push([new THREE.SphereGeometry(0.075, 5, 4), 0xc21e3a, M(Math.cos(i * 2.4) * 0.62, 0.45 + (i % 3) * 0.22, Math.sin(i * 2.4) * 0.62)]); return mergeC(p); },
  fern() { const p = []; for (let k = 0; k < 7; k++) { const f = new THREE.PlaneGeometry(0.34, 1.5, 1, 3), q = f.attributes.position; for (let i = 0; i < q.count; i++) { const t = (q.getY(i) + 0.75) / 1.5; q.setXYZ(i, q.getX(i) * (1 - t * 0.8), t * 1.1, -t * t * 0.8); } p.push([f, 0x4f9a3c, M(0, 0, 0, 0, k * 0.9, 0), 0.3]); } return mergeC(p); },
  aloe() { const p = []; for (let k = 0; k < 8; k++) p.push([new THREE.ConeGeometry(0.1, 0.9, 5), 0x6fae8a, M(Math.cos(k * 0.785) * 0.16, 0.36, Math.sin(k * 0.785) * 0.16, Math.sin(k * 0.785) * 0.6, 0, -Math.cos(k * 0.785) * 0.6), 0.2]); return mergeC(p); },
  grass() {
    const pos = [], nor = [], col = [];
    for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.1 + (k % 3) * 0.14, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.45 + (k % 4) * 0.16, w = 0.07, lx = Math.cos(a + 1.3) * 0.22, lz = Math.sin(a + 1.3) * 0.22, dx = Math.cos(a) * w, dz = Math.sin(a) * w;
      pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lx, h, z + lz); for (let i = 0; i < 3; i++) nor.push(0, 1, 0); const v = 0.8 + (k % 3) * 0.15; col.push(0.2 * v, 0.42 * v, 0.14 * v, 0.2 * v, 0.42 * v, 0.14 * v, 0.42 * v, 0.66 * v, 0.24 * v); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  },
  stick() { return mergeC([[new THREE.CylinderGeometry(0.035, 0.05, 1.1, 5), 0x6e5539, M(0, 0.06, 0, 0, 0, 1.52)], [new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4), 0x6e5539, M(0.2, 0.1, 0.1, 0.9, 0, 1.2)]]); },
  stone() { return mergeC([[blob(0.2, 41, 0.65), 0x8a8782, M(0, 0.1, 0), 0.2]]); },
  flint() { return mergeC([[new THREE.OctahedronGeometry(0.19, 0), 0x2b2d33, M(0, 0.1, 0, 0.5, 0.3, 0.2, 1, 0.55, 0.8)]]); },
  shell() { return mergeC([[new THREE.ConeGeometry(0.13, 0.26, 7), 0xf2dcc8, M(0, 0.08, 0, 1.35, 0, 0)], [new THREE.SphereGeometry(0.09, 6, 5), 0xe8b9a0, M(0, 0.08, -0.1)]]); },
  coconut() { return mergeC([[new THREE.SphereGeometry(0.19, 8, 7), 0x5f4426, M(0, 0.18, 0, 0, 0, 0, 1, 1.12, 1)]]); },
};

/* ---------------- shaders ---------------- */
export const WATER_VS = `varying vec3 vWp; varying float vD;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWp = wp.xyz; vec4 mv = viewMatrix*wp; vD = -mv.z; gl_Position = projectionMatrix*mv; }`;
export const WATER_FS = `
uniform sampler2D uH; uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar; uniform float uSize; uniform float uWind; uniform float uUnder;
varying vec3 vWp; varying float vD;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float wv(vec2 p){ return vn(p*0.35+vec2(uTime*0.35,uTime*0.21)) + 0.5*vn(p*0.9-vec2(uTime*0.5,uTime*0.33)) + 0.25*vn(p*2.3+vec2(uTime*0.7,-uTime*0.6)); }
void main(){
  vec2 uv = (vWp.xz + uSize*0.5)/uSize;
  float h = -30.0; if(uv.x>0.0 && uv.x<1.0 && uv.y>0.0 && uv.y<1.0) h = texture2D(uH, uv).r;
  float depth = -h;
  float e = 0.35, amp = 0.9 + uWind*1.4;
  float w0 = wv(vWp.xz), wx = wv(vWp.xz+vec2(e,0.0)), wz = wv(vWp.xz+vec2(0.0,e));
  vec3 n = normalize(vec3((w0-wx)*amp, 1.0, (w0-wz)*amp));
  vec3 V = normalize(cameraPosition - vWp); if(uUnder > 0.5){ n = -n; }
  float fres = pow(1.0 - max(dot(n,V),0.0), 3.0);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 9.0, depth));
  vec3 col = mix(body, uSky, clamp(fres*0.85+0.06,0.0,1.0));
  vec3 Hh = normalize(uSun + V);
  col += uSunCol * pow(max(dot(n,Hh),0.0), 180.0) * 1.6;
  float foam = smoothstep(0.75, 0.0, depth + (w0-0.8)*0.9) * step(-0.3, depth);
  foam += smoothstep(1.55,1.75,w0)*uWind*0.6;
  col = mix(col, vec3(0.95,0.97,1.0)*(0.35+0.65*length(uSunCol)*0.6+uSky*0.3), clamp(foam,0.0,1.0)*0.85);
  float a = mix(0.5, 0.97, smoothstep(0.0, 4.5, depth)); a = max(a, foam);
  if(uUnder > 0.5){ col = mix(uShallow*1.3, uSky, 0.35) * (0.7+0.6*w0*0.5); a = 0.75; }
  float fog = smoothstep(uFogNear, uFogFar, vD);
  gl_FragColor = vec4(mix(col, uFogCol, fog), a);
}`;
export const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`;
export const SKY_FS = `
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSun; uniform float uNight; uniform float uDusk; uniform float uTime; uniform float uCloud; uniform vec3 uCloudCol;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.0, w=0.5; for(int i=0;i<4;i++){ a+=vn(p)*w; p=p*2.03+7.1; w*=0.5; } return a; }
float h31(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(uHor, uZen, pow(clamp(h,0.0,1.0),0.5));
  if(h<0.0) col = uHor;
  float s = max(dot(d,uSun),0.0);
  col += vec3(1.0,0.55,0.25)*pow(s,5.0)*0.45*uDusk + vec3(1.0,0.9,0.7)*pow(s,300.0)*0.5*(1.0-uNight) + vec3(1.0,0.97,0.9)*smoothstep(0.9994,0.9997,s)*(1.0-uNight)*2.0;
  float m = max(dot(d,-uSun),0.0);
  col += vec3(0.9,0.93,1.0)*smoothstep(0.9990,0.9993,m)*uNight + vec3(0.25,0.33,0.5)*pow(m,60.0)*0.3*uNight;
  if(h>0.02){ vec3 q=floor(d*240.0); float st=step(0.996,h31(q)); col += vec3(st*(0.6+0.4*sin(uTime*2.0+h31(q+1.0)*40.0)))*uNight*smoothstep(0.02,0.25,h)*(1.0-uCloud*0.9); }
  if(h>0.01){
    vec2 p = d.xz/(h+0.12)*1.3 + vec2(uTime*0.012, uTime*0.006);
    float c = fbm(p); float cov = smoothstep(0.62-uCloud*0.45, 0.82-uCloud*0.35, c);
    vec3 cc = uCloudCol*(0.75+0.35*fbm(p*2.0+3.0)) + vec3(1.0,0.5,0.25)*uDusk*0.35*pow(s,2.0);
    col = mix(col, cc, cov*smoothstep(0.01,0.14,h)*0.92);
  }
  gl_FragColor = vec4(col,1.0);
}`;
export function patchTerrain(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWp;
float th(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float tn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(th(i),th(i+vec2(1,0)),f.x), mix(th(i+vec2(0,1)),th(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float dn = tn(vWp.xz*2.3)*0.5 + tn(vWp.xz*9.0)*0.3 + tn(vWp.xz*0.35)*0.2;
diffuseColor.rgb *= 0.72 + 0.56*dn;
if(vWp.y < 0.0){ float u = clamp(-vWp.y/12.0, 0.0, 0.9); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.25,0.6,0.7), u); float ca = tn(vWp.xz*1.4 + vec2(sin(vWp.z*0.8), cos(vWp.x*0.8))*0.5); diffuseColor.rgb += vec3(0.25,0.3,0.22)*smoothstep(0.62,0.9,ca)*(1.0-u); }
else if(vWp.y < 0.7){ diffuseColor.rgb *= mix(0.72, 1.0, vWp.y/0.7); }`);
  };
}
export function woodTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  if (kind === 'stone') {
    x.fillStyle = '#77756f'; x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) { const w = 64, ox = (r % 2) * 32; const v = 95 + Math.random() * 50 | 0; x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(k * w + ox - 32 + 2, r * 43 + 2, w - 4, 39); }
  } else if (kind === 'thatch') {
    x.fillStyle = '#9a8246'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { const v = 110 + Math.random() * 80 | 0; x.strokeStyle = `rgb(${v + 30},${v},${v * 0.45 | 0})`; x.beginPath(); const px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 8, py + 14 + Math.random() * 16); x.stroke(); }
  } else {
    for (let k = 0; k < 5; k++) { const v = 105 + Math.random() * 40 | 0; x.fillStyle = `rgb(${v + 28},${v},${v * 0.62 | 0})`; x.fillRect(0, k * 51.2, 256, 51.2); x.fillStyle = 'rgba(30,18,8,.55)'; x.fillRect(0, k * 51.2, 256, 2.5); for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(40,25,10,${0.08 + Math.random() * 0.14})`; x.beginPath(); const y = k * 51.2 + Math.random() * 51; x.moveTo(0, y); x.bezierCurveTo(80, y + Math.random() * 6 - 3, 170, y + Math.random() * 6 - 3, 256, y); x.stroke(); } }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
