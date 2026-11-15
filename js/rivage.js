// RIVAGE — survie en monde ouvert sur une île. Jeu original pour NOVA.
import * as THREE from './three.module.min.js';
import { Input, Sound, Store, Modal, ListMenu, clamp, lerp, damp, rng, el, fmtDuration, isTV, isTouch, lowEnd } from './core.js';
import { World, ISLANDS, GEO, SIZE, HALF, G, CELL, smooth, WATER_VS, WATER_FS, SKY_VS, SKY_FS, patchTerrain, woodTexture, mergeC, mat } from './rivage-world.js';
import { ITEMS, TOOLS, RECIPES, PIECES, ANIMALS, PRED_NAMES, ERAS, MODES, MODS, JOURNAL, CSS, STATION_NAMES, buildHuman, toolMesh, buildAnimal } from './rivage-data.js';

THREE.ColorManagement.enabled = false;
const V3 = THREE.Vector3, R = 0.35, PH = 1.75, DAY = 1200, SEA = -1.3;
const GP = { use: 'R2', alt: 'L2', jump: '✕', crouch: '○', act: '△', inv: '▢', build: '↑', eat: '↓', drink: '→', light: '←', next: 'R1', journal: 'PAVÉ', pause: 'OPTIONS' };
const KB = { use: 'Clic G', alt: 'Clic D', jump: 'Espace', crouch: 'C', act: 'E', inv: 'Tab', build: 'B', eat: 'G', drink: 'H', light: 'T', next: 'Molette', journal: 'M', pause: 'Échap' };
const TC = { use: 'UTILISER', alt: 'PIVOTER', jump: 'SAUT', crouch: 'PLONGER', act: 'ACTION', inv: 'SAC', build: 'BÂTIR', eat: 'MANGER', drink: 'BOIRE', next: 'OUTIL', journal: 'CARTE', pause: '❚❚' };
const gly = a => Input.device === 'gp' ? `<i class="g g-r">${GP[a]}</i>` : `<i class="g g-k">${(Input.device === 'touch' ? TC : KB)[a]}</i>`;
const OBJ = {
  palm: { n: 'Palmier', hp: 5, r: 0.4, cy: 1.5, tree: 1, drop: { wood: 3, leaf: 3, coconut: 1 } }, tree: { n: 'Arbre', hp: 7, r: 0.5, cy: 1.5, tree: 1, drop: { wood: 5, stick: 2, leaf: 1 } },
  pine: { n: 'Pin', hp: 6, r: 0.4, cy: 1.5, tree: 1, drop: { wood: 4, stick: 2, leaf: 2 } }, dead: { n: 'Arbre mort', hp: 3, r: 0.35, cy: 1.5, tree: 1, drop: { wood: 2, stick: 3 } },
  rock: { n: 'Rocher', hp: 6, r: 1.0, cy: 0.5, rock: 1, drop: { stone: 4, flint: 1 } }, ironrock: { n: 'Roche ferreuse', hp: 8, r: 1.0, cy: 0.5, rock: 1, drop: { stone: 2, ore: 3 } },
  bush: { n: 'Buisson de baies', cy: 0.5, pick: 1, drop: { berry: 3, fiber: 1 } }, fern: { n: 'Fougère', cy: 0.4, pick: 1, drop: { fiber: 3 } }, aloe: { n: 'Aloès', cy: 0.3, pick: 1, drop: { aloe: 2 } },
  stick: { n: 'Bâton', cy: 0.1, pick: 1, drop: { stick: 1 } }, stone: { n: 'Pierre', cy: 0.1, pick: 1, drop: { stone: 1 } }, flint: { n: 'Silex', cy: 0.1, pick: 1, drop: { flint: 1 } },
  shell: { n: 'Coquillage', cy: 0.1, pick: 1, drop: { shell: 1 } }, coconut: { n: 'Noix de coco', cy: 0.15, pick: 1, drop: { coconut: 1 } },
};
function softTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

export class Rivage {
  constructor(root, { onExit }) {
    this.root = root; this.onExit = onExit; this.ui = null; this.running = true; this.time = 0;
    if (!document.getElementById('rv-css')) { const s = el('style'); s.id = 'rv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const sv = Store.getGame('rivage');
    this.loop = this.loop.bind(this); this.last = performance.now(); requestAnimationFrame(this.loop);
    Sound.playMusic(null);
    if (sv && sv.state && sv.state.cfg) this.begin(sv.state.cfg, sv.state.S); else this.setup();
  }

  /* ================= écran de nouvelle partie ================= */
  setup() {
    const cfg = { island: 'tropic', era: 'e2026', mode: 'story', mods: {}, seed: (Math.random() * 99999) | 0 };
    const ov = el('div', 'rv-setup');
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">RIVAGE · NOUVELLE PARTIE</div><h2>Choisis ton monde</h2><div class="gm-list"></div><div class="gm-foot"></div></div>`;
    this.root.appendChild(ov);
    const cyc = (obj, key, list) => ({ left: () => { cfg[key] = list[(list.indexOf(cfg[key]) + list.length - 1) % list.length]; }, right: () => { cfg[key] = list[(list.indexOf(cfg[key]) + 1) % list.length]; } });
    const items = [
      { label: 'Île', sub: () => `${ISLANDS[cfg.island].sub} — ${ISLANDS[cfg.island].desc}`, get: () => ISLANDS[cfg.island].name, ...cyc(cfg, 'island', Object.keys(ISLANDS)) },
      { label: 'Époque', sub: () => `${ERAS[cfg.era].sub} — change ton équipement de départ et l’épave`, get: () => ERAS[cfg.era].n, ...cyc(cfg, 'era', Object.keys(ERAS)) },
      { label: 'Mode', sub: () => MODES[cfg.mode].sub, get: () => MODES[cfg.mode].n, ...cyc(cfg, 'mode', Object.keys(MODES)) },
      ...Object.entries(MODS).map(([id, [n, d]]) => ({ label: 'Mod · ' + n, sub: d, get: () => cfg.mods[id] ? '<b class="eq">Activé</b>' : 'Non', left: () => { cfg.mods[id] = !cfg.mods[id]; }, right: () => { cfg.mods[id] = !cfg.mods[id]; } })),
      { label: 'Monde aléatoire', sub: 'Numéro de l’île générée', get: () => '#' + cfg.seed, left: () => { cfg.seed = (Math.random() * 99999) | 0; }, right: () => { cfg.seed = (Math.random() * 99999) | 0; } },
      { label: '▶ Commencer l’aventure', cls: 'warn', act: () => { ov.remove(); this.ui = null; this.begin(cfg, null); } },
      { label: 'Retour à NOVA', cls: 'exit', act: () => { this.destroy(); this.onExit && this.onExit(); } },
    ];
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    ov.querySelector('.gm-foot').innerHTML = `${gly('jump')} Valider &nbsp; ◀ ▶ Changer`;
    this.ui = { update: nav => { list.update(nav); if (Input.pressed('back') && this.ui && !this.world) { this.destroy(); this.onExit && this.onExit(); } } };
  }

  /* ================= démarrage ================= */
  begin(cfg, saved) {
    this.cfg = cfg; this.mods = cfg.mods || {}; this.isl = ISLANDS[cfg.island]; this.era = ERAS[cfg.era]; this.creative = cfg.mode === 'creative'; this.hard = cfg.mode === 'hard';
    this.root.style.setProperty('--acc', this.isl.acc);
    this.quality = Store.settings.quality === 'auto' ? ((isTV || lowEnd) ? 'low' : isTouch ? 'medium' : 'high') : Store.settings.quality;
    const W = this.world = new World(cfg), st = W.sites;
    this.S = saved || { day: 1, tod: 0.31, p: { x: st.spawn[0], z: st.spawn[1], y: 0, yaw: Math.atan2(st.spawn[0], st.spawn[1]), hp: 100, food: 78, water: 72, en: 100 }, inv: {}, tool: 'hands', removed: {}, digs: [], pieces: [], spawn: null, story: { step: 0, frags: [], flags: {}, maya: 'none', rel: 0, talk: 0, pages: [], gift: 0 }, weather: 'clear', wT: 150, collect: {}, stats: { kills: 0, dug: 0, built: 0, crafted: 0, deaths: 0 }, playTime: 0, ended: null, pid: 1 };
    const S = this.S;
    if (!saved) { Object.assign(S.inv, this.era.start); if (this.creative) Object.assign(S.inv, { axe2: 1, pick2: 1, spear: 1, hammer: 1, torch: 1 }); }
    for (const d of S.digs) W.dig(d[0], d[1], d[2], d[3]);
    this.boxes = []; this.static = []; this.pieces = []; this.animals = []; this.spots = []; this.fires = []; this.falling = [];
    this.buildMode = null; this.focus = null; this.useCd = 0; this.wet = 0; this.rainK = 0; this.flash = 0; this.hudT = 0; this.spawnT = 0; this.tempFeel = 20; this.o2 = 100; this.toastQ = {};
    this.initScene(); this.initObjects(); this.initSites(); this.initPlayer(); this.initHUD(); this.initAudio();
    for (const p of S.pieces) this.addPiece(p, true);
    this.rebuildBoxes();
    if (isTouch || Input.device === 'touch') this.initTouch();
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize); this.resize();
    this.onVis = () => { if (document.hidden) { this.saveGame(); if (!this.ui) this.openPause(); } }; document.addEventListener('visibilitychange', this.onVis);
    this.P.pos.set(S.p.x, Math.max(S.p.y, W.getH(S.p.x, S.p.z)), S.p.z); this.cam.yaw = S.p.yaw || 0;
    if (!saved) this.intro(); else { this.toast('Partie reprise', `Jour ${S.day} · ${this.isl.name}`); this.placeMaya(); }
    this.lastSave = 0;
  }
  async intro() {
    this.ui = { update() {} }; this.fade(true, `${this.isl.name.toUpperCase()}\n${this.era.n}`); this.fadeEl.style.transition = 'none'; await this.wait(2400); this.fadeEl.style.transition = ''; this.fade(false); this.ui = null;
    await this.say('', this.era.intro);
    await this.say('', `Tu es en vie. Pour le rester : de l’eau, à manger, un feu avant la nuit.\n\n${gly('act')} ramasser · ${gly('use')} utiliser l’outil · ${gly('inv')} sac et fabrication · ${gly('build')} construire`);
    this.saveGame();
  }

  /* ================= scène ================= */
  initScene() {
    const q = this.quality, W = this.world, low = q === 'low';
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: q === 'high', powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.prTarget = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'medium' ? Math.min(devicePixelRatio, 1.4) : (isTV ? 0.6 : Math.min(devicePixelRatio, 0.8)); this.pr = this.prTarget; r.setPixelRatio(this.pr);
    r.shadowMap.enabled = !low; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'game-canvas'; this.root.appendChild(r.domElement);
    r.domElement.addEventListener('click', () => { if (!this.ui && !Modal.active && !isTouch && Input.device !== 'touch' && document.pointerLockElement !== r.domElement) { try { const p = r.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } });
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.15, 3000);
    this.fogFar = low ? (isTV ? 240 : 330) : q === 'medium' ? 480 : 620;
    sc.fog = new THREE.Fog(0x9ab, 40, this.fogFar);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); sc.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = !low;
    sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024); const sc2 = sun.shadow.camera; sc2.left = sc2.bottom = -34; sc2.right = sc2.top = 34; sc2.near = 1; sc2.far = 220; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
    sc.add(sun, sun.target);
    // ciel
    this.skyU = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new V3(0, 1, 0) }, uNight: { value: 0 }, uDusk: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.3 }, uCloudCol: { value: new THREE.Color(1, 1, 1) } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; sc.add(this.sky);
    // terrain
    const tm = new THREE.MeshLambertMaterial({ vertexColors: true }); patchTerrain(tm);
    this.terrain = new THREE.Mesh(W.buildTerrain(low), tm); this.terrain.receiveShadow = true; sc.add(this.terrain);
    // océan
    const P = this.isl.pal;
    this.waterU = { uH: { value: W.heightTex() }, uTime: { value: 0 }, uSun: this.skyU.uSun, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color(...P.deep) }, uShallow: { value: new THREE.Color(...P.shallow) }, uFogCol: { value: new THREE.Color() }, uFogNear: { value: 40 }, uFogFar: { value: 600 }, uSize: { value: SIZE }, uWind: { value: 0 }, uUnder: { value: 0 } };
    const wg = new THREE.PlaneGeometry(6000, 6000); wg.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.water.renderOrder = 2; sc.add(this.water);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...P.deep).multiplyScalar(0.55) })); bed.position.y = -24; sc.add(bed);
    if (this.cfg.island === 'volcan') { const lava = new THREE.Mesh(new THREE.CircleGeometry(30, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a1a, fog: false })); let lowest = 1e9; for (let a = 0; a < 20; a++) lowest = Math.min(lowest, W.getH(Math.cos(a) * 6, Math.sin(a) * 6)); lava.position.set(0, lowest + 2.5, 0); sc.add(lava); this.lava = lava; const ll = new THREE.PointLight(0xff5a1a, 2, 160, 1.2); ll.position.set(0, lowest + 12, 0); sc.add(ll); }
    // pluie
    const n = low ? 300 : 800, rp = new Float32Array(n * 6); this.rainN = n; this.rainP = rp;
    for (let i = 0; i < n; i++) { rp[i * 6] = (Math.random() - 0.5) * 40; rp[i * 6 + 1] = Math.random() * 22; rp[i * 6 + 2] = (Math.random() - 0.5) * 40; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd6e6, transparent: true, opacity: 0.45, fog: false })); this.rain.frustumCulled = false; this.rain.visible = false; sc.add(this.rain);
    // particules
    this.soft = softTex(); const pn = this.pN = low ? 200 : 500; this.pI = 0;
    this.pp = new Float32Array(pn * 3); this.pc = new Float32Array(pn * 3); this.pv = new Float32Array(pn * 3); this.pl = new Float32Array(pn); this.pm = new Float32Array(pn); this.pb = new Float32Array(pn * 3); this.pg = new Float32Array(pn);
    for (let i = 0; i < pn; i++) this.pp[i * 3 + 1] = -999;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    this.parts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.5, map: this.soft, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); this.parts.frustumCulled = false; this.parts.renderOrder = 3; sc.add(this.parts);
    this.mats = { wood: new THREE.MeshLambertMaterial({ map: woodTexture('wood') }), stone: new THREE.MeshLambertMaterial({ map: woodTexture('stone') }), thatch: new THREE.MeshLambertMaterial({ map: woodTexture('thatch') }), flame: new THREE.MeshBasicMaterial({ color: 0xffa23d, transparent: true, opacity: 0.9 }), rockM: new THREE.MeshLambertMaterial({ color: 0x77736c, flatShading: true }), glow: new THREE.MeshBasicMaterial({ color: 0x7ff6ff }) };
    this.torchLight = new THREE.PointLight(0xffb060, 0, 26, 1.4); sc.add(this.torchLight);
    this.fireLights = [0, 1].map(() => { const l = new THREE.PointLight(0xff9a40, 0, 30, 1.3); sc.add(l); return l; });
  }
  burst(p, n, hex, spd = 3, life = 0.6, grav = 6) {
    const c = new THREE.Color(hex);
    for (let k = 0; k < n; k++) { const i = this.pI; this.pI = (i + 1) % this.pN; const a = Math.random() * 6.28, e = Math.random() * 3.14, s = spd * (0.3 + Math.random() * 0.7);
      this.pp[i * 3] = p.x; this.pp[i * 3 + 1] = p.y; this.pp[i * 3 + 2] = p.z; this.pv[i * 3] = Math.sin(e) * Math.cos(a) * s; this.pv[i * 3 + 1] = Math.abs(Math.cos(e)) * s; this.pv[i * 3 + 2] = Math.sin(e) * Math.sin(a) * s;
      this.pl[i] = this.pm[i] = life * (0.6 + Math.random() * 0.6); this.pg[i] = grav; this.pb[i * 3] = c.r; this.pb[i * 3 + 1] = c.g; this.pb[i * 3 + 2] = c.b; }
  }
  updateParts(dt) {
    for (let i = 0; i < this.pN; i++) { if (this.pl[i] <= 0) continue; this.pl[i] -= dt; const k = i * 3; if (this.pl[i] <= 0) { this.pp[k + 1] = -999; continue; }
      this.pv[k + 1] -= this.pg[i] * dt; this.pp[k] += this.pv[k] * dt; this.pp[k + 1] += this.pv[k + 1] * dt; this.pp[k + 2] += this.pv[k + 2] * dt;
      const f = this.pl[i] / this.pm[i]; this.pc[k] = this.pb[k] * f; this.pc[k + 1] = this.pb[k + 1] * f; this.pc[k + 2] = this.pb[k + 2] * f; }
    this.parts.geometry.attributes.position.needsUpdate = this.parts.geometry.attributes.color.needsUpdate = true;
  }

  /* ================= objets récoltables ================= */
  initObjects() {
    const W = this.world, low = this.quality === 'low', S = this.S;
    this.objs = W.scatter(low); this.grid = new Map(); this.inst = {};
    const by = {}; for (const o of this.objs) (by[o.type] = by[o.type] || []).push(o);
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0);
    for (const [type, list] of Object.entries(by)) {
      const geo = type === 'rock' ? GEO.rock() : GEO[type]();
      const im = new THREE.InstancedMesh(geo, m, list.length); im.castShadow = !low && (OBJ[type].tree || OBJ[type].rock); im.receiveShadow = false;
      list.forEach((o, i) => { o.idx = i; o.hp = OBJ[type].hp || 1; o.alive = !(o.id in S.removed); this.setObj(im, o, m4, q, up); const k = this.gk(o.x, o.z); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(o); });
      im.computeBoundingSphere(); im.frustumCulled = false; this.scene.add(im); this.inst[type] = im;
    }
    const pts = W.grassPoints(low ? (isTV ? 900 : 2500) : this.quality === 'medium' ? 7000 : 14000);
    const gm = new THREE.InstancedMesh(GEO.grass(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), pts.length);
    const sv = new V3(), pv = new V3();
    pts.forEach((p, i) => { q.setFromAxisAngle(up, p[4]); m4.compose(pv.set(p[0], p[1] - 0.05, p[2]), q, sv.set(p[3], p[3], p[3])); gm.setMatrixAt(i, m4); });
    gm.frustumCulled = false; this.scene.add(gm); this.grassPts = pts; this.grassM = gm;
  }
  gk(x, z) { return ((x + HALF) / 12 | 0) + ((z + HALF) / 12 | 0) * 1000; }
  setObj(im, o, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0)) {
    q.setFromAxisAngle(up, o.rot); const s = o.alive ? o.s : 0; m4.compose(new V3(o.x, o.y - 0.08, o.z), q, new V3(s, s, s)); im.setMatrixAt(o.idx, m4); im.instanceMatrix.needsUpdate = true;
  }
  near(x, z, rad, fn) { const c0 = ((x - rad + HALF) / 12) | 0, c1 = ((x + rad + HALF) / 12) | 0, d0 = ((z - rad + HALF) / 12) | 0, d1 = ((z + rad + HALF) / 12) | 0; for (let d = d0; d <= d1; d++) for (let c = c0; c <= c1; c++) { const l = this.grid.get(c + d * 1000); if (l) for (const o of l) if (o.alive) fn(o); } }
  removeObj(o) { o.alive = false; this.S.removed[o.id] = this.S.day; this.setObj(this.inst[o.type], o); }
  regrow() { const S = this.S; for (const id in S.removed) { const o = this.objs[id]; if (!o) { delete S.removed[id]; continue; } const d = OBJ[o.type]; const need = d.rock ? 9999 : d.tree ? 6 : 2; if (S.day - S.removed[id] >= need) { delete S.removed[id]; o.alive = true; o.hp = d.hp || 1; this.setObj(this.inst[o.type], o); } } }

  /* ================= lieux de l'histoire ================= */
  initSites() {
    const W = this.world, st = W.sites, sc = this.scene, M = this.mats, S = this.S;
    const stone = (x, y, z, sx, sy, sz, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.stone); m.position.set(x, y + sy / 2, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; sc.add(m); return m; };
    const plat = (p, rad, h = 0.5) => { const y = W.getH(p[0], p[1]); let top = y; for (let a = 0; a < 8; a++) top = Math.max(top, W.getH(p[0] + Math.cos(a * 0.785) * rad, p[1] + Math.sin(a * 0.785) * rad)); const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad + 0.6, top - y + h + 3, 20), M.stone); m.position.set(p[0], (top + h + y - 3) / 2, p[1]); m.receiveShadow = true; sc.add(m); this.static.push({ minX: p[0] - rad * 0.8, maxX: p[0] + rad * 0.8, minZ: p[1] - rad * 0.8, maxZ: p[1] + rad * 0.8, minY: y - 3, maxY: top + h }); return top + h; };
    const fragM = (x, y, z) => { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), M.glow); g.position.set(x, y, z); sc.add(g); const l = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshBasicMaterial({ color: 0x35e8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(l); return g; };
    this.fragMeshes = {};
    // sources d'eau douce
    st.springs.forEach((p, i) => { const y = W.getH(p[0], p[1]); const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3fb7d8, transparent: true, opacity: 0.8 })); pool.position.set(p[0], y + 0.25, p[1]); sc.add(pool);
      for (let a = 0; a < 7; a++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.4, 0), M.rockM); r.position.set(p[0] + Math.cos(a * 0.9) * 2.5, y + 0.2, p[1] + Math.sin(a * 0.9) * 2.5); r.castShadow = true; sc.add(r); }
      this.spots.push({ id: 'spring' + i, x: p[0], z: p[1], y, r: 3.4, pool, label: () => S.story.flags.dry ? 'Source tarie' : 'Boire à la source', fn: () => this.drinkSpring() }); });
    this.springPools = this.spots.filter(s => s.pool).map(s => s.pool);
    // épave
    { const p = st.wreck, y = W.getH(p[0], p[1]), g = new THREE.Group(); g.position.set(p[0], y, p[1]); g.rotation.y = 0.7;
      const add = (geo, col, x, yy, z, rx = 0, rz = 0, s) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, yy, z); m.rotation.set(rx, 0, rz); if (s) m.scale.set(...s); m.castShadow = true; g.add(m); return m; };
      if (this.cfg.era === 'e1720') { add(new THREE.SphereGeometry(3, 16, 10, 0, 6.3, 1.4, 1.75), 0x5a4028, 0, 1.6, 0, 0, 0.35, [1, 0.9, 2.6]); add(new THREE.CylinderGeometry(0.2, 0.25, 9, 8), 0x4a3522, 0.5, 4, 1, 0.5, 0.3); add(new THREE.PlaneGeometry(4, 3), 0xd8cfb8, 1.6, 5.4, 2.2, 0.5, 0.3); for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.2, 2.4, 0.25), 0x4a3522, -2.2, 1.2, -4 + i * 2, 0, 0.5); }
      else if (this.cfg.era === 'e2026') { add(new THREE.CapsuleGeometry(1.1, 6, 6, 12), 0xe9ecef, 0, 1.2, 0, Math.PI / 2, 0.12); add(new THREE.BoxGeometry(11, 0.2, 1.8), 0xd23a2e, 0.5, 2.5, 0.6, 0, 0.22); add(new THREE.BoxGeometry(0.15, 2, 1.4), 0xd23a2e, 0, 2.6, -3.6, 0, 0.12); add(new THREE.CapsuleGeometry(0.4, 4, 4, 8), 0xc9cdd2, -1.8, 0.4, 0.5, Math.PI / 2, 0); }
      else { add(new THREE.CylinderGeometry(1.2, 2.3, 3, 14), 0x2f343c, 0, 1.3, 0, 0.35, 0.2); add(new THREE.SphereGeometry(4, 14, 8, 0, 6.3, 0, 1.2), 0xff7a2e, 4.5, 0.3, 2, 0, 1.2, [1, 0.25, 1]); add(new THREE.BoxGeometry(0.9, 0.5, 0.06), 0x35e8ff, 0.2, 1.6, 1.75, 0.35, 0.2); }
      sc.add(g); this.wreckPos = new V3(p[0], y, p[1]);
      this.spots.push({ id: 'wreck', x: p[0] + 3, z: p[1] + 3, y, r: 5.5, label: () => S.story.flags.wreck ? null : 'Fouiller l’épave', fn: () => this.sceneWreck() }); }
    // tanière
    { const p = st.den, y = W.getH(p[0], p[1]); for (let a = 0; a < 9; a++) { if (a === 0) continue; const ang = a * 0.698, r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random(), 0), M.rockM); r.position.set(p[0] + Math.cos(ang) * 5, W.getH(p[0] + Math.cos(ang) * 5, p[1] + Math.sin(ang) * 5) + 0.6, p[1] + Math.sin(ang) * 5); r.scale.y = 1.3; r.castShadow = true; sc.add(r); this.static.push({ minX: r.position.x - 1.2, maxX: r.position.x + 1.2, minZ: r.position.z - 1.2, maxZ: r.position.z + 1.2, minY: y - 3, maxY: r.position.y + 1.6 }); }
      this.fragMeshes.den = fragM(p[0], y + 1, p[1]);
      this.spots.push({ id: 'den', x: p[0], z: p[1], y, r: 2.6, label: () => S.story.frags.includes('den') ? null : 'Prendre le fragment', fn: () => this.takeFrag('den', 1) });
      this.spots.push({ id: 'denMother', x: p[0] + 5, z: p[1], y, r: 9, vert: 14, auto: true, label: () => null, fn: () => this.sceneDen() }); }
    // ruines englouties
    { const p = st.sunken, y = W.getH(p[0], p[1]); for (let a = 0; a < 6; a++) stone(p[0] + Math.cos(a * 1.047) * 4, y - 0.5, p[1] + Math.sin(a * 1.047) * 4, 0.9, 3 + (a % 3), 0.9, a); stone(p[0], y - 0.3, p[1], 2, 0.9, 2);
      this.fragMeshes.sunken = fragM(p[0], y + 1.5, p[1]);
      this.spots.push({ id: 'sunken', x: p[0], z: p[1], y: y + 1, r: 3, vert: 3, label: () => S.story.frags.includes('sunken') ? null : 'Prendre le fragment', fn: () => this.takeFrag('sunken', 2) }); }
    // sanctuaire
    { const p = st.sanct, top = plat(p, 6.5); for (let a = 0; a < 8; a++) { stone(p[0] + Math.cos(a * 0.785) * 5.6, top, p[1] + Math.sin(a * 0.785) * 5.6, 0.8, 3.2, 0.8, a); const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 5), M.glow); c.position.set(p[0] + Math.cos(a * 0.785 + 0.4) * 3.6, top + 0.45, p[1] + Math.sin(a * 0.785 + 0.4) * 3.6); sc.add(c); }
      stone(p[0], top, p[1], 1.2, 1, 1.2); this.fragMeshes.sanct = fragM(p[0], top + 1.7, p[1]);
      this.spots.push({ id: 'sanct', x: p[0], z: p[1], y: top, r: 3, label: () => S.story.frags.includes('sanct') ? null : 'Examiner le fragment', fn: () => this.sceneSanct() }); }
    // sommet : le Passage
    { const p = st.summit, top = plat(p, 8, 0.6); this.gateY = top; this.gatePos = new V3(p[0], top, p[1]);
      stone(p[0] - 2.6, top, p[1] - 4, 1.1, 6.5, 1.1); stone(p[0] + 2.6, top, p[1] - 4, 1.1, 6.5, 1.1); stone(p[0], top + 6.5, p[1] - 4, 7.4, 1, 1.3);
      this.static.push({ minX: p[0] - 3.2, maxX: p[0] - 2, minZ: p[1] - 4.6, maxZ: p[1] - 3.4, minY: top, maxY: top + 6.5 }, { minX: p[0] + 2, maxX: p[0] + 3.2, minZ: p[1] - 4.6, maxZ: p[1] - 3.4, minY: top, maxY: top + 6.5 });
      const portal = this.portal = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 6.4), new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); portal.position.set(p[0], top + 3.25, p[1] - 4); sc.add(portal);
      stone(p[0], top, p[1] + 1, 1.4, 1, 1.0);
      const cairn = new THREE.Mesh(new THREE.ConeGeometry(1, 1.4, 6), M.rockM); cairn.position.set(p[0] + 5, top + 0.7, p[1] + 3); cairn.castShadow = true; sc.add(cairn);
      this.fragMeshes.summit = fragM(p[0] + 5, top + 1.9, p[1] + 3);
      this.spots.push({ id: 'cairn', x: p[0] + 5, z: p[1] + 3, y: top, r: 2.4, label: () => S.story.frags.includes('summit') ? null : 'Tombe d’Ilan Kerr : prendre le fragment', fn: () => this.takeFrag('summit', 5) });
      this.spots.push({ id: 'altar', x: p[0], z: p[1] + 1, y: top, r: 2.6, label: () => S.ended ? null : this.S.inv.key ? 'Ouvrir le Passage' : 'Autel du Passage', fn: () => this.sceneGate() }); }
    for (const id in this.fragMeshes) if (S.story.frags.includes(id)) this.fragMeshes[id].visible = false;
    // Maya
    this.maya = buildHuman({ skin: 0xb98562, top: this.cfg.era === 'e1720' ? 0x7a2f3a : this.cfg.era === 'e2026' ? 0x55606e : 0xe07a2e, bottom: 0x2c2f38, hair: 0x1c1410, long: true }); this.maya.visible = false; sc.add(this.maya);
    this.spots.push({ id: 'maya', x: 0, z: 0, y: 0, r: 2.6, label: () => this.maya.visible ? 'Parler à Maya' : null, fn: () => this.sceneMaya() });
    this.placeMaya();
    // mère de la tanière
    if (!S.story.flags.motherDead && !S.story.flags.motherFed) { const a = this.spawnAnimal('pred', st.den[0] + 5.5, st.den[1]); a.mother = true; a.hp = a.maxHp = 110; a.home = [st.den[0] + 5.5, st.den[1]]; a.g.scale.multiplyScalar(1.25); }
  }
  placeMaya() {
    const S = this.S, W = this.world, sp = this.spots.find(s => s.id === 'maya'); if (!this.maya) return;
    if (S.story.maya !== 'saved' || S.ended === 'her') { this.maya.visible = S.story.maya === 'found'; if (S.story.maya === 'found') { const p = this.wreckPos; this.maya.position.set(p.x + 3, W.getH(p.x + 3, p.z + 3) - 0.55, p.z + 3); this.maya.userData.sit = true; sp.x = p.x + 3; sp.z = p.z + 3; sp.y = p.y; } return; }
    const bed = S.pieces.find(p => p.t === 'bed'); const b = bed ? [bed.x + 1.6, bed.z + 0.8] : [this.wreckPos.x + 3, this.wreckPos.z + 3];
    this.maya.visible = true; this.maya.userData.sit = false; const y = Math.max(W.getH(b[0], b[1]), bed ? bed.y : -99); this.maya.position.set(b[0], y, b[1]); sp.x = b[0]; sp.z = b[1]; sp.y = y;
  }

  /* ================= joueur ================= */
  initPlayer() {
    this.P = { pos: new V3(), vel: new V3(), grounded: false, swim: false, facing: 0, phase: 0, swingT: 0, peak: 0, hurtCd: 0, sick: 0 };
    this.pm = buildHuman({ top: this.cfg.era === 'e1720' ? 0xd8cfb8 : this.cfg.era === 'e2026' ? 0x2f6d8a : 0x3a3f4a, bottom: 0x4a4034 }); this.scene.add(this.pm);
    this.cam = { yaw: 0, pitch: -0.15, dist: 4.2, fov: 68 };
    this.heldId = null; this.setTool(this.S.tool);
  }
  setTool(id) {
    if (id !== 'hands' && !this.S.inv[id]) id = 'hands';
    this.S.tool = id; const arm = this.pm.userData.armR; if (this.held) arm.remove(this.held);
    this.held = toolMesh(id); this.held.position.y = -0.58; this.held.rotation.x = Math.PI / 2; arm.add(this.held); this.hotDirty = true;
  }
  hotbar() { return ['hands', ...Object.keys(TOOLS).filter(t => t !== 'hands' && this.S.inv[t])]; }
  has(need) { if (this.creative) return true; for (const k in need) if ((this.S.inv[k] || 0) < need[k]) return false; return true; }
  take(need) { if (this.creative) return; for (const k in need) { this.S.inv[k] -= need[k]; if (this.S.inv[k] <= 0) delete this.S.inv[k]; } if (!this.S.inv[this.S.tool] && this.S.tool !== 'hands') this.setTool('hands'); }
  give(id, n = 1, quiet) { this.S.inv[id] = (this.S.inv[id] || 0) + n; this.hotDirty = true; if (!quiet) { this.toastQ[id] = (this.toastQ[id] || 0) + n; } }
  giveDrop(drop, mult = 1) { const k = (this.mods.rich ? 3 : 1) * mult; for (const id in drop) this.give(id, Math.max(1, Math.round(drop[id] * k))); }
  rebuildBoxes() { this.boxes = this.static.slice(); for (const p of this.pieces) if (!p.open) for (const b of p.boxes) this.boxes.push(b); }
  groundAt(x, z, y) { let g = this.world.getH(x, z); for (const b of this.boxes) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.maxY <= y + 0.7 && b.maxY > g) g = b.maxY; return g; }
  collide(prevY) {
    const P = this.P, p = P.pos;
    for (const b of this.boxes) {
      if (p.x + R <= b.minX || p.x - R >= b.maxX || p.z + R <= b.minZ || p.z - R >= b.maxZ) continue;
      if (p.y >= b.maxY || p.y + PH <= b.minY) continue;
      if ((prevY >= b.maxY - 0.06 || b.maxY - p.y <= 0.62) && P.vel.y <= 0.5) { p.y = b.maxY; P.vel.y = 0; P.grounded = true; continue; }
      if (p.y + PH - 0.2 < b.minY + 0.4 && P.vel.y > 0) { p.y = b.minY - PH; P.vel.y = 0; continue; }
      const l = p.x + R - b.minX, r = b.maxX - (p.x - R), f = p.z + R - b.minZ, k = b.maxZ - (p.z - R), m = Math.min(l, r, f, k);
      if (m === l) p.x -= l; else if (m === r) p.x += r; else if (m === f) p.z -= f; else p.z += k;
    }
    this.near(p.x, p.z, 2.5, o => { const d = OBJ[o.type]; if (!d.r) return; const rr = d.r * (d.rock ? o.s : 1) + R, dx = p.x - o.x, dz = p.z - o.z, L = Math.hypot(dx, dz); if (L < rr && L > 0.001 && p.y < o.y + (d.rock ? 1.2 * o.s : 5)) { p.x = o.x + dx / L * rr; p.z = o.z + dz / L * rr; } });
    const lim = HALF - 6; p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
    const g = this.world.getH(p.x, p.z); if (p.y <= g) { p.y = g; if (P.vel.y < 0) P.vel.y = 0; P.grounded = true; }
  }
  updatePlayer(dt) {
    const P = this.P, S = this.S, I = Input, cam = this.cam, W = this.world, p = P.pos;
    if (this.dead) return;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mvx = rx * I.ax.mx + fx * I.ax.my, mvz = rz * I.ax.mx + fz * I.ax.my, mm = Math.hypot(mvx, mvz);
    const th = W.getH(p.x, p.z), wasG = P.grounded, wasSwim = P.swim;
    P.swim = th < SEA - 0.05 && p.y < SEA + 0.25 && this.groundAt(p.x, p.z, p.y) < SEA;
    const sprint = I.down('sprint') && (S.p.en > 4 || this.creative), grav = this.mods.lowgrav ? 7 : 26;
    let spd = (sprint ? 7.4 : 4.3) * (this.mods.speed && sprint ? 2 : 1) * (S.p.en < 12 && !this.creative ? 0.7 : 1);
    if (P.swim) {
      if (!wasSwim) { this.sfx('splash'); this.burst(new V3(p.x, 0.1, p.z), 14, 0xcfefff, 3, 0.5, 8); }
      spd = sprint ? 4.4 : 3;
      const k = 1 - Math.exp(-5 * dt); P.vel.x += (mvx * spd - P.vel.x) * k; P.vel.z += (mvz * spd - P.vel.z) * k;
      let vy = clamp((SEA - p.y) * 2.5, -1.5, 2.5);
      if (I.down('crouch')) vy = -3; else if (I.down('jump') && p.y < SEA - 0.05) vy = 3.4;
      if (cam.pitch < -0.5 && mm > 0.3 && I.ax.my > 0.3) vy = Math.min(vy, -2.2);
      P.vel.y += (vy - P.vel.y) * (1 - Math.exp(-6 * dt)); P.grounded = false;
    } else {
      if (th < -0.35 && p.y < -0.3) spd *= 0.6;
      if (P.grounded) { const k = 1 - Math.exp(-12 * dt); P.vel.x += (mvx * spd - P.vel.x) * k; P.vel.z += (mvz * spd - P.vel.z) * k; }
      else { P.vel.x += mvx * 12 * dt; P.vel.z += mvz * 12 * dt; const hv = Math.hypot(P.vel.x, P.vel.z), cap = Math.max(spd, 4); if (hv > cap) { P.vel.x *= cap / hv; P.vel.z *= cap / hv; } }
      if (I.pressed('jump') && P.grounded) { P.vel.y = this.mods.lowgrav ? 7.5 : 8.2; P.grounded = false; this.sfx('step'); }
      else if (this.creative && I.down('jump') && !P.grounded) P.vel.y = Math.max(P.vel.y, 7);
      P.vel.y -= grav * dt; if (P.vel.y < -55) P.vel.y = -55;
    }
    const steps = Math.max(1, Math.ceil(P.vel.length() * dt / 0.12)), h = dt / steps;
    if (!P.swim) P.grounded = false;
    for (let s = 0; s < steps; s++) { const py = p.y; p.addScaledVector(P.vel, h); this.collide(py); }
    if (P.swim && p.y > SEA && this.world.getH(p.x, p.z) < SEA) { p.y = SEA; if (P.vel.y > 0) P.vel.y = 0; }
    if (!P.grounded) P.peak = Math.min(P.peak, P.vel.y);
    if (P.grounded && !wasG) { const imp = -P.peak; if (imp > 15 && !this.creative && !P.swim) this.hurt((imp - 15) * 4.5, 'chute'); if (imp > 5) this.sfx('land'); P.peak = 0; }
    if (P.grounded || P.swim) P.peak = 0;
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (hv > 0.4) P.facing = Math.atan2(P.vel.x, P.vel.z);
    if (this.buildMode || P.swingT > 0) P.facing = Math.atan2(fx, fz);
    const prevPh = P.phase; P.phase += hv * dt * (P.swim ? 1.3 : 1.55);
    if (P.grounded && Math.floor(P.phase / Math.PI) !== Math.floor(prevPh / Math.PI) && hv > 1) this.sfx(th < 0 ? 'wade' : 'step');
    if (sprint && mm > 0.3 && !this.creative) S.p.en = Math.max(0, S.p.en - dt * 0.9);
    P.swingT -= dt; P.hurtCd -= dt; this.useCd -= dt;
  }
  updateModel(dt) {
    const P = this.P, g = this.pm, u = g.userData, hv = Math.hypot(P.vel.x, P.vel.z);
    g.position.copy(P.pos); g.visible = !this.dead;
    let df = P.facing - g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); g.rotation.y += df * (1 - Math.exp(-12 * dt));
    const set = (o, x, k = 12) => { o.rotation.x = damp(o.rotation.x, x, k, dt); };
    const s = Math.sin(P.phase), k = clamp(hv / 4.5, 0, 1.5);
    if (P.swim) { set(u.hips, 1.25, 5); u.hips.position.y = damp(u.hips.position.y, 1.25, 5, dt); set(u.armL, -2.6 + Math.sin(P.phase) * 1.1); set(u.armR, -2.6 - Math.sin(P.phase) * 1.1); set(u.legL, s * 0.5); set(u.legR, -s * 0.5); }
    else {
      u.hips.position.y = damp(u.hips.position.y, 0.95 + Math.abs(Math.cos(P.phase)) * 0.05 * k, 10, dt);
      if (P.grounded) { set(u.hips, hv > 6 ? 0.2 : 0.03 * k, 6); set(u.legL, s * 0.8 * k); set(u.legR, -s * 0.8 * k); set(u.armL, -s * 0.6 * k); set(u.armR, s * 0.6 * k - (this.S.tool !== 'hands' ? 0.35 : 0)); }
      else { set(u.hips, 0.1, 6); set(u.legL, -0.5); set(u.legR, 0.3); set(u.armL, -1.2); set(u.armR, -0.5); }
    }
    if (P.swingT > 0) { const t = 1 - P.swingT / 0.34; u.armR.rotation.x = -2.5 + t * 2.4; }
    if (this.held && this.held.userData.flame) this.held.userData.flame.scale.setScalar(0.9 + Math.sin(this.time * 20) * 0.15);
    // Maya
    if (this.maya.visible) { const m = this.maya.userData; if (this.maya.userData.sit) { m.legL.rotation.x = m.legR.rotation.x = -1.5; m.hips.rotation.x = -0.15; } else { m.legL.rotation.x = m.legR.rotation.x = 0; m.hips.rotation.x = 0; const d = Math.atan2(P.pos.x - this.maya.position.x, P.pos.z - this.maya.position.z); if (P.pos.distanceTo(this.maya.position) < 8) this.maya.rotation.y = d; } m.armL.rotation.x = Math.sin(this.time * 1.3) * 0.05; m.head.rotation.y = Math.sin(this.time * 0.5) * 0.2; }
  }
  updateCamera(dt) {
    const c = this.cam, P = this.P, S = Store.settings, W = this.world, look = Input.consumeLook(), inv = S.invertY ? -1 : 1;
    c.yaw -= look.x * 0.0026 * S.sens + Input.ax.lx * 2.6 * S.sens * dt; c.pitch -= (look.y * 0.0026 * S.sens + Input.ax.ly * 1.8 * S.sens * dt) * inv;
    c.pitch = clamp(c.pitch, -1.35, 1.1);
    const fwd = this.fwd = new V3(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch)), right = new V3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    const target = new V3(P.pos.x, P.pos.y + (P.swim ? 0.9 : 1.55), P.pos.z).addScaledVector(right, 0.45);
    let want = this.buildMode ? 5.2 : 3.9, d = want;
    for (let t = 0.4; t <= want; t += 0.4) { const x = target.x - fwd.x * t, y = target.y - fwd.y * t, z = target.z - fwd.z * t; if (y < W.getH(x, z) + 0.3) { d = Math.max(0.5, t - 0.5); break; } let blocked = false; for (const b of this.boxes) if (x > b.minX - 0.1 && x < b.maxX + 0.1 && z > b.minZ - 0.1 && z < b.maxZ + 0.1 && y > b.minY && y < b.maxY) { blocked = true; break; } if (blocked) { d = Math.max(0.5, t - 0.5); break; } }
    c.dist = d < c.dist ? d : damp(c.dist, d, 4, dt);
    const pos = target.clone().addScaledVector(fwd, -c.dist);
    const gh = W.getH(pos.x, pos.z) + 0.25; if (pos.y < gh) pos.y = gh;
    if (Math.abs(pos.y) < 0.12) pos.y = pos.y < 0 ? -0.12 : 0.12;
    this.camera.position.copy(pos); this.camera.lookAt(pos.clone().add(fwd)); this.sky.position.copy(pos);
    this.under = pos.y < 0 && W.getH(pos.x, pos.z) < 0;
  }

  /* ================= visée / interaction ================= */
  rayBox(o, d, b, maxT) {
    let t0 = 0, t1 = maxT, n = 1; const ax = ['x', 'y', 'z'], mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
    for (let i = 0; i < 3; i++) { const oo = o[ax[i]], dd = d[ax[i]]; if (Math.abs(dd) < 1e-8) { if (oo < mn[i] || oo > mx[i]) return null; continue; } let a = (mn[i] - oo) / dd, c = (mx[i] - oo) / dd, s = -1; if (a > c) { const t = a; a = c; c = t; s = 1; } if (a > t0) { t0 = a; n = i; this._ns = s; } if (c < t1) t1 = c; if (t0 > t1) return null; }
    return t0 > 0 ? { t: t0, axis: n, sign: this._ns } : null;
  }
  updateFocus() {
    const o = this.camera.position, d = this.fwd, P = this.P, chest = new V3(P.pos.x, P.pos.y + 1.2, P.pos.z), reach = this.buildMode ? 8 : (TOOLS[this.S.tool].reach || 2.5) + 1.2, maxT = this.cam.dist + reach + 1;
    let best = null, bt = maxT;
    const sph = (cx, cy, cz, rad) => { const lx = cx - o.x, ly = cy - o.y, lz = cz - o.z, t = lx * d.x + ly * d.y + lz * d.z; if (t < 0 || t > bt) return -1; const dx = lx - d.x * t, dy = ly - d.y * t, dz = lz - d.z * t; return dx * dx + dy * dy + dz * dz < rad * rad ? t : -1; };
    if (!this.buildMode) {
      for (const a of this.animals) { if (a.dead) continue; const t = sph(a.pos.x, a.pos.y + a.rad * 0.6, a.pos.z, a.rad + 0.35); if (t > 0) { bt = t; best = { kind: 'animal', a, p: a.pos }; } }
      this.near(P.pos.x, P.pos.z, 7, ob => { const D = OBJ[ob.type], rad = D.tree ? 0.9 : D.rock ? 1.2 * ob.s : 0.7; const t = sph(ob.x, ob.y + D.cy, ob.z, rad); if (t > 0) { bt = t; best = { kind: 'obj', o: ob, p: new V3(ob.x, ob.y + D.cy, ob.z) }; } });
    }
    for (const b of this.boxes) { const h = this.rayBox(o, d, b, bt); if (h && h.t < bt) { bt = h.t; best = { kind: b.piece ? 'piece' : 'static', piece: b.piece, box: b, axis: h.axis, sign: h.sign, p: o.clone().addScaledVector(d, h.t) }; } }
    for (let t = Math.max(0.5, this.cam.dist - 0.5); t < bt; t += 0.3) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < this.world.getH(x, z)) { let a = t - 0.3, b2 = t; for (let i = 0; i < 5; i++) { const m = (a + b2) / 2; if (o.y + d.y * m < this.world.getH(o.x + d.x * m, o.z + d.z * m)) b2 = m; else a = m; } const px = o.x + d.x * b2, pz = o.z + d.z * b2; best = { kind: 'terrain', p: new V3(px, this.world.getH(px, pz), pz) }; bt = b2; break; } }
    if (best && best.p.distanceTo(chest) > reach + (best.kind === 'obj' && OBJ[best.o.type].rock ? 1 : 0)) best = null;
    // ramassage de proximité
    if (!this.buildMode && (!best || best.kind === 'terrain' || best.kind === 'static')) { let bd = 2.0, pk = null; this.near(P.pos.x, P.pos.z, 2.2, ob => { if (!OBJ[ob.type].pick) return; const dd = Math.hypot(ob.x - P.pos.x, ob.z - P.pos.z); if (dd < bd && Math.abs(ob.y - P.pos.y) < 2.2) { bd = dd; pk = ob; } }); if (pk) this.pickFocus = pk; else this.pickFocus = null; } else this.pickFocus = best && best.kind === 'obj' && OBJ[best.o.type].pick ? best.o : null;
    this.focus = best;
    // lieux
    this.spot = null; for (const s of this.spots) { const dd = Math.hypot(s.x - P.pos.x, s.z - P.pos.z); if (dd < s.r && Math.abs(P.pos.y - s.y) < (s.vert || 7)) { if (s.auto) { if (!this.ui) s.fn(); } else if (s.label()) { this.spot = s; break; } } }
  }
  doUse() {
    if (this.useCd > 0) return;
    const S = this.S, tool = TOOLS[S.tool], f = this.focus, P = this.P;
    if (this.buildMode) return this.place();
    this.useCd = 0.42; P.swingT = 0.34;
    if (!this.creative) S.p.en = Math.max(0, S.p.en - 0.25);
    if (!f) { this.sfx('swing'); return; }
    if (f.kind === 'animal') { this.hitAnimal(f.a, tool.dmg * (this.creative ? 5 : 1)); return; }
    if (f.kind === 'obj') {
      const o = f.o, D = OBJ[o.type];
      if (D.pick) return this.collect(o);
      if (D.tree) { if (tool.chop) { o.hp -= tool.chop; this.sfx('chop'); this.burst(f.p, 8, 0xc8a878, 3, 0.5, 9); if (o.hp <= 0) { this.giveDrop(D.drop); this.fell(o); this.sfx('fall'); } } else { this.sfx('thud'); if (Math.random() < 0.5) this.give(Math.random() < 0.5 ? 'stick' : 'leaf', 1); else this.hint('Il te faut une hache pour abattre un arbre'); } }
      else if (D.rock) { if (tool.mine) { o.hp -= tool.mine; this.sfx('mine'); this.burst(f.p, 8, 0xbbbbbb, 4, 0.4, 12); if (o.hp <= 0) { this.giveDrop(D.drop); this.removeObj(o); this.sfx('crumble'); } } else { this.sfx('thud'); this.hint('Il te faut une pioche pour casser la roche'); } }
      return;
    }
    if (f.kind === 'piece') { if (tool.demol) { this.removePiece(f.piece); } else this.interactPiece(f.piece); return; }
    if (f.kind === 'terrain') return this.digAt(f.p, tool);
    this.sfx('thud');
  }
  digAt(p, tool) {
    const W = this.world, S = this.S, depth = W.getH0(p.x, p.z) - W.getH(p.x, p.z), beach = W.getH0(p.x, p.z) < 3;
    if (!tool.dig) { if (!beach || depth > 0.8) { this.sfx('thud'); return this.hint('Il te faut une pioche pour creuser ici'); } }
    if (depth > 13.5) { this.sfx('thud'); return this.hint('Roche-mère : impossible de creuser plus profond'); }
    for (const pc of this.pieces) if (Math.hypot(pc.x - p.x, pc.z - p.z) < 3.2) return this.hint('Trop près d’une construction');
    if (this.spots.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 9 && s.id !== 'maya' && s.id !== 'denMother')) return this.hint('Ce lieu ne se laisse pas creuser');
    const amt = tool.dig || 0.25, rad = 2.6;
    W.dig(p.x, p.z, rad, amt);
    const last = S.digs[S.digs.length - 1];
    if (last && Math.hypot(last[0] - p.x, last[1] - p.z) < 0.6) last[3] = +(last[3] + amt).toFixed(2); else S.digs.push([+p.x.toFixed(1), +p.z.toFixed(1), rad, amt]);
    if (S.digs.length > 2500) S.digs.shift();
    this.near(p.x, p.z, rad + 1, o => { o.y = W.getH(o.x, o.z); this.setObj(this.inst[o.type], o); });
    S.stats.dug++; this.sfx(beach && depth < 1 ? 'sand' : 'mine'); this.burst(p.clone().add(new V3(0, 0.2, 0)), 10, beach ? 0xd8c890 : 0x8a7a66, 3.5, 0.5, 10);
    if (!tool.dig) { if (Math.random() < 0.25) this.give('shell', 1); return; }
    const sanct = Math.hypot(p.x - W.sites.sanct[0], p.z - W.sites.sanct[1]) < 60, q = Math.random(), iron = this.cfg.island === 'volcan' ? 0.3 : 0.18, best = tool.dig > 0.6 ? 1.5 : 1;
    if (depth > 0.6) this.giveDrop({ stone: 1 });
    if (depth > 1.5 && q < iron) this.giveDrop({ ore: 1 }); else if (q > 0.86) this.giveDrop({ flint: 1 });
    if (depth > 4 && Math.random() < (sanct ? 0.3 : 0.11) * best) { this.giveDrop({ crystal: 1 }); this.sfx('gem'); this.burst(p, 16, 0x7ff6ff, 4, 0.8, 2); }
  }
  fell(o) { o.alive = false; this.S.removed[o.id] = this.S.day; this.falling.push({ o, t: 0 }); }
  collect(o) { this.giveDrop(OBJ[o.type].drop); this.removeObj(o); this.sfx('pick'); this.P.swingT = 0.2; }
  doAct() {
    if (this.spot) return this.spot.fn();
    if (this.pickFocus) return this.collect(this.pickFocus);
    const f = this.focus; if (f && f.kind === 'piece') return this.interactPiece(f.piece);
  }
  hint(t) { if (this.time - (this.hintT || -9) < 2.5) return; this.hintT = this.time; this.toast('Impossible', t, 'red'); }

  /* ================= survie ================= */
  hurt(n, why) {
    const S = this.S; if (this.creative || this.dead || S.ended && false) return;
    S.p.hp -= n * (this.hard ? 1.5 : 1); this.hud.hurt.classList.remove('hit'); void this.hud.hurt.offsetWidth; this.hud.hurt.classList.add('hit'); this.sfx('hurt'); Input.rumble(0.7, 0.4, 150);
    if (S.p.hp <= 0) this.die(why);
  }
  async die(why) {
    const S = this.S; this.dead = true; S.stats.deaths++; S.p.hp = 0; this.sfx('death');
    const cause = { faim: 'Tu es mort de faim.', soif: 'Tu es mort de soif.', froid: 'Le froid t’a emporté.', noyade: 'Tu t’es noyé.', chute: 'La chute t’a été fatale.', bete: 'Tu n’as pas survécu à l’attaque.', maladie: 'La fièvre t’a emporté.' }[why] || 'Tu es mort.';
    if (this.hard) { this.fade(true, `${cause}\n\nMode Hardcore : la partie est effacée.\nTu as tenu ${S.day} jour${S.day > 1 ? 's' : ''}.`); await this.wait(5000); Store.deleteGame('rivage'); this.noSave = true; this.destroy(); this.onExit && this.onExit(); return; }
    this.fade(true, `${cause}\n\nTu rouvres les yeux, plus faible. Une partie de tes ressources est perdue.`); await this.wait(3800);
    for (const k in S.inv) if (!TOOLS[k] && !['frag', 'key', 'gourd', 'coat'].includes(k)) { S.inv[k] = Math.floor(S.inv[k] / 2); if (!S.inv[k]) delete S.inv[k]; }
    const sp = S.spawn || [this.world.sites.spawn[0], 0, this.world.sites.spawn[1]];
    this.P.pos.set(sp[0], Math.max(sp[1], this.world.getH(sp[0], sp[2])) + 0.3, sp[2]); this.P.vel.set(0, 0, 0);
    S.p.hp = 60; S.p.food = Math.max(S.p.food, 45); S.p.water = Math.max(S.p.water, 45); S.p.en = 70; this.o2 = 100; S.tod = 0.3; S.day++; this.dead = false; this.fade(false); this.saveGame();
  }
  updateNeeds(dt) {
    const S = this.S, p = S.p, P = this.P, W = this.world;
    // température ressentie
    const el = Math.sin((S.tod - 0.25) * Math.PI * 2);
    let t = this.isl.temp + el * 6 - Math.max(0, P.pos.y) * 0.075 - this.rainK * 5;
    const roof = this.boxes.some(b => b.piece && P.pos.x > b.minX && P.pos.x < b.maxX && P.pos.z > b.minZ && P.pos.z < b.maxZ && b.minY > P.pos.y + 1.2 && b.minY < P.pos.y + 6);
    const wetNow = P.swim || (this.rainK > 0.3 && !roof) || (W.getH(P.pos.x, P.pos.z) < -0.4 && P.pos.y < 0);
    this.wet = clamp(this.wet + (wetNow ? dt * 0.5 : -dt * 0.04), 0, 1);
    t -= this.wet * 8; if (roof) t += 4; if (S.inv.coat) t += 10; if (S.tool === 'torch') t += 3;
    let fire = 0; for (const f of this.fires) { const d = f.pos.distanceTo(P.pos); if (d < 7) fire = Math.max(fire, 1 - d / 7); } t += fire * 20; if (fire > 0.3) this.wet = Math.max(0, this.wet - dt * 0.2);
    if (this.cfg.island === 'volcan' && this.lava) { const d = Math.hypot(P.pos.x, P.pos.z); if (d < 45 && P.pos.y < this.lava.position.y + 14) { t += (45 - d) * 1.2; if (P.pos.y < this.lava.position.y + 0.4 && d < 30) this.hurt(40 * dt + 1, 'chute'); } }
    this.tempFeel = damp(this.tempFeel, t, 0.6, dt);
    if (this.creative || S.ended === 'left') { p.hp = 100; p.food = p.water = p.en = 100; this.o2 = 100; return; }
    const k = (this.hard ? 1.6 : 1) * dt / 60, hot = this.tempFeel > 34;
    p.food = Math.max(0, p.food - 2.1 * k); p.water = Math.max(0, p.water - (hot ? 5.6 : 3.1) * k); p.en = Math.max(0, p.en - 1.25 * k);
    if (this.rainK > 0.4 && !roof && !P.swim) p.water = Math.min(100, p.water + 1.5 * dt / 60 * 4);
    let dmg = 0, why = '';
    if (p.food <= 0) { dmg += 7; why = 'faim'; } if (p.water <= 0) { dmg += 10; why = 'soif'; }
    if (this.tempFeel < 8) { dmg += (8 - this.tempFeel) * 0.9; why = 'froid'; }
    if (this.tempFeel > 44) { dmg += (this.tempFeel - 44) * 1.5; why = 'chute'; }
    if (P.sick > 0) { P.sick -= dt; dmg += 5; why = why || 'maladie'; }
    const headUnder = P.pos.y + 1.55 < -0.02 && W.getH(P.pos.x, P.pos.z) < -1.4;
    this.o2 = clamp(this.o2 + (headUnder ? -100 / 40 : 60) * dt, 0, 100);
    if (this.o2 <= 0) { dmg += 480; why = 'noyade'; }
    if (dmg > 0) { p.hp -= dmg * (this.hard ? 1.5 : 1) * dt / 60 * (why === 'noyade' ? 1 : 1); this.dmgT = (this.dmgT || 0) + dt; if (this.dmgT > 4) { this.dmgT = 0; this.hud.hurt.classList.remove('hit'); void this.hud.hurt.offsetWidth; this.hud.hurt.classList.add('hit'); } if (p.hp <= 0) this.die(why); }
    else if (p.food > 35 && p.water > 35) p.hp = Math.min(100, p.hp + 5 * dt / 60 * (p.en > 50 ? 1.5 : 1));
    this.hud.cold.style.opacity = this.tempFeel < 10 ? clamp((10 - this.tempFeel) / 10, 0, 1) : 0;
  }
  eat(id) {
    const S = this.S, d = ITEMS[id] && ITEMS[id][2]; if (!d || !S.inv[id]) return false;
    if (id === 'water') { } this.take({ [id]: 1 });
    if (d.food) S.p.food = Math.min(100, S.p.food + d.food); if (d.water) S.p.water = Math.min(100, S.p.water + d.water); if (d.heal) S.p.hp = Math.min(100, S.p.hp + d.heal);
    if (d.sick && Math.random() < 0.45 && !this.creative) { this.P.sick = 25; this.toast('Tu te sens mal', 'La nourriture crue rend malade : cuis-la au feu', 'red'); }
    this.sfx(d.water && !d.food ? 'drink' : 'eat'); return true;
  }
  quickEat() { const order = ['meat', 'fish', 'ration', 'coconut', 'berry', 'rawfish', 'rawmeat']; for (const id of order) if (this.S.inv[id]) { this.eat(id); this.toast('Mangé', ITEMS[id][0]); return; } this.hint('Rien à manger dans le sac'); }
  quickDrink() { if (this.S.inv.water) { this.eat('water'); return this.toast('Bu', 'Eau potable'); } if (this.S.inv.coconut) { this.eat('coconut'); return this.toast('Bu', 'Noix de coco'); } if (this.P.swim || this.world.getH(this.P.pos.x, this.P.pos.z) < -0.2) { this.S.p.water = Math.min(100, this.S.p.water + 4); this.P.sick = Math.max(this.P.sick, 12); this.sfx('drink'); return this.toast('Eau de mer', 'Le sel te rend malade…', 'red'); } this.hint('Rien à boire : trouve une source, une noix de coco ou de la pluie'); }
  drinkSpring() { const S = this.S; if (S.story.flags.dry) return this.hint('La source est tarie depuis que le fragment du sanctuaire a été arraché'); S.p.water = 100; this.sfx('drink'); const cap = (S.inv.gourd || 0) * 2, add = Math.max(0, cap - (S.inv.water || 0)); if (add) this.give('water', add); this.toast('Eau douce', add ? 'Soif étanchée, gourde remplie' : 'Soif étanchée'); if (S.story.step === 2) this.advance(3); }

  /* ================= construction ================= */
  pieceBoxes(p) {
    const d = PIECES.find(x => x.id === p.t), sw = p.r % 2 === 1, sx = (sw ? d.size[2] : d.size[0]) / 2, sz = (sw ? d.size[0] : d.size[2]) / 2, h = d.size[1], out = [];
    if (d.id === 'fire') return out;
    if (d.stairs) { const dir = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.r]; for (let i = 0; i < 4; i++) { const c = -0.75 + i * 0.5, cx = p.x + dir[0] * c, cz = p.z + dir[1] * c, hx = dir[0] ? 0.25 : 1, hz = dir[1] ? 0.25 : 1; out.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, minY: p.y, maxY: p.y + (i + 1) * 0.6, piece: p }); } return out; }
    out.push({ minX: p.x - sx, maxX: p.x + sx, minZ: p.z - sz, maxZ: p.z + sz, minY: p.y, maxY: p.y + h, piece: p }); return out;
  }
  pieceMesh(p) {
    const d = PIECES.find(x => x.id === p.t), M = this.mats, g = new THREE.Group(), [sx, sy, sz] = d.size;
    const box = (w, h, dp, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), m); k.position.set(x, y + h / 2, z); k.castShadow = k.receiveShadow = true; g.add(k); return k; };
    const L = c => new THREE.MeshLambertMaterial({ color: c });
    if (d.stairs) for (let i = 0; i < 4; i++) box(2, 0.12, 0.5, M.wood, 0, (i + 1) * 0.6 - 0.12, -0.75 + i * 0.5);
    else if (d.id === 'fence') for (let i = 0; i < 6; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.5 + (i % 2) * 0.12, 6), M.wood); k.position.set(-0.83 + i * 0.33, 0.75, 0); k.castShadow = true; g.add(k); const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.25, 6), M.wood); c.position.set(-0.83 + i * 0.33, 1.62 + (i % 2) * 0.06, 0); g.add(c); }
    else if (d.id === 'door') { box(0.18, sy, 0.24, M.wood, -0.91); box(0.18, sy, 0.24, M.wood, 0.91); box(2, 0.2, 0.24, M.wood, 0, sy - 0.2); const hinge = new THREE.Group(); hinge.position.set(-0.82, 0, 0); g.add(hinge); const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.64, sy - 0.22, 0.1), L(0x7a5a38)); leaf.position.set(0.82, (sy - 0.22) / 2, 0); leaf.castShadow = true; hinge.add(leaf); g.userData.hinge = hinge; hinge.rotation.y = p.open ? -1.6 : 0; }
    else if (d.id === 'fire') { for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), M.rockM); k.position.set(Math.cos(i * 0.9) * 0.45, 0.08, Math.sin(i * 0.9) * 0.45); g.add(k); } for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5), L(0x3a2a1c)); k.rotation.set(1.2, i * 2.1, 0); k.position.y = 0.16; g.add(k); } const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 7), M.flame), f2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); f1.position.y = 0.5; f2.position.y = 0.42; g.add(f1, f2); g.userData.flames = [f1, f2]; }
    else if (d.id === 'bed') { box(1.1, 0.14, 2.1, L(0x4f7a3a)); box(1.0, 0.1, 1.5, L(0x8a7a52), 0, 0.14, 0.2); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), L(0xb9a878)); r.rotation.z = Math.PI / 2; r.position.set(0, 0.26, -0.8); g.add(r); }
    else if (d.id === 'bench') { box(1.6, 0.1, 0.8, M.wood, 0, 0.8); for (const [x, z] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) box(0.1, 0.8, 0.1, M.wood, x, 0, z); box(0.3, 0.08, 0.12, L(0x86837e), 0.3, 0.9, 0); }
    else if (d.id === 'furnace') { box(1.1, 1.1, 1.1, M.stone); box(0.5, 0.5, 0.5, M.stone, 0, 1.1); box(0.45, 0.35, 0.06, new THREE.MeshBasicMaterial({ color: 0xff7a2e }), 0, 0.25, 0.56); }
    else if (d.id === 'collector') { for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) box(0.06, 0.9, 0.06, M.wood, x, 0, z); const c = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0x3b8f33, side: THREE.DoubleSide })); c.rotation.x = Math.PI; c.position.y = 0.75; g.add(c); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.25, 10), L(0x5f4426)); b.position.y = 0.14; g.add(b); }
    else { const m = M[d.mat] || M.wood; box(sx, sy, sz, m); }
    g.position.set(p.x, p.y, p.z); g.rotation.y = -p.r * Math.PI / 2; return g;
  }
  addPiece(p, quiet) {
    p.boxes = this.pieceBoxes(p); p.mesh = this.pieceMesh(p); this.scene.add(p.mesh); this.pieces.push(p);
    if (p.t === 'fire') this.fires.push({ pos: new V3(p.x, p.y + 0.4, p.z), p });
    if (!quiet) this.rebuildBoxes();
  }
  removePiece(p) {
    const d = PIECES.find(x => x.id === p.t); this.scene.remove(p.mesh); this.pieces.splice(this.pieces.indexOf(p), 1); this.S.pieces.splice(this.S.pieces.indexOf(p), 1);
    this.fires = this.fires.filter(f => f.p !== p); this.rebuildBoxes(); this.sfx('crumble');
    for (const k in d.cost) this.give(k, Math.ceil(d.cost[k] / 2)); this.toast('Démonté', d.n + ' : la moitié des matériaux récupérée'); this.placeMaya();
  }
  ghostUpdate() {
    const b = this.buildMode, d = b.def, f = this.focus, W = this.world;
    if (!b.ghost) { b.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.4, depthWrite: false })); this.scene.add(b.ghost); }
    b.ok = false; b.ghost.visible = !!f;
    if (!f) return;
    const P = f.p.clone(); if (f.kind === 'piece' || f.kind === 'static') { const n = [0, 0, 0]; n[f.axis] = f.sign; P.x += n[0] * 0.06; P.y += n[1] * 0.06; P.z += n[2] * 0.06; }
    const sw = b.r % 2 === 1; let x, z, y;
    if (d.k === 'cell') { x = Math.round(P.x / 2) * 2; z = Math.round(P.z / 2) * 2; }
    else if (d.k === 'edge') { if (!sw) { x = Math.round(P.x / 2) * 2; z = Math.round((P.z - 1) / 2) * 2 + 1; } else { x = Math.round((P.x - 1) / 2) * 2 + 1; z = Math.round(P.z / 2) * 2; } }
    else { x = Math.round(P.x * 4) / 4; z = Math.round(P.z * 4) / 4; }
    const hx = (sw ? d.size[2] : d.size[0]) / 2, hz = (sw ? d.size[0] : d.size[2]) / 2;
    if (f.kind === 'piece' || f.kind === 'static') { const top = f.axis === 1 && f.sign > 0; y = top || d.id === 'floor' || d.id === 'roof' ? f.box.maxY : f.box.minY; if (!top && d.k === 'cell' && d.id !== 'floor' && d.id !== 'roof') y = f.box.minY; }
    else { const g0 = this.groundAt(x, z, P.y + 0.3); if (d.id === 'found' || d.id === 'sfound') { y = Math.max(W.getH(x - 1, z - 1), W.getH(x + 1, z - 1), W.getH(x - 1, z + 1), W.getH(x + 1, z + 1), W.getH(x, z)) - 0.2; } else y = g0; }
    y = Math.round(y * 20) / 20;
    const nb = { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, minY: y, maxY: y + d.size[1] };
    let clash = false; for (const o of this.boxes) if (nb.minX < o.maxX - 0.12 && nb.maxX > o.minX + 0.12 && nb.minZ < o.maxZ - 0.12 && nb.maxZ > o.minZ + 0.12 && nb.minY < o.maxY - 0.12 && nb.maxY > o.minY + 0.12) { clash = true; break; }
    const pp = this.P.pos; if (d.k !== 'free' && pp.x + R > nb.minX && pp.x - R < nb.maxX && pp.z + R > nb.minZ && pp.z - R < nb.maxZ && pp.y < nb.maxY - 0.1 && pp.y + PH > nb.minY + 0.1 && d.size[1] > 0.7) clash = true;
    if (y < -0.6 && d.k === 'free') clash = true;
    b.afford = this.has(d.cost); b.ok = !clash && b.afford; b.at = { x, y, z };
    b.ghost.scale.set(hx * 2, d.size[1], hz * 2); b.ghost.position.set(x, y + d.size[1] / 2, z); b.ghost.material.color.setHex(b.ok ? 0x3dff9a : 0xff4a5a);
  }
  place() {
    const b = this.buildMode; if (!b || !b.at) return;
    if (this.useCd > 0) return; this.useCd = 0.25;
    if (!b.ok) { this.sfx('thud'); return this.hint(b.afford ? 'Emplacement occupé ou invalide' : 'Matériaux insuffisants'); }
    this.take(b.def.cost); const p = { t: b.def.id, x: b.at.x, y: b.at.y, z: b.at.z, r: b.r, id: this.S.pid++ };
    this.S.pieces.push(p); this.addPiece(p); this.S.stats.built++; this.sfx('build'); this.burst(new V3(p.x, p.y + 0.5, p.z), 10, 0xc8a878, 2.5, 0.5, 6); Input.rumble(0.4, 0.3, 80);
    if (p.t === 'fire' && this.S.story.step === 3) this.advance(4);
    if (p.t === 'bed') { this.S.spawn = [p.x, p.y + 0.4, p.z]; this.toast('Point de réapparition', 'Tu reviendras ici après une mort'); this.placeMaya(); }
    if (b.def.st) this.exitBuild();
  }
  enterBuild(def) { this.exitBuild(); this.buildMode = { def, r: 0 }; this.hud.build.style.display = 'block'; }
  exitBuild() { const b = this.buildMode; if (b && b.ghost) this.scene.remove(b.ghost); this.buildMode = null; if (this.hud) this.hud.build.style.display = 'none'; }
  interactPiece(p) {
    const S = this.S;
    if (p.t === 'door') { p.open = !p.open; p.mesh.userData.hinge.rotation.y = p.open ? -1.6 : 0; this.rebuildBoxes(); this.sfx('door'); }
    else if (p.t === 'fire') this.menuFire();
    else if (p.t === 'bed') this.sleep();
    else if (p.t === 'bench' || p.t === 'furnace') this.openBag(1);
    else if (p.t === 'collector') { const n = S.collect[p.id] || 0; if (n < 1) return this.hint('Le collecteur est vide : il se remplit sous la pluie et chaque matin'); S.collect[p.id] = n - 1; S.p.water = Math.min(100, S.p.water + 45); this.sfx('drink'); this.toast('Eau de pluie', `Il reste ${S.collect[p.id]} dose(s)`); }
  }
  nearStation(st) { if (st === 'altar') return this.P.pos.distanceTo(this.gatePos) < 10; return this.creative || this.pieces.some(p => p.t === st && Math.hypot(p.x - this.P.pos.x, p.z - this.P.pos.z) < 6); }
  async menuFire() {
    const S = this.S;
    for (;;) {
      const cap = (S.inv.gourd || 0) * 2 - (S.inv.water || 0);
      const c = await this.ask('Feu de camp', 'Les flammes crépitent. La chaleur te fait du bien.', [
        { label: `Cuire la viande (${S.inv.rawmeat || 0})`, off: !S.inv.rawmeat }, { label: `Griller le poisson (${S.inv.rawfish || 0})`, off: !S.inv.rawfish },
        { label: `Distiller de l’eau de mer (gourde : ${Math.max(0, cap)} place${cap > 1 ? 's' : ''})`, off: cap <= 0 }, { label: 'S’éloigner' }]);
      if (c === 0) { const n = S.inv.rawmeat; this.take({ rawmeat: n }); this.give('meat', n); this.sfx('sizzle'); }
      else if (c === 1) { const n = S.inv.rawfish; this.take({ rawfish: n }); this.give('fish', n); this.sfx('sizzle'); }
      else if (c === 2) { this.give('water', cap); this.sfx('sizzle'); }
      else break;
    }
  }
  async sleep() {
    const S = this.S, night = S.tod > 0.78 || S.tod < 0.22;
    if (!night && S.p.en > 55) return this.hint('Tu n’es pas assez fatigué pour dormir en plein jour');
    if (this.animals.some(a => !a.dead && a.hostile && a.pos.distanceTo(this.P.pos) < 25)) return this.hint('Impossible de dormir : un prédateur rôde');
    let txt = 'Tu fermes les yeux…';
    const lovers = S.story.flags.lovers && S.story.maya === 'saved' && this.maya.visible && this.maya.position.distanceTo(this.P.pos) < 12;
    if (lovers) txt = 'Maya se glisse contre toi. Cette nuit, personne n’a froid.';
    this.ui = { update() {} }; this.fade(true, txt); await this.wait(2600); this.ui = null;
    if (S.tod > 0.25) S.day++; S.tod = 0.27; this.newDay();
    S.p.en = 100; S.p.hp = Math.min(100, S.p.hp + 35); S.p.food = Math.max(5, S.p.food - 14); S.p.water = Math.max(5, S.p.water - 16); this.wet = 0;
    this.fade(false); this.toast(`Jour ${S.day}`, 'Tu te réveilles reposé'); if (S.story.step === 4) this.advance(5); this.saveGame();
  }
  newDay() { const S = this.S; this.regrow(); for (const p of this.pieces) if (p.t === 'collector') S.collect[p.id] = Math.min(4, (S.collect[p.id] || 0) + 1); S.story.gift = 0; }

  /* ================= faune ================= */
  spawnAnimal(type, x, z) {
    const D = ANIMALS[type], g = buildAnimal(type, this.cfg.island), sc = this.mods.giants ? 2 : 1; g.scale.setScalar(sc); this.scene.add(g);
    const a = { type, D, g, pos: g.position, hp: D.hp * sc, maxHp: D.hp * sc, rad: D.r * sc, yaw: Math.random() * 6.28, tx: x, tz: z, t: 0, st: 'wander', cd: 0, hostile: !!D.aggro && !this.mods.peace, ph: Math.random() * 6 };
    a.pos.set(x, this.animalY(a, x, z), z); this.animals.push(a); return a;
  }
  animalY(a, x, z) { const h = this.world.getH(x, z); return a.D.water ? Math.max(h + a.rad * 0.6, a.type === 'shark' ? -1.6 : -0.9) : h; }
  manageAnimals(dt) {
    this.spawnT -= dt; const P = this.P, W = this.world, S = this.S;
    for (let i = this.animals.length - 1; i >= 0; i--) { const a = this.animals[i]; if (!a.mother && a.pos.distanceTo(P.pos) > 130 || (a.dead && a.t > 12)) { this.scene.remove(a.g); this.animals.splice(i, 1); } }
    if (this.spawnT > 0) return; this.spawnT = 1.6;
    if (this.animals.length >= (this.quality === 'low' ? 10 : 18)) return;
    const ang = Math.random() * 6.28, d = 38 + Math.random() * 40, x = P.pos.x + Math.cos(ang) * d, z = P.pos.z + Math.sin(ang) * d;
    if (Math.abs(x) > HALF - 20 || Math.abs(z) > HALF - 20) return;
    const h = W.getH(x, z), night = S.tod > 0.8 || S.tod < 0.2, q = Math.random(); let type = null;
    if (h < -4.5) type = q < (this.hard ? 0.4 : 0.22) ? 'shark' : 'fish'; else if (h < -0.6) type = 'fish'; else if (h > 0.4 && h < 3) type = q < 0.6 ? 'crab' : null;
    else if (h >= 3 && h < this.isl.peak * 0.7 && W.slope(x, z) < 0.6) { const pr = (night ? 0.45 : this.hard ? 0.15 : 0.04) * (S.story.flags.motherDead ? 1.8 : 1); type = q < pr ? 'pred' : q < pr + 0.3 ? 'boar' : q < pr + 0.6 ? 'goat' : null; }
    if (type === 'shark' && this.animals.filter(a => a.type === 'shark').length >= 2) type = 'fish';
    if (type) this.spawnAnimal(type, x, z);
  }
  updateAnimals(dt) {
    const P = this.P, W = this.world, pp = P.pos;
    for (const a of this.animals) {
      a.t += dt; a.cd -= dt; a.flash = (a.flash || 0) - dt;
      if (a.dead) { a.g.rotation.z = damp(a.g.rotation.z, a.D.water ? Math.PI : Math.PI / 2, 5, dt); if (a.D.water) a.pos.y = damp(a.pos.y, -0.3, 1, dt); continue; }
      const dx = pp.x - a.pos.x, dz = pp.z - a.pos.z, dist = Math.hypot(dx, dz), D = a.D; let spd = D.spd * 0.3;
      const canReach = D.water ? (P.swim && W.getH(pp.x, pp.z) < -2) : !P.swim;
      if (a.mother) { const hd = Math.hypot(a.home[0] - a.pos.x, a.home[1] - a.pos.z); if (a.st !== 'chase' || hd > 26 || !canReach) { a.st = 'guard'; a.tx = a.home[0]; a.tz = a.home[1]; spd = hd > 2 ? D.spd * 0.6 : 0; } if (a.angry && dist < 16 && canReach && hd < 24) a.st = 'chase'; }
      else if (a.hostile && dist < D.aggro && canReach && !this.dead && !this.creative) a.st = 'chase';
      else if (a.st === 'chase') a.st = 'wander';
      if (D.flee && dist < D.flee && !this.dead) { a.st = 'flee'; a.ft = 2; }
      if (a.st === 'chase' || a.st === 'angry') { a.tx = pp.x; a.tz = pp.z; spd = D.spd; if (dist < a.rad + 1.1 && a.cd <= 0 && Math.abs(pp.y - a.pos.y) < 2.5) { a.cd = 1.3; this.hurt(D.dmg * (this.mods.giants ? 1.5 : 1), 'bete'); this.sfx('bite'); } if (!canReach && !a.mother) a.st = 'wander'; if (a.st === 'angry' && (a.ang -= dt) < 0) a.st = 'wander'; }
      else if (a.st === 'flee') { a.tx = a.pos.x - dx / (dist || 1) * 12; a.tz = a.pos.z - dz / (dist || 1) * 12; spd = D.spd; if ((a.ft -= dt) < 0) a.st = 'wander'; }
      else if (a.st === 'wander') { if (a.t > (a.nt || 0)) { a.nt = a.t + 3 + Math.random() * 5; const an = Math.random() * 6.28, r = 4 + Math.random() * 10; a.tx = a.pos.x + Math.cos(an) * r; a.tz = a.pos.z + Math.sin(an) * r; } }
      const ex = a.tx - a.pos.x, ez = a.tz - a.pos.z, el = Math.hypot(ex, ez);
      if (el > 0.5 && spd > 0) {
        const nx = a.pos.x + ex / el * spd * dt, nz = a.pos.z + ez / el * spd * dt, nh = W.getH(nx, nz);
        const ok = D.water ? nh < (a.type === 'shark' ? -2.6 : -0.7) : nh > (a.type === 'crab' ? 0.2 : 0.6) && Math.abs(nx) < HALF - 10 && Math.abs(nz) < HALF - 10;
        if (ok) { a.pos.x = nx; a.pos.z = nz; a.ph += spd * dt * 2.2; } else { a.nt = 0; if (a.st === 'flee') a.st = 'wander'; }
        let df = Math.atan2(ex, ez) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * (1 - Math.exp(-6 * dt));
      }
      a.pos.y = damp(a.pos.y, this.animalY(a, a.pos.x, a.pos.z), 10, dt); a.g.rotation.y = a.yaw + (a.type === 'crab' ? Math.PI / 2 : 0);
      const L = a.g.userData.legs; if (a.type === 'crab') L.forEach((l, i) => l.rotation.z = Math.sin(a.ph * 3 + i) * 0.4); else if (L.length) L.forEach((l, i) => l.rotation.x = Math.sin(a.ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.5 : 0)) * 0.6 * clamp(spd / 3, 0, 1));
      if (a.g.userData.tail) a.g.userData.tail.rotation.y = Math.sin(a.t * (a.st === 'chase' ? 12 : 6)) * 0.5;
    }
  }
  hitAnimal(a, dmg) {
    const S = this.S; a.hp -= dmg; this.sfx('hit'); this.burst(new V3(a.pos.x, a.pos.y + a.rad * 0.6, a.pos.z), 8, 0xaa2020, 3, 0.4, 9); Input.rumble(0.5, 0.5, 70);
    if (a.mother) a.angry = true;
    if (a.D.neutral && !this.mods.peace) { a.st = 'angry'; a.ang = 9; } else if (!a.hostile) { a.st = 'flee'; a.ft = 4; }
    if (a.hp <= 0) { a.dead = true; a.t = 0; S.stats.kills++; const m = this.mods.giants ? 2 : 1; this.giveDrop(a.D.drop, m); if (S.inv.knife && a.D.drop.hide) this.give('hide', 1); this.sfx('death2');
      if (a.mother) { S.story.flags.motherDead = true; this.toast('La femelle est morte', 'Dans la tanière, des petits gémissent.', 'red'); this.saveGame(); } }
  }

  /* ================= histoire ================= */
  objective() {
    const S = this.S, st = S.story, n = st.frags.length;
    if (S.ended) return ['Épilogue', S.ended === 'stay' || S.ended === 'her' || S.ended === 'both_stay' ? 'L’île est ton monde. Vis.' : 'Un autre monde t’attend… ou reste explorer.'];
    if (this.creative && st.step < 5) st.step = 5;
    switch (st.step) {
      case 0: return ['Premiers gestes', `Ramasse 2 bâtons et 2 pierres sur la plage (${Math.min(2, S.inv.stick || 0)}/2 · ${Math.min(2, S.inv.stone || 0)}/2)`, `${gly('act')} ramasser`];
      case 1: return ['Un outil', `Cueille de la fibre sur une fougère, puis fabrique une hache de pierre`, `${gly('inv')} ouvrir le sac → Fabriquer`];
      case 2: return ['La soif', 'Bois : noix de coco, pluie ou source d’eau douce (voir la carte)', `${gly('drink')} boire · ${gly('journal')} carte`];
      case 3: return ['Le feu', 'Construis un feu de camp (3 bâtons, 3 pierres)', `${gly('build')} construire`];
      case 4: return ['Un abri', 'Construis un couchage et dors pour passer la nuit', 'Le couchage devient ton point de réapparition'];
    }
    if (!st.flags.wreck) return ['La fumée', `Une colonne de fumée monte de ${this.era.wreck}. Va voir.`, 'Elle est marquée sur la carte'];
    if (st.maya === 'found') return ['La survivante', 'Maya est blessée. Reviens avec un bandage et de quoi boire.', 'Bandage : 2 fibres + 1 aloès'];
    if (n < 5) return ['Les fragments du Passage', `Fragments réunis : ${n} / 5`, 'Tanière · ruines englouties · sanctuaire · sommet (voir la carte)'];
    if (!S.inv.key) return ['La clé', `Forge la Clé du Passage à l’autel du sommet (5 fragments + 3 cristaux : ${S.inv.crystal || 0}/3)`, 'Les cristaux se trouvent en creusant profond'];
    return ['Le Passage', 'Pose la clé sur l’autel, au sommet de l’île.', ''];
  }
  advance(n) { const st = this.S.story; if (st.step < n) { st.step = n; this.sfx('goal'); this.toast('Objectif accompli', this.objective()[0]); this.saveGame(); } }
  checkStory() {
    const S = this.S, st = S.story;
    if (st.step === 0 && (S.inv.stick || 0) >= 2 && (S.inv.stone || 0) >= 2) this.advance(1);
    if (st.step === 1 && (S.inv.axe1 || S.inv.axe2)) this.advance(2);
    if (st.step === 2 && S.p.water > 88) this.advance(3);
    if (st.step === 3 && this.fires.length) this.advance(4);
  }
  page(i) { const st = this.S.story; if (st.pages.includes(i)) return; st.pages.push(i); this.sfx('goal'); return this.say(JOURNAL[i][0], JOURNAL[i][1]); }
  async takeFrag(id, pg) {
    const S = this.S, st = S.story; if (st.frags.includes(id)) return;
    if (id === 'den') { const m = this.animals.find(a => a.mother && !a.dead); if (m && !st.flags.motherFed) return this.hint('La femelle te barre le passage'); }
    st.frags.push(id); this.give('frag', 1); this.fragMeshes[id].visible = false; this.sfx('gem'); this.burst(this.fragMeshes[id].position, 30, 0x7ff6ff, 5, 1, 1);
    this.toast('Fragment du Passage', `${st.frags.length} / 5`);
    if (pg != null && JOURNAL[pg]) await this.page(pg);
    if (id === 'summit') await this.page(4);
    this.saveGame();
  }
  async sceneWreck() {
    const S = this.S, st = S.story;
    if (st.maya === 'none') {
      st.maya = 'found'; this.placeMaya();
      await this.say('', `Entre les débris de ${this.era.wreck}, quelqu’un respire. Une femme, adossée à la coque, la jambe ouverte du genou à la cheville.`);
      await this.say('Maya', `« Ne reste pas planté là. Je m’appelle Maya, j’étais ${this.era.role}. Il y a un coffre dans l’épave. Prends ce que tu veux… mais si tu as de quoi panser ça, je ne dirai pas non. »`);
    }
    const can = (S.inv.bandage || 0) >= 1 && ((S.inv.water || 0) + (S.inv.coconut || 0)) >= 1;
    const c = await this.ask('Maya', '« Alors ? »', [{ label: 'La soigner (1 bandage + 1 eau ou noix de coco)', off: !can && !this.creative }, { label: 'Vider le coffre et la laisser là' }, { label: 'Revenir plus tard' }]);
    if (c === 2) return;
    st.flags.wreck = true; this.give('frag', 1); st.frags.push('wreck');
    if (c === 0) {
      if (!this.creative) { this.take({ bandage: 1 }); if (S.inv.water) this.take({ water: 1 }); else this.take({ coconut: 1 }); }
      st.maya = 'saved'; st.rel = 1; this.give('rope', 2); this.give('iron', 1);
      await this.say('Maya', '« Merci. Vraiment. Dans le coffre, il y avait ça : une pierre gravée qui brille, et un vieux carnet. Garde-les. Moi je garde ma jambe. »');
      await this.say('', 'Maya restera près de l’épave tant que tu n’auras pas de camp. Construis un couchage : elle te rejoindra.');
    } else {
      st.maya = 'left'; this.give('iron', 3); this.give('bandage', 2); this.give('ration', 2); this.give('rope', 2);
      await this.say('', 'Tu prends tout. Le fer, les rations, la pierre gravée, le carnet. Elle ne dit rien. Elle te regarde partir, et c’est pire.');
    }
    this.placeMaya(); await this.page(0); this.saveGame();
  }
  async sceneDen() {
    const S = this.S, st = S.story, m = this.animals.find(a => a.mother && !a.dead);
    if (!m || st.flags.motherFed || m.angry || (this.denT && this.time - this.denT < 25)) return;
    this.denT = this.time;
    const nm = PRED_NAMES[this.cfg.island].toLowerCase();
    const c = await this.ask('La tanière', `Une femelle ${nm} se dresse devant un cercle de roches. Derrière elle, une lueur bleue, et des petits qui remuent. Elle gronde mais n’attaque pas. Pas encore.`, [{ label: `Déposer 3 viandes crues et reculer (${S.inv.rawmeat || 0}/3)`, off: (S.inv.rawmeat || 0) < 3 && !this.creative }, { label: 'Avancer vers elle, arme en main' }, { label: 'Reculer' }]);
    if (c === 0) { this.take({ rawmeat: 3 }); st.flags.motherFed = true; m.home = [m.home[0] + 14, m.home[1] + 10]; m.angry = false; await this.say('', 'Elle renifle, traîne la viande à l’écart et se couche avec ses petits. Le chemin est libre. Elle te suit des yeux, sans haine.'); await this.page(1); this.saveGame(); }
    else if (c === 1) { m.angry = true; m.st = 'chase'; }
  }
  async sceneSanct() {
    const S = this.S, st = S.story;
    await this.page(3);
    const c = await this.ask('Le sanctuaire', 'Le fragment est scellé dans la pierre. Sous tes doigts, on sent battre l’eau des sources. L’arracher les fera taire.', [{ label: 'Arracher le fragment (les sources se tarissent)' }, { label: `Le remplacer par 6 cristaux (${S.inv.crystal || 0}/6)`, off: (S.inv.crystal || 0) < 6 && !this.creative }, { label: 'Ne rien toucher pour l’instant' }]);
    if (c === 2) return;
    if (c === 0) { st.flags.dry = true; this.springPools.forEach(p => p.visible = false); await this.say('', 'La pierre cède. Un long soupir monte du sol, puis plus rien. Quelque part, l’eau vient de s’arrêter de couler.'); }
    else { this.take({ crystal: 6 }); st.flags.kept = true; await this.say('', 'Tu poses les cristaux un à un. La pierre les boit. Le fragment se détache tout seul, tiède, et l’eau continue de chanter.'); }
    st.frags.push('sanct'); this.give('frag', 1); this.fragMeshes.sanct.visible = false; this.sfx('gem'); this.saveGame();
  }
  async sceneMaya() {
    const S = this.S, st = S.story, n = st.frags.length;
    if (st.maya === 'found') return this.sceneWreck();
    const T = [
      [0, '« Tu sais ce qui me fait le plus peur ? Pas les bêtes. Le silence. Chez moi il y avait toujours du bruit. »', ['« Raconte-moi chez toi. »', '« On n’a pas le temps pour ça. »'], [1, 0], ['Elle parle longtemps. Tu écoutes. Quand elle se tait, il fait nuit et aucun de vous n’a eu peur.', '« Non. Tu as raison. » Elle retourne au feu.']],
      [2, '« Ce carnet… Ilan a laissé partir la femme qu’il aimait. Tu aurais fait pareil ? »', ['« Oui. Si c’était sa seule chance. »', '« Non. Je serais parti. On ne doit rien à personne ici. »', '« Je ne sais pas. »'], [1, -1, 0], ['« Moi aussi, je crois. » Elle sourit pour la première fois.', '« Au moins tu es honnête. » Elle s’écarte un peu.', '« Personne ne sait. C’est bien le problème. »']],
      [3, '« Si la porte ne laisse passer qu’un seul de nous deux… je veux qu’on le décide avant. Pas là-haut. »', ['« Alors c’est toi qui passes. »', '« Alors c’est moi. »', '« On trouvera une autre voie. »'], [1, -1, 1], ['« Ne dis pas ça si tu ne le penses pas. » Mais elle te prend la main.', 'Elle hoche la tête, lentement. « D’accord. Au moins je le sais. »', '« Ilan a cherché neuf ans. » Elle regarde l’île. « Mais lui, il a pris sans rendre. Pas nous. »']],
      [4, '« Je ne pensais pas dire ça un jour sur un caillou perdu… mais je suis contente que ce soit toi qui m’aies trouvée. »', ['Rester près d’elle ce soir', '« Moi aussi. » (rester amis)'], [2, 0], ['Elle pose sa tête contre ton épaule. Le feu baisse. Ni l’un ni l’autre ne se lève pour le nourrir.', '« Amis de naufrage. Ça me va. »']],
    ];
    const t = T[st.talk];
    if (t && n >= t[0] + 1) {
      const c = await this.ask('Maya', t[1], t[2].map(l => ({ label: l })));
      st.rel += t[3][c]; await this.say('', t[4][c]); if (st.talk === 3 && c === 0 && st.rel >= 3) st.flags.lovers = true; st.talk++; this.saveGame(); return;
    }
    if (!st.gift) { st.gift = 1; const g = [['berry', 4], ['fish', 1], ['fiber', 4], ['water', 1], ['coconut', 2]][S.day % 5]; this.give(g[0], g[1]); return this.say('Maya', `« Tiens, j’ai trouvé ça pendant que tu courais partout. » (${ITEMS[g[0]][0]} ×${g[1]})`); }
    const lines = ['« Fais attention à toi. »', '« Le vent tourne. Il va pleuvoir. »', '« J’ai rêvé de la porte. Elle chantait. »', n >= 5 ? '« Tu les as tous. Alors… on y va quand tu veux. »' : '« Les ruines sous l’eau, n’y va pas le ventre vide. »'];
    return this.say('Maya', lines[(S.day + n) % lines.length]);
  }
  async sceneGate() {
    const S = this.S, st = S.story;
    if (!S.inv.key) { await this.page(5); if (st.frags.length >= 5) { if (this.has({ frag: 5, crystal: 3 })) { const c = await this.ask('L’autel', 'Cinq creux dans la pierre, trois plus petits autour.', [{ label: 'Forger la Clé du Passage' }, { label: 'Pas encore' }]); if (c === 0) { this.take({ frag: 5, crystal: 3 }); this.give('key', 1); this.sfx('gem'); S.stats.crafted++; this.saveGame(); } } else await this.say('L’autel', 'Cinq creux pour les fragments, trois pour des cristaux. Il te manque des cristaux : creuse profond.'); } else await this.say('L’autel', `Deux piliers et un linteau, face au vide. Il manque des fragments : ${st.frags.length} / 5.`); return; }
    this.portalOn = true; this.sfx('portal');
    const maya = st.maya === 'saved', harmony = !st.flags.dry && !st.flags.motherDead;
    await this.say('', 'La clé s’enfonce dans l’autel. Entre les piliers, l’air se déchire sans bruit : de l’autre côté, un ciel qui n’est pas le tien.');
    let c, end;
    if (maya) {
      await this.say('Maya', harmony ? '« Regarde… elle ne tremble pas. Ilan disait que la porte reste ouverte pour ceux qui n’ont rien pris par force. »' : '« Une clé, un voyageur. On savait. »');
      const opts = [{ label: 'Passer seul' }, { label: 'Laisser passer Maya et rester' }, { label: 'Refermer la porte et rester tous les deux' }]; if (harmony) opts.unshift({ label: 'Lui prendre la main et passer ensemble' });
      c = await this.ask('Le Passage', 'Il faut choisir.', opts); end = harmony ? ['together', 'alone', 'her', 'both_stay'][c] : ['alone', 'her', 'both_stay'][c];
    } else { c = await this.ask('Le Passage', st.maya === 'left' ? 'Tu penses à la femme de l’épave. Trop tard pour ça.' : 'Personne pour te retenir. Personne pour te suivre.', [{ label: 'Passer' }, { label: 'Rester sur l’île' }]); end = c === 0 ? 'alone' : 'stay'; }
    this.ending(end);
  }
  ending(id) {
    const S = this.S, st = S.story; S.ended = id; if (id !== 'both_stay' && id !== 'stay') delete S.inv.key;
    const dry = st.flags.dry ? '\n\nDerrière toi, l’île a soif. Les sources ne reviendront pas.' : '', mom = st.flags.motherDead ? ' Dans la tanière, plus rien ne bouge.' : '';
    const E = {
      together: ['ENSEMBLE', 'L’île vous a laissés passer', `Vous franchissez le seuil main dans la main. La porte ne se referme pas : elle attend le prochain naufragé, et il trouvera des sources pleines et une tanière habitée.\n\nDe l’autre côté, l’herbe est bleue, et quelqu’un a allumé un feu.`],
      alone: ['SEUL', 'Une clé, un voyageur', `Tu passes. La clé se brise derrière toi.${st.maya === 'saved' ? '\n\nMaya reste sur le seuil. Elle lève la main. Tu ne sauras jamais si c’était un adieu ou un reproche.' : st.maya === 'left' ? '\n\nSur la plage, près d’une épave, quelqu’un a cessé d’attendre depuis longtemps.' : ''}${dry}${mom}\n\nDe l’autre côté, un ciel neuf. Tu es vivant. Il faudra s’en contenter.`],
      her: ['LA GARDIENNE DU SEUIL', 'Tu as tenu la porte', `Maya passe. Elle se retourne une fois, et la porte se ferme sur son visage.\n\nTu redescends du sommet. Le carnet d’Ilan est dans ta poche ; tu y ajoutes une page.${dry}\n\nL’île est à toi, maintenant. Ou toi à elle.`],
      both_stay: ['LE FEU', 'Vous avez refermé la porte', `Tu retires la clé. Le ciel étranger se referme comme une paupière.\n\n« On a déjà un monde », dit Maya. « Il est petit, il mord, et il pleut dedans. Mais c’est le nôtre. »\n\nVous redescendez avant la nuit.${dry}`],
      stay: ['LE NAUFRAGÉ', 'Tu es resté', `Tu regardes longtemps le ciel de l’autre côté. Puis tu reprends la clé.\n\nPersonne ne t’attend là-bas non plus.${dry}\n\nEn bas, ton feu fume encore.`],
    }[id];
    this.portalOn = id !== 'both_stay' && id !== 'stay'; this.placeMaya(); this.saveGame(); this.sfx('goal');
    const ov = el('div', 'rv-end'); ov.innerHTML = `<div><h3>${E[1].toUpperCase()}</h3><h1>${E[0]}</h1><p>${E[2]}</p><p style="font-size:13px;opacity:.7">Jour ${S.day} · ${fmtDuration(S.playTime)} de jeu · ${S.stats.kills} animaux chassés · ${S.stats.built} constructions · ${S.stats.deaths} mort(s)</p><div class="gm-list" style="max-width:420px;margin:auto"></div></div>`;
    this.root.appendChild(ov);
    const list = new ListMenu(ov.querySelector('.gm-list'), [{ label: 'Continuer à explorer l’île', act: () => { ov.remove(); this.ui = null; this.last = performance.now(); } }, { label: 'Retour à NOVA', cls: 'exit', act: () => { ov.remove(); this.ui = null; this.exit(); } }]);
    this.ui = { update: nav => list.update(nav) };
  }

  /* ================= dialogues & interface ================= */
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  fade(on, text) { const f = this.fadeEl || (this.fadeEl = this.root.appendChild(el('div', 'rv-fade'))); if (text != null) f.textContent = text; f.style.whiteSpace = 'pre-line'; f.classList.toggle('on', on); }
  say(who, text) { return this.ask(who, text, [{ label: 'Continuer' }]); }
  ask(who, text, choices) {
    return new Promise(res => {
      const prev = this.ui; if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
      const d = el('div', 'rv-dlg glass'); d.innerHTML = `${who ? `<h4>${who}</h4>` : ''}<p>${text}</p><div class="gm-list"></div>`; this.root.appendChild(d);
      const done = i => { d.remove(); this.ui = prev || null; this.last = performance.now(); Input.poll(); res(i); };
      const list = new ListMenu(d.querySelector('.gm-list'), choices.map((c, i) => ({ label: c.label, disabled: () => !!c.off, act: () => done(i) })));
      const first = choices.findIndex(c => !c.off); list.focus = Math.max(0, first); list.paint(); this.sfx('page');
      const t0 = performance.now(); this.ui = { update: nav => { if (performance.now() - t0 > 250) list.update(nav); } };
    });
  }
  toast(title, text, color = 'cyan') { if (!this.hud) return; const t = el('div', 'toast ' + color, `<b>${title}</b><span>${text}</span>`); this.hud.toasts.appendChild(t); setTimeout(() => t.classList.add('out'), 3000); setTimeout(() => t.remove(), 3500); while (this.hud.toasts.children.length > 4) this.hud.toasts.firstChild.remove(); }
  initHUD() {
    const h = el('div', 'rv-hud');
    h.innerHTML = `<div class="rv-under"></div><div class="rv-cold"></div><div class="rv-hurt"></div>
      <div class="rv-obj"><b></b><span></span><small></small></div>
      <div class="rv-top"><div class="rv-chip day"></div><div class="rv-chip temp"></div><div class="rv-chip wx"></div></div>
      <div class="rv-stats">${[['o2', '🫧'], ['hp', '❤'], ['food', '🍖'], ['water', '💧'], ['en', '⚡']].map(([c, i]) => `<div class="rv-bar ${c}"><em>${i}</em><div><i></i></div></div>`).join('')}</div>
      <div class="rv-hot"></div><div class="reticle"><i></i></div><div class="rv-prompt"></div><div class="rv-build"></div><div class="toasts"></div><div class="fps"></div>`;
    this.root.appendChild(h); const q = s => h.querySelector(s);
    this.hud = { root: h, under: q('.rv-under'), cold: q('.rv-cold'), hurt: q('.rv-hurt'), objB: q('.rv-obj b'), objS: q('.rv-obj span'), objH: q('.rv-obj small'), day: q('.day'), temp: q('.temp'), wx: q('.wx'), hot: q('.rv-hot'), ret: q('.reticle'), prompt: q('.rv-prompt'), build: q('.rv-build'), toasts: q('.toasts'), fps: q('.fps'), bars: {} };
    for (const c of ['o2', 'hp', 'food', 'water', 'en']) this.hud.bars[c] = q('.rv-bar.' + c);
    this.hud.fps.style.display = Store.settings.fps ? 'block' : 'none'; this.hotDirty = true;
  }
  updateHUD(dt) {
    const H = this.hud, S = this.S, p = S.p;
    // invite
    let pr = '';
    const f = this.focus, tool = TOOLS[S.tool];
    if (this.spot) pr = `${gly('act')} ${this.spot.label()}`;
    else if (this.buildMode) pr = '';
    else if (this.pickFocus) pr = `${gly('act')} Ramasser : ${OBJ[this.pickFocus.type].n}`;
    else if (f && f.kind === 'obj') { const D = OBJ[f.o.type]; pr = `${gly('use')} ${D.tree ? (tool.chop ? 'Abattre' : 'Secouer') : (tool.mine ? 'Casser' : 'Frapper')} : ${D.n}`; }
    else if (f && f.kind === 'animal') pr = `${gly('use')} ${f.a.dead ? '' : 'Attaquer : '}${f.a.type === 'pred' ? PRED_NAMES[this.cfg.island] : f.a.D.n}`;
    else if (f && f.kind === 'piece') { const d = PIECES.find(x => x.id === f.piece.t); pr = tool.demol ? `${gly('use')} Démonter : ${d.n}` : (d.st || d.door) ? `${gly('act')} ${{ fire: 'Cuisiner', bed: 'Dormir', bench: 'Fabriquer', furnace: 'Fondre', collector: 'Boire', door: f.piece.open ? 'Fermer' : 'Ouvrir' }[d.id]}` : ''; }
    else if (f && f.kind === 'terrain' && tool.dig) pr = `${gly('use')} Creuser`;
    if (f && f.kind === 'animal' && f.a.dead) pr = '';
    if (H.prompt._v !== pr) { H.prompt.innerHTML = pr; H.prompt._v = pr; } H.prompt.classList.toggle('show', !!pr);
    H.ret.classList.toggle('on', !!f && f.kind !== 'terrain' && f.kind !== 'static');
    H.under.classList.toggle('on', !!this.under);
    if (this.buildMode) { const b = this.buildMode, d = b.def, cost = Object.entries(d.cost).map(([k, n]) => `<span class="${(S.inv[k] || 0) < n && !this.creative ? 'no' : ''}">${ITEMS[k][1]} ${this.creative ? n : (S.inv[k] || 0) + '/' + n}</span>`).join(' &nbsp; '); const v = d.id + cost + Input.device; if (H.build._v !== v) { H.build._v = v; H.build.innerHTML = `<b>${d.n}</b>${cost}<br>${gly('use')} poser &nbsp; ${gly('alt')} pivoter &nbsp; ${gly('next')} pièce suivante &nbsp; ${gly('crouch')} quitter`; } }
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.2;
    for (const id in this.toastQ) { this.toast(`+${this.toastQ[id]} ${ITEMS[id][1]}`, ITEMS[id][0], 'green'); delete this.toastQ[id]; }
    const set = (c, v) => { const b = H.bars[c]; b.querySelector('i').style.width = clamp(v, 0, 100) + '%'; b.classList.toggle('low', v < 22); };
    set('hp', p.hp); set('food', p.food); set('water', p.water); set('en', p.en); set('o2', this.o2); H.bars.o2.style.display = this.o2 < 99 ? 'flex' : 'none';
    const hh = Math.floor(S.tod * 24), mi = Math.floor((S.tod * 24 - hh) * 60);
    H.day.textContent = `Jour ${S.day} · ${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    const t = Math.round(this.tempFeel); H.temp.textContent = `🌡 ${t}°${this.wet > 0.5 ? ' · trempé' : ''}`; H.temp.className = 'rv-chip temp' + (t < 10 ? ' cold' : t > 34 ? ' hot' : '');
    H.wx.textContent = { clear: S.tod > 0.78 || S.tod < 0.22 ? '☾ Nuit claire' : '☀ Dégagé', cloudy: '☁ Nuageux', rain: this.cfg.island === 'nord' ? '❄ Neige fondue' : '🌧 Pluie', storm: '⛈ Tempête' }[S.weather];
    const o = this.objective(); const ov = o.join('|'); if (H.objB._v !== ov) { H.objB._v = ov; H.objB.textContent = o[0]; H.objS.innerHTML = o[1]; H.objH.innerHTML = o[2] || ''; }
    if (this.hotDirty) { this.hotDirty = false; const hb = this.hotbar(); H.hot.innerHTML = hb.map(id => `<div class="rv-slot${id === S.tool ? ' on' : ''}">${id === 'hands' ? '✋' : ITEMS[id][1]}</div>`).join(''); }
    this.checkStory();
  }
  initTouch() {
    const t = el('div', 'touch');
    t.innerHTML = `<div class="t-look"></div><div class="t-stick"><div class="t-base"><div class="t-knob"></div></div></div>
      <div class="t-btns"><button data-a="use" class="tb big swing">UTILISER</button><button data-a="jump" class="tb big jump">SAUT</button><button data-a="act" class="tb atk">ACTION</button><button data-a="next" class="tb zip">OUTIL</button><button data-a="crouch" class="tb dash">PLONGER</button><button data-a="alt" class="tb act">PIVOTER</button></div>
      <div class="t-top rv"><button data-a="inv" class="tb sm">SAC</button><button data-a="build" class="tb sm">BÂTIR</button><button data-a="eat" class="tb sm">MANGER</button><button data-a="drink" class="tb sm">BOIRE</button><button data-a="journal" class="tb sm">CARTE</button><button data-a="pause" class="tb sm">❚❚</button></div>`;
    this.root.appendChild(t); this.root.classList.add('has-touch'); const T = Input.touch;
    t.querySelectorAll('.tb').forEach(b => { const a = b.dataset.a; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); T.btn[a] = true; T.tap[a] = true; if (a === 'jump') T.btn.confirm = false; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (er) {} Sound.unlock(); }); const up = () => { T.btn[a] = false; b.classList.remove('down'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
    const stick = t.querySelector('.t-stick'), base = t.querySelector('.t-base'), knob = t.querySelector('.t-knob'); let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; base.style.left = sx + 'px'; base.style.top = sy + 'px'; base.classList.add('on'); try { stick.setPointerCapture(e.pointerId); } catch (er) {} });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - sx, dy = e.clientY - sy; const L = Math.hypot(dx, dy), Mx = 56; if (L > Mx) { dx *= Mx / L; dy *= Mx / L; } knob.style.transform = `translate(${dx}px,${dy}px)`; T.mx = dx / Mx; T.my = -dy / Mx; });
    const send = () => { sid = null; T.mx = T.my = 0; knob.style.transform = ''; base.classList.remove('on'); }; stick.addEventListener('pointerup', send); stick.addEventListener('pointercancel', send);
    const look = t.querySelector('.t-look'); let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (er) {} });
    look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; T.dx += (e.clientX - lx) * 1.6; T.dy += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
    const lup = () => { lid = null; }; look.addEventListener('pointerup', lup); look.addEventListener('pointercancel', lup);
  }
  /* sac / fabrication / construction */
  openBag(tab = 0) {
    if (this.ui) return; if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    const S = this.S, ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">RIVAGE · JOUR ${S.day}</div><div class="rv-tabs"></div><div class="gm-list"></div><div class="gm-foot"></div></div>`; this.root.appendChild(ov);
    const tabs = ['Sac', 'Fabriquer', 'Construire'], te = ov.querySelector('.rv-tabs'), list = new ListMenu(ov.querySelector('.gm-list'), []);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); this.sfx('page'); };
    const cost = need => Object.entries(need).map(([k, n]) => `<span style="color:${(S.inv[k] || 0) >= n || this.creative ? '#9fe8b0' : '#ff8a9a'}">${ITEMS[k][1]} ${ITEMS[k][0]} ${this.creative ? n : (S.inv[k] || 0) + '/' + n}</span>`).join(' · ');
    const show = () => {
      te.innerHTML = tabs.map((t, i) => `<button class="rv-tab${i === tab ? ' on' : ''}" data-i="${i}">${t}</button>`).join(''); te.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { tab = +b.dataset.i; list.focus = 0; show(); }));
      let items;
      if (tab === 0) { items = Object.keys(S.inv).filter(k => S.inv[k] > 0).map(id => { const it = ITEMS[id], d = it[2], isTool = !!TOOLS[id]; return { label: `${it[1]} ${it[0]}`, sub: isTool ? (S.tool === id ? 'En main' : 'Outil : valider pour le prendre en main') : d ? [d.food && `+${d.food} faim`, d.water && `+${d.water} soif`, d.heal && `+${d.heal} santé`, d.sick && 'cru : risque de maladie'].filter(Boolean).join(' · ') : 'Matériau', get: () => isTool ? (S.tool === id ? '<b class="eq">✓</b>' : '') : '×' + (S.inv[id] || 0), act: () => { if (isTool) { this.setTool(id); } else if (d) { this.eat(id); if (!S.inv[id]) show(); } } }; }); if (!items.length) items = [{ label: 'Ton sac est vide', sub: 'Ramasse des bâtons, des pierres, des fibres…' }]; }
      else if (tab === 1) items = RECIPES.map(r => { const st = r.st && !this.nearStation(r.st); return { label: `${ITEMS[r.id][1]} ${ITEMS[r.id][0]}`, sub: () => `${r.d}<br>${cost(r.need)}${r.st ? `<br><span style="color:${st ? '#ff8a9a' : '#9fe8b0'}">Nécessite ${STATION_NAMES[r.st]} à proximité</span>` : ''}`, get: () => S.inv[r.id] ? '×' + S.inv[r.id] : '', disabled: () => !this.has(r.need) || (r.st && !this.nearStation(r.st)), act: () => { this.take(r.need); this.give(r.id, r.id === 'gourd' ? 1 : 1, true); S.stats.crafted++; this.sfx('craft'); this.toast('Fabriqué', ITEMS[r.id][0], 'green'); if (TOOLS[r.id] && S.tool === 'hands') this.setTool(r.id); this.hotDirty = true; } }; });
      else items = PIECES.map(d => ({ label: d.n, sub: () => cost(d.cost), disabled: () => !this.has(d.cost), act: () => { close(); this.enterBuild(d); } }));
      list.setItems(items);
      ov.querySelector('.gm-foot').innerHTML = `${gly('jump')} Valider &nbsp; ${gly('next')} onglet suivant &nbsp; ${gly('crouch')} Fermer`;
    };
    show();
    this.ui = { update: nav => { if (Input.pressed('next') || Input.pressed('tabR')) { tab = (tab + 1) % 3; list.focus = 0; show(); this.sfx('page'); } else if (Input.pressed('prev') || Input.pressed('tabL')) { tab = (tab + 2) % 3; list.focus = 0; show(); this.sfx('page'); } list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('inv') || Input.pressed('pause'))) close(); } };
  }
  openMap() {
    if (this.ui) return; if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    const S = this.S, W = this.world, ov = el('div', 'gmenu');
    ov.innerHTML = `<div class="rv-map glass"><canvas width="640" height="640"></canvas><div class="map-side"><div class="gm-kicker">${this.isl.name.toUpperCase()} · ${this.era.n}</div><h2>Carte & carnet</h2><div class="gm-list"></div><div class="gm-foot">${gly('crouch')} Fermer</div></div></div>`; this.root.appendChild(ov);
    if (!this.mapImg) { const c = document.createElement('canvas'); c.width = c.height = 320; const x = c.getContext('2d'), im = x.createImageData(320, 320), col = [0, 0, 0], P = this.isl.pal; for (let j = 0; j < 320; j++) for (let i = 0; i < 320; i++) { const wx = -HALF + (i + 0.5) / 320 * SIZE, wz = -HALF + (j + 0.5) / 320 * SIZE, h = W.getH(wx, wz), k = (i + j * 320) * 4; if (h < 0) { const t = clamp(-h / 14, 0, 1); col[0] = lerp(P.shallow[0], P.deep[0], t); col[1] = lerp(P.shallow[1], P.deep[1], t); col[2] = lerp(P.shallow[2], P.deep[2], t); } else { W.colorAt(wx, wz, h, 1 - clamp(W.slope(wx, wz) * 0.6, 0, 0.9), col); const sh = 0.8 + clamp((W.getH(wx - 3, wz - 3) - h) * -0.06, -0.3, 0.35); col[0] *= sh; col[1] *= sh; col[2] *= sh; } im.data[k] = col[0] * 255; im.data[k + 1] = col[1] * 255; im.data[k + 2] = col[2] * 255; im.data[k + 3] = 255; } x.putImageData(im, 0, 0); this.mapImg = c; }
    const cv = ov.querySelector('canvas'), x = cv.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(this.mapImg, 0, 0, 640, 640);
    const tp = (wx, wz) => [(wx + HALF) / SIZE * 640, (wz + HALF) / SIZE * 640];
    const mark = (p, c, label) => { const [a, b] = tp(p[0], p[1]); x.fillStyle = c; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.arc(a, b, 7, 0, 7); x.fill(); x.stroke(); x.font = '700 13px Inter,sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.strokeText(label, a, b - 12); x.fillText(label, a, b - 12); };
    const st = W.sites, known = S.story.pages.includes(0) || this.creative;
    st.springs.forEach(p => mark(p, S.story.flags.dry ? '#777' : '#3db8ff', 'Source')); mark(st.wreck, '#ffb36b', 'Épave');
    if (known) { mark(st.den, '#ff6070', 'Tanière'); mark(st.sunken, '#7ff6ff', 'Ruines englouties'); mark(st.sanct, '#b68cff', 'Sanctuaire'); mark(st.summit, '#fff', 'Sommet'); }
    const bed = S.pieces.find(p => p.t === 'bed'); if (bed) mark([bed.x, bed.z], '#3dff9a', 'Camp');
    const [px, pz] = tp(this.P.pos.x, this.P.pos.z); x.save(); x.translate(px, pz); x.rotate(-this.cam.yaw); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.beginPath(); x.moveTo(0, -12); x.lineTo(9, 9); x.lineTo(0, 4); x.lineTo(-9, 9); x.closePath(); x.fill(); x.stroke(); x.restore();
    const o = this.objective();
    const items = [{ label: '★ ' + o[0], sub: o[1] + (o[2] ? '<br>' + o[2] : '') }, ...S.story.pages.slice().sort().map(i => ({ label: '📖 ' + JOURNAL[i][0], sub: 'Valider pour relire', act: () => Modal.info(JOURNAL[i][0], `<p style="font-size:15px;line-height:1.7">${JOURNAL[i][1]}</p>`, { button: 'Fermer' }) })), { label: 'Fermer', act: () => close() }];
    const list = new ListMenu(ov.querySelector('.gm-list'), items);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); };
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('journal') || Input.pressed('pause'))) close(); } };
  }
  openPause() {
    if (this.ui) return; if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    const S = Store.settings, ov = el('div', 'gmenu'), G0 = this.S;
    ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">RIVAGE · ${this.isl.name.toUpperCase()} · ${MODES[this.cfg.mode].n.toUpperCase()}</div><h2>Pause</h2><div class="gm-list"></div><div class="gm-foot">${Store.cloud === 'on' ? '☁ Sauvegarde synchronisée' : '💾 Sauvegarde locale'} · Jour ${G0.day} · ${fmtDuration(G0.playTime)}</div></div>`; this.root.appendChild(ov);
    const close = () => { ov.remove(); this.ui = null; this.last = performance.now(); };
    const num = (k, step, min, max, fmt, after) => ({ get: () => fmt(S[k]), left: () => { S[k] = Math.max(min, +(S[k] - step).toFixed(2)); after && after(); Store.touch(); }, right: () => { S[k] = Math.min(max, +(S[k] + step).toFixed(2)); after && after(); Store.touch(); } });
    const tg = k => ({ get: () => S[k] ? 'Oui' : 'Non', left: () => { S[k] = !S[k]; Store.touch(); }, right: () => { S[k] = !S[k]; Store.touch(); } });
    const list = new ListMenu(ov.querySelector('.gm-list'), [
      { label: 'Reprendre', act: close }, { label: 'Carte & carnet', act: () => { close(); this.openMap(); } },
      { label: 'Commandes', act: () => Modal.info('Commandes · RIVAGE', `<div class="ctrl-grid"><div><h4>Manette PS5</h4><ul><li><b>Joysticks</b> bouger / caméra · <b>L3</b> sprint</li><li><b>R2</b> utiliser l’outil, frapper, creuser, poser</li><li><b>L2</b> pivoter la pièce</li><li><b>✕</b> saut, nager vers le haut</li><li><b>○</b> plonger, quitter la construction</li><li><b>△</b> ramasser, interagir</li><li><b>▢</b> sac, fabrication</li><li><b>R1 / L1</b> changer d’outil</li><li><b>Croix ↑</b> construire · <b>↓</b> manger · <b>→</b> boire · <b>←</b> torche</li><li><b>Pavé</b> carte · <b>Options</b> pause</li></ul></div><div><h4>Clavier & souris</h4><ul><li><b>ZQSD / WASD</b> bouger · <b>Maj</b> sprint</li><li><b>Clic gauche</b> utiliser · <b>Clic droit</b> pivoter</li><li><b>Espace</b> saut · <b>C</b> plonger</li><li><b>E</b> ramasser, interagir</li><li><b>Tab</b> sac · <b>B</b> construire</li><li><b>G</b> manger · <b>H</b> boire · <b>T</b> torche</li><li><b>Molette / 1-9</b> outil · <b>M</b> carte</li></ul></div></div>`, { button: 'Compris' }) },
      { label: 'Sensibilité caméra', ...num('sens', 0.1, 0.3, 3, v => v.toFixed(1)) }, { label: 'Inverser l’axe vertical', ...tg('invertY') },
      { label: 'Volume des sons', ...num('sfx', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) }, { label: 'Vibrations', ...tg('rumble') },
      { label: 'Sauvegarder et quitter vers NOVA', cls: 'exit', act: () => { close(); this.exit(); } }]);
    this.ui = { update: nav => { list.update(nav); if (this.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }

  /* ================= ciel, météo, sons ================= */
  updateEnv(dt) {
    const S = this.S, U = this.skyU, night0 = S.tod > 0.77 || S.tod < 0.23;
    S.tod += dt / DAY / (this.mods.longnight && night0 ? 3 : 1); if (S.tod >= 1) { S.tod -= 1; S.day++; this.newDay(); this.toast(`Jour ${S.day}`, 'Un nouveau jour se lève bientôt'); }
    S.wT -= dt; if (this.mods.storm) S.weather = 'storm'; else if (S.wT <= 0) { const q = Math.random(), pr = { tropic: [0.5, 0.75, 0.94], volcan: [0.6, 0.85, 0.95], nord: [0.3, 0.62, 0.9] }[this.cfg.island]; S.weather = q < pr[0] ? 'clear' : q < pr[1] ? 'cloudy' : q < pr[2] ? 'rain' : 'storm'; S.wT = 110 + Math.random() * 200; }
    const wantR = S.weather === 'rain' ? 0.7 : S.weather === 'storm' ? 1 : 0, wantC = { clear: 0.18, cloudy: 0.62, rain: 0.9, storm: 1 }[S.weather];
    this.rainK = damp(this.rainK, wantR, 0.4, dt); U.uCloud.value = damp(U.uCloud.value, wantC, 0.25, dt);
    const ang = (S.tod - 0.25) * Math.PI * 2, sd = new V3(Math.cos(ang) * 0.8, Math.sin(ang), 0.5).normalize(), el = sd.y, cl = U.uCloud.value;
    const day = smooth(-0.1, 0.25, el), night = 1 - smooth(-0.2, 0.06, el), dusk = Math.exp(-Math.pow(el / 0.2, 2)) * (1 - cl * 0.6), dim = 1 - cl * 0.55;
    const zen = new THREE.Color(0.012, 0.02, 0.055).lerp(new THREE.Color(0.2, 0.42, 0.8), day).lerp(new THREE.Color(0.3, 0.33, 0.37).multiplyScalar(0.25 + day * 0.75), cl * 0.85);
    const hor = new THREE.Color(0.04, 0.05, 0.11).lerp(new THREE.Color(0.66, 0.78, 0.92), day).lerp(new THREE.Color(0.5, 0.53, 0.56).multiplyScalar(0.2 + day * 0.8), cl * 0.8);
    hor.r += dusk * 0.5; hor.g += dusk * 0.18;
    if (this.flash > 0) { this.flash -= dt; const f = this.flash * 3; zen.addScalar(f); hor.addScalar(f); }
    if (S.weather === 'storm' && Math.random() < dt * 0.09) { this.flash = 0.25; setTimeout(() => this.sfx('thunder'), 300 + Math.random() * 1500); }
    U.uZen.value.copy(zen); U.uHor.value.copy(hor); U.uNight.value = night; U.uDusk.value = dusk; U.uTime.value = this.time; U.uSun.value.copy(sd);
    U.uCloudCol.value.setRGB(1, 1, 1).multiplyScalar((0.16 + day * 0.84) * (1 - this.rainK * 0.45));
    const lightDir = el > -0.04 ? sd : sd.clone().negate();
    const sc = el > -0.04 ? new THREE.Color(1, 0.62, 0.36).lerp(new THREE.Color(1, 0.96, 0.9), smooth(0, 0.4, el)).multiplyScalar((0.2 + day * 0.95) * dim) : new THREE.Color(0.13, 0.17, 0.3).multiplyScalar(dim);
    this.sun.color.copy(sc); this.sun.position.copy(this.P.pos).addScaledVector(lightDir, 110); this.sun.target.position.copy(this.P.pos);
    this.hemi.color.copy(zen.clone().lerp(hor, 0.5).multiplyScalar(1.15).addScalar(0.07 + Math.max(0, this.flash))); this.hemi.intensity = 2.3; this.sun.intensity = 2.7; this.hemi.groundColor.setRGB(0.08 + 0.14 * day, 0.08 + 0.13 * day, 0.07 + 0.1 * day);
    const fog = this.scene.fog;
    if (this.under) { fog.color.setRGB(this.isl.pal.shallow[0] * 0.35 * (0.3 + day * 0.7), this.isl.pal.shallow[1] * 0.5 * (0.3 + day * 0.7), this.isl.pal.shallow[2] * 0.6 * (0.3 + day * 0.7)); fog.near = 0.5; fog.far = 34; }
    else { fog.color.copy(hor); fog.near = lerp(this.fogFar * 0.12, 8, this.rainK * 0.8); fog.far = this.fogFar * (1 - this.rainK * 0.6); }
    const WU = this.waterU; WU.uTime.value = this.time; WU.uSunCol.value.copy(sc); WU.uSky.value.copy(zen).lerp(hor, 0.55); WU.uFogCol.value.copy(fog.color); WU.uFogNear.value = fog.near; WU.uFogFar.value = this.under ? 34 : fog.far; WU.uWind.value = this.rainK; WU.uUnder.value = this.under ? 1 : 0;
    this.nightK = night;
    if (this.world.texDirty) this.world.updateTex();
    // pluie
    this.rain.visible = this.rainK > 0.05 && !this.under;
    if (this.rain.visible) { const rp = this.rainP, c = this.camera.position; for (let i = 0; i < this.rainN; i++) { const k = i * 6; rp[k + 1] -= 34 * dt; if (rp[k + 1] < -3) { rp[k] = (Math.random() - 0.5) * 40; rp[k + 1] = 18 + Math.random() * 6; rp[k + 2] = (Math.random() - 0.5) * 40; } rp[k + 3] = rp[k] + 0.25; rp[k + 4] = rp[k + 1] + 0.9; rp[k + 5] = rp[k + 2]; } this.rain.position.set(c.x, c.y, c.z); this.rain.geometry.attributes.position.needsUpdate = true; this.rain.material.opacity = this.rainK * 0.45; }
    // feux, torche, portail, fragments
    const fl = this.fires.slice().sort((a, b) => a.pos.distanceToSquared(this.P.pos) - b.pos.distanceToSquared(this.P.pos));
    this.fireLights.forEach((l, i) => { const f = fl[i]; if (f && f.pos.distanceTo(this.P.pos) < 60) { l.position.copy(f.pos).y += 0.5; l.intensity = (1.6 + Math.sin(this.time * 13 + i) * 0.3) * (0.4 + night * 0.9); } else l.intensity = 0; });
    for (const f of this.fires) { const fm = f.p.mesh.userData.flames; fm[0].scale.set(1 + Math.sin(this.time * 11) * 0.15, 1 + Math.sin(this.time * 17) * 0.25, 1); fm[1].scale.y = 1 + Math.sin(this.time * 23) * 0.3; if (Math.random() < dt * 5 && f.pos.distanceTo(this.P.pos) < 40) this.burst(f.pos.clone().add(new V3(0, 0.4, 0)), 1, 0xff8a30, 0.5, 1.2, -1.4); }
    const torch = S.tool === 'torch'; this.torchLight.intensity = torch ? 1.5 + Math.sin(this.time * 15) * 0.2 : 0; if (torch) this.torchLight.position.set(this.P.pos.x, this.P.pos.y + 1.7, this.P.pos.z);
    this.portal.material.opacity = damp(this.portal.material.opacity, this.portalOn ? 0.6 + Math.sin(this.time * 3) * 0.15 : 0, 2, dt);
    for (const id in this.fragMeshes) { const m = this.fragMeshes[id]; if (m.visible) { m.rotation.y += dt * 1.5; m.position.y += Math.sin(this.time * 2) * dt * 0.15; } }
    if (!S.story.flags.wreck && Math.random() < dt * 6) this.burst(this.wreckPos.clone().add(new V3(0, 2.5, 0)), 1, 0x555555, 0.6, 5, -2.2);
    for (let i = this.falling.length - 1; i >= 0; i--) { const f = this.falling[i]; f.t += dt; const o = f.o, im = this.inst[o.type], q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.min(1.5, f.t * f.t * 2.4), o.rot, 0, 'YXZ')), s = f.t > 1.4 ? Math.max(0, 1 - (f.t - 1.4) * 2) * o.s : o.s; im.setMatrixAt(o.idx, new THREE.Matrix4().compose(new V3(o.x, o.y - 0.08, o.z), q, new V3(s, s, s))); im.instanceMatrix.needsUpdate = true; if (f.t > 1.9) this.falling.splice(i, 1); }
  }
  initAudio() {
    const ctx = Sound.ctx; this.amb = null; if (!ctx) return;
    const out = ctx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 18000; out.connect(Sound.fx);
    const loop = (type, freq, q = 0.7) => { const s = ctx.createBufferSource(); s.buffer = Sound.noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); s.start(0, Math.random()); return { s, f, g }; };
    this.amb = { out, sea: loop('lowpass', 520), wind: loop('bandpass', 420, 0.6), rain: loop('highpass', 2600), fire: loop('bandpass', 1400, 1.2), nodes: [] }; this.amb.nodes = [this.amb.sea, this.amb.wind, this.amb.rain, this.amb.fire];
  }
  updateAudio(dt) {
    if (!this.amb) { if (Sound.ctx) this.initAudio(); return; }
    const A = this.amb, P = this.P, W = this.world, t = Sound.ctx.currentTime, set = (n, v) => n.g.gain.setTargetAtTime(v, t, 0.25);
    const shore = clamp(1 - Math.max(0, W.getH(P.pos.x, P.pos.z) - 1) / 22, 0, 1);
    set(A.sea, (0.05 + shore * 0.28) * (0.75 + 0.25 * Math.sin(this.time * 0.7)) * (this.under ? 1.6 : 1));
    set(A.wind, 0.03 + clamp(P.pos.y / 90, 0, 1) * 0.16 + this.rainK * 0.14); set(A.rain, this.under ? 0 : this.rainK * 0.2);
    let fd = 99; for (const f of this.fires) fd = Math.min(fd, f.pos.distanceTo(P.pos)); set(A.fire, fd < 12 ? (1 - fd / 12) * 0.12 * (0.6 + Math.random() * 0.8) : 0);
    A.out.frequency.setTargetAtTime(this.under ? 480 : 18000, t, 0.1);
    this.chirpT = (this.chirpT || 2) - dt;
    if (this.chirpT <= 0 && !this.under && this.rainK < 0.3) {
      const h = W.getH(P.pos.x, P.pos.z);
      if (this.nightK > 0.6) { this.chirpT = 0.5 + Math.random() * 0.5; if (h > 3) for (let i = 0; i < 3; i++) Sound.tone(4300 + Math.random() * 200, 0.04, { type: 'sine', vol: 0.012, delay: i * 0.06, dest: A.out }); }
      else { this.chirpT = 1.5 + Math.random() * 5; if (h > 2) { const f = 1800 + Math.random() * 1800; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) Sound.tone(f + Math.random() * 300, 0.09, { type: 'sine', vol: 0.02, to: f * (0.8 + Math.random() * 0.5), delay: i * 0.13, dest: A.out }); } }
    }
    this.musT = (this.musT || 20) - dt; if (this.musT <= 0) { this.musT = 70 + Math.random() * 60; const sc = [220, 261.6, 293.7, 329.6, 392, 440], b = (Math.random() * 3) | 0; [0, 2, 4, 3].forEach((n, i) => Sound.tone(sc[(b + n) % 6], 5, { type: 'sine', vol: 0.03, delay: i * 2.2, attack: 1.2, dest: Sound.music })); Sound.tone(sc[b] / 2, 11, { type: 'sine', vol: 0.03, attack: 2, dest: Sound.music }); }
    if (this.S.p.hp < 25 && !this.dead) { this.hbT = (this.hbT || 0) - dt; if (this.hbT <= 0) { this.hbT = 0.9; Sound.tone(60, 0.15, { vol: 0.2, to: 40 }); Sound.tone(55, 0.15, { vol: 0.14, to: 38, delay: 0.18 }); } }
  }
  sfx(n) {
    if (!Sound.ctx) return; const N = (d, o) => Sound.noise(d, o), T = (f, d, o) => Sound.tone(f, d, o);
    switch (n) {
      case 'step': N(0.07, { vol: 0.05, freq: 700 + Math.random() * 400, type: 'bandpass' }); break; case 'wade': N(0.16, { vol: 0.08, freq: 1500, type: 'bandpass' }); break; case 'land': N(0.14, { vol: 0.14, freq: 400, to: 120 }); break;
      case 'splash': N(0.5, { vol: 0.25, freq: 2500, to: 500, type: 'bandpass' }); break; case 'swing': N(0.12, { vol: 0.05, freq: 1200, to: 3000, type: 'bandpass' }); break;
      case 'chop': T(180, 0.09, { type: 'square', vol: 0.09, to: 90 }); N(0.08, { vol: 0.18, freq: 1800, to: 500 }); break; case 'mine': T(900, 0.05, { type: 'square', vol: 0.05, to: 500 }); N(0.07, { vol: 0.18, freq: 3500, to: 900, type: 'bandpass' }); break;
      case 'sand': N(0.14, { vol: 0.14, freq: 1100, type: 'bandpass' }); break; case 'thud': T(110, 0.08, { vol: 0.12, to: 60 }); break; case 'fall': N(0.9, { vol: 0.2, freq: 900, to: 150 }); T(70, 0.4, { vol: 0.25, to: 35, delay: 0.75 }); break;
      case 'crumble': N(0.4, { vol: 0.22, freq: 1500, to: 200 }); break; case 'pick': T(700, 0.05, { type: 'triangle', vol: 0.07 }); T(1050, 0.07, { type: 'triangle', vol: 0.05, delay: 0.04 }); break;
      case 'craft': T(520, 0.08, { type: 'triangle', vol: 0.08 }); T(780, 0.12, { type: 'triangle', vol: 0.08, delay: 0.07 }); N(0.08, { vol: 0.1, freq: 2500, delay: 0.02 }); break; case 'build': T(160, 0.1, { type: 'square', vol: 0.08, to: 90 }); N(0.12, { vol: 0.15, freq: 900 }); break;
      case 'eat': for (let i = 0; i < 3; i++) N(0.07, { vol: 0.09, freq: 900, type: 'bandpass', delay: i * 0.13 }); break; case 'drink': for (let i = 0; i < 3; i++) T(300 + i * 60, 0.09, { vol: 0.07, to: 500 + i * 60, delay: i * 0.14 }); break;
      case 'sizzle': N(0.9, { vol: 0.1, freq: 5000, type: 'highpass' }); break; case 'door': T(140, 0.18, { type: 'sawtooth', vol: 0.05, to: 220 }); break; case 'hit': T(150, 0.1, { type: 'square', vol: 0.1, to: 60 }); N(0.08, { vol: 0.2, freq: 1500 }); break;
      case 'bite': N(0.12, { vol: 0.2, freq: 700 }); T(90, 0.2, { type: 'sawtooth', vol: 0.12, to: 50 }); break; case 'hurt': T(190, 0.2, { type: 'sawtooth', vol: 0.08, to: 90 }); break; case 'death': [330, 262, 196, 131].forEach((f, i) => T(f, 0.7, { type: 'triangle', vol: 0.08, delay: i * 0.22 })); break;
      case 'death2': T(240, 0.35, { type: 'sawtooth', vol: 0.06, to: 80 }); break; case 'gem': [1318, 1568, 2093, 2637].forEach((f, i) => T(f, 0.4, { vol: 0.06, delay: i * 0.06 })); break; case 'goal': [392, 523, 659, 784].forEach((f, i) => T(f, 0.6, { vol: 0.07, delay: i * 0.1, attack: 0.02 })); break;
      case 'page': N(0.1, { vol: 0.05, freq: 3000, type: 'highpass' }); break; case 'thunder': N(2.6, { vol: 0.5, freq: 400, to: 50 }); T(50, 2, { vol: 0.3, to: 28 }); break; case 'portal': T(110, 4, { type: 'sine', vol: 0.15, to: 440, attack: 1 }); T(165, 4, { type: 'sine', vol: 0.1, to: 660, attack: 1 }); break;
    }
  }

  /* ================= sauvegarde, boucle ================= */
  completion() { const S = this.S; return Math.min(100, S.story.frags.length * 13 + Math.min(S.story.step, 5) * 2 + (S.inv.key ? 5 : 0) + (S.ended ? 25 : 0) + (S.ended ? 0 : 0)); }
  saveGame() {
    if (!this.world || this.noSave) return; const S = this.S, P = this.P;
    if (!this.dead) { S.p.x = +P.pos.x.toFixed(2); S.p.y = +P.pos.y.toFixed(2); S.p.z = +P.pos.z.toFixed(2); } S.p.yaw = this.cam.yaw;
    const clean = JSON.parse(JSON.stringify(S, (k, v) => (k === 'mesh' || k === 'boxes') ? undefined : v));
    const o = this.objective();
    Store.setGame('rivage', { state: { cfg: this.cfg, S: clean }, summary: { level: S.day, completion: this.completion(), playTime: S.playTime, chapter: o[0], line: `Jour ${S.day} · ${this.isl.name} · ${MODES[this.cfg.mode].n}`, cards: [['Reprendre', o[0], `${this.isl.name} · ${this.era.n}`], ['Fragments', `${S.story.frags.length} / 5`, 'Du Passage', S.story.frags.length / 5], ['Constructions', String(S.pieces.length), 'Pièces posées'], ['Mode', MODES[this.cfg.mode].n, Object.keys(this.mods).filter(k => this.mods[k]).length + ' mod(s) actif(s)']] } });
    this.lastSave = this.time;
  }
  exit() { this.saveGame(); this.destroy(); this.onExit && this.onExit(); }
  destroy() {
    this.running = false; if (this.onResize) removeEventListener('resize', this.onResize); if (this.onVis) document.removeEventListener('visibilitychange', this.onVis);
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    Input.touch.mx = Input.touch.my = 0; Input.touch.btn = {}; this.root.classList.remove('has-touch');
    if (this.amb) { for (const n of this.amb.nodes) { try { n.s.stop(); } catch (e) {} } try { this.amb.out.disconnect(); } catch (e) {} }
    if (this.scene) { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {} }
    this.root.innerHTML = '';
  }
  resize() { const w = this.root.clientWidth || innerWidth, h = this.root.clientHeight || innerHeight; this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.root.classList.toggle('portrait', h > w); }
  loop(now) {
    if (!this.running) return; requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (dt <= 0) dt = 0.016;
    Input.poll(); const nav = Input.nav(dt);
    if (Modal.active) { Modal.active.update(nav); this.render(); return; }
    if (this.ui) { this.ui.update(nav); if (!this.running) return; if (this.world) { this.skyU.uTime.value += dt * 0.2; this.waterU.uTime.value += dt * 0.5; } this.render(); return; }
    if (!this.world) return;
    const I = Input;
    if (I.pressed('pause')) return this.openPause();
    if (I.pressed('journal')) return this.openMap();
    if (I.pressed('inv')) return this.openBag(0);
    if (I.pressed('build')) { if (this.buildMode) this.exitBuild(); else return this.openBag(2); }
    if (I.pressed('eat')) this.quickEat(); if (I.pressed('drink')) this.quickDrink();
    if (I.pressed('light')) { if (this.S.inv.torch) this.setTool(this.S.tool === 'torch' ? 'hands' : 'torch'); else this.hint('Fabrique une torche (1 bâton, 2 fibres)'); }
    if (this.buildMode) {
      if (I.pressed('alt')) { this.buildMode.r = (this.buildMode.r + 1) % 4; this.sfx('page'); }
      if (I.pressed('crouch') && !this.P.swim) this.exitBuild();
      else if (I.pressed('next') || I.pressed('prev')) { const i = PIECES.indexOf(this.buildMode.def), r = this.buildMode.r; this.enterBuild(PIECES[(i + (I.pressed('next') ? 1 : PIECES.length - 1)) % PIECES.length]); this.buildMode.r = r; this.sfx('page'); }
    } else {
      const hb = this.hotbar(); let i = hb.indexOf(this.S.tool);
      if (I.pressed('next')) this.setTool(hb[(i + 1) % hb.length]); else if (I.pressed('prev')) this.setTool(hb[(i + hb.length - 1) % hb.length]);
      if (I.cur.digit && !I.prev.digit && hb[I.cur.digit - 1]) this.setTool(hb[I.cur.digit - 1]);
    }
    this.time += dt; this.S.playTime += dt;
    this.updatePlayer(dt); this.updateCamera(dt); this.updateFocus();
    if (this.buildMode) this.ghostUpdate();
    if (!this.ui) { if (I.down('use')) this.doUse(); if (I.pressed('act')) this.doAct(); }
    this.updateModel(dt); this.manageAnimals(dt); this.updateAnimals(dt); this.updateNeeds(dt); this.updateEnv(dt); this.updateParts(dt); this.updateAudio(dt); this.updateHUD(dt);
    if (this.lava) this.lava.material.color.setRGB(1, 0.3 + Math.sin(this.time * 1.3) * 0.08, 0.08);
    if (this.time - this.lastSave > 30) this.saveGame();
    this.render(); this.perf(dt);
  }
  render() { if (this.renderer && this.scene) this.renderer.render(this.scene, this.camera); }
  perf(dt) { this.fa = (this.fa || 0) + dt; this.fn = (this.fn || 0) + 1; if (this.fa < 1.5) return; const fps = this.fn / this.fa; this.fa = 0; this.fn = 0; if (Store.settings.fps) this.hud.fps.textContent = `${fps.toFixed(0)} FPS · ×${this.pr.toFixed(2)}`; if (fps < 40 && this.pr > 0.5) { this.pr = Math.max(0.5, this.pr - 0.1); this.renderer.setPixelRatio(this.pr); this.resize(); } else if (fps > 57 && this.pr < this.prTarget) { this.pr = Math.min(this.prTarget, this.pr + 0.05); this.renderer.setPixelRatio(this.pr); this.resize(); } }
}
