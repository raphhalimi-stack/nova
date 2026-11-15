// CUBIKA — moteur partagé : monde de blocs, physique des personnages, avatars, caméra, effets.
import * as THREE from './three.module.min.js';
import { clamp, lerp, damp } from './core.js';

export const V3 = THREE.Vector3;
export const GRAV = 36, JUMP = 13.2, RUN = 7.6, CH_R = 0.36, CH_H = 1.82;

/* ---------------- matériau « jouet » : arêtes de blocs dessinées en espace monde ---------------- */
export function toyPatch(m, grid = 1) {
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 ckp = vec4(transformed, 1.0); vec3 ckn = objectNormal;
      #ifdef USE_INSTANCING
        ckp = instanceMatrix * ckp; ckn = mat3(instanceMatrix) * ckn;
      #endif
      ckp = modelMatrix * ckp; vWP = ckp.xyz; vWN = normalize(mat3(modelMatrix) * ckn);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 an = abs(vWN); vec2 uv = an.y > 0.6 ? vWP.xz : (an.x > 0.6 ? vWP.zy : vWP.xy); uv /= ${grid.toFixed(2)};
        vec2 g = abs(fract(uv) - 0.5); float e = smoothstep(0.43, 0.5, max(g.x, g.y));
        diffuseColor.rgb *= (1.0 - e * 0.16) * (an.y > 0.6 && vWN.y > 0.0 ? 1.06 : 0.94); }`);
  };
  m.customProgramCacheKey = () => 'toy' + grid;
  return m;
}
const matCache = new Map();
export function boxMat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (matCache.has(k)) return matCache.get(k);
  let m;
  if (opts.basic) m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, depthWrite: !opts.opacity, fog: opts.fog ?? true });
  else { m = new THREE.MeshLambertMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, emissive: opts.emissive || 0x000000 }); if (!opts.smooth) toyPatch(m); }
  matCache.set(k, m); return m;
}
export function clearMatCache() { for (const m of matCache.values()) m.dispose(); matCache.clear(); }
const BOXG = new THREE.BoxGeometry(1, 1, 1);

/* ---------------- texte en sprite / texture ---------------- */
export function textCanvas(text, { w = 512, h = 128, size = 64, color = '#fff', bg = null, stroke = '#000', font = 'Sora,Inter,sans-serif', weight = 800 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; const r = h * 0.3; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, r) : x.rect(4, 4, w - 8, h - 8); x.fill(); }
  x.font = `${weight} ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = String(text).split('\n'), lh = size * 1.1;
  lines.forEach((l, i) => { const y = h / 2 + (i - (lines.length - 1) / 2) * lh; if (stroke) { x.lineWidth = size * 0.16; x.strokeStyle = stroke; x.lineJoin = 'round'; x.strokeText(l, w / 2, y); } x.fillStyle = color; x.fillText(l, w / 2, y); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
export function textSprite(text, height = 0.5, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(text, opts), transparent: true, depthWrite: false, depthTest: opts.depthTest ?? true, fog: false }));
  s.scale.set(height * w / h, height, 1); s.renderOrder = 5; return s;
}
export function textPlane(text, width, height, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: textCanvas(text, opts), transparent: true, side: THREE.DoubleSide, fog: false }));
  return m;
}
export function skyTexture(top, mid, bot) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------------- monde : boîtes alignées (collision + rendu instancié) ---------------- */
export class World {
  constructor(scene, quality) {
    this.scene = scene; this.q = quality; this.boxes = []; this.dyn = []; this.group = new THREE.Group(); scene.add(this.group);
    this.instMat = toyPatch(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  }
  // x,y,z = centre ; w,h,d = tailles
  add(x, y, z, w, h, d, color, o = {}) {
    const b = Object.assign({ min: new V3(x - w / 2, y - h / 2, z - d / 2), max: new V3(x + w / 2, y + h / 2, z + d / 2), color, solid: true }, o);
    if (o.visual === false) b.hidden = true;
    if (o.dyn) { b.mesh = new THREE.Mesh(BOXG, o.mat || boxMat(color, o.opacity ? { opacity: o.opacity } : {})); b.mesh.scale.set(w, h, d); b.mesh.position.set(x, y, z); b.mesh.castShadow = this.q === 'high'; b.mesh.receiveShadow = this.q !== 'low'; this.group.add(b.mesh); b.delta = new V3(); this.dyn.push(b); }
    else if (o.opacity || o.mat) { b.mesh = new THREE.Mesh(BOXG, o.mat || boxMat(color, { opacity: o.opacity })); b.mesh.scale.set(w, h, d); b.mesh.position.set(x, y, z); this.group.add(b.mesh); if (o.solid !== false) this.boxes.push(b); return b; }
    if (!o.dyn && o.solid !== false) this.boxes.push(b);
    if (!o.dyn && o.solid === false && !b.hidden) this.boxes.push(Object.assign(b, { ghost: true }));
    return b;
  }
  // pose de bloc posé/retiré à la volée (guerre des lits, tycoon)
  addLive(x, y, z, w, h, d, color, o = {}) { return this.add(x, y, z, w, h, d, color, Object.assign({ dyn: true }, o)); }
  remove(b) {
    if (!b) return;
    let i = this.dyn.indexOf(b); if (i >= 0) this.dyn.splice(i, 1);
    i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1);
    if (b.mesh) { this.group.remove(b.mesh); }
    if (b.inst != null && this.inst) { this.inst.setMatrixAt(b.inst, new THREE.Matrix4().makeScale(0, 0, 0)); this.inst.instanceMatrix.needsUpdate = true; }
  }
  moveDyn(b, x, y, z) {
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
    b.delta.set(x - cx, y - cy, z - cz); b.min.add(b.delta); b.max.add(b.delta); if (b.mesh) b.mesh.position.set(x, y, z);
  }
  build() {
    const list = this.boxes.filter(b => !b.mesh && !b.hidden);
    if (!list.length) return;
    const im = this.inst = new THREE.InstancedMesh(BOXG, this.instMat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), c = new THREE.Color();
    list.forEach((b, i) => { s.subVectors(b.max, b.min); p.addVectors(b.max, b.min).multiplyScalar(0.5); m4.compose(p, q, s); im.setMatrixAt(i, m4); c.set(b.color); im.setColorAt(i, c); b.inst = i; });
    im.castShadow = this.q === 'high'; im.receiveShadow = this.q !== 'low';
    this.group.add(im);
  }
  colliders() { return this.dyn.length ? this.boxes.concat(this.dyn.filter(b => b.solid !== false)) : this.boxes; }
  clear() {
    this.group.traverse(o => { if (o.geometry && o.geometry !== BOXG) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); if (o.isSprite || (o.material && !matCacheHas(o.material) && o.material !== this.instMat)) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && m.dispose && m.dispose()); } });
    this.scene.remove(this.group); this.group = new THREE.Group(); this.scene.add(this.group);
    if (this.inst) { this.inst.dispose(); this.inst = null; }
    this.boxes = []; this.dyn = [];
  }
  solidAt(x, y, z) {
    for (const b of this.colliders()) if (!b.ghost && !b.off && x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z) return b;
    return null;
  }
  groundBelow(x, z, fromY, r = 0) {
    let best = -1e9, bb = null;
    for (const b of this.colliders()) { if (b.ghost || b.off || b.kill) continue; if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && b.max.y <= fromY + 0.01 && b.max.y > best) { best = b.max.y; bb = b; } }
    return bb ? { y: best, b: bb } : null;
  }
  ray(o, d, maxT, skip) {
    let best = maxT;
    for (const b of this.colliders()) {
      if (b.ghost || b.noCam || b.off || b === skip) continue;
      let t0 = 0, t1 = best, ok = true;
      for (const ax of ['x', 'y', 'z']) {
        if (Math.abs(d[ax]) < 1e-6) { if (o[ax] < b.min[ax] || o[ax] > b.max[ax]) { ok = false; break; } continue; }
        let a = (b.min[ax] - o[ax]) / d[ax], c = (b.max[ax] - o[ax]) / d[ax]; if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}
function matCacheHas(m) { for (const v of matCache.values()) if (v === m) return true; return false; }

/* ---------------- personnage : physique ---------------- */
export class Char {
  constructor(look, name, isBot = false) {
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.onGround = false; this.ground = null; this.coyote = 0; this.alive = true;
    this.look = look; this.name = name; this.bot = isBot; this.r = CH_R; this.h = CH_H; this.anim = 0; this.swing = 0; this.hp = 100; this.speedMul = 1; this.crouch = false; this.data = {};
    this.av = buildAvatar(look);
    if (name) { this.tag = textSprite(name, 0.36, { size: 54, w: 384, h: 96 }); this.tag.position.y = 2.55; this.av.group.add(this.tag); }
  }
  setLook(l) { this.look = l; const g = this.av.group, par = g.parent, tag = this.tag; disposeAvatar(this.av); this.av = buildAvatar(l); if (tag) this.av.group.add(tag); if (par) { par.remove(g); par.add(this.av.group); } this.sync(); }
  sync() { const g = this.av.group; g.position.copy(this.pos); g.rotation.y = this.yaw; }
}
const tmpMin = new V3(), tmpMax = new V3();
function overlap(c, b, e = 1e-4) {
  return c.pos.x - c.r < b.max.x - e && c.pos.x + c.r > b.min.x + e && c.pos.y < b.max.y - e && c.pos.y + c.h > b.min.y + e && c.pos.z - c.r < b.max.z - e && c.pos.z + c.r > b.min.z + e;
}
export function stepChar(ch, world, dt, mv, wantJump, opts = {}) {
  const spd = (opts.speed ?? RUN) * ch.speedMul * (ch.crouch ? 0.45 : 1);
  const g = ch.ground, ice = g && g.ice, acc = ch.onGround ? (ice ? 2.2 : 16) : 6;
  let tx = mv.x * spd, tz = mv.z * spd;
  if (g && g.conv && ch.onGround) { tx += g.conv[0]; tz += g.conv[1]; }
  if (opts.push) { tx += opts.push.x; tz += opts.push.z; }
  ch.vel.x = damp(ch.vel.x, tx, acc, dt); ch.vel.z = damp(ch.vel.z, tz, acc, dt);
  if (ch.knock) { ch.vel.x += ch.knock.x; ch.vel.z += ch.knock.z; ch.vel.y = Math.max(ch.vel.y, ch.knock.y || 0); ch.knock = null; ch.onGround = false; }
  ch.coyote -= dt;
  if (ch.onGround) ch.coyote = 0.12;
  ch.jumped = false;
  if (wantJump && ch.coyote > 0 && !ch.crouch) { ch.vel.y = (opts.jump ?? JUMP); ch.onGround = false; ch.coyote = 0; ch.jumped = true; }
  ch.vel.y -= GRAV * (opts.grav ?? 1) * dt; if (ch.vel.y < -48) ch.vel.y = -48;
  if (g && g.delta && ch.onGround) { ch.pos.x += g.delta.x; ch.pos.z += g.delta.z; if (g.delta.y > 0) ch.pos.y += g.delta.y; }
  const wasGround = ch.onGround, prevY = ch.pos.y, boxes = world.colliders();
  ch.onGround = false; ch.landed = false;
  const prevGround = ch.ground; ch.ground = null;
  // X puis Z
  for (const ax of ['x', 'z']) {
    const d = ch.vel[ax] * dt; if (!d) continue; ch.pos[ax] += d;
    for (const b of boxes) {
      if (b.ghost || b.off || b.passable) continue;
      if (!overlap(ch, b)) continue;
      if (b.kill && !opts.solidKill) continue;
      const up = b.max.y - ch.pos.y;
      if (wasGround && up > 0 && up <= 0.62) { const oy = ch.pos.y; ch.pos.y = b.max.y + 0.001; let blocked = false; for (const b2 of boxes) if (b2 !== b && !b2.ghost && !b2.off && !b2.kill && overlap(ch, b2)) { blocked = true; break; } if (!blocked) continue; ch.pos.y = oy; }
      ch.pos[ax] = d > 0 ? b.min[ax] - ch.r - 0.001 : b.max[ax] + ch.r + 0.001; ch.vel[ax] = 0; ch.hitWall = b;
    }
  }
  ch.pos.y += ch.vel.y * dt;
  for (const b of boxes) {
    if (b.ghost || b.off) continue;
    if (!overlap(ch, b)) continue;
    if (b.kill) continue;
    if (ch.vel.y <= 0 && prevY >= b.max.y - 0.35) { ch.pos.y = b.max.y; if (b.bounce) { ch.vel.y = b.bounce; ch.bounced = true; } else { if (!wasGround && ch.vel.y < -8) ch.landed = -ch.vel.y; ch.vel.y = 0; ch.onGround = true; ch.ground = b; } }
    else if (ch.vel.y > 0 && !b.passable) { ch.pos.y = b.min.y - ch.h - 0.001; ch.vel.y = 0; }
  }
  // collé au sol sur une petite descente
  if (!ch.onGround && wasGround && ch.vel.y <= 0 && !ch.jumped) {
    const gb = world.groundBelow(ch.pos.x, ch.pos.z, ch.pos.y + 0.01, ch.r * 0.7);
    if (gb && ch.pos.y - gb.y < 0.5 && !gb.b.bounce) { ch.pos.y = gb.y; ch.vel.y = 0; ch.onGround = true; ch.ground = gb.b; }
  }
  if (ch.ground && ch.ground !== prevGround && ch.ground.onStep) ch.ground.onStep(ch);
  // contact avec un bloc mortel
  ch.touchKill = null;
  for (const b of boxes) if (b.kill && !b.off && ch.pos.x - ch.r < b.max.x + 0.05 && ch.pos.x + ch.r > b.min.x - 0.05 && ch.pos.y < b.max.y + 0.05 && ch.pos.y + ch.h > b.min.y && ch.pos.z - ch.r < b.max.z + 0.05 && ch.pos.z + ch.r > b.min.z - 0.05) { ch.touchKill = b; break; }
  // orientation + animation
  const hs = Math.hypot(ch.vel.x, ch.vel.z);
  if (!opts.noTurn && Math.hypot(mv.x, mv.z) > 0.1) { const ty = Math.atan2(mv.x, mv.z); let d = ty - ch.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); ch.yaw += d * Math.min(1, dt * 14); }
  animate(ch, dt, hs);
  ch.sync();
}
export function animate(ch, dt, hs) {
  const P = ch.av.parts; ch.anim += dt * (4 + hs * 1.25);
  const k = ch.onGround ? Math.min(1, hs / 6) : 0.25, s = Math.sin(ch.anim) * 0.9 * k;
  P.legL.rotation.x = s; P.legR.rotation.x = -s;
  if (ch.swing > 0) { ch.swing -= dt; const t = 1 - ch.swing / 0.3; P.armR.rotation.x = -Math.sin(t * Math.PI) * 2.2; }
  else P.armR.rotation.x = ch.onGround ? s : -2.6;
  P.armL.rotation.x = ch.onGround ? -s : -2.6;
  if (ch.pose) { P.armR.rotation.x = -2.8; P.armL.rotation.x = -2.8; P.armL.rotation.z = 0.5; P.armR.rotation.z = -0.5; } else { P.armL.rotation.z = 0; P.armR.rotation.z = 0; }
  const cr = ch.crouch ? 1 : 0; P.body.position.y = -cr * 0.45; P.body.rotation.x = cr * 0.35; P.legL.rotation.x += cr * -1.2; P.legR.rotation.x += cr * -1.2;
  if (ch.sit) { P.legL.rotation.x = P.legR.rotation.x = -1.5; P.armL.rotation.x = P.armR.rotation.x = -1.1; }
  P.body.position.y += ch.onGround ? Math.abs(Math.cos(ch.anim)) * 0.05 * k : 0;
}

/* ---------------- avatars ---------------- */
export const SKIN = ['#f6d7b8', '#eac096', '#d29a6a', '#a8714a', '#7a4c2c', '#4e3020', '#ffd84a', '#9fd8ff'];
export const COLORS = ['#ff4d6d', '#ff8a3d', '#ffd23d', '#7ddc4a', '#2ec4b6', '#3d8bff', '#7a5cff', '#d65cff', '#ff7ac8', '#ffffff', '#b8c0cc', '#5b6270', '#1f2430', '#8a5a3c', '#1e7a4a', '#0f3a6e'];
export const HATS = {
  none: ['Aucun', 0, 1], cap: ['Casquette', 0, 1, ['sport', 'retro']], flower: ['Fleur', 30, 1, ['plage', 'foret']], beanie: ['Bonnet', 40, 1, ['hiver']], antenna: ['Antenne', 60, 1, ['robot', 'espace']],
  cat: ['Oreilles de chat', 70, 2, ['fantaisie']], headset: ['Casque audio', 90, 2, ['retro', 'sport']], mohawk: ['Crête', 110, 2, ['retro']], cowboy: ['Chapeau de ranch', 140, 3, ['foret']],
  horns: ['Cornes', 150, 3, ['fantaisie']], pirate: ['Tricorne', 180, 3, ['pirate']], tophat: ['Haut-de-forme', 120, 2, ['chic']], halo: ['Auréole', 250, 4, ['fantaisie', 'chic']],
  bubble: ['Bulle spatiale', 300, 6, ['espace']], crown: ['Couronne', 400, 5, ['chic', 'fantaisie']],
};
export const BACKS = {
  none: ['Aucun', 0, 1], bag: ['Sac à dos', 50, 1, ['sport', 'foret']], shell: ['Carapace', 100, 2, ['plage']], cape: ['Cape', 120, 2, ['chic', 'fantaisie']],
  guitar: ['Guitare', 160, 3, ['retro']], jetpack: ['Jetpack', 220, 4, ['espace', 'robot']], wings: ['Ailes', 350, 5, ['fantaisie']], scarf: ['Écharpe', 60, 1, ['hiver']],
};
export const FACES = { smile: ['Sourire', 0, 1], happy: ['Ravi', 0, 1], wink: ['Clin d’œil', 40, 1], surprise: ['Surpris', 30, 1], sleepy: ['Endormi', 30, 1], determined: ['Décidé', 60, 2], cool: ['Lunettes noires', 80, 2, ['plage', 'chic']], catf: ['Minou', 90, 3, ['fantaisie']], robotf: ['Visière', 120, 3, ['robot', 'espace']] };
export const DECALS = { none: ['Uni', 0, 1], star: ['Étoile', 20, 1, ['espace']], heart: ['Cœur', 20, 1, ['chic']], bolt: ['Éclair', 40, 1, ['sport']], stripes: ['Rayures', 50, 2, ['plage', 'pirate']], check: ['Damier', 60, 2, ['retro', 'sport']], flame: ['Flamme', 90, 3, ['retro']], leaf: ['Feuille', 40, 2, ['foret']], snow: ['Flocon', 40, 2, ['hiver']], gear: ['Engrenage', 70, 3, ['robot']], skull: ['Pavillon', 90, 3, ['pirate']] };
export const defaultLook = () => ({ skin: SKIN[1], shirt: '#3d8bff', pants: '#1f2430', shoes: '#ffffff', hat: 'cap', hatC: '#ff4d6d', back: 'none', backC: '#ffd23d', face: 'smile', decal: 'star' });
export function randomLook(r = Math.random) {
  const pick = a => a[(r() * a.length) | 0], keys = o => Object.keys(o);
  return { skin: pick(SKIN), shirt: pick(COLORS), pants: pick(COLORS), shoes: pick(COLORS), hat: pick(keys(HATS)), hatC: pick(COLORS), back: r() < 0.5 ? 'none' : pick(keys(BACKS)), backC: pick(COLORS), face: pick(keys(FACES)), decal: pick(keys(DECALS)) };
}
const texCache = new Map();
function faceTex(face) {
  if (texCache.has('f' + face)) return texCache.get('f' + face);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#1a1a22'; x.strokeStyle = '#1a1a22'; x.lineCap = 'round'; x.lineWidth = 7;
  const eye = (cx, cy, r = 9) => { x.beginPath(); x.ellipse(cx, cy, r * 0.8, r * 1.15, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 2, cy - 4, 3, 0, 7); x.fill(); x.fillStyle = '#1a1a22'; };
  const arc = (cx, cy, r, a0, a1) => { x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke(); };
  switch (face) {
    case 'smile': eye(44, 52); eye(84, 52); arc(64, 70, 22, 0.25 * Math.PI, 0.75 * Math.PI); break;
    case 'happy': arc(44, 56, 10, Math.PI * 1.1, Math.PI * 1.9); arc(84, 56, 10, Math.PI * 1.1, Math.PI * 1.9); x.beginPath(); x.arc(64, 74, 20, 0, Math.PI); x.closePath(); x.fill(); x.fillStyle = '#ff7a8a'; x.beginPath(); x.arc(64, 86, 9, 0, Math.PI); x.fill(); break;
    case 'wink': eye(44, 52); arc(84, 56, 10, Math.PI * 1.1, Math.PI * 1.9); arc(64, 72, 20, 0.2 * Math.PI, 0.8 * Math.PI); break;
    case 'surprise': eye(44, 50, 11); eye(84, 50, 11); x.beginPath(); x.ellipse(64, 88, 9, 12, 0, 0, 7); x.fill(); break;
    case 'sleepy': x.beginPath(); x.moveTo(34, 56); x.lineTo(54, 56); x.moveTo(74, 56); x.lineTo(94, 56); x.stroke(); arc(64, 84, 8, 0, Math.PI * 2); x.font = '700 22px Sora,sans-serif'; x.fillText('z', 100, 30); break;
    case 'determined': x.beginPath(); x.moveTo(30, 36); x.lineTo(56, 44); x.moveTo(98, 36); x.lineTo(72, 44); x.stroke(); eye(46, 56, 8); eye(82, 56, 8); x.beginPath(); x.moveTo(48, 88); x.lineTo(80, 86); x.stroke(); break;
    case 'cool': x.beginPath(); x.roundRect ? x.roundRect(24, 40, 36, 24, 8) : x.rect(24, 40, 36, 24); x.fill(); x.beginPath(); x.roundRect ? x.roundRect(68, 40, 36, 24, 8) : x.rect(68, 40, 36, 24); x.fill(); x.fillRect(56, 46, 16, 6); arc(64, 72, 18, 0.25 * Math.PI, 0.7 * Math.PI); break;
    case 'catf': eye(44, 52); eye(84, 52); x.lineWidth = 5; x.beginPath(); x.moveTo(52, 80); x.quadraticCurveTo(58, 88, 64, 80); x.quadraticCurveTo(70, 88, 76, 80); x.stroke(); x.beginPath(); x.moveTo(20, 74); x.lineTo(42, 76); x.moveTo(20, 84); x.lineTo(42, 80); x.moveTo(108, 74); x.lineTo(86, 76); x.moveTo(108, 84); x.lineTo(86, 80); x.stroke(); x.fillStyle = '#ff7a9a'; x.beginPath(); x.arc(64, 74, 5, 0, 7); x.fill(); break;
    case 'robotf': x.fillStyle = '#16202c'; x.fillRect(18, 38, 92, 30); x.fillStyle = '#38f0ff'; x.fillRect(30, 48, 22, 10); x.fillRect(76, 48, 22, 10); x.fillStyle = '#1a1a22'; for (let i = 0; i < 4; i++) x.fillRect(40 + i * 13, 84, 8, 8); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('f' + face, t); return t;
}
function decalTex(d) {
  if (texCache.has('d' + d)) return texCache.get('d' + d);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 10; x.lineJoin = 'round';
  const star = (cx, cy, R, r, n = 5) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
  switch (d) {
    case 'star': star(64, 66, 44, 19); break;
    case 'heart': x.beginPath(); x.moveTo(64, 104); x.bezierCurveTo(10, 66, 22, 18, 64, 44); x.bezierCurveTo(106, 18, 118, 66, 64, 104); x.fill(); break;
    case 'bolt': x.beginPath(); x.moveTo(74, 10); x.lineTo(34, 72); x.lineTo(62, 72); x.lineTo(50, 118); x.lineTo(96, 52); x.lineTo(68, 52); x.closePath(); x.fill(); break;
    case 'stripes': x.globalAlpha = 0.75; for (let i = 0; i < 4; i++) x.fillRect(0, 10 + i * 30, 128, 14); break;
    case 'check': x.globalAlpha = 0.7; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32); break;
    case 'flame': x.fillStyle = '#ffb02e'; x.beginPath(); x.moveTo(30, 118); x.quadraticCurveTo(10, 60, 50, 20); x.quadraticCurveTo(44, 60, 64, 64); x.quadraticCurveTo(70, 30, 92, 12); x.quadraticCurveTo(120, 70, 98, 118); x.closePath(); x.fill(); x.fillStyle = '#ffe14a'; x.beginPath(); x.moveTo(48, 118); x.quadraticCurveTo(44, 84, 64, 70); x.quadraticCurveTo(88, 88, 80, 118); x.fill(); break;
    case 'leaf': x.beginPath(); x.moveTo(20, 108); x.quadraticCurveTo(10, 20, 108, 20); x.quadraticCurveTo(108, 108, 20, 108); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 5; x.beginPath(); x.moveTo(24, 104); x.lineTo(96, 32); x.stroke(); break;
    case 'snow': x.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; x.beginPath(); x.moveTo(64 - Math.cos(a) * 46, 64 - Math.sin(a) * 46); x.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); x.stroke(); } break;
    case 'gear': star(64, 64, 50, 36, 8); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(64, 64, 16, 0, 7); x.fill(); break;
    case 'skull': x.beginPath(); x.arc(64, 54, 32, 0, 7); x.fill(); x.fillRect(46, 74, 36, 24); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(52, 54, 9, 0, 7); x.arc(76, 54, 9, 0, 7); x.fill(); x.fillRect(58, 88, 4, 10); x.fillRect(66, 88, 4, 10); break;
    default: return null;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('d' + d, t); return t;
}
const lamb = c => boxMat(c, { smooth: true });
function bx(w, h, d, c, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(BOXG, lamb(c)); m.scale.set(w, h, d); m.position.set(x, y, z); return m; }
export function buildAvatar(L) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const S = 0.86, part = (w, h, d, c, px, py, pz, pivotY) => { const p = new THREE.Group(); p.position.set(px, py, pz); const m = bx(w, h, d, c, 0, -h / 2 + (pivotY || 0), 0); p.add(m); return p; };
  const legL = part(0.38, 0.8, 0.4, L.pants, -0.2, 0.8, 0), legR = part(0.38, 0.8, 0.4, L.pants, 0.2, 0.8, 0);
  legL.add(bx(0.4, 0.16, 0.46, L.shoes, 0, -0.74, 0.03)); legR.add(bx(0.4, 0.16, 0.46, L.shoes, 0, -0.74, 0.03));
  const torso = bx(0.82, 0.8, 0.44, L.shirt, 0, 1.2, 0);
  const armL = part(0.34, 0.78, 0.38, L.shirt, -0.6, 1.58, 0), armR = part(0.34, 0.78, 0.38, L.shirt, 0.6, 1.58, 0);
  armL.add(bx(0.33, 0.2, 0.37, L.skin, 0, -0.7, 0)); armR.add(bx(0.33, 0.2, 0.37, L.skin, 0, -0.7, 0));
  const head = new THREE.Group(); head.position.y = 1.6; head.add(bx(0.58, 0.56, 0.56, L.skin, 0, 0.29, 0));
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.54), new THREE.MeshBasicMaterial({ map: faceTex(L.face || 'smile'), transparent: true })); fm.position.set(0, 0.29, 0.282); head.add(fm);
  const dt = decalTex(L.decal); if (dt) { const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), new THREE.MeshBasicMaterial({ map: dt, transparent: true, opacity: 0.92, color: new THREE.Color(L.shirt).getHSL({}).l > 0.6 ? 0x222833 : 0xffffff })); dm.position.set(0, 1.22, 0.223); body.add(dm); }
  addHat(head, L.hat, L.hatC); addBack(body, L.back, L.backC);
  body.add(legL, legR, torso, armL, armR, head);
  body.scale.setScalar(S);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, parts: { body, legL, legR, armL, armR, head, torso } };
}
export function disposeAvatar(av) { av.group.traverse(o => { if (o.geometry && o.geometry !== BOXG) o.geometry.dispose(); if (o.material && !matCacheHas(o.material) && !o.isSprite) o.material.dispose(); }); if (av.group.parent) av.group.parent.remove(av.group); }
function addHat(h, t, c) {
  const Y = 0.56;
  switch (t) {
    case 'cap': h.add(bx(0.62, 0.16, 0.6, c, 0, Y + 0.06, 0), bx(0.6, 0.05, 0.3, c, 0, Y, 0.38)); break;
    case 'flower': for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; h.add(bx(0.1, 0.1, 0.04, c, 0.22 + Math.cos(a) * 0.08, Y - 0.02 + Math.sin(a) * 0.08, 0.29)); } h.add(bx(0.08, 0.08, 0.05, '#ffd23d', 0.22, Y - 0.02, 0.3)); break;
    case 'beanie': h.add(bx(0.64, 0.24, 0.62, c, 0, Y + 0.06, 0)); h.add(bx(0.68, 0.1, 0.66, '#ffffff', 0, Y - 0.04, 0)); h.add(bx(0.16, 0.16, 0.16, '#ffffff', 0, Y + 0.26, 0)); break;
    case 'antenna': h.add(bx(0.05, 0.4, 0.05, '#b8c0cc', 0, Y + 0.2, 0)); h.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), boxMat(c, { basic: true }))); h.children[h.children.length - 1].position.set(0, Y + 0.44, 0); break;
    case 'cat': h.add(bx(0.16, 0.2, 0.08, c, -0.2, Y + 0.08, 0), bx(0.16, 0.2, 0.08, c, 0.2, Y + 0.08, 0)); break;
    case 'headset': h.add(bx(0.68, 0.06, 0.12, c, 0, Y + 0.04, 0), bx(0.1, 0.24, 0.22, c, -0.33, 0.3, 0), bx(0.1, 0.24, 0.22, c, 0.33, 0.3, 0)); break;
    case 'mohawk': for (let i = 0; i < 4; i++) h.add(bx(0.1, 0.16 + (i % 2) * 0.06, 0.13, c, 0, Y + 0.08, 0.2 - i * 0.14)); break;
    case 'cowboy': h.add(bx(0.98, 0.05, 0.9, c, 0, Y + 0.02, 0), bx(0.6, 0.26, 0.56, c, 0, Y + 0.16, 0), bx(0.62, 0.06, 0.58, '#1f2430', 0, Y + 0.06, 0)); break;
    case 'horns': { const cg = new THREE.ConeGeometry(0.07, 0.3, 6); [-1, 1].forEach(s => { const m = new THREE.Mesh(cg, lamb(c)); m.position.set(s * 0.22, Y + 0.12, 0); m.rotation.z = -s * 0.4; h.add(m); }); break; }
    case 'pirate': h.add(bx(0.86, 0.14, 0.5, c, 0, Y + 0.08, 0), bx(0.5, 0.22, 0.4, c, 0, Y + 0.2, 0), bx(0.16, 0.12, 0.02, '#ffffff', 0, Y + 0.12, 0.26)); break;
    case 'tophat': h.add(bx(0.8, 0.04, 0.76, c, 0, Y + 0.02, 0), bx(0.5, 0.46, 0.48, c, 0, Y + 0.25, 0), bx(0.52, 0.07, 0.5, '#ff4d6d', 0, Y + 0.08, 0)); break;
    case 'halo': { const m = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 6, 20), boxMat('#ffe66a', { basic: true })); m.rotation.x = Math.PI / 2; m.position.y = Y + 0.24; h.add(m); break; }
    case 'bubble': { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.3, depthWrite: false })); m.position.y = 0.3; h.add(m); h.add(bx(0.7, 0.08, 0.7, c, 0, -0.02, 0)); break; }
    case 'crown': h.add(bx(0.6, 0.14, 0.58, '#ffd23d', 0, Y + 0.06, 0)); for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.78; h.add(bx(0.1, 0.14, 0.1, '#ffd23d', Math.cos(a) * 0.24, Y + 0.18, Math.sin(a) * 0.24)); } h.add(bx(0.09, 0.09, 0.02, c, 0, Y + 0.07, 0.3)); break;
  }
}
function addBack(b, t, c) {
  switch (t) {
    case 'bag': b.add(bx(0.62, 0.62, 0.24, c, 0, 1.2, -0.34)); b.add(bx(0.5, 0.2, 0.08, '#1f2430', 0, 1.06, -0.48)); break;
    case 'shell': b.add(bx(0.78, 0.74, 0.3, c, 0, 1.2, -0.37)); b.add(bx(0.5, 0.5, 0.1, '#ffffff', 0, 1.2, -0.55)); break;
    case 'cape': { const m = bx(0.8, 1.2, 0.05, c, 0, 0.98, -0.26); m.rotation.x = 0.12; b.add(m); break; }
    case 'guitar': { const gg = new THREE.Group(); gg.add(bx(0.5, 0.5, 0.12, c, 0, -0.2, 0), bx(0.1, 0.7, 0.08, '#8a5a3c', 0, 0.38, 0)); gg.position.set(0, 1.2, -0.3); gg.rotation.z = 0.6; b.add(gg); break; }
    case 'jetpack': b.add(bx(0.24, 0.6, 0.28, c, -0.16, 1.2, -0.36), bx(0.24, 0.6, 0.28, c, 0.16, 1.2, -0.36), bx(0.18, 0.12, 0.18, '#ff8a3d', -0.16, 0.84, -0.36), bx(0.18, 0.12, 0.18, '#ff8a3d', 0.16, 0.84, -0.36)); break;
    case 'wings': [-1, 1].forEach(s => { const m = bx(0.9, 0.5, 0.05, c, s * 0.5, 1.4, -0.3); m.rotation.z = s * 0.35; m.rotation.y = s * 0.4; b.add(m); }); break;
    case 'scarf': b.add(bx(0.86, 0.14, 0.5, c, 0, 1.56, 0), bx(0.16, 0.5, 0.06, c, 0.22, 1.3, 0.25)); break;
  }
}

/* ---------------- caméra orbitale ---------------- */
export class OrbitCam {
  constructor(camera) { this.cam = camera; this.yaw = 0; this.pitch = 0.32; this.dist = 8; this.target = new V3(); this.cur = new V3(); this.d = 8; this.shake = 0; }
  update(dt, world, look, focus, opts = {}) {
    this.yaw -= look.x; this.pitch = clamp(this.pitch + look.y, -0.5, 1.25);
    this.target.copy(focus); this.cur.lerp(this.target, 1 - Math.exp(-dt * 16));
    const dir = new V3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    let want = opts.dist || this.dist;
    if (world) { const t = world.ray(this.cur, dir, want); if (t < want) want = Math.max(1.2, t - 0.3); }
    this.d = want < this.d ? want : damp(this.d, want, 4, dt);
    this.cam.position.copy(this.cur).addScaledVector(dir, this.d);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const k = this.shake * 0.5; this.cam.position.x += (Math.random() - 0.5) * k; this.cam.position.y += (Math.random() - 0.5) * k; }
    this.cam.lookAt(this.cur);
  }
  // direction de déplacement en monde depuis le joystick
  moveDir(mx, my) { const s = Math.sin(this.yaw), c = Math.cos(this.yaw); return new V3(mx * c - my * s, 0, -mx * s - my * c); }
}

/* ---------------- particules (petits cubes) ---------------- */
export class Bits {
  constructor(scene, n = 160) {
    this.n = n; this.im = new THREE.InstancedMesh(BOXG, new THREE.MeshBasicMaterial({ color: 0xffffff }), n); this.im.frustumCulled = false; scene.add(this.im);
    this.p = Array.from({ length: n }, () => ({ pos: new V3(0, -999, 0), v: new V3(), l: 0, s: 0.15 })); this.i = 0; this.m4 = new THREE.Matrix4(); this.c = new THREE.Color(); this.q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) { this.im.setColorAt(i, this.c.set(0xffffff)); this.im.setMatrixAt(i, this.m4.makeScale(0, 0, 0)); }
  }
  burst(pos, count, color, spd = 5, size = 0.16, life = 0.9) {
    for (let k = 0; k < count; k++) { const p = this.p[this.i]; this.im.setColorAt(this.i, this.c.set(Array.isArray(color) ? color[k % color.length] : color)); this.i = (this.i + 1) % this.n; p.pos.copy(pos); p.v.set((Math.random() - 0.5) * spd, Math.random() * spd * 0.9 + 1.5, (Math.random() - 0.5) * spd); p.l = life * (0.6 + Math.random() * 0.6); p.s = size * (0.6 + Math.random() * 0.8); }
    this.im.instanceColor.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) { const p = this.p[i]; if (p.l <= 0) { if (p.s) { this.im.setMatrixAt(i, this.m4.makeScale(0, 0, 0)); p.s = 0; } continue; } p.l -= dt; p.v.y -= 14 * dt; p.pos.addScaledVector(p.v, dt); const s = p.s * Math.min(1, p.l * 3); this.q.setFromAxisAngle(p.v, p.l * 6); this.m4.compose(p.pos, this.q, new V3(s, s, s)); this.im.setMatrixAt(i, this.m4); }
    this.im.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- aides pour les bots ---------------- */
export function steer(bot, tx, tz, stopDist = 0.4) {
  const dx = tx - bot.pos.x, dz = tz - bot.pos.z, d = Math.hypot(dx, dz);
  if (d < stopDist) return new V3();
  return new V3(dx / d, 0, dz / d);
}
// faut-il sauter ? (vide devant, ou marche trop haute)
export function needJump(bot, world, dir, look = 0.9) {
  if (!bot.onGround) return false;
  const fx = bot.pos.x + dir.x * look, fz = bot.pos.z + dir.z * look;
  const gb = world.groundBelow(fx, fz, bot.pos.y + 0.05, 0.05);
  if (!gb || bot.pos.y - gb.y > 1.2) return true;
  if (world.solidAt(fx, bot.pos.y + 0.8, fz)) return true;
  if (bot.hitWall) { bot.hitWall = null; return true; }
  return false;
}
export { THREE, clamp, lerp, damp };
