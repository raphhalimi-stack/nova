// CUBIKA — la place aux mini-jeux. Jeu original pour NOVA (hors ligne, contre des bots).
import * as THREE from './three.module.min.js';
import { Input, Sound, Store, Modal, ListMenu, clamp, lerp, damp, el, fmtDuration, isTV, isTouch } from './core.js';
import { World, Char, stepChar, OrbitCam, Bits, V3, textSprite, textPlane, skyTexture, boxMat, clearMatCache, defaultLook, randomLook, disposeAvatar, HATS, BACKS, FACES, DECALS, SKIN, COLORS, RUN } from './cubika-engine.js';
import { Obby, Tower, Tycoon, Pets, HideSeek } from './cubika-games1.js';
import { Disasters, Kart, Fashion, BedWars, Mystery } from './cubika-games2.js';

THREE.ColorManagement.enabled = false;
export const BOT_NAMES = ['Pixou', 'Lunaé', 'Brindille', 'Tarak', 'Zézette', 'Moko', 'Plume', 'Gribouille', 'Nox', 'Capucine', 'Bulle', 'Ricochet', 'Saphir', 'Kiwi', 'Mirabelle', 'Zorg', 'Tilda', 'Basile', 'Pistache', 'Orion', 'Nougat', 'Yuzu', 'Comète', 'Fifi'];
export const MINIS = [
  { id: 'obby', cls: Obby, name: 'Parcours céleste', genre: 'Parcours d’obstacles', col: '#ff5d8f', ico: '🏁', desc: 'Un parcours suspendu dans les nuages : plateformes mobiles, dalles fantômes, barres tournantes et trampolines.', rules: 'Atteins l’arche d’arrivée avant les bots. Les drapeaux sont des points de contrôle. Le rouge, on n’y touche pas.', reward: '25 à 80 ◆ selon la place' },
  { id: 'tower', cls: Tower, name: 'Tour sans fin', genre: 'Tour infinie', col: '#ff8a3d', ico: '🗼', desc: 'Une tour qui grimpe à l’infini pendant que la lave monte, de plus en plus vite.', rules: 'Grimpe le plus haut possible. Chaque palier atteint rapporte des jetons. La lave ne pardonne pas.', reward: '4 ◆ par étage' },
  { id: 'tycoon', cls: Tycoon, name: 'Usine à jetons', genre: 'Tycoon', col: '#ffd23d', ico: '🏭', desc: 'Ton terrain, ton usine. Des distributeurs, des tapis, des améliorateurs, et des billets qui s’empilent.', rules: 'Marche sur les boutons verts pour acheter. Va récupérer l’argent au coffre. Tout acheter = renaissance avec bonus.', reward: '◆ à chaque palier' },
  { id: 'pets', cls: Pets, name: 'Ferme à familiers', genre: 'Simulateur de familiers', col: '#7ddc4a', ico: '🐾', desc: 'Casse des cristaux avec tes familiers, fais éclore des œufs et débloque de nouvelles zones.', rules: 'Frappe un cristal : tes familiers t’aident. Achète des œufs à la couveuse. Les plus rares cassent plus vite.', reward: '1 ◆ pour 40 gemmes' },
  { id: 'hide', cls: HideSeek, name: 'Cache-cache', genre: 'Cache-cache', col: '#2ec4b6', ico: '🙈', desc: 'Une grande maison pleine de recoins. Une manche tu te caches, la suivante tu cherches.', rules: 'Caché : ne te fais pas voir (accroupis-toi derrière les meubles). Chercheur : touche les cachés avant la fin.', reward: '15 à 70 ◆' },
  { id: 'disaster', cls: Disasters, name: 'Catastrophes', genre: 'Survie aux catastrophes', col: '#3d8bff', ico: '🌪', desc: 'Inondation, pluie de météores, tornade, séisme, sol de lave… Une île, trois catastrophes.', rules: 'Survis à chaque catastrophe. Monte sur les toits, fuis la tornade, surveille les ombres du ciel.', reward: '20 ◆ par catastrophe' },
  { id: 'kart', cls: Kart, name: 'Grand Prix Cubique', genre: 'Course de karts', col: '#7a5cff', ico: '🏎', desc: 'Trois tours de circuit en kart contre cinq pilotes, avec dalles turbo et virages serrés.', rules: '✕ / R2 accélérer, ○ / L2 freiner. Passe sur les flèches turbo. Termine premier !', reward: '20 à 90 ◆ selon la place' },
  { id: 'fashion', cls: Fashion, name: 'Défilé de mode', genre: 'Défilé de mode', col: '#ff7ac8', ico: '👗', desc: 'Un thème, une minute pour t’habiller, puis le podium. Le jury et les bots votent.', rules: 'Choisis une tenue qui colle au thème. Pendant ton passage, prends la pose au bout du podium pour des étoiles bonus.', reward: '20 à 80 ◆' },
  { id: 'beds', cls: BedWars, name: 'Guerre des lits', genre: 'Protège ton lit', col: '#ff4d6d', ico: '🛏', desc: 'Quatre îles, quatre lits. Ramasse du fer, achète blocs et épées, construis des ponts.', rules: 'Tant que ton lit tient, tu réapparais. Casse les lits ennemis et sois le dernier sur la carte.', reward: '30 à 110 ◆' },
  { id: 'mystery', cls: Mystery, name: 'Le Manoir Mystère', genre: 'Enquête', col: '#d65cff', ico: '🔎', desc: 'L’Étoile de Cristal a disparu pendant la réception. Six invités, un seul coupable.', rules: 'Trouve les indices brillants, interroge les invités, puis accuse le bon. Chaque partie est différente.', reward: 'jusqu’à 120 ◆' },
];
const LVL_XP = n => 100 + (n - 1) * 60;
const GP = { jump: '✕', attack: '▢', alt: 'L2', interact: '△', crouch: '○', pause: 'OPTIONS', use: 'R2' };
const KB = { jump: 'Espace', attack: 'Clic G / F', alt: 'Clic D / Q', interact: 'E / R', crouch: 'C', pause: 'Échap', use: 'Clic G' };
const TC = { jump: 'SAUT', attack: 'ACTION', alt: 'BLOC', interact: '△', crouch: 'BAS', pause: '❚❚' };
export const gly = a => Input.device === 'gp' ? `<i class="g g-r">${GP[a] || a}</i>` : `<i class="g g-k">${(Input.device === 'touch' ? TC : KB)[a] || a}</i>`;

const CSS = `
.ck-hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-family:Inter,sans-serif;text-shadow:0 1px 6px rgba(0,0,0,.55)}
.ck-tl{position:absolute;left:calc(16px + var(--safe-l));top:calc(14px + var(--safe-t));display:flex;gap:10px;align-items:center}
.ck-lvl{width:46px;height:46px;border-radius:14px;background:linear-gradient(140deg,#ffd23d,#ff8a3d);display:grid;place-items:center;font-family:var(--fd);font-weight:800;color:#2a1600;font-size:18px;box-shadow:0 4px 0 #b25a10,0 6px 18px rgba(0,0,0,.35);text-shadow:none}
.ck-xp{width:120px;height:8px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden;margin-top:5px}.ck-xp i{display:block;height:100%;background:#7dffb0;border-radius:5px;transition:width .4s}
.ck-name{font-family:var(--fd);font-weight:700;font-size:14px}
.ck-coins{padding:7px 14px;border-radius:14px;background:rgba(10,12,22,.62);font-family:var(--fd);font-weight:800;font-size:17px;color:#ffe066;border:2px solid rgba(255,224,102,.35)}
.ck-top{position:absolute;left:50%;top:calc(14px + var(--safe-t));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.ck-info{padding:8px 18px;border-radius:16px;background:rgba(10,12,22,.62);font-family:var(--fd);font-weight:700;font-size:15px;white-space:nowrap;display:none}
.ck-timer{padding:6px 16px;border-radius:14px;background:rgba(10,12,22,.62);font-family:var(--fd);font-weight:800;font-size:22px;display:none}
.ck-timer.urg{color:#ff7a8a;animation:pulse .6s infinite alternate}
@keyframes pulse{to{transform:scale(1.08)}}
.ck-board{position:absolute;right:calc(16px + var(--safe-r));top:calc(70px + var(--safe-t));min-width:170px;display:none;flex-direction:column;gap:4px}
.ck-board div{display:flex;justify-content:space-between;gap:14px;padding:5px 12px;border-radius:10px;background:rgba(10,12,22,.55);font-size:13px;font-weight:600}
.ck-board div.me{background:color-mix(in srgb,var(--acc) 55%,rgba(10,12,22,.6));}.ck-board div.out{opacity:.45;text-decoration:line-through}
.ck-board b{font-family:var(--fd)}
.ck-big{position:absolute;left:0;right:0;top:30%;text-align:center;opacity:0;transform:scale(.9);transition:.25s}
.ck-big.show{opacity:1;transform:none}.ck-big b{display:block;font-family:var(--fd);font-weight:800;font-size:clamp(30px,6vw,72px);letter-spacing:.04em;text-shadow:0 4px 0 rgba(0,0,0,.35),0 0 30px var(--acc)}.ck-big span{font-size:clamp(14px,1.8vw,20px);font-weight:600}
.ck-prompt{position:absolute;left:50%;bottom:calc(90px + var(--safe-b));transform:translateX(-50%);padding:10px 18px;border-radius:16px;background:rgba(10,12,22,.72);font-weight:700;font-size:15px;display:none;white-space:nowrap;border:2px solid color-mix(in srgb,var(--acc) 60%,transparent)}
.ck-prompt.show{display:block}
.ck-mini{position:absolute;left:calc(16px + var(--safe-l));bottom:calc(16px + var(--safe-b));padding:10px 14px;border-radius:14px;background:rgba(10,12,22,.55);font-size:12.5px;line-height:1.5;max-width:330px}
.ck-mini b{font-family:var(--fd)}
.has-touch .ck-mini{display:none}.has-touch .ck-board{top:calc(120px + var(--safe-t));transform:scale(.85);transform-origin:right top}
.has-touch .ck-prompt{bottom:auto;top:calc(110px + var(--safe-t));pointer-events:auto}
.ck-fade{position:absolute;inset:0;background:#0a0716;opacity:0;pointer-events:none;transition:opacity .35s;display:grid;place-items:center;font-family:var(--fd);font-weight:800;font-size:40px;letter-spacing:.1em}
.ck-fade.on{opacity:1;pointer-events:auto}
.ck-card{display:flex;gap:18px;align-items:flex-start;margin-bottom:12px}.ck-card .ico{font-size:46px;width:74px;height:74px;border-radius:20px;display:grid;place-items:center;background:var(--acc);flex:none;box-shadow:0 5px 0 rgba(0,0,0,.25)}
.ck-card p{font-size:14px;line-height:1.5;color:rgba(255,255,255,.85);margin:0 0 6px}.ck-card small{color:var(--mut);font-size:12.5px;line-height:1.4;display:block}
.ck-res{font-size:15px;line-height:1.7;margin-bottom:12px}.ck-res b{font-family:var(--fd)}.ck-res .gain{font-family:var(--fd);font-weight:800;font-size:28px;color:#ffe066}
.ck-ward{position:absolute;left:calc(14px + var(--safe-l));top:calc(14px + var(--safe-t));bottom:calc(14px + var(--safe-b));width:min(420px,52vw);border-radius:24px;padding:18px;display:flex;flex-direction:column;pointer-events:auto;z-index:20}
.ck-ward .gm-list{flex:1;overflow:auto}
.ck-sw{display:inline-block;width:18px;height:18px;border-radius:6px;vertical-align:-4px;border:2px solid rgba(255,255,255,.6);margin-right:6px}
.ck-lock{color:#ffb36b;font-size:12px}
.ck-hatch{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.ck-hatch div{padding:20px 34px;border-radius:24px;text-align:center;font-family:var(--fd)}
.ck-hatch b{display:block;font-size:30px;font-weight:800}.ck-hatch span{font-size:15px}
.ck-notes{font-size:13.5px;line-height:1.6}.ck-notes li{margin:4px 0}
.ck-notes .x{text-decoration:line-through;opacity:.45}
.ck-stars{color:#ffd23d;font-size:20px;letter-spacing:2px}
`;

export class Cubika {
  constructor(root, { onExit }) {
    this.root = root; this.onExit = onExit; this.running = true; this.ui = null; this.time = 0; this.bots = []; this.chars = []; this.mg = null;
    if (!document.getElementById('ck-css')) { const s = el('style'); s.id = 'ck-css'; s.textContent = CSS; document.head.appendChild(s); }
    const sv = Store.getGame('cubika');
    this.S = Object.assign({ look: defaultLook(), coins: 60, xp: 0, level: 1, owned: { hat: ['none', 'cap'], back: ['none'], face: ['smile', 'happy'], decal: ['none', 'star'] }, stats: {}, playTime: 0, lastDay: '', tycoon: null, pets: null, created: false }, sv && sv.state ? sv.state : {});
    this.quality = Store.settings.quality === 'auto' ? (isTV ? 'low' : isTouch ? 'medium' : 'high') : Store.settings.quality;
    this.root.style.setProperty('--acc', '#ffd23d');
    this.initScene(); this.initHUD();
    if (isTouch || Input.device === 'touch') this.initTouch();
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize); this.resize();
    this.onVis = () => { if (document.hidden) { this.save(); if (!this.ui && !Modal.active) this.openPause(); } }; document.addEventListener('visibilitychange', this.onVis);
    this.loop = this.loop.bind(this); this.last = performance.now(); requestAnimationFrame(this.loop);
    Sound.playMusic('cubika');
    this.player = this.spawnChar(this.S.look, null, false);
    this.enterPlaza(true);
    if (!this.S.created) { this.S.created = true; setTimeout(() => { this.big('Bienvenue sur CUBIKA', 'Commence par créer ton avatar', 2.4); const tryOpen = () => { if (!this.running) return; if (this.ui || Modal.active || this.mode !== 'plaza') return setTimeout(tryOpen, 1000); this.openWardrobe(); }; setTimeout(tryOpen, 1400); }, 600); }
    const today = new Date().toISOString().slice(0, 10);
    if (this.S.lastDay !== today) { const first = !this.S.lastDay; this.S.lastDay = today; if (!first) setTimeout(() => { this.addCoins(50); this.toast('Bonus du jour', '+50 ◆ pour ta visite', '#ffd23d'); }, 2500); }
    this.save();
  }

  /* ================= scène ================= */
  initScene() {
    const q = this.quality;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: q === 'high', powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.prTarget = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'medium' ? Math.min(devicePixelRatio, 1.3) : Math.min(devicePixelRatio, 0.75); this.pr = this.prTarget; r.setPixelRatio(this.pr);
    r.shadowMap.enabled = q === 'high'; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'game-canvas'; this.root.appendChild(r.domElement);
    r.domElement.addEventListener('click', () => { if (!this.ui && !Modal.active && !isTouch && Input.device !== 'touch' && document.pointerLockElement !== r.domElement) { try { const p = r.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } });
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.hemi = new THREE.HemisphereLight(0xeaf4ff, 0x6a5a4a, 1.25); sc.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff2dc, 1.35); sun.position.set(30, 50, 20); sun.castShadow = q === 'high';
    sun.shadow.mapSize.set(2048, 2048); const c2 = sun.shadow.camera; c2.left = c2.bottom = -40; c2.right = c2.top = 40; c2.near = 1; c2.far = 140; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    sc.add(sun, sun.target);
    this.world = new World(sc, q); this.ocam = new OrbitCam(this.camera); this.bits = new Bits(sc, q === 'low' ? 90 : 180);
  }
  setSky(top, mid, bot, fog, near = 60, far = 260) { this.scene.background && this.scene.background.dispose && this.scene.background.dispose(); this.scene.background = skyTexture(top, mid, bot); this.scene.fog = new THREE.Fog(fog, near, this.quality === 'low' ? far * 0.75 : far); }
  spawnChar(look, name, bot) { const c = new Char(look, name, bot); this.scene.add(c.av.group); this.chars.push(c); if (bot) this.bots.push(c); return c; }
  removeChar(c) { disposeAvatar(c.av); this.chars = this.chars.filter(x => x !== c); this.bots = this.bots.filter(x => x !== c); }
  clearBots() { for (const b of [...this.bots]) this.removeChar(b); this.bots = []; }
  makeBots(n, seed = Math.random) { const names = [...BOT_NAMES].sort(() => seed() - 0.5); const out = []; for (let i = 0; i < n; i++) { const b = this.spawnChar(randomLook(seed), names[i % names.length], true); b.skill = 0.6 + seed() * 0.4; out.push(b); } return out; }
  // contrôle du joueur (à appeler par les mini-jeux)
  ctlPlayer(dt, opts = {}) {
    const P = this.player, I = Input;
    const mv = this.ocam.moveDir(I.ax.mx, I.ax.my);
    if (opts.noMove || !P.alive) mv.set(0, 0, 0);
    const sp = (opts.speed ?? RUN) * (I.down('sprint') ? 1.15 : 1);
    stepChar(P, this.world, dt, mv, P.alive && !opts.noJump && (I.pressed('jump') || (P.onGround && I.down('jump') && P._jb > 0)), { ...opts, speed: sp });
    if (I.pressed('jump')) P._jb = 0.12; else P._jb = (P._jb || 0) - dt;
    if (P.jumped) this.sfx('jump'); if (P.landed > 14) { this.sfx('land'); Input.rumble(0.3, 0.2, 80); }
    if (P.bounced) { P.bounced = false; this.sfx('jump2'); }
    return mv;
  }
  moveBot(b, dt, mv, jump, opts = {}) { stepChar(b, this.world, dt, mv, jump, opts); b.bounced = false; }
  updateCam(dt, opts = {}) {
    const lk = Input.consumeLook(), sens = Store.settings.sens, inv = Store.settings.invertY ? -1 : 1;
    const look = { x: (lk.x * 0.0026 + Input.ax.lx * dt * 2.6) * sens, y: (lk.y * 0.0026 + Input.ax.ly * dt * 2.0) * sens * inv };
    const f = (opts.focus || this.player.pos).clone(); f.y += opts.h ?? 1.6;
    this.ocam.update(dt, opts.noCollide ? null : this.world, look, f, opts);
  }
  get inp() { const I = Input; return { act: I.pressed('attack') || I.pressed('use'), actHeld: I.down('attack') || I.down('use'), alt: I.pressed('alt') || I.pressed('zip'), inter: I.pressed('interact') || I.pressed('act'), crouch: I.pressed('crouch'), crouchHeld: I.down('crouch') }; }

  /* ================= place centrale ================= */
  enterPlaza(first) {
    this.mode = 'plaza'; this.mg = null; this.resetHUD();
    this.world.clear(); this.clearBots(); this.player.alive = true; this.player.crouch = false; this.player.sit = false; this.player.av.group.visible = true; this.player.speedMul = 1;
    this.root.style.setProperty('--acc', '#ffd23d');
    this.setSky('#3f8fff', '#9fd2ff', '#ffe9c4', 0xbfe0ff, 70, 220);
    this.hemi.intensity = 1.25; this.sun.intensity = 1.35;
    const W = this.world, R = 23;
    W.add(0, -1, 0, 80, 2, 80, '#7ddc4a');
    W.add(0, -0.45, 0, 34, 0.9, 34, '#e9e2d0', { solid: true }); W.add(0, -0.4, 0, 36, 0.8, 36, '#cfc6b0');
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; W.add(Math.sin(a) * 15, -0.38, Math.cos(a) * 15, 4, 0.8, 14, '#d9d0bb'); }
    // fontaine
    W.add(0, 0.3, 0, 7, 0.6, 7, '#9fb4c8'); W.add(0, 0.62, 0, 6, 0.1, 6, '#4fc3ff', { opacity: 0.8, solid: false }); W.add(0, 1.3, 0, 1.2, 2, 1.2, '#b8c6d6'); W.add(0, 2.5, 0, 2.6, 0.4, 2.6, '#9fb4c8');
    this.fountain = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.55 })); this.fountain.position.set(0, 3.4, 0); W.group.add(this.fountain);
    // logo
    const logo = textSprite('CUBIKA', 2.2, { size: 100, w: 768, h: 160, color: '#ffe066', stroke: '#5a2d00' }); logo.position.set(0, 6.2, 0); W.group.add(logo);
    // portails
    this.portals = MINIS.map((g, i) => {
      const a = i / MINIS.length * Math.PI * 2 + Math.PI / MINIS.length, x = Math.sin(a) * R, z = Math.cos(a) * R, yaw = a + Math.PI;
      const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = yaw; W.group.add(grp);
      const pillar = (px) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), boxMat(g.col)); m.position.set(px, 2.5, 0); grp.add(m); };
      pillar(-2); pillar(2); const top = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.9), boxMat(g.col)); top.position.y = 5.2; grp.add(top);
      const ready = g.cls && !g.soon;
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.6), new THREE.MeshBasicMaterial({ color: ready ? g.col : '#555a66', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); portal.position.y = 2.4; grp.add(portal);
      const sign = textSprite(`${g.ico} ${g.name}${ready ? '' : '\nBientôt'}`, ready ? 1.05 : 1.6, { size: 60, w: 900, h: ready ? 120 : 220, color: '#fff', bg: 'rgba(10,12,24,.72)', stroke: null }); sign.position.y = 6.5; grp.add(sign);
      const st = this.S.stats[g.id]; if (st && st.wins) { const s = textSprite('★ '.repeat(Math.min(3, st.wins)).trim(), 0.6, { size: 70, w: 256, h: 96, color: '#ffd23d' }); s.position.y = 7.4; grp.add(s); }
      // colliders des piliers (en monde)
      const cx = Math.cos(yaw), sx = Math.sin(yaw);
      [-2, 2].forEach(px => W.add(x + px * cx, 2.5, z - px * sx, 0.8, 5, 0.8, g.col, { visual: false }));
      W.add(x, -0.35, z, 6, 0.7, 6, '#ffffff');
      return { g, x, z, portal, ready, a };
    });
    // garde-robe & arbres
    this.wardPos = new V3(6, 0, 11);
    W.add(6, 1.5, 13, 5, 3, 1, '#ff7ac8'); W.add(6, 3.3, 12.2, 5.6, 0.4, 2.8, '#ffffff'); W.add(3.8, 1.5, 12, 0.4, 3, 0.4, '#ffffff'); W.add(8.2, 1.5, 12, 0.4, 3, 0.4, '#ffffff');
    const ws = textSprite('👕 Garde-robe', 0.7, { size: 60, w: 640, h: 110, bg: 'rgba(255,122,200,.9)', stroke: null }); ws.position.set(6, 4.3, 12); W.group.add(ws);
    this.statPos = new V3(-6, 0, 11);
    W.add(-6, 1.5, 13, 5, 3, 1, '#3d8bff'); W.add(-6, 3.3, 12.2, 5.6, 0.4, 2.8, '#ffffff'); W.add(-8.2, 1.5, 12, 0.4, 3, 0.4, '#ffffff'); W.add(-3.8, 1.5, 12, 0.4, 3, 0.4, '#ffffff');
    const ss = textSprite('🏆 Records', 0.7, { size: 60, w: 640, h: 110, bg: 'rgba(61,139,255,.9)', stroke: null }); ss.position.set(-6, 4.3, 12); W.group.add(ss);
    const rr = Math.random;
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + 0.1, d = 32 + rr() * 5, x = Math.sin(a) * d, z = Math.cos(a) * d, h = 2 + rr() * 2; W.add(x, h / 2, z, 0.8, h, 0.8, '#8a5a3c'); W.add(x, h + 1.2, z, 3, 2.4, 3, ['#4bbf4a', '#3aa34a', '#5fd65a'][i % 3]); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; W.add(Math.sin(a) * 9, 0.35, Math.cos(a) * 9, 2.2, 0.3, 0.7, '#8a5a3c'); }
    W.build();
    // bots d'ambiance
    this.makeBots(isTV ? 4 : 7).forEach((b, i) => { const a = i * 1.3; b.pos.set(Math.sin(a) * 12, 0, Math.cos(a) * 12); b.data.t = 0; b.data.goal = null; });
    const P = this.player;
    if (first || !this.lastPortal) { P.pos.set(0, 0, 8); P.yaw = 0; this.ocam.yaw = 0; }
    else { const p = this.portals.find(x => x.g.id === this.lastPortal) || this.portals[0]; P.pos.set(p.x * 0.8, 0, p.z * 0.8); P.yaw = p.a + Math.PI; this.ocam.yaw = p.a; }
    P.vel.set(0, 0, 0); P.sync(); this.ocam.pitch = 0.3; this.ocam.cur.copy(P.pos);
    this.hud.mini.innerHTML = `<b>Place de CUBIKA</b><br>Approche-toi d’un portail et appuie sur ${gly('interact')} pour jouer.<br>Garde-robe : personnalise ton avatar.`;
    this.paintCoins();
  }
  updatePlaza(dt) {
    const P = this.player, I = Input;
    this.ctlPlayer(dt);
    if (P.pos.y < -10) { P.pos.set(0, 1, 8); P.vel.set(0, 0, 0); }
    // bots d'ambiance
    for (const b of this.bots) {
      b.data.t -= dt;
      if (b.data.t <= 0) { const p = this.portals[(Math.random() * 10) | 0]; b.data.goal = Math.random() < 0.5 ? new V3(p.x * 0.75, 0, p.z * 0.75) : new V3((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30); b.data.t = 4 + Math.random() * 6; }
      let mv = new V3(); if (b.data.goal) { const dx = b.data.goal.x - b.pos.x, dz = b.data.goal.z - b.pos.z, d = Math.hypot(dx, dz); if (d > 1) mv.set(dx / d * 0.55, 0, dz / d * 0.55); }
      this.moveBot(b, dt, mv, b.hitWall && b.onGround ? (b.hitWall = null, true) : Math.random() < 0.002);
    }
    this.fountain.rotation.y += dt; this.fountain.scale.y = 1 + Math.sin(this.time * 4) * 0.08;
    this.portals.forEach((p, i) => { p.portal.material.opacity = 0.45 + Math.sin(this.time * 2 + i) * 0.12; });
    // proximité
    let near = null; for (const p of this.portals) if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 3.4) near = p;
    const nearW = P.pos.distanceTo(this.wardPos) < 2.8, nearS = P.pos.distanceTo(this.statPos) < 2.8;
    if (near) this.prompt(`${gly('interact')} ${near.g.ico} ${near.g.name}${near.ready ? '' : ' · bientôt'}`);
    else if (nearW) this.prompt(`${gly('interact')} Garde-robe`);
    else if (nearS) this.prompt(`${gly('interact')} Records & profil`);
    else this.prompt('');
    if (this.inp.inter || (this.touchPromptTap && (this.touchPromptTap = false, true))) {
      if (near) this.openCard(near.g); else if (nearW) this.openWardrobe(); else if (nearS) this.openRecords();
    }
    this.updateCam(dt);
  }
  openCard(g) {
    this.exitLock();
    const st = this.S.stats[g.id] || {}, ready = g.cls && !g.soon;
    const ov = el('div', 'gmenu'); ov.style.setProperty('--acc', g.col);
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">CUBIKA · ${g.genre.toUpperCase()}</div><h2>${g.name}</h2><div class="ck-card"><div class="ico">${g.ico}</div><div><p>${g.desc}</p><small><b>Règles :</b> ${g.rules}</small><small><b>Récompense :</b> ${g.reward}</small><small>${st.plays ? `Parties : ${st.plays} · Victoires : ${st.wins || 0}${st.bestTxt ? ' · Record : ' + st.bestTxt : ''}` : 'Jamais joué'}</small></div></div><div class="gm-list"></div><div class="gm-foot">${gly('jump')} Valider &nbsp; ${gly('crouch')} Retour</div></div>`;
    this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); };
    const list = new ListMenu(ov.querySelector('.gm-list'), ready ? [{ label: '▶ Jouer', cls: 'warn', act: () => { close(); this.startMini(g.id); } }, { label: 'Retour à la place', act: close }] : [{ label: 'En construction : revient au prochain passage', disabled: () => true }, { label: 'Retour à la place', act: close }]);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  async startMini(id) {
    const g = MINIS.find(x => x.id === id); this.lastPortal = id; this.lastMini = id;
    await this.fadeTo(true, `${g.ico} ${g.name}`);
    this.world.clear(); this.clearBots(); this.resetHUD(); this.scene.fog = null;
    const P = this.player; P.alive = true; P.crouch = false; P.sit = false; P.pose = false; P.speedMul = 1; P.hp = 100; P.av.group.visible = true; P.vel.set(0, 0, 0); P.data = {};
    this.root.style.setProperty('--acc', g.col);
    this.mode = 'game'; this.mgDef = g;
    this.hud.mini.innerHTML = `<b>${g.name}</b><br>${g.rules}`;
    try { this.mg = new g.cls(this); this.mg.start(); } catch (e) { console.error(e); this.toast('Erreur', String(e.message || e).slice(0, 80), '#ff4d6d'); this.mg = null; this.enterPlaza(); }
    this.ocam.cur.copy(P.pos); this.last = performance.now();
    await this.wait(250); this.fadeTo(false);
  }
  // fin d'une manche
  finish(res) {
    if (!this.mg || this.mg.done) return; this.mg.done = true; this.exitLock();
    const g = this.mgDef, st = this.S.stats[g.id] = this.S.stats[g.id] || { plays: 0, wins: 0 };
    st.plays++; if (res.win) st.wins++;
    let rec = false;
    if (res.best != null) { const better = res.low ? (st.best == null || res.best < st.best) : (st.best == null || res.best > st.best); if (better) { st.best = res.best; st.bestTxt = res.bestTxt; rec = st.plays > 1; } }
    const coins = Math.round(res.coins || 0), xp = Math.round(res.xp ?? (20 + coins * 0.6));
    this.addCoins(coins); const lv = this.addXP(xp);
    this.save();
    this.sfx(res.win ? 'win' : res.place && res.place <= 3 ? 'level' : 'fail');
    setTimeout(() => {
      const ov = el('div', 'gmenu'); ov.style.setProperty('--acc', g.col);
      ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">${g.name.toUpperCase()} · RÉSULTATS</div><h2>${res.title || (res.win ? 'Victoire !' : 'Terminé')}</h2><div class="ck-res">${(res.lines || []).map(l => `<div>${l}</div>`).join('')}${rec ? '<div><b style="color:#7dffb0">Nouveau record !</b></div>' : ''}<div class="gain">+${coins} ◆ &nbsp; <span style="font-size:18px;color:#7dffb0">+${xp} XP</span></div>${lv ? `<div><b style="color:#ffd23d">Niveau ${this.S.level} atteint !</b> De nouveaux objets t’attendent à la garde-robe.</div>` : ''}</div><div class="gm-list"></div></div>`;
      this.root.appendChild(ov);
      const close = () => { ov.remove(); this.ui = null; };
      const items = [{ label: '↻ Rejouer', cls: 'warn', act: () => { close(); this.endMini(); this.startMini(g.id); } }, { label: 'Retour à la place', act: () => { close(); this.backToPlaza(); } }];
      const list = new ListMenu(ov.querySelector('.gm-list'), items);
      const t0 = performance.now();
      this.ui = { update: nav => { if (performance.now() - t0 > 600) list.update(nav); } };
    }, res.delay ?? 1600);
  }
  endMini() { if (this.mg) { try { this.mg.destroy && this.mg.destroy(); } catch (e) { console.error(e); } } this.mg = null; }
  async backToPlaza() { await this.fadeTo(true, 'CUBIKA'); this.endMini(); this.enterPlaza(); this.save(); await this.wait(200); this.fadeTo(false); }

  /* ================= progression ================= */
  addCoins(n) { if (!n) return; this.S.coins = Math.max(0, this.S.coins + n); this.paintCoins(); if (n > 0) { this.hud.coins.animate && this.hud.coins.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 }); } }
  addXP(n) { const S = this.S; S.xp += n; let up = false; while (S.xp >= LVL_XP(S.level)) { S.xp -= LVL_XP(S.level); S.level++; up = true; } if (up) { this.big(`Niveau ${S.level} !`, 'Nouveaux objets débloqués', 2.2); this.sfx('level'); this.bits.burst(this.player.pos.clone().setY(this.player.pos.y + 2), 40, ['#ffd23d', '#ff7ac8', '#7dffb0', '#3d8bff'], 8); } this.paintCoins(); return up; }
  paintCoins() { const S = this.S; this.hud.coins.textContent = `◆ ${S.coins.toLocaleString('fr-FR')}`; this.hud.lvl.textContent = S.level; this.hud.xp.style.width = Math.min(100, S.xp / LVL_XP(S.level) * 100) + '%'; this.hud.name.textContent = Store.data.profile.name || 'Joueur'; }
  completion() {
    let c = 0; for (const g of MINIS) { const st = this.S.stats[g.id]; if (st) { c += st.plays ? 3 : 0; c += st.wins ? 4 : 0; } }
    const tot = Object.keys(HATS).length + Object.keys(BACKS).length + Object.keys(FACES).length + Object.keys(DECALS).length, own = Object.values(this.S.owned).reduce((a, l) => a + l.length, 0);
    c += Math.round(own / tot * 20) + Math.min(10, this.S.level - 1);
    return Math.min(100, c);
  }
  save() {
    const S = this.S; const played = MINIS.filter(g => this.S.stats[g.id] && this.S.stats[g.id].plays).length, wins = MINIS.reduce((a, g) => a + ((this.S.stats[g.id] || {}).wins || 0), 0);
    const fav = MINIS.slice().sort((a, b) => ((this.S.stats[b.id] || {}).plays || 0) - ((this.S.stats[a.id] || {}).plays || 0))[0];
    Store.setGame('cubika', { state: JSON.parse(JSON.stringify(S)), summary: { level: S.level, completion: this.completion(), playTime: S.playTime, line: `Niveau ${S.level} · ${S.coins} ◆ · ${played}/10 mini-jeux`, cards: [['Reprendre', 'La place de CUBIKA', `${played} / 10 mini-jeux découverts`, played / 10], ['Jetons', `◆ ${S.coins.toLocaleString('fr-FR')}`, 'Pour la garde-robe'], ['Victoires', String(wins), 'Tous mini-jeux confondus'], ['Préféré', played ? fav.name : '—', played ? `${(this.S.stats[fav.id] || {}).plays} partie(s)` : 'Essaie-les tous']] } });
    this.lastSave = this.time;
  }

  /* ================= garde-robe ================= */
  openWardrobe(opts = {}) {
    this.exitLock();
    const S = this.S, L = opts.look || JSON.parse(JSON.stringify(S.look)), free = !!opts.free, P = this.player; this.hud.big.classList.remove('show');
    const ov = el('div', 'ck-ward glass');
    ov.innerHTML = `<div class="gm-kicker">${opts.kicker || 'CUBIKA · GARDE-ROBE'}</div><h2 style="font-family:var(--fd);font-size:24px;margin:4px 0 10px">${opts.title || 'Ton avatar'}</h2>${opts.extra || ''}<div class="gm-list"></div><div class="gm-foot">◀ ▶ changer &nbsp; ${gly('jump')} acheter / valider${free ? '' : ` &nbsp; ${gly('crouch')} fermer`}</div>`;
    this.root.appendChild(ov);
    this.wardCam = true; P.vel.set(0, 0, 0);
    const apply = () => { P.setLook(L); };
    const cyc = (key, list) => ({ left: () => { L[key] = list[(list.indexOf(L[key]) + list.length - 1) % list.length]; apply(); }, right: () => { L[key] = list[(list.indexOf(L[key]) + 1) % list.length]; apply(); } });
    const own = (cat, id) => free || S.owned[cat].includes(id);
    const lockTxt = (cat, tbl, id) => { const it = tbl[id]; if (own(cat, id)) return ''; return S.level < it[2] ? ` <span class="ck-lock">🔒 niv. ${it[2]}</span>` : ` <span class="ck-lock">🔒 ${it[1]} ◆</span>`; };
    const buy = (cat, tbl, key) => { const id = L[key], it = tbl[id]; if (own(cat, id)) return; if (S.level < it[2]) { this.toast('Pas encore', `Disponible au niveau ${it[2]}`, '#ff8a3d'); this.sfx('nope'); return; } if (S.coins < it[1]) { this.toast('Pas assez de jetons', `Il te faut ${it[1]} ◆`, '#ff8a3d'); this.sfx('nope'); return; } this.addCoins(-it[1]); S.owned[cat].push(id); this.sfx('buy'); this.toast('Acheté !', it[0], '#7dffb0'); this.bits.burst(P.pos.clone().setY(2.2), 26, ['#ffd23d', '#fff'], 5); this.save(); };
    const sw = c => `<span class="ck-sw" style="background:${c}"></span>`;
    const colRow = (label, key, pal = COLORS) => ({ label, get: () => sw(L[key]), ...cyc(key, pal) });
    const objRow = (label, cat, tbl, key) => ({ label, get: () => tbl[L[key]][0] + lockTxt(cat, tbl, L[key]), ...cyc(key, Object.keys(tbl)), act: () => buy(cat, tbl, key) });
    const items = [
      colRow('Peau', 'skin', SKIN), objRow('Visage', 'face', FACES, 'face'), colRow('Haut', 'shirt'), objRow('Motif du haut', 'decal', DECALS, 'decal'), colRow('Bas', 'pants'), colRow('Chaussures', 'shoes'),
      objRow('Chapeau', 'hat', HATS, 'hat'), colRow('Couleur du chapeau', 'hatC'), objRow('Dos', 'back', BACKS, 'back'), colRow('Couleur du dos', 'backC'),
      { label: '🎲 Tenue au hasard', act: () => { const r = randomLook(); for (const k of ['shirt', 'pants', 'shoes', 'hatC', 'backC']) L[k] = r[k]; if (free) Object.assign(L, { hat: r.hat, back: r.back, decal: r.decal, face: r.face }); apply(); } },
      { label: opts.done || '✓ Terminer', cls: 'warn', act: () => close(true) },
    ];
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    const close = ok => {
      if (!free) { const fix = (cat, key, tbl) => { if (!own(cat, L[key])) { L[key] = S.look[key] && own(cat, S.look[key]) ? S.look[key] : 'none'; } }; fix('hat', 'hat'); fix('back', 'back'); fix('face', 'face'); fix('decal', 'decal'); if (!S.owned.face.includes(L.face)) L.face = 'smile'; S.look = L; P.setLook(L); this.save(); }
      ov.remove(); this.ui = null; this.wardCam = false; this.last = performance.now(); opts.onDone && opts.onDone(L);
    };
    this.ui = { update: nav => { list.update(nav); if (this.ui && !free && (Input.pressed('back') || Input.pressed('pause'))) close(false); }, cam: true, el: ov, list };
    return { close, list, L };
  }
  openRecords() {
    this.exitLock();
    const S = this.S, ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">CUBIKA · PROFIL</div><h2>${Store.data.profile.name || 'Joueur'} · niveau ${S.level}</h2><div class="gm-list"></div><div class="gm-foot">${gly('crouch')} Fermer · ${fmtDuration(S.playTime)} de jeu · ${this.completion()} %</div></div>`;
    this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); };
    const items = MINIS.map(g => { const st = S.stats[g.id] || {}; return { label: `${g.ico} ${g.name}`, sub: st.plays ? `${st.plays} partie(s) · ${st.wins || 0} victoire(s)` : 'Pas encore joué', get: () => st.bestTxt ? `<b>${st.bestTxt}</b>` : '—' }; });
    items.push({ label: 'Fermer', cls: 'exit', act: close });
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }

  /* ================= HUD ================= */
  initHUD() {
    const h = el('div', 'ck-hud');
    h.innerHTML = `<div class="ck-tl"><div class="ck-lvl">1</div><div><div class="ck-name"></div><div class="ck-xp"><i></i></div></div><div class="ck-coins">◆ 0</div></div>
      <div class="ck-top"><div class="ck-timer"></div><div class="ck-info"></div></div><div class="ck-board"></div><div class="ck-big"><b></b><span></span></div>
      <div class="ck-prompt"></div><div class="ck-mini"></div><div class="toasts"></div><div class="fps"></div><div class="ck-fade"></div>`;
    this.root.appendChild(h); const q = s => h.querySelector(s);
    this.hud = { root: h, lvl: q('.ck-lvl'), name: q('.ck-name'), xp: q('.ck-xp i'), coins: q('.ck-coins'), timer: q('.ck-timer'), info: q('.ck-info'), board: q('.ck-board'), big: q('.ck-big'), bigB: q('.ck-big b'), bigS: q('.ck-big span'), prompt: q('.ck-prompt'), mini: q('.ck-mini'), toasts: q('.toasts'), fps: q('.fps'), fade: q('.ck-fade') };
    this.hud.prompt.addEventListener('pointerdown', () => { this.touchPromptTap = true; Input.touch.tap.interact = true; });
    this.hud.fps.style.display = Store.settings.fps ? 'block' : 'none';
  }
  resetHUD() { this.info(''); this.timer(null); this.board(null); this.prompt(''); this.hud.big.classList.remove('show'); }
  info(html) { const e = this.hud.info; if (e._v === html) return; e._v = html; e.innerHTML = html; e.style.display = html ? 'block' : 'none'; }
  timer(sec) { const e = this.hud.timer; if (sec == null) { e.style.display = 'none'; return; } e.style.display = 'block'; const t = Math.max(0, Math.ceil(sec)), s = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; if (e._v !== s) { e._v = s; e.textContent = s; e.classList.toggle('urg', t <= 10); if (t <= 5 && t > 0) this.sfx('tick'); } }
  board(rows) { const e = this.hud.board; if (!rows) { e.style.display = 'none'; e._v = ''; return; } const h = rows.map(r => `<div class="${r.me ? 'me' : ''}${r.out ? ' out' : ''}"><span>${r.n}</span><b>${r.v}</b></div>`).join(''); if (e._v !== h) { e._v = h; e.innerHTML = h; } e.style.display = 'flex'; }
  big(t, s = '', dur = 1.6) { const H = this.hud; H.bigB.textContent = t; H.bigS.textContent = s; H.big.classList.add('show'); clearTimeout(this._bigT); this._bigT = setTimeout(() => H.big.classList.remove('show'), dur * 1000); }
  prompt(html) { const e = this.hud.prompt; if (e._v === html) return; e._v = html; e.innerHTML = html; e.classList.toggle('show', !!html); }
  toast(title, text, color = '#ffd23d') { const t = el('div', 'toast', `<b>${title}</b><span>${text}</span>`); t.style.setProperty('--c', color); this.hud.toasts.appendChild(t); setTimeout(() => t.classList.add('out'), 2800); setTimeout(() => t.remove(), 3300); while (this.hud.toasts.children.length > 4) this.hud.toasts.firstChild.remove(); }
  async countdown(n = 3) { for (let i = n; i > 0; i--) { this.big(String(i), '', 0.8); this.sfx('beep'); await this.wait(800); if (!this.running) return; } this.big('C’EST PARTI !', '', 1); this.sfx('go'); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  async fadeTo(on, text = '') { const f = this.hud.fade; f.textContent = text; f.classList.toggle('on', on); await this.wait(380); }
  exitLock() { if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} } }
  initTouch() {
    const t = el('div', 'touch');
    t.innerHTML = `<div class="t-look"></div><div class="t-stick"><div class="t-base"><div class="t-knob"></div></div></div>
      <div class="t-btns"><button data-a="jump" class="tb big jump">SAUT</button><button data-a="attack" class="tb big swing">ACTION</button><button data-a="interact" class="tb atk">△</button><button data-a="alt" class="tb zip">BLOC</button><button data-a="crouch" class="tb dash">BAS</button></div>
      <div class="t-top"><button data-a="pause" class="tb sm">❚❚</button></div>`;
    this.root.appendChild(t); this.root.classList.add('has-touch'); const T = Input.touch; this.touchEl = t;
    t.querySelectorAll('.tb').forEach(b => { const a = b.dataset.a; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); T.btn[a] = true; T.tap[a] = true; if (a === 'jump') T.btn.confirm = false; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (er) {} Sound.unlock(); }); const up = () => { T.btn[a] = false; b.classList.remove('down'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
    const stick = t.querySelector('.t-stick'), base = t.querySelector('.t-base'), knob = t.querySelector('.t-knob'); let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; base.style.left = sx + 'px'; base.style.top = (sy - stick.getBoundingClientRect().top) + 'px'; base.classList.add('on'); try { stick.setPointerCapture(e.pointerId); } catch (er) {} });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - sx, dy = e.clientY - sy; const L = Math.hypot(dx, dy), Mx = 56; if (L > Mx) { dx *= Mx / L; dy *= Mx / L; } knob.style.transform = `translate(${dx}px,${dy}px)`; T.mx = dx / Mx; T.my = -dy / Mx; });
    const send = () => { sid = null; T.mx = T.my = 0; knob.style.transform = ''; base.classList.remove('on'); }; stick.addEventListener('pointerup', send); stick.addEventListener('pointercancel', send);
    const look = t.querySelector('.t-look'); let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (er) {} });
    look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; T.dx += (e.clientX - lx) * 1.6; T.dy += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
    const lup = () => { lid = null; }; look.addEventListener('pointerup', lup); look.addEventListener('pointercancel', lup);
  }
  touchLabels(map) { if (!this.touchEl) return; const def = { jump: 'SAUT', attack: 'ACTION', interact: '△', alt: 'BLOC', crouch: 'BAS' }; for (const [a, d] of Object.entries(def)) { const b = this.touchEl.querySelector(`[data-a="${a}"]`); if (!b) continue; const v = map && a in map ? map[a] : d; b.textContent = v || ''; b.style.display = v === null ? 'none' : ''; } }
  openPause() {
    if (this.ui) return; this.exitLock();
    const S = Store.settings, ov = el('div', 'gmenu'), inGame = this.mode === 'game' && this.mg && !this.mg.done;
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">CUBIKA · ${inGame ? this.mgDef.name.toUpperCase() : 'LA PLACE'}</div><h2>Pause</h2><div class="gm-list"></div><div class="gm-foot">${Store.cloud === 'on' ? '☁ Sauvegarde synchronisée' : '💾 Sauvegarde locale'} · Niveau ${this.S.level} · ${fmtDuration(this.S.playTime)}</div></div>`; this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); };
    const num = (k, step, min, max, fmt, after) => ({ get: () => fmt(S[k]), left: () => { S[k] = Math.max(min, +(S[k] - step).toFixed(2)); after && after(); Store.touch(); }, right: () => { S[k] = Math.min(max, +(S[k] + step).toFixed(2)); after && after(); Store.touch(); } });
    const tg = k => ({ get: () => S[k] ? 'Oui' : 'Non', left: () => { S[k] = !S[k]; Store.touch(); }, right: () => { S[k] = !S[k]; Store.touch(); } });
    const items = [{ label: 'Reprendre', act: close }, { label: 'Commandes', act: () => this.showControls() }];
    if (!inGame) items.push({ label: 'Garde-robe', act: () => { close(); this.openWardrobe(); } }, { label: 'Records & profil', act: () => { close(); this.openRecords(); } });
    if (inGame && this.mg.help) items.push({ label: 'Aide du mini-jeu', act: () => Modal.info(this.mgDef.name, this.mg.help(), { button: 'Compris' }) });
    items.push({ label: 'Sensibilité caméra', ...num('sens', 0.1, 0.3, 3, v => v.toFixed(1)) }, { label: 'Inverser l’axe vertical', ...tg('invertY') }, { label: 'Musique', ...num('music', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) }, { label: 'Effets sonores', ...num('sfx', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) }, { label: 'Vibrations', ...tg('rumble') });
    if (inGame) items.push({ label: 'Abandonner et revenir à la place', cls: 'exit', act: () => { close(); if (this.mg && this.mg.persist) this.mg.persist(); this.backToPlaza(); } });
    items.push({ label: 'Sauvegarder et quitter vers NOVA', cls: 'exit', act: () => { close(); this.exit(); } });
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  showControls() {
    Modal.info('Commandes · CUBIKA', `<div class="ctrl-grid"><div><h4>Manette PS5</h4><ul><li><b>Joystick gauche</b> bouger · <b>L3</b> sprint</li><li><b>Joystick droit</b> caméra</li><li><b>✕</b> sauter · valider</li><li><b>▢ / R2</b> action (frapper, casser, prendre la pose)</li><li><b>L2</b> poser un bloc (Guerre des lits)</li><li><b>△</b> interagir, entrer dans un portail</li><li><b>○</b> s’accroupir · retour</li><li><b>Options</b> pause</li></ul></div><div><h4>Clavier & souris</h4><ul><li><b>ZQSD / WASD</b> bouger · <b>Maj</b> sprint</li><li><b>Souris</b> caméra (clique pour la verrouiller) · <b>flèches</b> aussi</li><li><b>Espace</b> sauter</li><li><b>Clic gauche / F</b> action</li><li><b>Clic droit / Q</b> bloc</li><li><b>E / R</b> interagir · <b>C</b> accroupi</li><li><b>Échap</b> pause</li></ul></div><div><h4>Tactile</h4><ul><li>Moitié gauche : joystick</li><li>Glisser à droite : caméra</li><li>Boutons : saut, action, △, bloc, bas</li><li>Touche l’invite en haut pour interagir</li></ul></div></div>`, { button: 'Compris' });
  }

  /* ================= sons ================= */
  sfx(n) {
    switch (n) {
      case 'jump': Sound.tone(420, 0.14, { type: 'square', vol: 0.05, to: 820 }); break;
      case 'jump2': Sound.tone(300, 0.3, { type: 'square', vol: 0.06, to: 1200 }); break;
      case 'land': Sound.sfx('land'); break;
      case 'coin': Sound.sfx('coin'); break;
      case 'buy': Sound.sfx('ring'); Sound.tone(1568, 0.25, { type: 'triangle', vol: 0.06, delay: 0.1 }); break;
      case 'nope': Sound.sfx('fizzle'); break;
      case 'hit': Sound.sfx('hit'); break;
      case 'die': Sound.tone(600, 0.5, { type: 'square', vol: 0.06, to: 90 }); Sound.noise(0.3, { vol: 0.12, freq: 900, to: 200 }); break;
      case 'win': Sound.sfx('mission'); break;
      case 'tick': Sound.tone(1200, 0.05, { type: 'square', vol: 0.04 }); break;
      case 'pop': Sound.tone(700, 0.08, { type: 'sine', vol: 0.1, to: 1400 }); break;
      case 'break': Sound.noise(0.25, { vol: 0.2, freq: 2200, to: 500, type: 'bandpass' }); Sound.tone(900, 0.12, { type: 'triangle', vol: 0.05, to: 1600 }); break;
      case 'check': [784, 988, 1175].forEach((f, i) => Sound.tone(f, 0.18, { type: 'triangle', vol: 0.07, delay: i * 0.06 })); break;
      case 'place': Sound.tone(220, 0.07, { type: 'square', vol: 0.05 }); Sound.noise(0.06, { vol: 0.08, freq: 1200 }); break;
      default: Sound.sfx(n);
    }
  }

  /* ================= boucle ================= */
  exit() { if (this.mg && this.mg.persist) this.mg.persist(); this.save(); this.destroy(); this.onExit && this.onExit(); }
  destroy() {
    this.running = false; removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis);
    this.exitLock(); Input.touch.mx = Input.touch.my = 0; Input.touch.btn = {}; this.root.classList.remove('has-touch');
    try { this.mg && this.mg.destroy && this.mg.destroy(); } catch (e) {}
    this.world.clear();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    clearMatCache(); this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {}
    this.root.innerHTML = '';
  }
  resize() { const w = this.root.clientWidth || innerWidth, h = this.root.clientHeight || innerHeight; this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.root.classList.toggle('portrait', h > w); }
  loop(now) {
    if (!this.running) return; requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (dt <= 0) dt = 0.016;
    Input.poll(); const nav = Input.nav(dt);
    this.time += dt; this.S.playTime += dt;
    if (Modal.active) { Modal.active.update(nav); this.render(); return; }
    if (this.ui) {
      this.ui.update(nav); if (!this.running) return;
      if (this.wardCam) { const P = this.player; animStand(P, dt); const f = P.pos.clone(); const cy = P.yaw; const off = this.root.clientWidth > this.root.clientHeight * 1.2 ? 1 : 0.3; this.camera.position.set(P.pos.x + Math.sin(cy) * 5.4 - Math.cos(cy) * 2.6 * off, P.pos.y + 2.1, P.pos.z + Math.cos(cy) * 5.4 + Math.sin(cy) * 2.6 * off); f.y += 1.1; f.x -= Math.cos(cy) * 2.2 * off; f.z += Math.sin(cy) * 2.2 * off; this.camera.lookAt(f); P.yaw += dt * 0.5; P.sync(); }
      if (this.ui && this.ui.tick) this.ui.tick(dt);
      this.bits.update(dt); this.render(); return;
    }
    if (Input.pressed('pause')) { this.openPause(); this.render(); return; }
    if (this.mode === 'plaza') this.updatePlaza(dt);
    else if (this.mg) { try { this.mg.update(dt); } catch (e) { console.error(e); this.toast('Erreur du mini-jeu', String(e.message || e).slice(0, 80), '#ff4d6d'); this.mg = null; this.enterPlaza(); } }
    this.bits.update(dt);
    if (this.sun) { const p = this.ocam.cur; this.sun.position.set(p.x + 30, p.y + 50, p.z + 20); this.sun.target.position.copy(p); }
    if (this.time - (this.lastSave || 0) > 40) { if (this.mg && this.mg.persist) this.mg.persist(); this.save(); }
    this.render(); this.perf(dt);
  }
  render() { if (this.renderer) this.renderer.render(this.scene, this.camera); }
  perf(dt) { this.fa = (this.fa || 0) + dt; this.fn = (this.fn || 0) + 1; if (this.fa < 1.5) return; const fps = this.fn / this.fa; this.fa = 0; this.fn = 0; if (Store.settings.fps) this.hud.fps.textContent = `${fps.toFixed(0)} FPS · ×${this.pr.toFixed(2)}`; if (fps < 40 && this.pr > 0.5) { this.pr = Math.max(0.5, this.pr - 0.1); this.renderer.setPixelRatio(this.pr); this.resize(); } else if (fps > 57 && this.pr < this.prTarget) { this.pr = Math.min(this.prTarget, this.pr + 0.05); this.renderer.setPixelRatio(this.pr); this.resize(); } }
}
function animStand(P, dt) { const p = P.av.parts; P.anim += dt * 2; p.legL.rotation.x = p.legR.rotation.x = 0; p.armL.rotation.x = p.armR.rotation.x = Math.sin(P.anim) * 0.06; p.body.position.y = 0; p.body.rotation.x = 0; }
