// BLOCKVERSE — moteur voxel : blocs, atlas procédural, génération, maillage, physique. Jeu original pour NOVA.
import * as THREE from './three.module.min.js';
import { rng, clamp, lerp } from './core.js';

export const CH = 16; // taille d'un tronçon (x/z)
const TPR = 16, ROWS = 4, TS = 16; // atlas : 16 tuiles par ligne, 4 lignes, 16 px

/* ---------------- blocs ---------------- */
// t: [dessus, côtés, dessous] (indices de tuiles) · cut: découpe (ne cache pas les voisins) · liq: liquide · lamp: lumière émise
export const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANKS: 8, GLASS: 9, BRICK: 10, SNOW: 11, COAL: 12, IRON: 13, CRYSTAL: 14, LANTERN: 15, TNT: 16, BASALT: 25, ICE: 26, BOUNCE: 27, BEDROCK: 28, PINE: 29, STONEBRICK: 30, GOLD: 31 };
export const BLOCKS = [];
const def = (id, n, t, o = {}) => { BLOCKS[id] = Object.assign({ id, n, t: Array.isArray(t) ? t : [t, t, t], hard: 0.6, solid: true }, o); };
def(0, 'Air', 0, { solid: false, air: true });
def(1, 'Herbe', [0, 1, 2], { hard: 0.55, drop: 2, col: '#5fae3e' });
def(2, 'Terre', 2, { hard: 0.5, col: '#8a5a3c' });
def(3, 'Pierre', 3, { hard: 1.4, col: '#8b8f96' });
def(4, 'Sable', 4, { hard: 0.45, col: '#e3d39a' });
def(5, 'Eau', 5, { solid: false, liq: true, hard: 0, col: '#3a8fd8' });
def(6, 'Tronc', [7, 6, 7], { hard: 1.0, col: '#7a5530' });
def(7, 'Feuillage', 8, { cut: true, hard: 0.2, col: '#3f8f3a' });
def(8, 'Planches', 9, { hard: 0.9, col: '#c49a5c' });
def(9, 'Verre', 10, { cut: true, hard: 0.3, col: '#bfeaff' });
def(10, 'Briques', 11, { hard: 1.5, col: '#a8483a' });
def(11, 'Neige', [12, 13, 2], { hard: 0.4, col: '#f2f6ff' });
def(12, 'Minerai de charbon', 14, { hard: 1.8, col: '#3a3a40' });
def(13, 'Minerai de fer', 15, { hard: 2.2, col: '#c8a080' });
def(14, 'Cristal', 16, { hard: 2.6, lamp: 0.55, col: '#6ff0ff' });
def(15, 'Lanterne', 17, { hard: 0.3, lamp: 1, col: '#ffd27a' });
def(16, 'Dynamite', [19, 18, 19], { hard: 0.2, col: '#e0402e' });
const CONC = [['blanc', '#e9ecef'], ['noir', '#22252b'], ['rouge', '#d8343c'], ['orange', '#f08a24'], ['jaune', '#f2cc2a'], ['vert', '#45b04a'], ['bleu', '#2f6fd8'], ['violet', '#8a46d0']];
CONC.forEach(([n, c], i) => def(17 + i, 'Béton ' + n, 20 + i, { hard: 1.2, col: c, conc: c }));
def(25, 'Basalte', 28, { hard: 1.6, col: '#3b3a40' });
def(26, 'Glace', 29, { hard: 0.5, col: '#a8d8ff', slip: true });
def(27, 'Bloc rebond', [30, 31, 31], { hard: 0.4, col: '#ff5fa2' });
def(28, 'Socle', 32, { hard: 1e9, col: '#222' });
def(29, 'Aiguilles de sapin', 33, { cut: true, hard: 0.2, col: '#2c5e3a' });
def(30, 'Pierre taillée', 34, { hard: 1.5, col: '#9a9ea6' });
def(31, 'Bloc d’or', 35, { hard: 1.2, col: '#f4c542' });
export const N_BLOCKS = BLOCKS.length;
const OPAQ = new Uint8Array(256), SOLID = new Uint8Array(256), CUT = new Uint8Array(256), LAMP = new Float32Array(256);
for (const b of BLOCKS) if (b) { OPAQ[b.id] = b.solid && !b.cut ? 1 : 0; SOLID[b.id] = b.solid ? 1 : 0; CUT[b.id] = b.cut ? 1 : 0; LAMP[b.id] = b.lamp || 0; }
export const isSolid = id => SOLID[id] === 1;

/* ---------------- atlas procédural ---------------- */
let ATLAS = null, ATLAS_CANVAS = null;
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function atlasCanvas() {
  if (ATLAS_CANVAS) return ATLAS_CANVAS;
  const cv = document.createElement('canvas'); cv.width = TPR * TS; cv.height = ROWS * TS;
  const x = cv.getContext('2d'), img = x.createImageData(cv.width, cv.height), D = img.data;
  const R = rng(1234);
  const tile = (t, fn) => { const ox = (t % TPR) * TS, oy = ((t / TPR) | 0) * TS; for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) { const c = fn(i, j, R()); const k = ((oy + j) * cv.width + ox + i) * 4; D[k] = clamp(c[0], 0, 255); D[k + 1] = clamp(c[1], 0, 255); D[k + 2] = clamp(c[2], 0, 255); D[k + 3] = c[3] == null ? 255 : c[3]; } };
  const sh = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const noisy = (c, a = 0.12) => (i, j, r) => sh(c, 1 - a + r * a * 2);
  const grass = [96, 170, 62], dirt = [134, 92, 60], stone = [128, 132, 138];
  tile(0, (i, j, r) => sh(grass, 0.82 + r * 0.32));
  tile(1, (i, j, r) => { const edge = 3 + ((i * 7) % 3 === 0 ? 1 : 0) + (r < 0.2 ? 1 : 0); return j < edge ? sh(grass, 0.8 + r * 0.3) : sh(dirt, 0.85 + r * 0.25); });
  tile(2, (i, j, r) => sh(dirt, 0.82 + r * 0.3 - (r > 0.92 ? 0.25 : 0)));
  tile(3, (i, j, r) => { const crack = ((i + j * 3) % 11 === 0 || (i * 2 + j) % 13 === 0) ? 0.78 : 1; return sh(stone, (0.86 + r * 0.22) * crack); });
  tile(4, (i, j, r) => sh([226, 210, 152], 0.9 + r * 0.16));
  tile(5, (i, j, r) => [40 + r * 20, 120 + r * 25, 210 + r * 20, 255]);
  tile(6, (i, j, r) => { const s = (i % 4 === 0) ? 0.72 : 1; return sh([122, 86, 48], (0.85 + r * 0.2) * s); });
  tile(7, (i, j, r) => { const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5)); const ring = (Math.floor(d) % 3 === 0) ? 0.8 : 1; return d > 6.5 ? sh([110, 76, 42], 0.9 + r * 0.15) : sh([196, 156, 98], (0.9 + r * 0.12) * ring); });
  tile(8, (i, j, r) => r < 0.1 ? [30, 70, 30, 0] : sh([62, 140, 56], 0.7 + r * 0.45));
  tile(9, (i, j, r) => { const seam = j % 4 === 3 ? 0.7 : (((i + (j >> 2) * 5) % 8) === 0 ? 0.78 : 1); return sh([196, 154, 92], (0.9 + r * 0.14) * seam); });
  tile(10, (i, j) => { const e = i === 0 || j === 0 || i === 15 || j === 15; const g = (i === j + 3 || i === j + 4) && i > 3 && i < 12; return e ? [220, 240, 250, 255] : g ? [255, 255, 255, 200] : [190, 230, 255, 0]; });
  tile(11, (i, j, r) => { const row = j >> 2, mortar = j % 4 === 3 || ((i + (row % 2) * 4) % 8 === 7); return mortar ? sh([200, 196, 186], 0.9 + r * 0.1) : sh([170, 72, 58], 0.85 + r * 0.25); });
  tile(12, (i, j, r) => sh([242, 246, 255], 0.94 + r * 0.06));
  tile(13, (i, j, r) => { const edge = 4 + (r < 0.3 ? 1 : 0); return j < edge ? sh([242, 246, 255], 0.94 + r * 0.06) : sh(dirt, 0.85 + r * 0.25); });
  const ore = (col, sp) => (i, j, r) => { const h = Math.sin(i * 1.7 + j * 0.9) * Math.cos(j * 1.3 - i * 0.4); return h > sp ? sh(col, 0.85 + r * 0.3) : sh(stone, 0.86 + r * 0.22); };
  tile(14, ore([40, 40, 44], 0.45)); tile(15, ore([214, 170, 130], 0.5));
  tile(16, (i, j, r) => { const h = Math.sin(i * 1.3 + j * 1.1) * Math.cos(j * 0.9 - i * 0.7); return h > 0.3 ? [90 + r * 60, 230 + r * 25, 255, 255] : sh([70, 76, 92], 0.85 + r * 0.25); });
  tile(17, (i, j, r) => { const e = i < 2 || i > 13 || j < 2 || j > 13; const bars = (i === 5 || i === 10) && !e; return e ? sh([60, 48, 36], 0.9 + r * 0.2) : bars ? [90, 70, 44] : [255, 214 + r * 30, 120 + r * 40]; });
  tile(18, (i, j, r) => { const band = j > 5 && j < 10; return band ? (i % 4 < 2 ? [240, 236, 220] : [40, 40, 40]) : sh([214, 58, 44], 0.85 + r * 0.25); });
  tile(19, (i, j, r) => { const d = Math.hypot(i - 7.5, j - 7.5); return d < 2 ? [60, 60, 60] : sh([214, 58, 44], 0.8 + r * 0.2); });
  CONC.forEach(([, c], k) => tile(20 + k, (i, j, r) => sh(hex(c), 0.93 + r * 0.1)));
  tile(28, (i, j, r) => sh([60, 58, 66], 0.8 + r * 0.35));
  tile(29, (i, j, r) => { const l = (i - j + 16) % 9 === 0 ? 1.15 : 1; return [168 * l + r * 10, 214 * l, 255, 255]; });
  tile(30, (i, j, r) => { const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5)); return d > 6 ? [160, 40, 90] : d < 3 ? [255, 255, 255] : sh([255, 95, 162], 0.92 + r * 0.12); });
  tile(31, (i, j, r) => { const sp = (j % 5 === 2); return sp ? [140, 140, 150] : sh([255, 95, 162], 0.85 + r * 0.2); });
  tile(32, (i, j, r) => sh([40, 40, 46], 0.6 + r * 0.7));
  tile(33, (i, j, r) => r < 0.12 ? [20, 50, 30, 0] : sh([40, 96, 60], 0.7 + r * 0.4));
  tile(34, (i, j, r) => { const m = j % 8 === 7 || ((i + ((j >> 3) % 2) * 8) % 16 === 15); return m ? sh(stone, 0.6) : sh(stone, 0.92 + r * 0.14); });
  tile(35, (i, j, r) => { const e = i === 0 || j === 0 || i === 15 || j === 15; return e ? [200, 150, 30] : sh([248, 200, 70], 0.9 + r * 0.2 + ((i + j) % 7 === 0 ? 0.15 : 0)); });
  x.putImageData(img, 0, 0);
  ATLAS_CANVAS = cv; return cv;
}
export function atlasTexture() {
  if (ATLAS) return ATLAS;
  const t = new THREE.CanvasTexture(atlasCanvas());
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  ATLAS = t; return t;
}
// icône isométrique d'un bloc (pour la barre et l'inventaire)
const ICONS = {};
export function blockIcon(id, size = 64) {
  const key = id + ':' + size; if (ICONS[key]) return ICONS[key];
  const b = BLOCKS[id], A = atlasCanvas(), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const src = t => [(t % TPR) * TS, ((t / TPR) | 0) * TS];
  const s = size / 2 - 1, h = s * 0.5, V = s * 0.95, o = 1;
  const face = (t, m, dark) => { const [sx, sy] = src(t); x.save(); x.setTransform(...m); x.drawImage(A, sx, sy, TS, TS, 0, 0, 1, 1); if (dark) { x.fillStyle = `rgba(0,0,0,${dark})`; x.fillRect(0, 0, 1, 1); } x.restore(); };
  // dessus
  face(b.t[0], [s, h, -s, h, s + o, o], 0);
  face(b.t[1], [s, h, 0, V, o, h + o], 0.2);
  face(b.t[1], [s, -h, 0, V, s + o, 2 * h + o], 0.38);
  return (ICONS[key] = cv.toDataURL());
}
function tileUV(t, cu, cv, out, k) {
  const col = t % TPR, row = (t / TPR) | 0, e = 0.0008;
  out[k] = (col + (cu ? 1 : 0)) / TPR + (cu ? -e : e);
  out[k + 1] = 1 - (row + 1 - cv) / ROWS + (cv ? -e : e);
}

/* ---------------- bruit ---------------- */
function mkNoise(seed) {
  const r = rng(seed), p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const g2 = (i, j) => p[(p[i & 255] + j) & 255] / 255;
  const g3 = (i, j, k) => p[(p[(p[i & 255] + j) & 255] + k) & 255] / 255;
  const f = t => t * t * (3 - 2 * t);
  return {
    n2(x, y) { const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), v = f(y - yi); return lerp(lerp(g2(xi, yi), g2(xi + 1, yi), u), lerp(g2(xi, yi + 1), g2(xi + 1, yi + 1), u), v); },
    n3(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = f(x - xi), v = f(y - yi), w = f(z - zi);
      const a = lerp(lerp(g3(xi, yi, zi), g3(xi + 1, yi, zi), u), lerp(g3(xi, yi + 1, zi), g3(xi + 1, yi + 1, zi), u), v);
      const b = lerp(lerp(g3(xi, yi, zi + 1), g3(xi + 1, yi, zi + 1), u), lerp(g3(xi, yi + 1, zi + 1), g3(xi + 1, yi + 1, zi + 1), u), v);
      return lerp(a, b, w); },
  };
}
const fbm = (N, x, y, o = 4) => { let a = 0, f = 1, w = 0.5, s = 0; for (let i = 0; i < o; i++) { a += N.n2(x * f, y * f) * w; s += w; f *= 2.03; w *= 0.5; } return a / s; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const WORLD_TYPES = {
  prairies: { n: 'Prairies', d: 'Collines douces, lacs et forêts. Idéal pour commencer.' },
  archipel: { n: 'Archipel', d: 'Des îles de sable au milieu d’un océan turquoise.' },
  montagnes: { n: 'Montagnes', d: 'Sommets enneigés, sapins et grottes profondes.' },
  plat: { n: 'Monde plat', d: 'Une immense plaine pour construire sans contrainte.' },
};

/* ---------------- monde ---------------- */
export class VoxelWorld {
  constructor({ type = 'prairies', seed = 1, size = 128, height = 64 }) {
    this.type = type; this.seed = seed; this.W = size; this.D = size; this.H = height; this.sea = 22;
    this.data = new Uint8Array(this.W * this.D * this.H);
    this.top = new Int16Array(this.W * this.D);
    this.edits = new Map(); this.lights = new Set();
    this.gen();
    this.computeTop();
  }
  idx(x, y, z) { return x + z * this.W + y * this.W * this.D; }
  inb(x, y, z) { return x >= 0 && z >= 0 && y >= 0 && x < this.W && z < this.D && y < this.H; }
  get(x, y, z) { if (y < 0) return B.BEDROCK; if (x < 0 || z < 0 || x >= this.W || z >= this.D || y >= this.H) return 0; return this.data[x + z * this.W + y * this.W * this.D]; }
  // collision : bords du monde = murs invisibles
  solid(x, y, z) { if (y < 0) return true; if (x < 0 || z < 0 || x >= this.W || z >= this.D) return y < this.H + 20; if (y >= this.H) return false; return SOLID[this.data[x + z * this.W + y * this.W * this.D]] === 1; }
  heightAt(x, z) {
    const N = this.N, t = this.type, W = this.W;
    if (t === 'plat') return 20;
    let h;
    if (t === 'prairies') h = 27 + (fbm(N, x * 0.018, z * 0.018, 4) - 0.5) * 22 + (fbm(N, x * 0.006 + 40, z * 0.006 + 9, 2) - 0.5) * 16;
    else if (t === 'archipel') h = 15 + (fbm(N, x * 0.016 + 7, z * 0.016 + 3, 4) - 0.38) * 38 + Math.max(0, fbm(N, x * 0.05, z * 0.05, 2) - 0.6) * 20;
    else { const rid = 1 - Math.abs(2 * fbm(N, x * 0.011 + 5, z * 0.011 + 1, 4) - 1); h = 18 + Math.pow(rid, 2.2) * 44 + (fbm(N, x * 0.03, z * 0.03, 3) - 0.5) * 8; }
    const e = Math.min(x, z, W - 1 - x, this.D - 1 - z);
    h = lerp(this.sea - 7, h, smooth(2, 14, e));
    return Math.round(clamp(h, 3, this.H - 4));
  }
  gen() {
    const { W, D, H, sea, type } = this, R = rng(this.seed * 7 + 3); this.N = mkNoise(this.seed);
    const N3 = mkNoise(this.seed + 99), d = this.data, WD = W * D;
    const set = (x, y, z, v) => { if (x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H) d[x + z * W + y * WD] = v; };
    const hm = new Int16Array(WD);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const h = this.heightAt(x, z); hm[x + z * W] = h;
      const snowy = type === 'montagnes' && h > 44 + (R() * 3 | 0);
      const beach = h <= sea && type !== 'plat';
      for (let y = 0; y <= h; y++) {
        let v;
        if (y === 0) v = B.BEDROCK;
        else if (y === h) v = beach ? B.SAND : snowy ? B.SNOW : B.GRASS;
        else if (y > h - 4) v = beach ? B.SAND : (snowy && y > h - 2 ? B.STONE : B.DIRT);
        else v = (type === 'archipel' && y < 8 && R() < 0.3) ? B.BASALT : B.STONE;
        d[x + z * W + y * WD] = v;
      }
      for (let y = h + 1; y <= sea && type !== 'plat'; y++) d[x + z * W + y * WD] = (type === 'montagnes' && y === sea && h < sea - 1 && hm[x + z * W] > sea - 4 && R() < 0.0) ? B.ICE : B.WATER;
    }
    if (type !== 'plat') {
      // grottes
      for (let y = 2; y < H - 4; y++) for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
        const h = hm[x + z * W]; if (y > h - 4) continue;
        const n = N3.n3(x * 0.07, y * 0.11, z * 0.07), m = N3.n3(x * 0.05 + 50, y * 0.08, z * 0.05 + 50);
        if (Math.abs(n - 0.5) < 0.045 && Math.abs(m - 0.5) < 0.12) d[x + z * W + y * WD] = 0;
      }
      // minerais
      const vein = (id, n, ymax, sz) => { for (let k = 0; k < n; k++) { let x = (R() * W) | 0, z = (R() * D) | 0, y = 2 + ((R() * (ymax - 2)) | 0); for (let s = 0; s < sz; s++) { if (d[x + z * W + y * WD] === B.STONE) d[x + z * W + y * WD] = id; x += (R() * 3 | 0) - 1; y += (R() * 3 | 0) - 1; z += (R() * 3 | 0) - 1; if (!this.inb(x, y, z)) break; } } };
      const area = W * D / 16384;
      vein(B.COAL, 110 * area, 50, 7); vein(B.IRON, 60 * area, 32, 5); vein(B.CRYSTAL, 26 * area, 16, 3); vein(B.GOLD, 10 * area, 12, 3);
      // arbres
      for (let z = 3; z < D - 3; z++) for (let x = 3; x < W - 3; x++) {
        const h = hm[x + z * W]; if (d[x + z * W + h * WD] !== B.GRASS) continue;
        const dens = type === 'montagnes' ? 0.02 : type === 'archipel' ? 0.012 : (fbm(this.N, x * 0.03 + 90, z * 0.03, 2) > 0.55 ? 0.05 : 0.006);
        if (R() > dens) continue;
        const pine = type === 'montagnes', th = pine ? 6 + (R() * 3 | 0) : 4 + (R() * 3 | 0);
        for (let y = 1; y <= th; y++) set(x, h + y, z, B.LOG);
        const leaf = pine ? B.PINE : B.LEAVES;
        if (pine) { for (let y = 3; y <= th + 1; y++) { const r = Math.max(0, Math.round((th + 1 - y) * 0.45)) + (y === th + 1 ? 0 : 0); for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) <= r + 0.5 && !(dx === 0 && dz === 0 && y <= th)) { if (d[x + dx + (z + dz) * W + (h + y) * WD] === 0) set(x + dx, h + y, z + dz, leaf); } } set(x, h + th + 1, z, leaf); set(x, h + th + 2, z, leaf); }
        else for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const r = dx * dx + dz * dz + dy * dy * 1.6; if (r > 5.2 + R()) continue; const yy = h + th + dy; if (this.inb(x + dx, yy, z + dz) && d[x + dx + (z + dz) * W + yy * WD] === 0) set(x + dx, yy, z + dz, leaf); }
      }
    }
    this.hm = hm;
  }
  computeTop() { for (let z = 0; z < this.D; z++) for (let x = 0; x < this.W; x++) this.colTop(x, z); this.lights.clear(); const d = this.data; for (let i = 0; i < d.length; i++) if (LAMP[d[i]] > 0) this.lights.add(i); }
  colTop(x, z) { let y = this.H - 1; const W = this.W, WD = W * this.D; while (y >= 0 && !OPAQ[this.data[x + z * W + y * WD]]) y--; this.top[x + z * W] = y; }
  set(x, y, z, v, record = true) {
    if (!this.inb(x, y, z)) return false;
    const i = this.idx(x, y, z), old = this.data[i]; if (old === v) return false;
    this.data[i] = v; if (record) this.edits.set(i, v);
    if (LAMP[old]) this.lights.delete(i); if (LAMP[v]) this.lights.add(i);
    this.colTop(x, z);
    return true;
  }
  spawnPoint() {
    const cx = this.W >> 1, cz = this.D >> 1;
    for (let r = 0; r < this.W / 2; r++) for (let a = 0; a < Math.max(1, r * 6); a++) {
      const t = a / Math.max(1, r * 6) * Math.PI * 2, x = Math.round(cx + Math.cos(t) * r), z = Math.round(cz + Math.sin(t) * r);
      if (x < 2 || z < 2 || x >= this.W - 2 || z >= this.D - 2) continue;
      const y = this.top[x + z * this.W]; const b = this.get(x, y, z);
      if (y >= this.sea && (b === B.GRASS || b === B.SAND || b === B.SNOW) && !this.get(x, y + 1, z) && !this.get(x, y + 2, z)) return [x + 0.5, y + 1, z + 0.5];
    }
    return [cx + 0.5, this.H - 2, cz + 0.5];
  }
  surfaceY(x, z) { // plus haut bloc solide (feuilles comprises)
    let y = this.H - 1; while (y > 0 && !SOLID[this.get(x, y, z)]) y--; return y;
  }
  // sauvegarde des modifications : "idx.id,idx.id" en base 36
  packEdits() { const out = []; for (const [i, v] of this.edits) out.push(i.toString(36) + '.' + v.toString(36)); return out.join(','); }
  applyEdits(s) {
    if (!s) return;
    for (const p of s.split(',')) { const k = p.indexOf('.'); if (k < 0) continue; const i = parseInt(p.slice(0, k), 36), v = parseInt(p.slice(k + 1), 36); if (!(i >= 0 && i < this.data.length) || !(v >= 0 && v < N_BLOCKS) || !BLOCKS[v]) continue; this.data[i] = v; this.edits.set(i, v); }
    this.computeTop();
  }
  skyAt(x, y, z) { if (x < 0 || z < 0 || x >= this.W || z >= this.D) return 1; const t = this.top[x + z * this.W]; return y > t ? 1 : Math.max(0.2, 1 - (t - y) * 0.14); }

  /* ---------------- maillage d'un tronçon ---------------- */
  buildChunk(cx, cz) {
    const W = this.W, WD = W * this.D, H = this.H, d = this.data;
    const x0 = cx * CH, z0 = cz * CH, x1 = Math.min(W, x0 + CH), z1 = Math.min(this.D, z0 + CH);
    // lumières proches
    const lamps = [];
    for (const i of this.lights) { const y = (i / WD) | 0, r = i - y * WD, z = (r / W) | 0, x = r - z * W; if (x > x0 - 8 && x < x1 + 8 && z > z0 - 8 && z < z1 + 8) lamps.push(x + 0.5, y + 0.5, z + 0.5, LAMP[d[i]]); }
    const S = { p: [], u: [], c: [], l: [], i: [] }, Wt = { p: [], u: [], c: [], l: [], i: [] };
    const get = (x, y, z) => (y < 0 ? B.BEDROCK : (x < 0 || z < 0 || x >= W || z >= this.D || y >= H) ? 0 : d[x + z * W + y * WD]);
    const occ = (x, y, z) => OPAQ[get(x, y, z)];
    let ymax = 0; for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { let y = H - 1; while (y > 0 && !d[x + z * W + y * WD]) y--; if (y > ymax) ymax = y; }
    const uv = [0, 0];
    for (let y = 0; y <= Math.min(H - 1, ymax); y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const id = d[x + z * W + y * WD]; if (!id) continue;
      const bd = BLOCKS[id], liq = bd.liq, cut = CUT[id], lampSelf = LAMP[id];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
        const nb = get(nx, ny, nz);
        if (liq) { if (nb === id || SOLID[nb] && !CUT[nb]) continue; if (f === 3 && ny < 0) continue; }
        else if (cut) { if (nb === id || OPAQ[nb]) continue; }
        else if (OPAQ[nb]) continue;
        if (f === 3 && y === 0) continue;
        const out = liq ? Wt : S;
        const sky = this.skyAt(nx, ny, nz);
        let lamp = lampSelf ? 1 : 0;
        if (!lampSelf && lamps.length) for (let k = 0; k < lamps.length; k += 4) { const dd = Math.hypot(lamps[k] - (nx + 0.5), lamps[k + 1] - (ny + 0.5), lamps[k + 2] - (nz + 0.5)); const v = (1 - dd / 7.5) * lamps[k + 3]; if (v > lamp) lamp = v; }
        const tile = f === 2 ? bd.t[0] : f === 3 ? bd.t[2] : bd.t[1];
        const base = out.p.length / 3, ax = F.ax, ao = [0, 0, 0, 0];
        const wtop = liq && f !== 3 && get(x, y + 1, z) !== id;
        for (let c = 0; c < 4; c++) {
          const C = F.c[c];
          let py = y + C[1]; if (wtop && C[1] === 1) py -= 0.12;
          out.p.push(x + C[0], py, z + C[2]);
          tileUV(tile, F.uv[c][0], F.uv[c][1], uv, 0); out.u.push(uv[0], uv[1]);
          let a = 3;
          if (!liq && !lampSelf) {
            const du = C[ax[0]] * 2 - 1, dv = C[ax[1]] * 2 - 1;
            const o1 = [nx, ny, nz], o2 = [nx, ny, nz], o3 = [nx, ny, nz];
            o1[ax[0]] += du; o2[ax[1]] += dv; o3[ax[0]] += du; o3[ax[1]] += dv;
            const s1 = occ(o1[0], o1[1], o1[2]), s2 = occ(o2[0], o2[1], o2[2]), s3 = occ(o3[0], o3[1], o3[2]);
            a = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
          }
          ao[c] = a;
          const k = AOF[a] * (lampSelf ? 1 : F.shade);
          out.c.push(k * sky, k * sky, k * sky); out.l.push(k * lamp);
        }
        if (ao[0] + ao[2] < ao[1] + ao[3]) out.i.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        else out.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const mk = s => { if (!s.i.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(s.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(s.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(s.c, 3)); g.setAttribute('lamp', new THREE.Float32BufferAttribute(s.l, 1)); g.setIndex(s.i); g.computeBoundingSphere(); return g; };
    return { solid: mk(S), water: mk(Wt) };
  }

  /* ---------------- rayon (DDA) ---------------- */
  ray(o, dir, maxD, hitLiquid = false) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx ? Math.abs(1 / dir.x) : 1e9, tdy = sy ? Math.abs(1 / dir.y) : 1e9, tdz = sz ? Math.abs(1 / dir.z) : 1e9;
    let tx = sx ? (sx > 0 ? x + 1 - o.x : o.x - x) * tdx : 1e9, ty = sy ? (sy > 0 ? y + 1 - o.y : o.y - y) * tdy : 1e9, tz = sz ? (sz > 0 ? z + 1 - o.z : o.z - z) * tdz : 1e9;
    let n = [0, 0, 0], t = 0;
    for (let i = 0; i < 64; i++) {
      const id = this.get(x, y, z);
      if (id && (SOLID[id] || (hitLiquid && BLOCKS[id].liq))) return { x, y, z, id, n, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
      if (t > maxD) return null;
    }
    return null;
  }
}
const AOF = [0.5, 0.66, 0.83, 1];
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8, ax: [1, 2] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8, ax: [1, 2] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1, ax: [0, 2] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, ax: [0, 2] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9, ax: [0, 1] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.7, ax: [0, 1] },
];
for (const F of FACES) F.uv = [[0, 0], [1, 0], [1, 1], [0, 1]];

// géométrie d'un bloc seul (main du joueur, objets)
export function blockGeometry(id) {
  const bd = BLOCKS[id], p = [], u = [], c = [], l = [], ix = [], uv = [0, 0];
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], tile = f === 2 ? bd.t[0] : f === 3 ? bd.t[2] : bd.t[1], b = p.length / 3;
    for (let k = 0; k < 4; k++) { const C = F.c[k]; p.push(C[0] - 0.5, C[1] - 0.5, C[2] - 0.5); tileUV(tile, F.uv[k][0], F.uv[k][1], uv, 0); u.push(uv[0], uv[1]); const s = bd.lamp ? 1 : F.shade; c.push(s, s, s); l.push(bd.lamp ? 1 : 0); }
    ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.setAttribute('lamp', new THREE.Float32BufferAttribute(l, 1)); g.setIndex(ix); return g;
}

// matériau voxel : couleur = lumière du ciel × jour, ou lumière des lanternes
export function voxelMaterial(uDay, opts = {}) {
  const m = new THREE.MeshBasicMaterial(Object.assign({ map: atlasTexture(), vertexColors: true }, opts));
  m.onBeforeCompile = sh => {
    sh.uniforms.uDay = uDay;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float lamp; varying float vLamp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLamp = lamp;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uDay; varying float vLamp;').replace('#include <color_fragment>', 'diffuseColor.rgb *= max(vColor.rgb * uDay, vec3(vLamp) * vec3(1.0, 0.86, 0.62));');
  };
  return m;
}

/* ---------------- physique (boîte englobante) ---------------- */
// e : { pos: Vector3 (pieds, centre), vel, hw, h, onGround, step }
const AX = ['x', 'y', 'z'];
function overlaps(w, e, px, py, pz) {
  const x0 = Math.floor(px - e.hw), x1 = Math.floor(px + e.hw - 1e-6), y0 = Math.floor(py), y1 = Math.floor(py + e.h - 1e-6), z0 = Math.floor(pz - e.hw), z1 = Math.floor(pz + e.hw - 1e-6);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (w.solid(x, y, z)) return true;
  return false;
}
export function moveEntity(w, e, dt) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(e.vel.x), Math.abs(e.vel.y), Math.abs(e.vel.z)) * dt / 0.35));
  const h = dt / steps; e.onGround = false; e.hitWall = false; let stepped = 0;
  for (let s = 0; s < steps; s++) for (const a of [1, 0, 2]) {
    const v = e.vel[AX[a]]; if (!v) continue;
    const p = e.pos, old = p[AX[a]];
    p[AX[a]] = old + v * h;
    if (!overlaps(w, e, p.x, p.y, p.z)) continue;
    if (a !== 1 && e.step && e.wasGround) {
      // marche automatique (1 bloc, 2 pour les véhicules)
      let ok = false;
      for (let k = 1; k <= e.step; k++) if (!overlaps(w, e, p.x, p.y + k + 0.01, p.z)) { p.y += k + 0.01; stepped += k; ok = true; break; }
      if (ok) continue;
    }
    p[AX[a]] = old;
    if (a === 1) { if (v < 0) { e.onGround = true; e.landV = v; } e.vel.y = 0; }
    else { e.vel[AX[a]] = 0; e.hitWall = true; }
  }
  e.wasGround = e.onGround;
  e.stepped = stepped;
  return e;
}
export function entityInBlock(w, e, frac = 0.4) { const x = Math.floor(e.pos.x), z = Math.floor(e.pos.z), y = Math.floor(e.pos.y + e.h * frac); return w.get(x, y, z); }
export { overlaps };
