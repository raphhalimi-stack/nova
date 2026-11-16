// BLOCKVERSE — bac à sable de cubes moddé. Jeu original pour NOVA (hors ligne).
import * as THREE from './three.module.min.js';
import { Input, Sound, Store, Modal, ListMenu, clamp, lerp, damp, el, fmtDuration, timeAgo, rng, isTV, isTouch, lowEnd } from './core.js';
import { VoxelWorld, BLOCKS, B, CH, WORLD_TYPES, blockIcon, blockGeometry, voxelMaterial, moveEntity, entityInBlock, overlaps, isSolid } from './blockverse-world.js';

THREE.ColorManagement.enabled = false;
const V3 = THREE.Vector3;
const LVL_XP = n => 120 + (n - 1) * 80;
const DAY_LEN = 600;
const PALETTE = [1, 2, 3, 4, 6, 8, 7, 29, 9, 10, 30, 11, 26, 25, 12, 13, 14, 31, 15, 16, 27, 17, 18, 19, 20, 21, 22, 23, 24, 5];
const HOT_CREA = [1, 2, 3, 8, 6, 9, 10, 15, 4];

export const MODS = [
  { id: 'sprint', n: 'Course éclair', d: 'Tu cours 70 % plus vite.', lvl: 1, ico: '⚡' },
  { id: 'saut', n: 'Super saut', d: 'Tes sauts montent trois blocs plus haut.', lvl: 1, ico: '🦘' },
  { id: 'jour', n: 'Toujours le jour', d: 'Le soleil ne se couche plus.', lvl: 1, ico: '☀' },
  { id: 'familiers', n: 'Familiers', d: 'Trotteurs et Plumots se promènent autour de toi.', lvl: 1, ico: '🐾', def: true },
  { id: 'rodeurs', n: 'Rôdeurs nocturnes', d: 'En Survie, les Ombrelins sortent la nuit.', lvl: 1, ico: '👁', def: true },
  { id: 'nuit', n: 'Vision nocturne', d: 'Tu vois clair la nuit et dans les grottes.', lvl: 2, ico: '🌙' },
  { id: 'glisseur', n: 'Glisseur', d: 'Un véhicule flottant : △ pour monter ou descendre.', lvl: 2, ico: '🛹' },
  { id: 'portee', n: 'Main longue', d: 'Tu casses et poses deux fois plus loin.', lvl: 2, ico: '🖐' },
  { id: 'lune', n: 'Gravité lunaire', d: 'Tout tombe trois fois moins vite.', lvl: 3, ico: '🌕' },
  { id: 'boum', n: 'Méga-explosions', d: 'La dynamite creuse deux fois plus large.', lvl: 3, ico: '💥' },
  { id: 'vol', n: 'Vol libre', d: 'Double saut pour voler, même en Survie.', lvl: 4, ico: '🪶' },
  { id: 'pinceau', n: 'Pinceau XXL', d: 'En Créatif, casse et pose par zones de 3×3.', lvl: 4, ico: '🖌' },
  { id: 'meteores', n: 'Étoiles filantes', d: 'Des météores tombent et laissent un cristal dans leur cratère.', lvl: 5, ico: '☄' },
];
const QUESTS = [
  { id: 'q1', n: 'Premiers coups', d: 'Casse 20 blocs', k: 'broken', v: 20, xp: 60 },
  { id: 'q2', n: 'Bâtisseur', d: 'Pose 50 blocs', k: 'placed', v: 50, xp: 70 },
  { id: 'q3', n: 'Explorateur', d: 'Parcours 600 blocs à pied', k: 'walk', v: 600, xp: 80 },
  { id: 'q4', n: 'Sous la surface', d: 'Descends sous la couche 12', k: 'deep', v: 1, xp: 90 },
  { id: 'q5', n: 'Artisan', d: 'Fabrique 10 objets en Survie', k: 'crafted', v: 10, xp: 100 },
  { id: 'q6', n: 'Illumination', d: 'Pose 8 lanternes', k: 'lanterns', v: 8, xp: 80 },
  { id: 'q7', n: 'Toucher le ciel', d: 'Monte jusqu’à la couche 58', k: 'high', v: 1, xp: 90 },
  { id: 'q8', n: 'Nageur', d: 'Nage sur 80 blocs', k: 'swim', v: 80, xp: 70 },
  { id: 'q9', n: 'Chercheur de cristal', d: 'Récolte 5 cristaux', k: 'crystals', v: 5, xp: 140 },
  { id: 'q10', n: 'Boum !', d: 'Fais exploser 3 dynamites', k: 'booms', v: 3, xp: 110 },
  { id: 'q11', n: 'Palette', d: 'Pose 15 sortes de blocs différentes', k: 'kinds', v: 15, xp: 120 },
  { id: 'q12', n: 'Architecte', d: 'Pose 500 blocs', k: 'placed', v: 500, xp: 180 },
  { id: 'q13', n: 'Pilote', d: 'Parcours 400 blocs en Glisseur', k: 'ride', v: 400, xp: 130 },
  { id: 'q14', n: 'Ressort', d: 'Rebondis 15 fois sur un bloc rebond', k: 'bounces', v: 15, xp: 100 },
  { id: 'q15', n: 'Gardien de nuit', d: 'Repousse 10 Ombrelins', k: 'kills', v: 10, xp: 160 },
  { id: 'q16', n: 'Survivant', d: 'Survis à une nuit entière en Survie', k: 'nights', v: 1, xp: 160 },
  { id: 'q17', n: 'Démolisseur', d: 'Casse 1 000 blocs', k: 'broken', v: 1000, xp: 200 },
  { id: 'q18', n: 'Trois mondes', d: 'Crée 3 mondes', k: 'worlds', v: 3, xp: 90 },
];
const RECIPES = [
  { out: 8, n: 4, in: [[6, 1]] },
  { out: 9, n: 1, in: [[4, 2]] },
  { out: 10, n: 2, in: [[2, 2], [3, 1]] },
  { out: 30, n: 4, in: [[3, 4]] },
  { out: 15, n: 2, in: [[8, 1], [12, 1]] },
  { out: 16, n: 1, in: [[12, 2], [4, 2]] },
  { out: 17, n: 4, in: [[3, 2], [4, 2]] },
  { out: 'conc', n: 4, in: [[17, 4], [13, 1]] },
  { out: 27, n: 2, in: [[7, 4], [14, 1]] },
  { out: 26, n: 2, in: [[11, 4]] },
];
const BOT_FEEL = { trot: { n: 'Trotteur', hp: 4 }, plum: { n: 'Plumot', hp: 2 }, ombre: { n: 'Ombrelin', hp: 3 } };

const GP = { jump: '✕', use: 'R2', alt: 'L2', act: '△', crouch: '○', inv: '▢', mods: 'PAVÉ', pause: 'OPTIONS', next: 'R1', prev: 'L1', sprint: 'L3' };
const TC = { jump: 'SAUT', use: 'CASSER', alt: 'POSER', act: '△', crouch: 'BAS', inv: 'SAC', mods: 'MODS', pause: '❚❚', next: '›', prev: '‹', sprint: 'STICK À FOND' };
const kb = a => ({ jump: 'Espace', use: 'Clic G / F', alt: `Clic D / ${Input.keyName('KeyQ')}`, act: 'E / R', crouch: 'C', inv: 'I / Tab', mods: 'M', pause: 'Échap', next: 'Molette', prev: 'Molette', sprint: 'Maj' })[a] || a;
const gly = a => Input.device === 'gp' ? `<i class="g g-r">${GP[a] || a}</i>` : `<i class="g g-k">${Input.device === 'touch' ? (TC[a] || a) : kb(a)}</i>`;

const CSS = `
.bv-hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-family:Inter,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.6)}
.bv-cross{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;border-radius:50%}
.bv-cross:before,.bv-cross:after{content:'';position:absolute;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.8)}
.bv-cross:before{left:12px;top:5px;width:2px;height:16px}.bv-cross:after{top:12px;left:5px;height:2px;width:16px}
.bv-ring{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px;border-radius:50%;background:conic-gradient(#fff var(--p,0%),transparent 0);-webkit-mask:radial-gradient(circle,transparent 17px,#000 18px);mask:radial-gradient(circle,transparent 17px,#000 18px);opacity:.85;display:none}
.bv-hot{position:absolute;left:50%;bottom:calc(14px + var(--safe-b));transform:translateX(-50%);display:flex;gap:6px;padding:6px;border-radius:16px;background:rgba(8,10,18,.55);pointer-events:auto}
.bv-slot{position:relative;width:52px;height:52px;border-radius:11px;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.12);display:grid;place-items:center}
.bv-slot img{width:40px;height:40px;image-rendering:pixelated}
.bv-slot.on{border-color:#fff;background:rgba(255,255,255,.2);box-shadow:0 0 14px rgba(120,255,140,.55)}
.bv-slot b{position:absolute;right:4px;bottom:1px;font-family:var(--fd);font-size:12px}
.bv-slot i{position:absolute;left:4px;top:1px;font-size:9px;opacity:.55;font-style:normal}
.bv-bname{position:absolute;left:50%;bottom:calc(90px + var(--safe-b));transform:translateX(-50%);font-family:var(--fd);font-weight:700;font-size:15px;opacity:0;transition:opacity .3s}
.bv-bname.show{opacity:1}
.bv-hearts{position:absolute;left:50%;bottom:calc(80px + var(--safe-b));transform:translateX(-50%);display:flex;gap:2px;font-size:17px;letter-spacing:-1px}
.bv-hearts span{filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}.bv-hearts .e{opacity:.25}
.bv-tl{position:absolute;left:calc(16px + var(--safe-l));top:calc(14px + var(--safe-t));display:flex;gap:10px;align-items:center}
.bv-lvl{width:44px;height:44px;border-radius:12px;background:linear-gradient(140deg,#7dff8a,#22a05a);display:grid;place-items:center;font-family:var(--fd);font-weight:800;color:#06240f;font-size:18px;box-shadow:0 4px 0 #13703c;text-shadow:none}
.bv-wn{font-family:var(--fd);font-weight:700;font-size:14px}.bv-wm{font-size:11px;opacity:.75}
.bv-xp{width:120px;height:7px;border-radius:4px;background:rgba(0,0,0,.4);overflow:hidden;margin-top:4px}.bv-xp i{display:block;height:100%;background:#7dff8a;transition:width .4s}
.bv-tr{position:absolute;right:calc(16px + var(--safe-r));top:calc(14px + var(--safe-t));text-align:right;font-family:var(--fd);font-weight:700;font-size:14px}
.bv-tr small{display:block;font-family:Inter,sans-serif;font-weight:500;font-size:11px;opacity:.7}
.bv-prompt{position:absolute;left:50%;bottom:calc(128px + var(--safe-b));transform:translateX(-50%);padding:8px 16px;border-radius:14px;background:rgba(8,10,18,.7);font-weight:700;font-size:14px;display:none;white-space:nowrap}
.bv-prompt.show{display:block}
.bv-big{position:absolute;left:0;right:0;top:28%;text-align:center;opacity:0;transform:scale(.92);transition:.25s}
.bv-big.show{opacity:1;transform:none}.bv-big b{display:block;font-family:var(--fd);font-weight:800;font-size:clamp(28px,5.5vw,64px);letter-spacing:.04em;text-shadow:0 4px 0 rgba(0,0,0,.35),0 0 30px #5bd36a}.bv-big span{font-size:clamp(13px,1.7vw,19px);font-weight:600}
.bv-hurt{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(255,20,40,.85);opacity:0;transition:opacity .4s}
.bv-water{position:absolute;inset:0;background:rgba(20,80,170,.38);display:none}
.bv-keys{position:absolute;left:calc(16px + var(--safe-l));bottom:calc(16px + var(--safe-b));font-size:12px;line-height:1.7;padding:8px 12px;border-radius:12px;background:rgba(8,10,18,.45)}
.has-touch .bv-keys,body.tv .bv-keys{display:none}
@media (max-width:1150px){.bv-keys{display:none}}
.has-touch .bv-hot{bottom:auto;top:calc(8px + var(--safe-t));transform:translateX(-50%) scale(.8);transform-origin:center top}
.has-touch .bv-hearts{bottom:auto;top:calc(62px + var(--safe-t))}
.has-touch .bv-bname{bottom:auto;top:calc(86px + var(--safe-t))}
.has-touch .bv-prompt{bottom:auto;top:calc(112px + var(--safe-t));pointer-events:auto}
.has-touch .bv-tl{top:calc(72px + var(--safe-t));transform:scale(.85);transform-origin:left top}
.has-touch .bv-tr{top:calc(72px + var(--safe-t))}
.bv-title{position:absolute;inset:0;z-index:15;overflow:hidden;background:radial-gradient(120% 90% at 70% 10%,#3fa6c9 0%,#14456e 45%,#071426 100%);display:flex;align-items:center;pointer-events:auto}
.bv-cubes{position:absolute;inset:0;pointer-events:none}
.bv-cubes img{position:absolute;image-rendering:pixelated;animation:bvfall linear infinite;opacity:.9}
@keyframes bvfall{from{transform:translateY(-15vh) rotate(0)}to{transform:translateY(115vh) rotate(25deg)}}
body.tv .bv-cubes img,body.lowend .bv-cubes img{animation:none}
.bv-tpanel{position:relative;margin-left:clamp(16px,6vw,90px);width:min(470px,92vw);max-height:92vh;display:flex;flex-direction:column;border-radius:26px;padding:22px}
.bv-logo{font-family:var(--fd);font-weight:800;font-size:clamp(30px,5vw,50px);letter-spacing:.08em;background:linear-gradient(180deg,#d9ffe0,#5bd36a 60%,#2b8a45);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #0b3a1c)}
.bv-tsub{font-size:13px;color:var(--mut);margin:2px 0 14px}
.bv-feat{position:relative;margin-left:auto;margin-right:clamp(16px,6vw,90px);display:flex;flex-direction:column;gap:14px;width:min(340px,30vw)}.bv-feat div{display:grid;grid-template-columns:56px 1fr;column-gap:14px;align-items:center;padding:14px 16px;border-radius:20px;background:rgba(8,14,28,.55);backdrop-filter:blur(6px)}.bv-feat img{grid-row:span 2;width:56px;image-rendering:pixelated}.bv-feat b{font-family:var(--fd);font-size:16px}.bv-feat span{font-size:12.5px;color:var(--mut);line-height:1.4}
@media (max-width:820px){.bv-feat{display:none}}
.bv-load{position:absolute;inset:0;z-index:16;display:grid;place-items:center;background:#071426;pointer-events:auto}
.bv-load div{width:min(420px,80vw);text-align:center;font-family:var(--fd)}
.bv-load b{display:block;font-size:22px;margin-bottom:14px}.bv-load i{display:block;height:10px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.bv-load i em{display:block;height:100%;width:0;background:#5bd36a;transition:width .15s}
.bv-load small{display:block;margin-top:10px;color:var(--mut);font-family:Inter,sans-serif}
.bv-inv{width:min(760px,96vw)}
.bv-tabs{display:flex;gap:8px;margin-bottom:12px}
.bv-tab{padding:8px 16px;border-radius:12px;background:rgba(255,255,255,.06);font-weight:700;font-size:14px;border:2px solid transparent;cursor:pointer}
.bv-tab.on{background:rgba(91,211,106,.25)}.bv-tab.focus{border-color:#fff}
.bv-grid{display:grid;grid-template-columns:repeat(var(--cols,8),1fr);gap:8px;overflow:auto;padding:3px;max-height:46vh}
.bv-cell{position:relative;aspect-ratio:1;border-radius:12px;background:rgba(255,255,255,.06);border:2px solid transparent;display:grid;place-items:center;cursor:pointer}
.bv-cell img{width:72%;image-rendering:pixelated}.bv-cell b{position:absolute;right:5px;bottom:2px;font-family:var(--fd);font-size:12px}
.bv-cell.focus{border-color:#fff;background:rgba(255,255,255,.16);box-shadow:0 0 16px rgba(91,211,106,.45)}
.bv-invhot{display:flex;gap:6px;margin-top:12px;justify-content:center}.bv-invhot .bv-slot{width:44px;height:44px}.bv-invhot .bv-slot img{width:32px;height:32px}
.bv-sel{font-family:var(--fd);font-weight:700;margin:10px 0 0;min-height:20px;text-align:center}
.bv-ico{width:26px;height:26px;image-rendering:pixelated;vertical-align:middle}
.bv-qbar{display:inline-block;width:80px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;vertical-align:middle;margin-left:8px}.bv-qbar i{display:block;height:100%;background:#5bd36a}
`;

/* ---------------- créatures ---------------- */
const BOXG = (() => { const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); const n = g.attributes.normal, c = []; for (let i = 0; i < n.count; i++) { const y = n.getY(i), x = n.getX(i); const s = y > 0.5 ? 1 : y < -0.5 ? 0.5 : Math.abs(x) > 0.5 ? 0.78 : 0.88; c.push(s, s, s); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; })();
class Mob {
  constructor(G, kind, x, y, z) {
    this.G = G; this.kind = kind; this.hp = BOT_FEEL[kind].hp; this.pos = new V3(x, y, z); this.vel = new V3(); this.yaw = Math.random() * 6.28; this.t = 0; this.think = 0; this.flee = 0; this.cool = 0; this.flash = 0; this.anim = Math.random() * 6;
    this.hw = kind === 'plum' ? 0.25 : kind === 'ombre' ? 0.42 : 0.4; this.h = kind === 'plum' ? 0.6 : kind === 'ombre' ? 0.85 : 0.95; this.step = 1;
    this.mats = []; const g = this.g = new THREE.Group();
    const box = (w, h, d, col, x, y, z, glow) => { const m = new THREE.MeshBasicMaterial({ color: col, vertexColors: true }); m.userData.base = new THREE.Color(col); m.userData.glow = !!glow; this.mats.push(m); const b = new THREE.Mesh(BOXG, m); b.scale.set(w, h, d); b.position.set(x, y, z); g.add(b); return b; };
    if (kind === 'trot') {
      this.body = box(0.8, 0.55, 1.05, 0xe9dcb8, 0, 0.62, 0); box(0.82, 0.2, 0.6, 0xc9b48a, 0, 0.92, -0.1);
      this.head = box(0.5, 0.48, 0.45, 0x8a5a3c, 0, 0.92, 0.66); box(0.14, 0.12, 0.05, 0x1a1a22, -0.13, 0.98, 0.89); box(0.14, 0.12, 0.05, 0x1a1a22, 0.13, 0.98, 0.89); box(0.2, 0.12, 0.06, 0xffb3a8, 0, 0.82, 0.9);
      this.legs = [box(0.18, 0.4, 0.18, 0x8a5a3c, -0.25, 0.2, 0.35), box(0.18, 0.4, 0.18, 0x8a5a3c, 0.25, 0.2, 0.35), box(0.18, 0.4, 0.18, 0x8a5a3c, -0.25, 0.2, -0.35), box(0.18, 0.4, 0.18, 0x8a5a3c, 0.25, 0.2, -0.35)];
    } else if (kind === 'plum') {
      const col = [0x3d8bff, 0xff8a3d, 0x7a5cff, 0x2ec4b6][(Math.random() * 4) | 0];
      this.body = box(0.42, 0.4, 0.5, col, 0, 0.32, 0); this.head = box(0.32, 0.3, 0.3, col, 0, 0.6, 0.18); box(0.1, 0.08, 0.16, 0xffc23d, 0, 0.58, 0.38); box(0.07, 0.07, 0.03, 0x111111, -0.1, 0.65, 0.33); box(0.07, 0.07, 0.03, 0x111111, 0.1, 0.65, 0.33);
      this.wings = [box(0.06, 0.26, 0.36, 0xffffff, -0.24, 0.35, -0.02), box(0.06, 0.26, 0.36, 0xffffff, 0.24, 0.35, -0.02)]; box(0.06, 0.12, 0.04, 0xffc23d, -0.08, 0.06, 0); box(0.06, 0.12, 0.04, 0xffc23d, 0.08, 0.06, 0);
    } else {
      this.body = box(0.85, 0.8, 0.85, 0x2a1f3a, 0, 0.4, 0); box(0.6, 0.3, 0.6, 0x3e2d55, 0, 0.82, 0);
      box(0.16, 0.12, 0.04, 0x6ff6ff, -0.18, 0.52, 0.43, true); box(0.16, 0.12, 0.04, 0x6ff6ff, 0.18, 0.52, 0.43, true); box(0.4, 0.06, 0.04, 0x6ff6ff, 0, 0.32, 0.43, true);
    }
    G.scene.add(g); this.sync();
  }
  sync() { this.g.position.copy(this.pos); this.g.rotation.y = this.yaw; }
  light(day) { const f = this.flash > 0 ? 2 : 1; for (const m of this.mats) { if (m.userData.glow) continue; m.color.copy(m.userData.base).multiplyScalar(f); m.color.r *= day.r; m.color.g *= day.g; m.color.b *= day.b; } }
  update(dt) {
    const G = this.G, P = G.P, w = G.world; this.t += dt; this.think -= dt; this.flee -= dt; this.cool -= dt; this.flash -= dt;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    let sp = 0, want = this.yaw;
    if (this.kind === 'ombre') {
      if (dist < 26 && G.mode === 'survie' && P.hp > 0) { want = Math.atan2(dx, dz); sp = 3.6; if (this.vel.y === 0 && (this.onGround) && this.think <= 0) { this.vel.y = 6.5; this.think = 0.7 + Math.random() * 0.4; G.sfx('slime', this.pos); } }
      else if (this.think <= 0) { this.think = 2 + Math.random() * 3; this.yaw = Math.random() * 6.28; }
      if (!this.onGround) sp = Math.max(sp, 2.4);
      if (dist < 1.1 && Math.abs(P.pos.y - this.pos.y) < 1.6 && this.cool <= 0 && G.mode === 'survie') { this.cool = 1.2; G.hurt(3, this.pos); }
    } else {
      if (this.flee > 0) { want = Math.atan2(-dx, -dz); sp = 4.2; }
      else { if (this.think <= 0) { this.think = 1.5 + Math.random() * 3.5; this.walk = Math.random() < 0.55; this.yaw += (Math.random() - 0.5) * 2.5; } sp = this.walk ? (this.kind === 'plum' ? 1.4 : 1.2) : 0; want = this.yaw; }
    }
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 6);
    const tvx = Math.sin(this.yaw) * sp, tvz = Math.cos(this.yaw) * sp;
    this.vel.x = damp(this.vel.x, tvx, 8, dt); this.vel.z = damp(this.vel.z, tvz, 8, dt);
    const inW = BLOCKS[entityInBlock(w, this, 0.3)].liq;
    const grav = (G.mod('lune') ? 9 : 26) * (this.kind === 'plum' ? 0.55 : 1) * (inW ? 0.25 : 1);
    this.vel.y -= grav * dt; if (inW) this.vel.y = Math.max(this.vel.y, -2) + dt * 12 * (this.vel.y < 1.5 ? 1 : 0);
    if (this.hitWall && this.onGround && this.kind !== 'ombre') this.vel.y = this.kind === 'plum' ? 6 : 7.5;
    moveEntity(w, this, dt);
    if (this.pos.y < -8) this.dead = true;
    this.anim += dt * (2 + Math.hypot(this.vel.x, this.vel.z) * 4);
    if (this.legs) { const a = Math.sin(this.anim) * 0.5 * Math.min(1, Math.hypot(this.vel.x, this.vel.z)); this.legs[0].rotation.x = this.legs[3].rotation.x = a; this.legs[1].rotation.x = this.legs[2].rotation.x = -a; if (this.head) this.head.position.y = 0.92 + (sp === 0 ? Math.sin(this.t * 0.8) * 0.06 - 0.06 : 0); }
    if (this.wings) { const a = this.onGround ? Math.sin(this.anim) * 0.15 : Math.sin(this.t * 30) * 0.9; this.wings[0].rotation.z = a; this.wings[1].rotation.z = -a; }
    if (this.kind === 'ombre') { const sq = this.onGround ? 1 : 1.15; this.body.scale.set(0.85 / Math.sqrt(sq), 0.8 * sq, 0.85 / Math.sqrt(sq)); }
    this.sync();
  }
  hit(G, dir) {
    this.hp--; this.flash = 0.15; this.vel.x += dir.x * 7; this.vel.z += dir.z * 7; this.vel.y = 5; this.flee = 4; G.sfx('hit', this.pos);
    if (this.kind !== 'ombre') { this.hp = Math.max(1, this.hp); G.bits(this.pos.clone().setY(this.pos.y + 0.8), 0xff8fb0, 8); return; }
    if (this.hp <= 0) { this.dead = true; G.bits(this.pos.clone().setY(this.pos.y + 0.5), 0x6ff6ff, 22); G.stat('kills', 1); G.sfx('poof', this.pos); }
  }
  dispose() { this.G.scene.remove(this.g); for (const m of this.mats) m.dispose(); }
}

/* ---------------- jeu ---------------- */
export class Blockverse {
  constructor(root, { onExit }) {
    this.root = root; this.onExit = onExit; this.running = true; this.ui = null; this.time = 0; this.mobs = []; this.state = 'title';
    if (!document.getElementById('bv-css')) { const s = el('style'); s.id = 'bv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const sv = Store.getGame('blockverse');
    const st = sv && sv.state ? sv.state : {};
    this.S = Object.assign({ v: 1, xp: 0, level: 1, playTime: 0, stats: {}, done: {}, mods: {}, worlds: [], last: null, kinds: [], set: { view: 'auto', autostep: true } }, st);
    this.S.set = Object.assign({ view: 'auto', autostep: true }, this.S.set || {});
    for (const m of MODS) if (this.S.mods[m.id] == null) this.S.mods[m.id] = !!m.def;
    this.quality = Store.settings.quality === 'auto' ? ((isTV || lowEnd) ? 'low' : isTouch ? 'medium' : 'high') : Store.settings.quality;
    this.root.style.setProperty('--acc', '#5bd36a');
    this.initScene(); this.initHUD();
    if (isTouch || Input.device === 'touch') this.initTouch();
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize); this.resize();
    this.onVis = () => { if (document.hidden && this.state === 'play') { this.saveWorld(); if (!this.ui && !Modal.active) this.openPause(); } }; document.addEventListener('visibilitychange', this.onVis);
    this.loop = this.loop.bind(this); this.last = performance.now(); requestAnimationFrame(this.loop);
    Sound.playMusic('blockverse');
    this.openTitle();
  }

  /* ================= scène ================= */
  initScene() {
    const q = this.quality;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: q === 'high', powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.prTarget = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'medium' ? Math.min(devicePixelRatio, 1.3) : Math.min(devicePixelRatio, 0.75); this.pr = this.prTarget; r.setPixelRatio(this.pr);
    r.domElement.className = 'game-canvas'; this.root.appendChild(r.domElement);
    r.domElement.addEventListener('click', () => { if (this.state === 'play' && !this.ui && !Modal.active && !isTouch && Input.device !== 'touch' && document.pointerLockElement !== r.domElement) { try { const p = r.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } });
    r.domElement.addEventListener('contextmenu', e => e.preventDefault());
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x87c8ff); sc.fog = new THREE.Fog(0x87c8ff, 30, 90);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 200); sc.add(this.camera);
    this.uDay = { value: new THREE.Color(1, 1, 1) };
    this.matS = voxelMaterial(this.uDay, { alphaTest: 0.5 });
    this.matW = voxelMaterial(this.uDay, { transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
    // contour du bloc visé
    const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.sel = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })); this.sel.visible = false; sc.add(this.sel);
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); this.crack.visible = false; sc.add(this.crack);
    // soleil, lune, étoiles, nuages
    const disc = (col, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: col, fog: false, transparent: true, depthWrite: false })); m.renderOrder = -1; sc.add(m); return m; };
    this.sun = disc(0xfff2b0, 22); this.moon = disc(0xdfe8ff, 14);
    const sp = []; const R = rng(5); for (let i = 0; i < 400; i++) { const a = R() * 6.28, b = Math.acos(R() * 0.95); sp.push(Math.sin(b) * Math.cos(a) * 150, Math.cos(b) * 150, Math.sin(b) * Math.sin(a) * 150); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false })); sc.add(this.stars);
    this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false, depthWrite: false });
    this.clouds = new THREE.Group(); sc.add(this.clouds);
    for (let i = 0; i < (q === 'low' ? 10 : 18); i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(8 + R() * 18, 2, 6 + R() * 12), this.cloudMat); c.position.set(R() * 200 - 36, 0, R() * 200 - 36); this.clouds.add(c); }
    // particules
    const N = q === 'low' ? 160 : 320; this.pN = N; this.pP = new Float32Array(N * 3); this.pV = new Float32Array(N * 3); this.pL = new Float32Array(N); this.pC = new Float32Array(N * 3); this.pI = 0;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pP, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pC, 3));
    this.parts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.14, vertexColors: true })); this.parts.frustumCulled = false; sc.add(this.parts);
    for (let i = 0; i < N; i++) this.pP[i * 3 + 1] = -999;
    // main
    this.hand = new THREE.Group(); this.camera.add(this.hand); this.hand.position.set(0.46, -0.42, -0.75);
    this.armMat = new THREE.MeshBasicMaterial({ color: 0xeac096, vertexColors: true });
    this.arm = new THREE.Mesh(BOXG, this.armMat); this.arm.scale.set(0.13, 0.13, 0.5); this.arm.rotation.set(0.25, -0.2, 0); this.hand.add(this.arm);
    this.handBlock = null; this.handId = -1;
    // glisseur
    const bg = new THREE.Group(); const bm = (c, glow) => { const m = new THREE.MeshBasicMaterial({ color: c, vertexColors: true }); m.userData.glow = glow; return m; };
    this.boardMats = [bm(0x2b2f45), bm(0x5bd36a, true), bm(0xff5fa2, true)];
    const bb = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(BOXG, m); o.scale.set(w, h, d); o.position.set(x, y, z); bg.add(o); };
    bb(0.95, 0.12, 1.9, this.boardMats[0], 0, 0, 0); bb(0.12, 0.05, 1.7, this.boardMats[1], -0.42, -0.07, 0); bb(0.12, 0.05, 1.7, this.boardMats[1], 0.42, -0.07, 0); bb(0.5, 0.06, 0.2, this.boardMats[2], 0, 0.08, 0.8);
    this.board = bg; bg.visible = false; sc.add(bg);
    this.chunks = new Map(); this.dirty = new Set();
  }

  /* ================= HUD ================= */
  initHUD() {
    const h = el('div', 'bv-hud');
    h.innerHTML = `<div class="bv-water"></div><div class="bv-hurt"></div><div class="bv-cross"></div><div class="bv-ring"></div>
      <div class="bv-tl"><div class="bv-lvl">1</div><div><div class="bv-wn"></div><div class="bv-wm"></div><div class="bv-xp"><i></i></div></div></div>
      <div class="bv-tr"><span class="bv-clock"></span><small class="bv-coord"></small></div>
      <div class="bv-big"><b></b><span></span></div><div class="bv-prompt"></div><div class="bv-bname"></div><div class="bv-hearts"></div><div class="bv-keys"></div>
      <div class="toasts"></div><div class="fps"></div>`;
    this.root.appendChild(h); const q = s => h.querySelector(s);
    this.hud = { root: h, lvl: q('.bv-lvl'), wn: q('.bv-wn'), wm: q('.bv-wm'), xp: q('.bv-xp i'), clock: q('.bv-clock'), coord: q('.bv-coord'), big: q('.bv-big'), bigB: q('.bv-big b'), bigS: q('.bv-big span'), prompt: q('.bv-prompt'), bname: q('.bv-bname'), hearts: q('.bv-hearts'), keys: q('.bv-keys'), toasts: q('.toasts'), fps: q('.fps'), ring: q('.bv-ring'), hurtEl: q('.bv-hurt'), water: q('.bv-water'), cross: q('.bv-cross') };
    this.hud.prompt.addEventListener('pointerdown', () => { Input.touch.tap.act = true; });
    this.hud.fps.style.display = Store.settings.fps ? 'block' : 'none';
    this.hotEl = el('div', 'bv-hot'); this.root.appendChild(this.hotEl);
    this.hudVisible(false);
  }
  hudVisible(v) { this.hud.root.style.display = v ? '' : 'none'; this.hotEl.style.display = v ? '' : 'none'; if (this.touchEl) this.touchEl.style.display = v ? '' : 'none'; }
  big(t, s = '', dur = 1.8) { const H = this.hud; H.bigB.textContent = t; H.bigS.textContent = s; H.big.classList.add('show'); clearTimeout(this._bigT); this._bigT = setTimeout(() => H.big.classList.remove('show'), dur * 1000); }
  prompt(html) { const e = this.hud.prompt; if (e._v === html) return; e._v = html; e.innerHTML = html; e.classList.toggle('show', !!html); }
  toast(title, text, color = '#5bd36a') { const t = el('div', 'toast', `<b>${title}</b><span>${text}</span>`); t.style.setProperty('--c', color); this.hud.toasts.appendChild(t); setTimeout(() => t.classList.add('out'), 2800); setTimeout(() => t.remove(), 3300); while (this.hud.toasts.children.length > 4) this.hud.toasts.firstChild.remove(); }
  paintTop() {
    const S = this.S, W = this.W; this.hud.lvl.textContent = S.level; this.hud.xp.style.width = Math.min(100, S.xp / LVL_XP(S.level) * 100) + '%';
    if (W) { this.hud.wn.textContent = W.name; this.hud.wm.textContent = `${WORLD_TYPES[W.type].n} · ${W.mode === 'survie' ? 'Survie' : 'Créatif'}`; }
  }
  paintHot() {
    const W = this.W; if (!W) return;
    const surv = W.mode === 'survie';
    this.hotEl.innerHTML = W.hot.map((id, i) => `<div class="bv-slot${i === W.slot ? ' on' : ''}" data-i="${i}"><i>${i + 1}</i>${id ? `<img src="${blockIcon(id, 64)}" alt="">${surv ? `<b>${this.count(id)}</b>` : ''}` : ''}</div>`).join('');
    this.hotEl.querySelectorAll('.bv-slot').forEach(s => s.addEventListener('pointerdown', e => { e.stopPropagation(); this.selectSlot(+s.dataset.i); }));
    this.setHand();
  }
  selectSlot(i) { const W = this.W; W.slot = (i + 9) % 9; this.paintHot(); const id = W.hot[W.slot]; const b = this.hud.bname; b.textContent = id ? BLOCKS[id].n : 'Main vide'; b.classList.add('show'); clearTimeout(this._bn); this._bn = setTimeout(() => b.classList.remove('show'), 1400); Sound.sfx('move'); }
  paintHearts() {
    const W = this.W; if (!W || W.mode !== 'survie') { this.hud.hearts.innerHTML = ''; return; }
    const hp = Math.max(0, Math.ceil(this.P.hp)); let s = ''; for (let i = 0; i < 10; i++) s += hp >= (i + 1) * 2 ? '<span>❤️</span>' : hp === i * 2 + 1 ? '<span>💔</span>' : '<span class="e">🖤</span>';
    if (this.hud.hearts._v !== s) { this.hud.hearts._v = s; this.hud.hearts.innerHTML = s; }
  }
  paintKeys() {
    const W = this.W; if (!W) return;
    const fly = W.mode === 'creatif' || this.mod('vol');
    this.hud.keys.innerHTML = `${gly('use')} casser · ${gly('alt')} poser · ${gly('act')} interagir<br>${gly('inv')} sac${W.mode === 'survie' ? ' & fabrication' : ''} · ${gly('mods')} mods · ${gly('next')} bloc${fly ? `<br>${gly('jump')} ×2 voler · ${gly('crouch')} descendre` : ''}`;
  }
  setHand() {
    const id = this.W ? this.W.hot[this.W.slot] : 0;
    if (this.handId === id) return; this.handId = id;
    if (this.handBlock) { this.hand.remove(this.handBlock); this.handBlock.geometry.dispose(); this.handBlock = null; }
    this.arm.visible = !id;
    if (id) { this.handBlock = new THREE.Mesh(blockGeometry(id), this.matS); this.handBlock.scale.setScalar(0.2); this.handBlock.rotation.set(0.12, 0.75, 0); this.handBlock.position.set(0.04, 0.1, 0); this.hand.add(this.handBlock); }
  }

  /* ================= écran titre ================= */
  openTitle() {
    this.exitLock(); this.state = 'title'; this.hudVisible(false); this.renderer.domElement.style.visibility = 'hidden';
    const S = this.S, ov = el('div', 'bv-title');
    let cubes = ''; const R = rng(Date.now() & 0xffff), n = (isTV || lowEnd) ? 10 : 22;
    for (let i = 0; i < n; i++) { const id = PALETTE[(R() * PALETTE.length) | 0]; if (id === 5) continue; const s = 36 + R() * 60; cubes += `<img src="${blockIcon(id, 64)}" style="left:${R() * 100}%;top:${(isTV || lowEnd) ? R() * 90 : -10}%;width:${s}px;animation-duration:${9 + R() * 14}s;animation-delay:${-R() * 20}s;opacity:${0.35 + R() * 0.55}">`; }
    ov.innerHTML = `<div class="bv-cubes">${cubes}</div><div class="bv-tpanel glass"><div class="bv-logo">BLOCKVERSE</div><div class="bv-tsub">Niveau ${S.level} · ${this.doneCount()} / ${QUESTS.length} défis · ${MODS.filter(m => S.level >= m.lvl).length} / ${MODS.length} mods débloqués</div><div class="gm-list"></div><div class="gm-foot">${gly('jump')} Valider · ◀ ▶ Ajuster · ${Store.cloud === 'on' ? '☁ Sauvegarde synchronisée' : '💾 Sauvegarde locale'}</div></div><div class="bv-feat"><div><img src="${blockIcon(1, 64)}"><b>Créatif & Survie</b><span>Construis sans limite ou récolte, fabrique et tiens bon la nuit.</span></div><div><img src="${blockIcon(14, 64)}"><b>13 mods intégrés</b><span>Vol, glisseur, gravité lunaire, étoiles filantes… en un clic.</span></div><div><img src="${blockIcon(31, 64)}"><b>18 défis</b><span>Gagne de l’XP, monte de niveau, débloque les mods.</span></div></div>`;
    this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; };
    const items = [];
    const ws = [...S.worlds].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    for (const w of ws) items.push({ label: `▶ ${w.name}`, sub: `${WORLD_TYPES[w.type].n} · ${w.mode === 'survie' ? 'Survie' : 'Créatif'} · ${fmtDuration(w.playTime)} · ${timeAgo(w.lastPlayed)}`, cls: w === ws[0] ? 'warn' : '', act: () => { close(); this.startWorld(w); } });
    items.push({ label: '＋ Nouveau monde', sub: S.worlds.length >= 3 ? 'Trois mondes maximum : supprimes-en un d’abord' : 'Prairies, archipel, montagnes ou monde plat', disabled: () => S.worlds.length >= 3, act: () => { close(); this.openNewWorld(); } });
    items.push({ label: '🏆 Défis', sub: `${this.doneCount()} / ${QUESTS.length} réussis`, act: () => { close(); this.openQuests(() => this.openTitle()); } });
    items.push({ label: '🧩 Mods', sub: 'Pouvoirs, véhicule, créatures : active-les en un clic', act: () => { close(); this.openMods(() => this.openTitle()); } });
    items.push({ label: 'Commandes', act: () => this.showControls() });
    if (S.worlds.length) items.push({ label: 'Supprimer un monde', act: async () => { for (const w of [...S.worlds]) { if (await Modal.confirm(`Supprimer « ${w.name} » ?`, 'Toutes les constructions de ce monde seront perdues. Cette action est définitive.', { yes: 'Supprimer', no: 'Garder', danger: true })) { S.worlds = S.worlds.filter(x => x !== w); this.save(); close(); this.openTitle(); return; } } } });
    items.push({ label: 'Quitter vers NOVA', cls: 'exit', act: () => { close(); this.exit(); } });
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && Input.pressed('back') && !Modal.active) { close(); this.exit(); } } };
  }
  openNewWorld() {
    const S = this.S, ov = el('div', 'bv-title');
    ov.innerHTML = `<div class="bv-tpanel glass"><div class="gm-kicker">BLOCKVERSE</div><h2 style="font-family:var(--fd);margin:4px 0 12px">Nouveau monde</h2><div class="gm-list"></div><div class="gm-foot">◀ ▶ changer · ${gly('jump')} valider · ${gly('crouch')} retour</div></div>`;
    this.root.appendChild(ov);
    const types = Object.keys(WORLD_TYPES), names = ['Terre de Nova', 'Vallée Verte', 'Île aux Cubes', 'Pic Céleste', 'Plaine Infinie', 'Royaume Carré', 'Baie Cristal', 'Mont Lanterne'];
    const cfg = { name: names[(Math.random() * names.length) | 0], type: 'prairies', mode: 'creatif', seed: (Math.random() * 99999) | 0 };
    const close = () => { ov.remove(); this.ui = null; };
    const items = [
      { label: 'Nom', get: () => cfg.name, act: async () => { const v = await Modal.info('Nom du monde', '<p>Comment s’appelle ton monde ?</p>', { input: true, value: cfg.name, button: 'Valider' }); if (v && v.trim()) { cfg.name = v.trim().slice(0, 22); list.refresh(); } } },
      { label: 'Type', sub: () => WORLD_TYPES[cfg.type].d, get: () => WORLD_TYPES[cfg.type].n, left: () => { cfg.type = types[(types.indexOf(cfg.type) + types.length - 1) % types.length]; }, right: () => { cfg.type = types[(types.indexOf(cfg.type) + 1) % types.length]; } },
      { label: 'Mode', sub: () => cfg.mode === 'survie' ? 'Récolte tes blocs, fabrique, survis aux nuits.' : 'Tous les blocs, vol, aucun danger.', get: () => cfg.mode === 'survie' ? 'Survie' : 'Créatif', left: () => { cfg.mode = cfg.mode === 'survie' ? 'creatif' : 'survie'; }, right: () => { cfg.mode = cfg.mode === 'survie' ? 'creatif' : 'survie'; } },
      { label: 'Graine', sub: 'Chaque graine donne un monde différent', get: () => String(cfg.seed), left: () => { cfg.seed = (Math.random() * 99999) | 0; }, right: () => { cfg.seed = (Math.random() * 99999) | 0; } },
      { label: '✓ Créer le monde', cls: 'warn', act: () => {
        close();
        const w = { id: 'w' + Date.now().toString(36), name: cfg.name, type: cfg.type, mode: cfg.mode, seed: cfg.seed, created: Date.now(), lastPlayed: Date.now(), playTime: 0, edits: '', pos: null, yaw: 0, pitch: 0, time: 0.08, hp: 20, inv: {}, hot: cfg.mode === 'creatif' ? [...HOT_CREA] : [0, 0, 0, 0, 0, 0, 0, 0, 0], slot: 0, day: 1, size: (isTV || lowEnd) ? 112 : 128 };
        S.worlds.push(w); this.stat('worlds', 1); this.save(); this.startWorld(w);
      } },
      { label: 'Retour', cls: 'exit', act: () => { close(); this.openTitle(); } },
    ];
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back')) && !Modal.active) { close(); this.openTitle(); } } };
  }

  /* ================= chargement d'un monde ================= */
  startWorld(w) {
    this.state = 'loading'; this.W = w; this.mode = w.mode; w.lastPlayed = Date.now(); this.S.last = w.id;
    const ld = el('div', 'bv-load', `<div><b>${w.name}</b><i><em></em></i><small>Génération du terrain…</small></div>`); this.root.appendChild(ld); this.loadEl = ld;
    setTimeout(() => {
      if (!this.running) return;
      this.clearWorld();
      const world = this.world = new VoxelWorld({ type: w.type, seed: w.seed, size: w.size || 128 });
      world.applyEdits(w.edits);
      this.queue = []; const nc = Math.ceil(world.W / CH);
      for (let cz = 0; cz < nc; cz++) for (let cx = 0; cx < nc; cx++) this.queue.push([cx, cz]);
      const sp = w.pos || world.spawnPoint(); this.spawn = world.spawnPoint();
      this.queue.sort((a, b) => Math.hypot(a[0] * CH - sp[0], a[1] * CH - sp[2]) - Math.hypot(b[0] * CH - sp[0], b[1] * CH - sp[2]));
      this.qTotal = this.queue.length;
      this.P = { pos: new V3(sp[0], sp[1], sp[2]), vel: new V3(), hw: 0.3, h: 1.8, step: 0, yaw: w.yaw || 0, pitch: w.pitch || 0, hp: w.hp ?? 20, flying: !!w.flying && (w.mode === 'creatif' || this.mod('vol')), riding: false, eye: 1.62, regen: 0, lastHurt: 0, fallStart: sp[1] };
      ld.querySelector('small').textContent = 'Construction des blocs…';
    }, 60);
  }
  clearWorld() {
    for (const c of this.chunks.values()) { for (const m of [c.s, c.w]) if (m) { this.scene.remove(m); m.geometry.dispose(); } }
    this.chunks.clear(); this.dirty.clear();
    for (const m of this.mobs) m.dispose(); this.mobs = []; this.tnt = []; this.meteors && this.meteors.forEach(m => { this.scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); }); this.meteors = [];
    if (this.tntMeshes) this.tntMeshes.forEach(m => { this.scene.remove(m); m.material.dispose(); }); this.tntMeshes = [];
  }
  rebuild(cx, cz) {
    const k = cx + ',' + cz, old = this.chunks.get(k), g = this.world.buildChunk(cx, cz);
    if (old) for (const m of [old.s, old.w]) if (m) { this.scene.remove(m); m.geometry.dispose(); }
    const c = { s: null, w: null };
    if (g.solid) { c.s = new THREE.Mesh(g.solid, this.matS); c.s.matrixAutoUpdate = false; this.scene.add(c.s); }
    if (g.water) { c.w = new THREE.Mesh(g.water, this.matW); c.w.matrixAutoUpdate = false; c.w.renderOrder = 2; this.scene.add(c.w); }
    this.chunks.set(k, c);
  }
  markDirty(x, z, r = 1) {
    const nc = Math.ceil(this.world.W / CH);
    for (let cz = Math.floor((z - r) / CH); cz <= Math.floor((z + r) / CH); cz++) for (let cx = Math.floor((x - r) / CH); cx <= Math.floor((x + r) / CH); cx++) if (cx >= 0 && cz >= 0 && cx < nc && cz < nc) this.dirty.add(cx + ',' + cz);
  }
  updateLoading() {
    const t0 = performance.now();
    while (this.queue && this.queue.length && performance.now() - t0 < 24) { const [cx, cz] = this.queue.shift(); this.rebuild(cx, cz); }
    if (!this.queue) return;
    const p = 1 - this.queue.length / this.qTotal; this.loadEl.querySelector('em').style.width = (p * 100).toFixed(0) + '%';
    if (!this.queue.length) this.enterPlay();
  }
  enterPlay() {
    this.queue = null; this.loadEl.remove(); this.loadEl = null; this.state = 'play'; this.renderer.domElement.style.visibility = '';
    this.hudVisible(true); this.paintTop(); this.paintHot(); this.paintHearts(); this.paintKeys();
    this.applyView(); this.last = performance.now(); this.lastSave = this.time;
    const W = this.W; this.big(W.name, `${WORLD_TYPES[W.type].n} · ${W.mode === 'survie' ? 'Survie' : 'Créatif'}`, 2.2);
    if (!W.pos) setTimeout(() => { if (this.state === 'play') this.toast(W.mode === 'survie' ? 'Survie' : 'Créatif', W.mode === 'survie' ? 'Casse des troncs et fabrique des planches avec le sac.' : 'Double saut pour voler. Ouvre le sac pour choisir tes blocs.'); }, 2600);
    this.spawnT = 0; this.meteorT = 20;
    if (!W.pos) { // regarder vers l'horizon le plus dégagé
      const P = this.P, eye = P.pos.clone().setY(P.pos.y + 1.6); let best = -1;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, d = new V3(-Math.sin(a), -0.05, -Math.cos(a)); const h = this.world.ray(eye, d, 40); const t = h ? h.t : 40; if (t > best) { best = t; P.yaw = a; } }
    }
  }
  applyView() {
    const v = this.S.set.view, far = v === 'court' ? 38 : v === 'moyen' ? 64 : v === 'long' ? 100 : (this.quality === 'low' ? 40 : this.quality === 'medium' ? 64 : 92);
    this.viewFar = far; this.scene.fog.near = far * 0.45; this.scene.fog.far = far; this.camera.far = far + 160; this.camera.updateProjectionMatrix();
  }

  /* ================= progression ================= */
  mod(id) { return this.S.level >= (MODS.find(m => m.id === id) || { lvl: 99 }).lvl && !!this.S.mods[id]; }
  doneCount() { return QUESTS.filter(q => this.S.done[q.id]).length; }
  stat(k, n) {
    const st = this.S.stats; st[k] = (st[k] || 0) + n;
    if (k === 'placed' || k === 'broken') { this._xpAcc = (this._xpAcc || 0) + n; if (this._xpAcc >= 12) { this._xpAcc = 0; this.addXP(1); } }
    this.checkQuests(k);
  }
  checkQuests(k) {
    for (const q of QUESTS) {
      if (this.S.done[q.id] || (k && q.k !== k)) continue;
      const v = q.k === 'kinds' ? this.S.kinds.length : (this.S.stats[q.k] || 0);
      if (v >= q.v) { this.S.done[q.id] = Date.now(); this.toast('🏆 Défi réussi', `${q.n} · +${q.xp} XP`, '#ffd23d'); Sound.sfx('mission'); this.addXP(q.xp); }
    }
  }
  addXP(n) {
    const S = this.S; S.xp += n; let up = false;
    while (S.xp >= LVL_XP(S.level)) { S.xp -= LVL_XP(S.level); S.level++; up = true; }
    if (up) { const un = MODS.filter(m => m.lvl === S.level); this.big(`Niveau ${S.level} !`, un.length ? `Nouveaux mods : ${un.map(m => m.n).join(', ')}` : 'Continue comme ça', 2.6); Sound.sfx('level'); if (this.P) this.bits(this.P.pos.clone().setY(this.P.pos.y + 1.4), 0x7dff8a, 30); }
    if (this.state === 'play') this.paintTop();
  }
  completion() { return Math.min(100, Math.round(this.doneCount() / QUESTS.length * 85 + Math.min(15, this.S.level - 1 + (this.S.worlds.length ? 1 : 0)))); }
  saveWorld() {
    const W = this.W, P = this.P; if (!W || !this.world || this.state !== 'play') return;
    W.edits = this.world.packEdits(); W.pos = [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)]; W.yaw = +P.yaw.toFixed(3); W.pitch = +P.pitch.toFixed(3); W.hp = Math.max(1, Math.round(P.hp)); W.flying = P.flying;
    if (W.edits.length > 600000 && !this._bigWarn) { this._bigWarn = true; this.toast('Monde très chargé', 'Tant de modifications ! La sauvegarde devient lourde.', '#ff8a3d'); }
    this.save();
  }
  save() {
    const S = this.S, W = S.worlds.find(w => w.id === S.last) || S.worlds[0], d = this.doneCount(), act = MODS.filter(m => this.mod(m.id)).length;
    Store.setGame('blockverse', { state: JSON.parse(JSON.stringify(S)), summary: { level: S.level, completion: this.completion(), playTime: S.playTime, line: `Niveau ${S.level} · ${d}/${QUESTS.length} défis · ${S.worlds.length} monde${S.worlds.length > 1 ? 's' : ''}`,
      cards: [['Reprendre', W ? W.name : 'Crée un monde', W ? `${WORLD_TYPES[W.type].n} · ${W.mode === 'survie' ? 'Survie' : 'Créatif'}` : 'Prairies, archipel, montagnes…'], ['Défis', `${d} / ${QUESTS.length}`, 'Chaque niveau débloque des mods', d / QUESTS.length], ['Blocs posés', (S.stats.placed || 0).toLocaleString('fr-FR'), `${(S.stats.broken || 0).toLocaleString('fr-FR')} cassés`], ['Mods actifs', `${act} / ${MODS.length}`, `${MODS.filter(m => S.level >= m.lvl).length} débloqués`]] } });
    this.lastSave = this.time;
  }

  /* ================= inventaire ================= */
  count(id) { return this.W.mode === 'creatif' ? 99 : (this.W.inv[id] || 0); }
  give(id, n) {
    const W = this.W; if (W.mode === 'creatif') return;
    W.inv[id] = (W.inv[id] || 0) + n; if (W.inv[id] <= 0) delete W.inv[id];
    if (n > 0 && !W.hot.includes(id)) { const e = W.hot.indexOf(0); if (e >= 0) W.hot[e] = id; }
    if (n < 0 && !W.inv[id]) { /* garde la case, affichée vide */ }
    this.paintHot();
  }
  openInventory(tab = 'blocks') {
    this.exitLock();
    const W = this.W, surv = W.mode === 'survie', ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="gmenu-panel glass bv-inv"><div class="gm-kicker">BLOCKVERSE · ${surv ? 'SAC' : 'TOUS LES BLOCS'}</div><div class="bv-tabs"></div><div class="bv-body"></div><div class="bv-sel"></div><div class="bv-invhot"></div><div class="gm-foot"></div></div>`;
    this.root.appendChild(ov);
    const st = { tab, zone: 'grid', f: 0 }, cols = innerWidth < 640 ? 6 : 8;
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); this.paintHot(); };
    const tabs = surv ? [['blocks', 'Blocs'], ['craft', 'Fabrication']] : [['blocks', 'Blocs']];
    let ids = [], list = null, conc = 17;
    const paintHotMini = () => { ov.querySelector('.bv-invhot').innerHTML = W.hot.map((id, i) => `<div class="bv-slot${i === W.slot ? ' on' : ''}" data-i="${i}">${id ? `<img src="${blockIcon(id, 64)}">${surv ? `<b>${this.count(id)}</b>` : ''}` : ''}</div>`).join(''); ov.querySelectorAll('.bv-invhot .bv-slot').forEach(s => s.addEventListener('click', () => { W.slot = +s.dataset.i; paintHotMini(); })); };
    const paintFoot = () => { ov.querySelector('.gm-foot').innerHTML = st.tab === 'blocks' ? `Flèches : choisir · ${gly('jump')} mettre dans la case ${W.slot + 1} · ${gly('next')} / ${gly('prev')} changer de case · ${gly('crouch')} fermer` : `${gly('jump')} fabriquer · ◀ ▶ couleur du béton · ${gly('crouch')} fermer`; };
    const render = () => {
      ov.querySelector('.bv-tabs').innerHTML = tabs.length > 1 ? tabs.map(([k, n]) => `<div class="bv-tab${st.tab === k ? ' on' : ''}${st.zone === 'tabs' && st.tab === k ? ' focus' : ''}" data-k="${k}">${n}</div>`).join('') : '';
      ov.querySelectorAll('.bv-tab').forEach(t => t.addEventListener('click', () => { st.tab = t.dataset.k; st.zone = 'grid'; st.f = 0; render(); }));
      const body = ov.querySelector('.bv-body');
      if (st.tab === 'blocks') {
        ids = surv ? PALETTE.filter(id => W.inv[id] > 0) : [...PALETTE];
        body.innerHTML = ids.length ? `<div class="bv-grid" style="--cols:${cols}">${ids.map((id, i) => `<div class="bv-cell${st.zone === 'grid' && i === st.f ? ' focus' : ''}" data-i="${i}"><img src="${blockIcon(id, 64)}">${surv ? `<b>${W.inv[id]}</b>` : ''}</div>`).join('')}</div>` : '<p style="color:var(--mut)">Ton sac est vide. Casse des blocs pour les récolter !</p>';
        body.querySelectorAll('.bv-cell').forEach(c => c.addEventListener('click', () => { st.f = +c.dataset.i; st.zone = 'grid'; pick(); }));
        const id = ids[st.f]; ov.querySelector('.bv-sel').textContent = id && st.zone === 'grid' ? BLOCKS[id].n : '';
        list = null;
      } else {
        body.innerHTML = '<div class="gm-list" style="max-height:46vh"></div>';
        const items = RECIPES.map(r => {
          const outId = () => r.out === 'conc' ? conc : r.out;
          const can = () => r.in.every(([i, n]) => (W.inv[i] || 0) >= n);
          return { label: `<img class="bv-ico" src="${blockIcon(r.out === 'conc' ? 18 : r.out, 64)}"> ${r.out === 'conc' ? 'Béton coloré' : BLOCKS[r.out].n} ×${r.n}`, sub: () => r.in.map(([i, n]) => `${BLOCKS[i].n} ×${n} <span style="opacity:.6">(${W.inv[i] || 0})</span>`).join(' + '),
            get: () => r.out === 'conc' ? `<span class="ck-sw" style="display:inline-block;width:18px;height:18px;border-radius:5px;background:${BLOCKS[conc].col};vertical-align:-4px"></span> ${BLOCKS[conc].n.replace('Béton ', '')}` : (can() ? '<b style="color:#7dff8a">Possible</b>' : ''),
            left: r.out === 'conc' ? () => { conc = conc <= 18 ? 24 : conc - 1; } : null, right: r.out === 'conc' ? () => { conc = conc >= 24 ? 18 : conc + 1; } : null,
            disabled: () => !can(),
            act: () => { if (!can()) return; for (const [i, n] of r.in) this.give(i, -n); this.give(outId(), r.n); this.stat('crafted', 1); Sound.sfx('coin'); this.toast('Fabriqué', `${BLOCKS[outId()].n} ×${r.n}`); paintHotMini(); } };
        });
        list = new ListMenu(body.querySelector('.gm-list'), items);
        ov.querySelector('.bv-sel').textContent = '';
      }
      paintHotMini(); paintFoot();
    };
    const pick = () => { const id = ids[st.f]; if (!id) return; W.hot[W.slot] = id; Sound.sfx('select'); paintHotMini(); this.setHand(); ov.querySelector('.bv-sel').textContent = `${BLOCKS[id].n} → case ${W.slot + 1}`; };
    render();
    this.ui = {
      update: nav => {
        if (Input.pressed('next') || Input.pressed('prev')) { W.slot = (W.slot + (Input.pressed('next') ? 1 : 8)) % 9; paintHotMini(); paintFoot(); }
        if (Input.cur.digit) { W.slot = Input.cur.digit - 1; paintHotMini(); paintFoot(); }
        if (st.zone === 'tabs') {
          if (nav === 'left' || nav === 'right') { const i = tabs.findIndex(t => t[0] === st.tab); st.tab = tabs[(i + (nav === 'right' ? 1 : tabs.length - 1)) % tabs.length][0]; Sound.sfx('move'); render(); }
          if (nav === 'down' || Input.pressed('confirm')) { st.zone = 'grid'; st.f = 0; render(); }
        } else if (st.tab === 'blocks') {
          const n = ids.length;
          if (nav === 'left' && st.f > 0) st.f--; else if (nav === 'right' && st.f < n - 1) st.f++;
          else if (nav === 'down' && st.f + cols < n) st.f += cols;
          else if (nav === 'up') { if (st.f - cols >= 0) st.f -= cols; else if (tabs.length > 1) st.zone = 'tabs'; }
          if (nav) { Sound.sfx('move'); render(); const c = ov.querySelector('.bv-cell.focus'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
          if (Input.pressed('confirm') && st.zone === 'grid') pick();
        } else if (list) {
          if (nav === 'up' && list.focus === 0) { st.zone = 'tabs'; render(); }
          else list.update(nav);
        }
        if (this.ui && (Input.pressed('back') || Input.pressed('inv') || Input.pressed('pause'))) close();
      },
    };
  }
  openMods(back) {
    this.exitLock();
    const S = this.S, ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">BLOCKVERSE · MODS INTÉGRÉS</div><h2>Mods</h2><div class="gm-list"></div><div class="gm-foot">${gly('jump')} ou ◀ ▶ activer / couper · ${gly('crouch')} fermer · Niveau ${S.level}</div></div>`;
    this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); if (this.state === 'play') { this.paintKeys(); if (!this.mod('glisseur') && this.P.riding) this.ride(false); } back && back(); };
    const tog = m => { if (S.level < m.lvl) { Sound.sfx('fizzle'); this.toast('Mod verrouillé', `Disponible au niveau ${m.lvl}`, '#ff8a3d'); return; } S.mods[m.id] = !S.mods[m.id]; this.save(); };
    const items = MODS.map(m => ({ label: `${m.ico} ${m.n}`, sub: m.d, get: () => S.level < m.lvl ? `<span class="ck-lock" style="color:#ffb36b">🔒 niv. ${m.lvl}</span>` : S.mods[m.id] ? '<b style="color:#7dff8a">Activé</b>' : 'Coupé', act: () => tog(m), left: () => tog(m), right: () => tog(m) }));
    items.push({ label: 'Fermer', cls: 'exit', act: close });
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause') || (this.state === 'play' && Input.pressed('journal')))) close(); } };
  }
  openQuests(back) {
    this.exitLock();
    const S = this.S, ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">BLOCKVERSE · DÉFIS</div><h2>${this.doneCount()} / ${QUESTS.length} réussis</h2><div class="gm-list"></div><div class="gm-foot">${gly('crouch')} fermer · Les défis donnent de l’XP, les niveaux débloquent des mods</div></div>`;
    this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); back && back(); };
    const items = QUESTS.map(q => { const v = q.k === 'kinds' ? S.kinds.length : (S.stats[q.k] || 0), p = Math.min(1, v / q.v); return { label: `${S.done[q.id] ? '✅' : '⬜'} ${q.n}`, sub: `${q.d} · +${q.xp} XP`, get: () => S.done[q.id] ? '<b style="color:#7dff8a">Réussi</b>' : `${Math.min(q.v, Math.floor(v))} / ${q.v}<span class="bv-qbar"><i style="width:${p * 100}%"></i></span>` }; });
    items.push({ label: 'Fermer', cls: 'exit', act: close });
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  openPause() {
    if (this.ui) return; this.exitLock(); this.saveWorld();
    const S = Store.settings, ov = el('div', 'gmenu'), W = this.W;
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">BLOCKVERSE · ${W.name.toUpperCase()}</div><h2>Pause</h2><div class="gm-list"></div><div class="gm-foot">${Store.cloud === 'on' ? '☁ Sauvegarde synchronisée' : '💾 Sauvegarde locale'} · Niveau ${this.S.level} · Jour ${W.day || 1} · ${fmtDuration(W.playTime)}</div></div>`; this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); };
    const num = (k, step, min, max, fmt, after) => ({ get: () => fmt(S[k]), left: () => { S[k] = Math.max(min, +(S[k] - step).toFixed(2)); after && after(); Store.touch(); }, right: () => { S[k] = Math.min(max, +(S[k] + step).toFixed(2)); after && after(); Store.touch(); } });
    const tg = k => ({ get: () => S[k] ? 'Oui' : 'Non', left: () => { S[k] = !S[k]; Store.touch(); }, right: () => { S[k] = !S[k]; Store.touch(); } });
    const views = ['auto', 'court', 'moyen', 'long'], vn = { auto: 'Auto', court: 'Courte', moyen: 'Moyenne', long: 'Longue' }, ss = this.S.set;
    const items = [
      { label: 'Reprendre', act: close },
      { label: W.mode === 'survie' ? 'Sac & fabrication' : 'Tous les blocs', act: () => { close(); this.openInventory(); } },
      { label: '🧩 Mods', act: () => { close(); this.openMods(); } },
      { label: '🏆 Défis', sub: `${this.doneCount()} / ${QUESTS.length}`, act: () => { close(); this.openQuests(); } },
      { label: 'Commandes', act: () => this.showControls() },
      { label: 'Distance de vue', sub: 'Plus courte = plus fluide sur la télé', get: () => vn[ss.view], left: () => { ss.view = views[(views.indexOf(ss.view) + 3) % 4]; this.applyView(); }, right: () => { ss.view = views[(views.indexOf(ss.view) + 1) % 4]; this.applyView(); } },
      { label: 'Montée automatique des marches', get: () => ss.autostep ? 'Oui' : 'Non', left: () => { ss.autostep = !ss.autostep; }, right: () => { ss.autostep = !ss.autostep; } },
      { label: 'Sensibilité caméra', ...num('sens', 0.1, 0.3, 3, v => v.toFixed(1)) }, { label: 'Inverser l’axe vertical', ...tg('invertY') },
      { label: 'Musique', ...num('music', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) }, { label: 'Effets sonores', ...num('sfx', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) }, { label: 'Vibrations', ...tg('rumble') },
      { label: 'Revenir au point de départ', act: () => { close(); this.respawn(false); } },
      { label: 'Sauvegarder et changer de monde', cls: 'exit', act: () => { close(); this.saveWorld(); this.leaveWorld(); this.openTitle(); } },
      { label: 'Sauvegarder et quitter vers NOVA', cls: 'exit', act: () => { close(); this.exit(); } },
    ];
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  leaveWorld() { this.state = 'title'; this.clearWorld(); this.world = null; this.W = null; this.handId = -1; this.ride(false, true); this.prompt(''); }
  showControls() {
    Modal.info('Commandes · BLOCKVERSE', `<div class="ctrl-grid"><div><h4>Manette PS5</h4><ul><li><b>Joystick gauche</b> bouger · <b>L3</b> sprint</li><li><b>Joystick droit</b> regarder</li><li><b>✕</b> sauter · deux fois pour voler</li><li><b>R2</b> casser · <b>L2</b> poser</li><li><b>R1 / L1</b> changer de bloc</li><li><b>△</b> interagir (dynamite, glisseur)</li><li><b>▢</b> sac & fabrication · <b>○</b> descendre / s’accroupir</li><li><b>Pavé</b> mods · <b>Options</b> pause</li></ul></div><div><h4>Clavier & souris</h4><ul><li><b>ZQSD / WASD</b> bouger · <b>Maj</b> sprint</li><li><b>Souris</b> regarder (clique pour verrouiller)</li><li><b>Espace</b> sauter · deux fois pour voler</li><li><b>Clic gauche / F</b> casser · <b>Clic droit / ${Input.keyName('KeyQ')}</b> poser</li><li><b>Molette / 1-9</b> choisir un bloc</li><li><b>E / R</b> interagir · <b>C</b> descendre</li><li><b>I / Tab</b> sac · <b>M</b> mods · <b>Échap</b> pause</li></ul></div><div><h4>Tactile</h4><ul><li>Joystick à gauche, glisser à droite pour regarder</li><li>CASSER (maintenir) · POSER</li><li>Touche une case en haut pour choisir le bloc</li><li>SAC, MODS et pause en haut</li></ul></div></div>`, { button: 'Compris' });
  }

  /* ================= actions ================= */
  sfx(n, pos) {
    let vol = 1; if (pos && this.P) { const d = pos.distanceTo(this.P.pos); if (d > 30) return; vol = clamp(1.2 - d / 30, 0.15, 1); }
    switch (n) {
      case 'break': Sound.noise(0.16, { vol: 0.16 * vol, freq: 1400, to: 300 }); Sound.tone(180, 0.08, { type: 'square', vol: 0.04 * vol, to: 90 }); break;
      case 'dig': Sound.noise(0.06, { vol: 0.07 * vol, freq: 900, type: 'bandpass' }); break;
      case 'place': Sound.tone(240, 0.06, { type: 'square', vol: 0.05 * vol }); Sound.noise(0.07, { vol: 0.1 * vol, freq: 1100 }); break;
      case 'step': Sound.noise(0.05, { vol: 0.035 * vol, freq: 700 }); break;
      case 'hit': Sound.sfx('hit'); break;
      case 'slime': Sound.tone(160, 0.12, { type: 'sine', vol: 0.06 * vol, to: 320 }); break;
      case 'poof': Sound.noise(0.3, { vol: 0.15 * vol, freq: 2500, to: 400, type: 'bandpass' }); Sound.tone(900, 0.2, { vol: 0.05 * vol, to: 300 }); break;
      case 'fuse': Sound.noise(0.5, { vol: 0.06 * vol, freq: 5000, type: 'highpass' }); break;
      case 'boom': Sound.noise(0.9, { vol: 0.4 * vol, freq: 1600, to: 50 }); Sound.tone(60, 0.8, { vol: 0.35 * vol, to: 25 }); break;
      case 'bounce': Sound.tone(300, 0.25, { type: 'sine', vol: 0.1, to: 900 }); break;
      case 'splash': Sound.noise(0.35, { vol: 0.12, freq: 1200, to: 300, type: 'bandpass' }); break;
      default: Sound.sfx(n);
    }
  }
  bits(pos, color, n = 10, spd = 3) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) { const i = this.pI = (this.pI + 1) % this.pN; this.pP.set([pos.x + (Math.random() - 0.5) * 0.6, pos.y + (Math.random() - 0.5) * 0.6, pos.z + (Math.random() - 0.5) * 0.6], i * 3); this.pV.set([(Math.random() - 0.5) * spd, Math.random() * spd * 1.2, (Math.random() - 0.5) * spd], i * 3); this.pL[i] = 0.5 + Math.random() * 0.5; const f = 0.75 + Math.random() * 0.4; this.pC.set([c.r * f, c.g * f, c.b * f], i * 3); }
  }
  setBlock(x, y, z, v) {
    const w = this.world, old = w.get(x, y, z);
    if (!w.set(x, y, z, v)) return false;
    const big = BLOCKS[old].lamp || BLOCKS[v].lamp; this.markDirty(x, z, big ? 8 : 1);
    if (old === B.TNT) this.tnt = this.tnt.filter(t => !(t.x === x && t.y === y && t.z === z));
    return true;
  }
  breakAt(x, y, z, fx = true) {
    const w = this.world, id = w.get(x, y, z); if (!id || id === B.BEDROCK || BLOCKS[id].liq) return false;
    // l'eau voisine remplit le trou
    const wet = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([a, b, c]) => w.get(x + a, y + b, z + c) === B.WATER);
    this.setBlock(x, y, z, wet ? B.WATER : 0);
    if (fx) { this.bits(new V3(x + 0.5, y + 0.5, z + 0.5), BLOCKS[id].col || '#888', 12); this.sfx('break'); }
    this.stat('broken', 1);
    if (this.W.mode === 'survie') { const drop = BLOCKS[id].drop || id; this.give(drop, 1); }
    if (id === B.CRYSTAL) this.stat('crystals', 1);
    return true;
  }
  placeAt(x, y, z, id) {
    const w = this.world, cur = w.get(x, y, z);
    if (!w.inb(x, y, z) || (cur && !BLOCKS[cur].liq) || cur === id) return false;
    if (isSolid(id)) { const P = this.P; const e = { hw: P.hw - 0.02, h: P.h - 0.02 }; if (x + 1 > P.pos.x - e.hw && x < P.pos.x + e.hw && z + 1 > P.pos.z - e.hw && z < P.pos.z + e.hw && y + 1 > P.pos.y && y < P.pos.y + e.h) return false; for (const m of this.mobs) if (x + 1 > m.pos.x - m.hw && x < m.pos.x + m.hw && z + 1 > m.pos.z - m.hw && z < m.pos.z + m.hw && y + 1 > m.pos.y && y < m.pos.y + m.h) return false; }
    this.setBlock(x, y, z, id);
    this.stat('placed', 1); if (!this.S.kinds.includes(id)) { this.S.kinds.push(id); this.checkQuests('kinds'); }
    if (id === B.LANTERN) this.stat('lanterns', 1);
    return true;
  }
  light(x, y, z, fuse = 3) {
    if (this.tnt.some(t => t.x === x && t.y === y && t.z === z)) return;
    const m = new THREE.Mesh(this.crack.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.position.set(x + 0.5, y + 0.5, z + 0.5); this.scene.add(m); this.tntMeshes.push(m);
    this.tnt.push({ x, y, z, t: fuse, m }); this.sfx('fuse', new V3(x, y, z));
  }
  explode(cx, cy, cz, r, crystal = false) {
    const w = this.world, R = Math.ceil(r), c = new V3(cx, cy, cz);
    let n = 0;
    for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) {
      if (x * x + y * y + z * z > r * r + Math.random() * r) continue;
      const X = Math.floor(cx) + x, Y = Math.floor(cy) + y, Z = Math.floor(cz) + z, id = w.get(X, Y, Z);
      if (!id || id === B.BEDROCK || BLOCKS[id].liq) continue;
      if (id === B.TNT) { this.light(X, Y, Z, 0.3 + Math.random() * 0.5); continue; }
      w.set(X, Y, Z, 0); n++; if (n % 6 === 0) this.bits(new V3(X + 0.5, Y + 0.5, Z + 0.5), BLOCKS[id].col || '#888', 2, 8);
    }
    if (crystal) { const X = Math.floor(cx), Z = Math.floor(cz); let Y = Math.floor(cy) - R; while (Y < w.H - 1 && w.get(X, Y, Z) && isSolid(w.get(X, Y, Z))) Y++; if (w.inb(X, Y, Z)) w.set(X, Y, Z, B.CRYSTAL); }
    this.markDirty(cx, cz, R + 8);
    this.bits(c, 0xffb23d, 30, 10); this.bits(c, 0x555555, 20, 6); this.sfx('boom', c);
    const P = this.P, d = P.pos.clone().setY(P.pos.y + 0.9).distanceTo(c);
    if (d < r * 2.2) { const k = 1 - d / (r * 2.2); const dir = P.pos.clone().sub(c).setY(0).normalize(); P.vel.addScaledVector(dir, 14 * k); P.vel.y += 8 * k; this.shake = 0.6 * k + 0.2; Input.rumble(0.9 * k + 0.1, 0.8 * k, 400); if (this.W.mode === 'survie') this.hurt(Math.round(14 * k), null); }
    for (const m of this.mobs) { const dm = m.pos.distanceTo(c); if (dm < r * 1.8) { if (m.kind === 'ombre') { m.hp = 0; m.hit(this, m.pos.clone().sub(c).normalize()); } else { m.vel.y = 8; m.flee = 5; } } }
  }
  hurt(n, from) {
    const P = this.P; if (this.W.mode !== 'survie' || P.hp <= 0 || n <= 0) return;
    P.hp -= n; P.lastHurt = this.time; this.hud.hurtEl.style.opacity = 1; setTimeout(() => this.hud.hurtEl.style.opacity = 0, 250);
    Sound.sfx('hurt'); Input.rumble(0.7, 0.5, 200); this.nightClean = false;
    if (from) { const dir = P.pos.clone().sub(from).setY(0).normalize(); P.vel.addScaledVector(dir, 7); P.vel.y = 5; }
    this.paintHearts();
    if (P.hp <= 0) { this.big('Tu es tombé !', 'Retour au point de départ, ton sac est intact', 2.6); Sound.sfx('fail'); setTimeout(() => { if (this.state === 'play') this.respawn(true); }, 1200); }
  }
  respawn(dead) { const P = this.P, s = this.world.spawnPoint(); P.pos.set(s[0], s[1], s[2]); P.vel.set(0, 0, 0); if (dead) P.hp = 20; P.fallStart = s[1]; this.paintHearts(); if (P.riding) this.ride(false); }
  ride(on, silent) {
    const P = this.P; if (!P) return; P.riding = on; this.board.visible = on;
    if (on) { P.flying = false; P.vel.y = 4; if (!silent) { this.sfx('place'); this.toast('Glisseur', `${gly('act')} pour descendre · ${gly('jump')} pour bondir`); } }
  }

  /* ================= boucle de jeu ================= */
  updatePlay(dt) {
    const P = this.P, W = this.W, w = this.world, I = Input, set = Store.settings;
    W.playTime += dt;
    // temps
    if (this.mod('jour')) W.time = damp(W.time, 0.25, 0.5, dt); else { const before = W.time; W.time = (W.time + dt / DAY_LEN) % 1; if (before > W.time) { W.day = (W.day || 1) + 1; } }
    const sunH = Math.sin(W.time * Math.PI * 2), night = sunH < -0.05;
    if (W.mode === 'survie') { if (night && !this.wasNight) this.nightClean = P.hp > 0; if (!night && this.wasNight && this.nightClean) { this.stat('nights', 1); this.toast('Nuit survécue', 'Le soleil se lève !', '#ffd23d'); } }
    this.wasNight = night;
    // regard
    const lk = I.consumeLook(), sens = set.sens, inv = set.invertY ? -1 : 1;
    P.yaw -= (lk.x * 0.0024 + I.ax.lx * dt * 2.7) * sens; P.pitch -= (lk.y * 0.0024 + I.ax.ly * dt * 2.1) * sens * inv; P.pitch = clamp(P.pitch, -1.55, 1.55);
    // hotbar
    if (I.pressed('next')) this.selectSlot(W.slot + 1); if (I.pressed('prev')) this.selectSlot(W.slot - 1); if (I.cur.digit && I.cur.digit - 1 !== W.slot) this.selectSlot(I.cur.digit - 1);
    // déplacement
    const canFly = W.mode === 'creatif' || this.mod('vol');
    if (!canFly) P.flying = false;
    if (I.pressed('jump')) { if (canFly && !P.riding && this.time - (this._jt || 0) < 0.32) { P.flying = !P.flying; P.vel.y = 0; this.toast(P.flying ? 'Vol activé' : 'Vol coupé', P.flying ? `${gly('jump')} monter · ${gly('crouch')} descendre` : '', '#8fd0ff'); this._jt = 0; } else this._jt = this.time; }
    const feet = w.get(Math.floor(P.pos.x), Math.floor(P.pos.y - 0.05), Math.floor(P.pos.z));
    const inW = BLOCKS[entityInBlock(w, P, 0.35)].liq, headW = BLOCKS[w.get(Math.floor(P.pos.x), Math.floor(P.pos.y + P.eye), Math.floor(P.pos.z))].liq;
    const crouch = I.down('crouch') && !P.flying && !P.riding;
    let sp = P.riding ? (I.down('sprint') ? 21 : 15) : P.flying ? (I.down('sprint') ? 20 : 10.5) : inW ? 2.8 : crouch ? 1.9 : I.down('sprint') ? 6.4 : 4.6;
    if (this.mod('sprint') && !P.riding) sp *= 1.7;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tx = (fx * I.ax.my + rx * I.ax.mx) * sp, tz = (fz * I.ax.my + rz * I.ax.mx) * sp;
    const acc = P.flying ? 7 : P.riding ? 5 : !P.wasGround ? 3 : feet === B.ICE ? 1.6 : 14;
    P.vel.x = damp(P.vel.x, tx, acc, dt); P.vel.z = damp(P.vel.z, tz, acc, dt);
    const g = (this.mod('lune') ? 9 : 27) * (P.riding ? 0.7 : 1);
    if (P.flying) { const vy = (I.down('jump') ? 1 : 0) - (I.down('crouch') ? 1 : 0); P.vel.y = damp(P.vel.y, vy * 9, 10, dt); }
    else if (inW) { P.vel.y -= g * 0.22 * dt; P.vel.y = Math.max(P.vel.y, -3); if (I.down('jump')) P.vel.y = Math.min(P.vel.y + 22 * dt, 3.6); }
    else { P.vel.y -= g * dt; if (P.vel.y < -40) P.vel.y = -40; if (I.down('jump') && P.wasGround) { P.vel.y = this.mod('saut') ? 12.5 : P.riding ? 9 : 8.4; this.sfx('step'); } }
    P.step = P.riding ? 2 : (this.S.set.autostep && !P.flying ? 1 : 0);
    const prev = P.pos.clone();
    moveEntity(w, P, dt);
    if (P.stepped) P.eyeOff = (P.eyeOff || 0) - P.stepped;
    P.eyeOff = damp(P.eyeOff || 0, 0, 14, dt);
    if (P.flying && P.onGround && !I.down('jump')) P.flying = false;
    // atterrissage / rebond / chute
    if (P.onGround) {
      const under = w.get(Math.floor(P.pos.x), Math.floor(P.pos.y - 0.05), Math.floor(P.pos.z));
      if (under === B.BOUNCE && (P.landV || 0) < -2) { P.vel.y = Math.min(22, Math.max(13, -P.landV * 0.92)); this.stat('bounces', 1); this.sfx('bounce'); P.fallStart = P.pos.y; P.landV = 0; }
      else { const fall = P.fallStart - P.pos.y; if (fall > 4.5 && W.mode === 'survie' && !this.mod('lune') && !inW && !P.riding) this.hurt(Math.round((fall - 3.5) * 1.6), null); if (fall > 2.5) { this.sfx('step'); Input.rumble(0.25, 0.2, 70); } P.fallStart = P.pos.y; }
      P.landV = 0;
    }
    if (P.onGround || P.flying || inW || P.riding) P.fallStart = P.pos.y; else P.fallStart = Math.max(P.fallStart, P.pos.y);
    if (inW && !this._inW) this.sfx('splash'); this._inW = inW;
    // stats de déplacement
    const moved = Math.hypot(P.pos.x - prev.x, P.pos.z - prev.z);
    if (moved < 2) { if (P.riding) this.stat('ride', moved); else if (inW) this.stat('swim', moved); else if (P.onGround) { this.stat('walk', moved); this._stepAcc = (this._stepAcc || 0) + moved; if (this._stepAcc > 2.1) { this._stepAcc = 0; this.sfx('step'); } } }
    if (P.pos.y < 12 && !this.S.stats.deep) this.stat('deep', 1);
    if (P.pos.y >= 58 && !this.S.stats.high) this.stat('high', 1);
    if (P.pos.y < -12) { this.hurt(6, null); this.respawn(false); }
    // régénération
    if (W.mode === 'survie' && P.hp > 0 && P.hp < 20 && this.time - P.lastHurt > 5) { P.regen += dt; if (P.regen > 3) { P.regen = 0; P.hp = Math.min(20, P.hp + 1); this.paintHearts(); } }
    // caméra
    const eyeH = crouch ? 1.35 : 1.62; P.eye = damp(P.eye, eyeH, 12, dt);
    const bob = P.onGround && !P.flying ? Math.sin(this.time * 9) * Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 6) * 0.035 : 0;
    this.shake = Math.max(0, (this.shake || 0) - dt);
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.4 : 0;
    this.camera.position.set(P.pos.x + sh, P.pos.y + P.eye + (P.eyeOff || 0) + bob + (P.riding ? 0.25 : 0), P.pos.z + sh);
    this.camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    const fovT = (I.down('sprint') && Math.hypot(P.vel.x, P.vel.z) > 5) || P.riding ? 80 : 72; if (Math.abs(this.camera.fov - fovT) > 0.1) { this.camera.fov = damp(this.camera.fov, fovT, 8, dt); this.camera.updateProjectionMatrix(); }
    if (P.riding) { this.board.position.set(P.pos.x, P.pos.y + 0.12 + Math.sin(this.time * 3) * 0.04, P.pos.z); this.board.rotation.y = P.yaw; }
    this.hud.water.style.display = headW ? 'block' : 'none';
    // visée & interactions
    this.interact(dt);
    // créatures, dynamite, météores
    this.updateMobs(dt, night);
    this.updateTNT(dt);
    this.updateMeteors(dt);
    // ciel
    this.updateSky(sunH, headW, dt);
    // HUD
    const hh = Math.floor((W.time * 24 + 6) % 24), mm = Math.floor(((W.time * 24 + 6) % 1) * 60);
    const clk = `${night ? '☾' : '☀'} Jour ${W.day || 1} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; if (this.hud.clock._v !== clk) { this.hud.clock._v = clk; this.hud.clock.textContent = clk; }
    const co = `X ${Math.floor(P.pos.x)} · Y ${Math.floor(P.pos.y)} · Z ${Math.floor(P.pos.z)}${P.flying ? ' · vol' : ''}`; if (this.hud.coord._v !== co) { this.hud.coord._v = co; this.hud.coord.textContent = co; }
    // reconstruction des tronçons modifiés
    let n = 0; for (const k of this.dirty) { const [cx, cz] = k.split(',').map(Number); this.rebuild(cx, cz); this.dirty.delete(k); if (++n >= 4) break; }
    if (this.time - (this.lastSave || 0) > 45) this.saveWorld();
  }
  interact(dt) {
    const P = this.P, W = this.W, w = this.world, I = Input, cam = this.camera;
    const dir = new V3(0, 0, -1).applyQuaternion(cam.quaternion), eye = cam.position.clone();
    const reach = (W.mode === 'creatif' ? 7 : 5.5) * (this.mod('portee') ? 2 : 1);
    const hit = w.ray(eye, dir, reach);
    // créature visée ?
    let mob = null, md = hit ? hit.t : reach;
    for (const m of this.mobs) { const t = rayBox(eye, dir, m.pos.x - m.hw, m.pos.y, m.pos.z - m.hw, m.pos.x + m.hw, m.pos.y + m.h, m.pos.z + m.hw); if (t != null && t < md) { md = t; mob = m; } }
    const brk = I.down('use') || I.keys.has('KeyF'), plc = I.down('alt') || I.keys.has('KeyQ');
    const brkP = brk && !this._brkPrev, plcP = plc && !this._plcPrev;
    this._brkPrev = brk; this._plcPrev = plc;
    this.handSwing = Math.max(0, (this.handSwing || 0) - dt * 4);
    // contour
    if (hit && !mob) { this.sel.visible = true; this.sel.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); } else this.sel.visible = false;
    // invite
    let pr = '';
    if (hit && hit.id === B.TNT && !mob) pr = `${gly('act')} Allumer la dynamite`;
    else if (this.mod('glisseur')) pr = P.riding ? '' : `${gly('act')} Sortir le glisseur`;
    if (mob && mob.kind !== 'ombre') pr = `${gly('act')} Caresser le ${BOT_FEEL[mob.kind].n}`;
    this.prompt(pr);
    if (I.pressed('act') || I.pressed('interact')) {
      if (mob && mob.kind !== 'ombre') { this.bits(mob.pos.clone().setY(mob.pos.y + 1.1), 0xff7ac8, 6, 1.5); mob.think = 3; mob.walk = false; Sound.sfx('ring'); }
      else if (hit && hit.id === B.TNT) this.light(hit.x, hit.y, hit.z);
      else if (this.mod('glisseur')) this.ride(!P.riding);
    }
    // casser
    this.cd = Math.max(0, (this.cd || 0) - dt);
    if (brk && mob && (brkP || this.cd <= 0)) { mob.hit(this, dir.clone().setY(0).normalize()); this.cd = 0.4; this.handSwing = 1; this.breakT = 0; }
    else if (brk && hit) {
      const key = hit.x + ',' + hit.y + ',' + hit.z;
      if (key !== this.breakKey) { this.breakKey = key; this.breakT = 0; }
      if (W.mode === 'creatif') {
        if (brkP || this.cd <= 0) { this.cd = 0.22; this.handSwing = 1;
          if (this.mod('pinceau')) { let any = false; for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) any = this.breakAt(hit.x + x, hit.y + y, hit.z + z, false) || any; if (any) { this.bits(new V3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), BLOCKS[hit.id].col, 20, 5); this.sfx('break'); } }
          else this.breakAt(hit.x, hit.y, hit.z);
        }
        this.hud.ring.style.display = 'none';
      } else {
        const hard = BLOCKS[hit.id].hard;
        if (hard > 1e6) { this.hud.ring.style.display = 'none'; }
        else {
          this.breakT += dt / Math.max(0.12, hard); this.handSwing = Math.max(this.handSwing, 0.6 + Math.sin(this.time * 18) * 0.4);
          if ((this._digT = (this._digT || 0) + dt) > 0.22) { this._digT = 0; this.sfx('dig'); this.bits(new V3(hit.x + 0.5 + hit.n[0] * 0.5, hit.y + 0.5 + hit.n[1] * 0.5, hit.z + 0.5 + hit.n[2] * 0.5), BLOCKS[hit.id].col, 2, 1.5); }
          this.hud.ring.style.display = 'block'; this.hud.ring.style.setProperty('--p', Math.min(100, this.breakT * 100) + '%');
          this.crack.visible = true; this.crack.position.copy(this.sel.position); this.crack.material.opacity = Math.min(0.5, this.breakT * 0.5);
          if (this.breakT >= 1) { this.breakAt(hit.x, hit.y, hit.z); this.breakT = 0; this.breakKey = null; }
        }
      }
    } else { this.breakT = 0; this.breakKey = null; this.hud.ring.style.display = 'none'; }
    if (!brk || !hit || W.mode === 'creatif') this.crack.visible = false;
    // poser
    if (plc && hit && (plcP || this.pcd <= 0)) {
      this.pcd = 0.24; const id = W.hot[W.slot];
      if (!id) { if (plcP) Sound.sfx('fizzle'); }
      else if (W.mode === 'survie' && !(W.inv[id] > 0)) { if (plcP) { Sound.sfx('fizzle'); this.toast('Plus de ' + BLOCKS[id].n, 'Récolte-en ou fabrique-en', '#ff8a3d'); } }
      else {
        const X = hit.x + hit.n[0], Y = hit.y + hit.n[1], Z = hit.z + hit.n[2];
        let ok = false;
        if (W.mode === 'creatif' && this.mod('pinceau')) { const ax = hit.n[0] ? [1, 2] : hit.n[1] ? [0, 2] : [0, 1]; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const p = [X, Y, Z]; p[ax[0]] += a; p[ax[1]] += b; ok = this.placeAt(p[0], p[1], p[2], id) || ok; } }
        else ok = this.placeAt(X, Y, Z, id);
        if (ok) { this.sfx('place'); this.handSwing = 1; if (W.mode === 'survie') this.give(id, -1); Input.rumble(0.15, 0.1, 40); }
      }
    }
    this.pcd = Math.max(0, (this.pcd ?? 0) - dt); if (!plc) this.pcd = 0;
    // main
    const s = Math.sin(this.handSwing * Math.PI);
    this.hand.position.set(0.46 - s * 0.12, -0.42 - s * 0.1 + Math.sin(this.time * 9) * 0.012 * Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 5), -0.75 - s * 0.08);
    this.hand.rotation.set(-s * 0.9, 0, 0);
  }
  updateMobs(dt, night) {
    const P = this.P, w = this.world, W = this.W;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.5;
      for (let i = this.mobs.length - 1; i >= 0; i--) { const m = this.mobs[i]; const far = m.pos.distanceTo(P.pos) > 64; const daylight = m.kind === 'ombre' && (!night || W.mode !== 'survie' || !this.mod('rodeurs')); if (far || (daylight && Math.random() < 0.35)) { if (daylight) { this.bits(m.pos.clone().setY(m.pos.y + 0.5), 0x2a1f3a, 12); } m.dead = true; } if (m.kind !== 'ombre' && !this.mod('familiers')) m.dead = true; }
      const low = this.quality === 'low';
      const nPass = this.mobs.filter(m => m.kind !== 'ombre').length, nHost = this.mobs.length - nPass;
      const at = (r0, r1) => { const a = Math.random() * 6.28, r = r0 + Math.random() * (r1 - r0); const x = Math.floor(P.pos.x + Math.cos(a) * r), z = Math.floor(P.pos.z + Math.sin(a) * r); if (x < 2 || z < 2 || x >= w.W - 2 || z >= w.D - 2) return null; const y = w.surfaceY(x, z); return { x, y, z, b: w.get(x, y, z) }; };
      if (this.mod('familiers') && nPass < (low ? 5 : 9)) { const s = at(14, 34); if (s && (s.b === B.GRASS || s.b === B.SNOW || s.b === B.SAND) && !w.get(s.x, s.y + 1, s.z)) this.mobs.push(new Mob(this, Math.random() < 0.6 ? 'trot' : 'plum', s.x + 0.5, s.y + 1, s.z + 0.5)); }
      if (W.mode === 'survie' && night && this.mod('rodeurs') && nHost < (low ? 3 : 5)) { const s = at(16, 28); if (s && isSolid(s.b) && s.b !== B.LEAVES && s.b !== B.PINE && !w.get(s.x, s.y + 1, s.z)) { this.mobs.push(new Mob(this, 'ombre', s.x + 0.5, s.y + 1, s.z + 0.5)); } }
    }
    const day = this.uDay.value;
    for (const m of this.mobs) { if (!m.dead) { m.update(dt); m.light(day); } }
    for (let i = this.mobs.length - 1; i >= 0; i--) if (this.mobs[i].dead) { this.mobs[i].dispose(); this.mobs.splice(i, 1); }
  }
  updateTNT(dt) {
    for (const t of [...this.tnt]) {
      t.t -= dt; t.m.material.opacity = Math.sin(t.t * 14) > 0 ? 0.6 : 0; t.m.scale.setScalar(1 + Math.max(0, 0.6 - t.t) * 0.25);
      if (t.t <= 0) { this.tnt = this.tnt.filter(x => x !== t); this.scene.remove(t.m); t.m.material.dispose(); this.tntMeshes = this.tntMeshes.filter(x => x !== t.m); if (this.world.get(t.x, t.y, t.z) === B.TNT) { this.world.set(t.x, t.y, t.z, 0); this.explode(t.x + 0.5, t.y + 0.5, t.z + 0.5, this.mod('boum') ? 5.5 : 3.3); this.stat('booms', 1); } }
    }
  }
  updateMeteors(dt) {
    if (!this.mod('meteores')) return;
    this.meteorT -= dt;
    if (this.meteorT <= 0) {
      this.meteorT = 25 + Math.random() * 20; const P = this.P, a = Math.random() * 6.28, r = 14 + Math.random() * 18;
      const x = clamp(P.pos.x + Math.cos(a) * r, 4, this.world.W - 4), z = clamp(P.pos.z + Math.sin(a) * r, 4, this.world.D - 4);
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xffa040, fog: false })); mesh.position.set(x - 30, this.world.H + 40, z - 10); this.scene.add(mesh);
      this.meteors.push({ mesh, tx: x, tz: z, ty: this.world.surfaceY(Math.floor(x), Math.floor(z)) + 1 }); this.toast('☄ Étoile filante', 'Regarde le ciel !', '#ffa040');
    }
    for (const m of [...this.meteors]) {
      const p = m.mesh.position, d = new V3(m.tx - p.x, m.ty - p.y, m.tz - p.z), L = d.length();
      p.addScaledVector(d.normalize(), Math.min(L, dt * 38)); m.mesh.rotation.x += dt * 5;
      if (Math.random() < 0.7) this.bits(p, 0xffc070, 1, 0.5);
      if (L < 0.8) { this.scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); this.meteors = this.meteors.filter(x => x !== m); this.explode(m.tx, m.ty, m.tz, 2.6, true); }
    }
  }
  updateSky(sunH, underwater, dt) {
    const P = this.P, W = this.W, t = W.time;
    const dayK = clamp(sunH * 2.2 + 0.45, 0, 1), dusk = clamp(1 - Math.abs(sunH) * 5, 0, 1);
    const nv = this.mod('nuit') ? 0.75 : 0;
    const sky = new THREE.Color().setRGB(lerp(0.03, 0.53, dayK), lerp(0.04, 0.78, dayK), lerp(0.1, 1, dayK)).lerp(new THREE.Color(1, 0.55, 0.35), dusk * 0.45);
    const L = Math.max(nv, lerp(0.16, 1, dayK));
    this.uDay.value.setRGB(L * (1 + dusk * 0.1), L * (1 - dusk * 0.08), L * (1 - dusk * 0.18) + (1 - dayK) * 0.06);
    if (underwater) { this.scene.background.setRGB(0.08, 0.25, 0.5); this.scene.fog.color.setRGB(0.08, 0.25, 0.5); this.scene.fog.near = 2; this.scene.fog.far = 22; }
    else { this.scene.background.copy(sky); this.scene.fog.color.copy(sky); this.scene.fog.near = this.viewFar * 0.45; this.scene.fog.far = this.viewFar; }
    const a = t * Math.PI * 2, cp = this.camera.position;
    this.sun.position.set(cp.x + Math.cos(a) * 140, cp.y + Math.sin(a) * 140, cp.z + 30); this.sun.lookAt(cp);
    this.moon.position.set(cp.x - Math.cos(a) * 140, cp.y - Math.sin(a) * 140, cp.z - 30); this.moon.lookAt(cp);
    this.stars.position.copy(cp); this.stars.material.opacity = clamp(-sunH * 3, 0, 1); this.stars.rotation.z = a;
    this.cloudMat.color.setScalar(Math.max(0.3, L)); this.cloudMat.opacity = 0.82 * clamp(dayK * 1.4, 0.12, 1); this.clouds.position.set(0, this.world.H + 12, 0);
    for (const c of this.clouds.children) { c.position.x += dt * 0.9; if (c.position.x > this.world.W + 70) c.position.x = -70; }
    for (const m of this.boardMats) if (!m.userData.glow) m.color.setScalar(Math.max(0.3, L) * 0.2 + 0.1);
    this.armMat.color.setRGB(0.92 * L, 0.75 * L, 0.59 * L);
  }
  updateParts(dt) {
    const P = this.pP, V = this.pV, Lf = this.pL;
    for (let i = 0; i < this.pN; i++) { if (Lf[i] <= 0) continue; Lf[i] -= dt; if (Lf[i] <= 0) { P[i * 3 + 1] = -999; continue; } V[i * 3 + 1] -= 14 * dt; P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt; }
    this.parts.geometry.attributes.position.needsUpdate = true; this.parts.geometry.attributes.color.needsUpdate = true;
  }

  /* ================= tactile ================= */
  initTouch() {
    const t = el('div', 'touch');
    t.innerHTML = `<div class="t-look"></div><div class="t-stick"><div class="t-base"><div class="t-knob"></div></div></div>
      <div class="t-btns"><button data-a="jump" class="tb big jump">SAUT</button><button data-a="use" class="tb big swing">CASSER</button><button data-a="act" class="tb atk">△</button><button data-a="alt" class="tb zip">POSER</button><button data-a="crouch" class="tb dash">BAS</button></div>
      <div class="t-top" style="right:auto;left:calc(12px + var(--safe-l))"><button data-a="pause" class="tb sm">❚❚</button><button data-a="inv" class="tb sm">SAC</button><button data-a="journal" class="tb sm">MODS</button></div>`;
    this.root.appendChild(t); this.root.classList.add('has-touch'); const T = Input.touch; this.touchEl = t;
    t.querySelectorAll('.tb').forEach(b => { const a = b.dataset.a; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); T.btn[a] = true; T.tap[a] = true; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (er) {} Sound.unlock(); }); const up = () => { T.btn[a] = false; b.classList.remove('down'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
    const stick = t.querySelector('.t-stick'), base = t.querySelector('.t-base'), knob = t.querySelector('.t-knob'); let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; base.style.left = sx + 'px'; base.style.top = (sy - stick.getBoundingClientRect().top) + 'px'; base.classList.add('on'); try { stick.setPointerCapture(e.pointerId); } catch (er) {} });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - sx, dy = e.clientY - sy; const L = Math.hypot(dx, dy), Mx = 56; if (L > Mx) { dx *= Mx / L; dy *= Mx / L; } knob.style.transform = `translate(${dx}px,${dy}px)`; T.mx = dx / Mx; T.my = -dy / Mx; });
    const send = () => { sid = null; T.mx = T.my = 0; knob.style.transform = ''; base.classList.remove('on'); }; stick.addEventListener('pointerup', send); stick.addEventListener('pointercancel', send);
    const look = t.querySelector('.t-look'); let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (er) {} });
    look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; T.dx += (e.clientX - lx) * 1.5; T.dy += (e.clientY - ly) * 1.5; lx = e.clientX; ly = e.clientY; });
    const lup = () => { lid = null; }; look.addEventListener('pointerup', lup); look.addEventListener('pointercancel', lup);
  }
  exitLock() { if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} } }

  /* ================= boucle ================= */
  exit() { if (this.state === 'play') this.saveWorld(); else this.save(); this.destroy(); this.onExit && this.onExit(); }
  destroy() {
    this.running = false; removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis);
    this.exitLock(); Input.touch.mx = Input.touch.my = 0; Input.touch.btn = {}; this.root.classList.remove('has-touch');
    this.clearWorld();
    this.scene.traverse(o => { if (o.geometry && o.geometry !== BOXG) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    this.matS.dispose(); this.matW.dispose(); this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {}
    this.root.innerHTML = '';
  }
  resize() { const w = this.root.clientWidth || innerWidth, h = this.root.clientHeight || innerHeight; this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.root.classList.toggle('portrait', h > w); }
  loop(now) {
    if (!this.running) return; requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (dt <= 0) dt = 0.016;
    Input.poll(); const nav = Input.nav(dt);
    this.time += dt; this.S.playTime += dt;
    if (this.state === 'loading') { this.updateLoading(); if (this.state === 'play') this.render(); return; }
    if (Modal.active) { Modal.active.update(nav); if (this.state === 'play') this.render(); return; }
    if (this.ui) { this.ui.update(nav); if (!this.running) return; if (this.state === 'play') { this.updateParts(dt); this.render(); } return; }
    if (this.state !== 'play') return;
    if (Input.pressed('pause')) { this.openPause(); this.render(); return; }
    if (Input.pressed('inv')) { this.openInventory(); this.render(); return; }
    if (Input.pressed('journal')) { this.openMods(); this.render(); return; }
    if (Input.device !== this._dev) { this._dev = Input.device; this.paintKeys(); }
    this.updatePlay(dt);
    this.updateParts(dt);
    this.render(); this.perf(dt);
  }
  render() { if (this.renderer) this.renderer.render(this.scene, this.camera); }
  perf(dt) { this.fa = (this.fa || 0) + dt; this.fn = (this.fn || 0) + 1; if (this.fa < 1.5) return; const fps = this.fn / this.fa; this.fa = 0; this.fn = 0; if (Store.settings.fps) this.hud.fps.textContent = `${fps.toFixed(0)} FPS · ×${this.pr.toFixed(2)}`; if (fps < 40 && this.pr > 0.5) { this.pr = Math.max(0.5, this.pr - 0.1); this.renderer.setPixelRatio(this.pr); this.resize(); } else if (fps > 57 && this.pr < this.prTarget) { this.pr = Math.min(this.prTarget, this.pr + 0.05); this.renderer.setPixelRatio(this.pr); this.resize(); } }
}
function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1e9;
  for (const [oa, da, a0, a1] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(da) < 1e-8) { if (oa < a0 || oa > a1) return null; continue; }
    let t0 = (a0 - oa) / da, t1 = (a1 - oa) / da; if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
    tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1); if (tmin > tmax) return null;
  }
  return tmin;
}
