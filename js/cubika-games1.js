// CUBIKA — mini-jeux 1 à 5 : parcours, tour, tycoon, familiers, cache-cache
import { Input, Modal, ListMenu, rng, el } from './core.js';
import { THREE, V3, steer, needJump, textSprite, boxMat, RUN, buildAvatar, disposeAvatar, randomLook, clamp, damp } from './cubika-engine.js';

const fmt = n => Math.floor(n).toLocaleString('fr-FR');
const top = (W, x, y, z, w, d, c, o = {}, h = 1) => W.add(x, y - h / 2, z, w, h, d, c, o); // bloc dont le dessus est à y
function coinMesh() { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), boxMat('#ffd23d', { smooth: true, emissive: 0x553300 })); m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); return g; }
function flag(W, x, y, z, col) { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3, 0.12), boxMat('#ffffff')); p.position.y = 1.5; const f = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.06), boxMat(col)); f.position.set(0.62, 2.55, 0); g.add(p, f); g.position.set(x, y, z); W.group.add(g); return { g, f }; }
const ord = n => n === 1 ? '1ʳᵉ' : n + 'ᵉ';
function confetti(G, p) { G.bits.burst(p, 50, ['#ff4d6d', '#ffd23d', '#7ddc4a', '#3d8bff', '#ff7ac8'], 9, 0.2, 1.4); }

/* ============================================================ */
/* 1. PARCOURS CÉLESTE                                           */
/* ============================================================ */
export class Obby {
  constructor(G) { this.G = G; }
  help() { return `<p>Rejoins l’arche d’arrivée. Les <b>drapeaux verts</b> sont des points de contrôle : si tu tombes, tu y repars. Les blocs <b style="color:#ff4d6d">rouges</b> et les barres tournantes te renvoient au dernier drapeau. Les dalles bleues disparaissent quand on marche dessus, les jaunes font rebondir très haut.</p>`; }
  start() {
    const G = this.G, W = G.world, r = this.r = rng((Math.random() * 1e9) | 0);
    G.setSky('#4aa3ff', '#bfe4ff', '#fff3e0', 0xd8ecff, 90, 320);
    this.wp = []; this.movers = []; this.ghosts = []; this.spinners = []; this.coins = []; this.cps = []; this.T = 0; this.limit = 200; this.order = []; this.got = 0;
    let x = 0, y = 0, z = 0;
    top(W, 0, 0, 0, 10, 10, '#ffffff'); this.wp.push({ p: new V3(0, 0, 3) });
    const C = ['#ff5d8f', '#ffd23d', '#7ddc4a', '#3d8bff', '#ff8a3d', '#a46bff'];
    const pad = (px, py, pz, w, d, c, o) => { const b = top(W, px, py, pz, w, d, c, o); this.wp.push({ p: new V3(px, py, pz), b }); return b; };
    const coin = (px, py, pz) => { const m = coinMesh(); m.position.set(px, py + 1.2, pz); W.group.add(m); this.coins.push(m); };
    z = 5;
    const types = ['pads', 'stairs', 'lava', 'mover', 'ghost', 'bounce', 'spinner', 'narrow', 'zigzag', 'pads', 'mover', 'lava', 'ghost', 'spinner', 'bounce', 'zigzag', 'stairs', 'narrow'];
    for (let i = types.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [types[i], types[j]] = [types[j], types[i]]; }
    types.forEach((t, si) => {
      const c = C[si % C.length];
      if (t === 'pads') for (let k = 0; k < 4; k++) { z += 2.4 + r() * 1.3 + 1.1; x += (r() - 0.5) * 3; y += (r() - 0.35) * 1.0; pad(x, y, z, 2.2, 2.2, c); if (k === 2) coin(x, y, z); z += 1.1; }
      else if (t === 'stairs') for (let k = 0; k < 5; k++) { z += 2.4; y += 1.05; pad(x, y, z, 2.4, 2, c); if (k === 4) coin(x, y, z); }
      else if (t === 'lava') { z += 3; const L = 15; top(W, x, y, z + L / 2, 4.5, L, '#f4f4f4'); for (let k = 0; k < 3; k++) { const kz = z + 3 + k * 4.2; this.wp.push({ p: new V3(x, y, kz - 1.6) }); W.add(x, y + 0.3, kz, 4.6, 0.6, 1, '#ff2a3c', { kill: true }); this.wp.push({ p: new V3(x, y, kz + 1.4) }); } coin(x, y, z + 11); z += L; this.wp.push({ p: new V3(x, y, z - 0.8) }); }
      else if (t === 'mover') { z += 3.8; const b = W.add(x, y - 0.5, z + 1.5, 3, 1, 3, c, { dyn: true }); this.movers.push({ b, bx: x, by: y - 0.5, bz: z + 1.5, ax: 'x', amp: 4.5, spd: 0.9 + r() * 0.5, ph: r() * 6 }); this.wp.push({ p: new V3(x, y, z + 1.5), b, wait: () => Math.abs((b.min.x + b.max.x) / 2 - x) < 0.9 }); z += 3 + 2.6; pad(x, y, z + 1.2, 3, 2.4, '#ffffff'); this.wp[this.wp.length - 2].next = true; z += 2.4; }
      else if (t === 'ghost') for (let k = 0; k < 5; k++) { z += 2.5 + 1.1; x += (r() - 0.5) * 2; const m = new THREE.MeshLambertMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.85 }); const b = W.add(x, y - 0.25, z, 2.2, 0.5, 2.2, '#8fd8ff', { dyn: true, mat: m }); b.onStep = () => { if (b.t == null) b.t = 0.55; }; this.ghosts.push(b); this.wp.push({ p: new V3(x, y, z), b }); z += 1.1; }
      else if (t === 'bounce') { z += 3.5; const b = top(W, x, y, z, 2.6, 2.6, '#ffe14a', { bounce: 22 }); this.wp.push({ p: new V3(x, y, z), b }); z += 4.5; y += 5.2; pad(x, y, z + 1.5, 4, 4, c); coin(x, y, z + 1.5); z += 3.5; }
      else if (t === 'spinner') { z += 3.4; const cz = z + 4.5; top(W, x, y, cz, 9, 9, '#ffffff'); W.add(x, y + 0.6, cz, 0.8, 1.2, 0.8, '#5b6270'); const m = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.45, 0.45), boxMat('#ff2a3c', { emissive: 0x440000 })); m.position.set(x, y + 0.55, cz); W.group.add(m); this.spinners.push({ c: new V3(x, y, cz), len: 4.2, m, spd: (1.1 + r() * 0.8) * (r() < 0.5 ? -1 : 1), a: r() * 6 }); this.wp.push({ p: new V3(x, y, cz - 3.6) }); this.wp.push({ p: new V3(x + 2.6, y, cz) }); this.wp.push({ p: new V3(x, y, cz + 3.6) }); coin(x - 2.6, y, cz); z = cz + 4.5; }
      else if (t === 'narrow') { z += 3; top(W, x, y, z + 5, 0.75, 10, c); this.wp.push({ p: new V3(x, y, z + 0.6) }); this.wp.push({ p: new V3(x, y, z + 9.4) }); coin(x, y, z + 5); z += 10; }
      else if (t === 'zigzag') for (let k = 0; k < 5; k++) { z += 2.6 + 0.9; x += k % 2 ? 3.2 : -3.2; pad(x, y, z, 1.8, 1.8, c); z += 0.9; }
      if (si % 6 === 5 && si < types.length - 1) { z += 3.2; const b = pad(x, y, z + 1.5, 4.5, 4.5, '#3ddc84'); flag(W, x - 1.6, y, z + 1.5, '#3ddc84'); this.cps.push({ b, i: this.wp.length - 1, p: new V3(x, y, z + 1.5) }); b.cp = this.cps.length; z += 4.5; }
    });
    z += 3.2; const fb = pad(x, y, z + 4, 9, 9, '#ffd23d'); fb.finish = true; this.finish = new V3(x, y, z + 4);
    for (const s of [-1, 1]) W.add(x + s * 3.8, y + 2.5, z + 4, 0.8, 5, 0.8, '#ff5d8f'); W.add(x, y + 5.3, z + 4, 8.4, 0.8, 0.8, '#ff5d8f');
    const sg = textSprite('ARRIVÉE', 1.1, { size: 90, w: 640, h: 140, color: '#fff', bg: 'rgba(255,93,143,.95)', stroke: null }); sg.position.set(x, y + 6.6, z + 4); W.group.add(sg);
    this.minY = -14;
    for (let i = 0; i < 40; i++) W.add((r() - 0.5) * 70, -10 - r() * 12, r() * (z + 20) - 10, 6 + r() * 8, 2 + r() * 2, 6 + r() * 8, '#ffffff', { solid: false });
    W.build();
    const G2 = G, P = G.player; P.pos.set(0, 0.1, 1.5); P.yaw = 0; G.ocam.yaw = Math.PI; G.ocam.pitch = 0.35;
    this.racers = [P, ...G.makeBots(5)];
    this.racers.forEach((c, i) => { if (c !== P) c.pos.set(-3.5 + (i % 3) * 3.5, 0.1, -1.5 - Math.floor(i / 3) * 2); c.yaw = 0; c.data = { wi: 0, cpi: 0, cp: c.pos.clone(), done: false }; c.sync(); });
    this.state = 'count'; G.touchLabels({ attack: null, alt: null, crouch: null });
    G.countdown(3).then(() => { if (this.state === 'count') this.state = 'run'; });
  }
  respawn(c) { const G = this.G; G.bits.burst(c.pos.clone().setY(c.pos.y + 1), 14, ['#fff', c.look.shirt], 5); c.pos.copy(c.data.cp).setY(c.data.cp.y + 0.5); c.vel.set(0, 0, 0); c.data.wi = c.data.cpi; if (c === G.player) { G.sfx('die'); Input.rumble(0.5, 0.3, 140); } }
  progress(c) { return c.data.done ? 1e6 - c.data.rank : c.data.wi; }
  update(dt) {
    const G = this.G, W = G.world, P = G.player; this.T += dt;
    for (const m of this.movers) { m.ph += dt * m.spd; const o = Math.sin(m.ph) * m.amp; W.moveDyn(m.b, m.bx + (m.ax === 'x' ? o : 0), m.by, m.bz + (m.ax === 'z' ? o : 0)); }
    for (const b of this.ghosts) { if (b.t != null) { b.t -= dt; if (!b.off) b.mesh.material.opacity = Math.max(0.12, b.t / 0.55 * 0.85); if (b.t <= 0 && !b.off) { b.off = true; b.mesh.visible = false; b.t = 2.6; } else if (b.t <= 0 && b.off) { b.off = false; b.mesh.visible = true; b.mesh.material.opacity = 0.85; b.t = null; } } }
    for (const s of this.spinners) { s.a += s.spd * dt; s.m.rotation.y = s.a; }
    for (const c of this.coins) if (c.visible) { c.rotation.y += dt * 3; if (P.pos.distanceTo(c.position.clone().setY(c.position.y - 1.2)) < 1.3) { c.visible = false; this.got++; G.sfx('coin'); G.bits.burst(c.position, 10, '#ffd23d', 4); } }
    const run = this.state === 'run';
    G.ctlPlayer(dt, { noMove: !run || P.data.done, noJump: !run });
    for (const b of this.racers) if (b !== P) this.botThink(b, dt, run);
    for (const c of this.racers) {
      if (c.data.done) continue;
      // points de contrôle / arrivée
      const gb = c.ground;
      if (gb && gb.cp && c.data.cpi < this.cps[gb.cp - 1].i) { const cp = this.cps[gb.cp - 1]; c.data.cpi = cp.i; c.data.cp = cp.p.clone(); c.data.wi = Math.max(c.data.wi, cp.i); if (c === P) { G.sfx('check'); G.big(`Point de contrôle ${gb.cp}`, '', 1.2); } }
      if (c === P) { let best = c.data.wi; for (let i = c.data.wi; i < Math.min(this.wp.length, c.data.wi + 4); i++) { const w = this.wp[i], wp = w.b && w.b.delta ? new V3((w.b.min.x + w.b.max.x) / 2, w.b.max.y, (w.b.min.z + w.b.max.z) / 2) : w.p; if (Math.hypot(c.pos.x - wp.x, c.pos.z - wp.z) < 1.8 && Math.abs(c.pos.y - wp.y) < 1.5) best = i; } c.data.wi = best; }
      if (gb && gb.finish && run) { c.data.done = true; c.data.rank = this.order.length; c.data.time = this.T; this.order.push(c); if (c === P) { confetti(G, c.pos.clone().setY(c.pos.y + 1.5)); G.big(`${ord(this.order.length)} place${this.order.length === 1 ? ' !' : ''}`, `Temps : ${this.T.toFixed(1)} s`, 2); this.end(); } }
      if (c.touchKill || this.spinHit(c) || c.pos.y < this.minY) this.respawn(c);
    }
    if (run) { this.timeLeft = this.limit - this.T; G.timer(this.timeLeft); if (this.timeLeft <= 0) this.end(); }
    const rows = [...this.racers].sort((a, b) => this.progress(b) - this.progress(a)).map(c => ({ n: c === P ? 'Toi' : c.name, v: c.data.done ? `✓ ${c.data.time.toFixed(1)} s` : Math.round(c.data.wi / (this.wp.length - 1) * 100) + ' %', me: c === P }));
    G.board(rows); G.info(`🏁 Drapeau ${P.data.cpi ? this.cps.findIndex(x => x.i === P.data.cpi) + 1 : 0}/${this.cps.length} · ◆ ${this.got}`);
    G.updateCam(dt);
  }
  spinHit(c) { for (const s of this.spinners) { if (c.pos.y > s.c.y + 0.8 || c.pos.y + c.h < s.c.y + 0.3) continue; const dx = c.pos.x - s.c.x, dz = c.pos.z - s.c.z; const ca = Math.cos(s.a), sa = Math.sin(s.a); const along = dx * ca - dz * sa, perp = dx * sa + dz * ca; if (Math.abs(along) < s.len && Math.abs(perp) < 0.25 + c.r) return true; } return false; }
  botThink(b, dt, run) {
    const G = this.G, W = G.world; if (!run || b.data.done) { G.moveBot(b, dt, new V3(), false); return; }
    const w = this.wp[Math.min(b.data.wi + 1, this.wp.length - 1)], tp = w.b && w.b.delta ? new V3((w.b.min.x + w.b.max.x) / 2, w.b.max.y, (w.b.min.z + w.b.max.z) / 2) : w.p;
    const cur = this.wp[b.data.wi];
    if (Math.hypot(b.pos.x - tp.x, b.pos.z - tp.z) < 1.0 && b.pos.y > tp.y - 0.4) { b.data.wi = Math.min(this.wp.length - 1, b.data.wi + 1); b.data.wait = 0; }
    let mv = steer(b, tp.x, tp.z, 0.3), jump = false;
    // attendre une plateforme mobile
    if ((w.wait && !w.wait()) || (cur && cur.next && cur.wait && !cur.wait())) { const dist = Math.hypot(b.pos.x - tp.x, b.pos.z - tp.z); if (b.onGround && dist > 2) { const gb = W.groundBelow(b.pos.x + mv.x * 0.9, b.pos.z + mv.z * 0.9, b.pos.y + 0.05, 0.05); if (!gb || b.pos.y - gb.y > 1) mv.set(0, 0, 0); } }
    if (b.onGround && mv.lengthSq() > 0) { jump = needJump(b, W, mv, 0.75); const kb = W.solidAt(b.pos.x + mv.x * 1.1, b.pos.y + 0.3, b.pos.z + mv.z * 1.1); if (kb && kb.kill) jump = true; if (tp.y > b.pos.y + 0.55 && Math.hypot(b.pos.x - tp.x, b.pos.z - tp.z) < 3.4) jump = true; }
    for (const s of this.spinners) { if (Math.abs(b.pos.y - s.c.y) > 1) continue; const dx = b.pos.x - s.c.x, dz = b.pos.z - s.c.z; if (Math.hypot(dx, dz) > s.len + 0.6) continue; const ca = Math.cos(s.a), sa = Math.sin(s.a); if (Math.abs(dx * sa + dz * ca) < 1.3 && Math.random() < b.skill) jump = true; }
    if (Math.random() < 0.004 * (1.2 - b.skill)) mv.multiplyScalar(0.2);
    G.moveBot(b, dt, mv, jump, { speed: RUN * (0.78 + b.skill * 0.2) });
  }
  end() {
    if (this.state === 'end') return; this.state = 'end'; const G = this.G, P = G.player;
    const all = [...this.racers].sort((a, b) => this.progress(b) - this.progress(a)), place = all.indexOf(P) + 1;
    const coins = (P.data.done ? [80, 60, 45, 32, 30, 30][place - 1] : 10 + 4 * this.cps.filter(c => c.i <= P.data.cpi).length) + this.got;
    G.finish({ win: place === 1 && P.data.done, place, coins, title: P.data.done ? (place === 1 ? 'Victoire !' : `${ord(place)} place`) : 'Temps écoulé', best: P.data.done ? +this.T.toFixed(1) : null, low: true, bestTxt: P.data.done ? `${this.T.toFixed(1)} s` : null, lines: [`Classement : <b>${ord(place)} sur ${all.length}</b>`, P.data.done ? `Temps : <b>${this.T.toFixed(1)} s</b>` : 'Parcours non terminé', `Pièces ramassées : <b>${this.got}</b>`] });
  }
  destroy() { this.G.touchLabels(null); }
}

/* ============================================================ */
/* 2. TOUR SANS FIN                                              */
/* ============================================================ */
export class Tower {
  constructor(G) { this.G = G; }
  help() { return `<p>Saute de marche en marche autour de la colonne. Chaque <b>palier</b> franchi compte comme un étage. La lave monte de plus en plus vite : ne traîne pas ! Les dalles jaunes rebondissent, les rouges brûlent.</p>`; }
  start() {
    const G = this.G, W = G.world; this.r = rng((Math.random() * 1e9) | 0);
    G.setSky('#1b1036', '#5a2a6e', '#ff9a5a', 0x3a2050, 50, 200);
    G.hemi.intensity = 1.0;
    this.wp = []; this.floors = []; this.genY = 0; this.ang = 0; this.floor = 0; this.lava = -8; this.T = 0; this.movers = [];
    top(W, 0, 0, 0, 22, 22, '#5b6270');
    W.add(0, 150, 0, 3.4, 300, 3.4, '#3a3550');
    this.wp.push({ p: new V3(0, 0, 6) });
    for (let i = 0; i < 4; i++) this.genFloor();
    W.build();
    const lm = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.88 });
    this.lavaM = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), lm); W.group.add(this.lavaM);
    this.lavaL = new THREE.PointLight(0xff6a2a, 2, 40, 1.4); W.group.add(this.lavaL);
    const P = G.player; P.pos.set(0, 0.1, 7); P.yaw = Math.PI / 2; G.ocam.yaw = -Math.PI / 2; G.ocam.pitch = 0.4;
    this.climbers = [P, ...G.makeBots(5)];
    this.climbers.forEach((c, i) => { if (c !== P) c.pos.set(Math.sin(i * 1.1) * 8, 0.1, Math.cos(i * 1.1) * 8); c.data = { wi: 0, fl: 0, dead: false }; c.sync(); });
    this.state = 'count'; G.touchLabels({ attack: null, alt: null, crouch: null });
    G.countdown(3).then(() => { if (this.state === 'count') this.state = 'run'; });
  }
  genFloor() {
    const W = this.G.world, r = this.r, n = this.floors.length, R = 6.2;
    const hue = ['#ff5d8f', '#ff8a3d', '#ffd23d', '#7ddc4a', '#2ec4b6', '#3d8bff', '#7a5cff', '#d65cff'][n % 8];
    const hard = Math.min(1, n / 10);
    for (let k = 0; k < 11; k++) {
      let skip = r() < 0.12 + hard * 0.18 ? 2 : 1; this.ang += 0.5 * skip; this.genY += 1.0;
      const x = Math.sin(this.ang) * R, z = Math.cos(this.ang) * R, kind = r();
      if (kind < 0.08 + hard * 0.1) { const bb = W.addLive(x, this.genY - 0.5, z, 2.4, 1, 2.4, '#ffe14a', { bounce: 19 }); this.wp.push({ p: new V3(x, this.genY, z), b: bb }); this.ang += 0.5; this.genY += 3.4; const x2 = Math.sin(this.ang) * R, z2 = Math.cos(this.ang) * R; W.addLive(x2, this.genY - 0.5, z2, 2.6, 1, 2.6, hue); this.wp.push({ p: new V3(x2, this.genY, z2) }); continue; }
      const sz = 2.4 - hard * 0.5;
      const b = W.addLive(x, this.genY - 0.5, z, sz, 1, sz, hue);
      if (kind > 0.85 - hard * 0.15) { W.addLive(x + (r() - 0.5) * 0.6, this.genY + 0.2, z, sz * 0.45, 0.4, sz * 0.45, '#ff2a3c', { kill: true }); }
      if (kind > 0.7 && kind < 0.78 && n > 1) this.movers.push({ b, x, z, y: this.genY - 0.5, ph: r() * 6, amp: 1.4 });
      this.wp.push({ p: new V3(x, this.genY, z), b });
    }
    this.ang += 0.5; this.genY += 1; const x = Math.sin(this.ang) * (R + 0.6), z = Math.cos(this.ang) * (R + 0.6);
    const lb = W.addLive(x, this.genY - 0.5, z, 4.2, 1, 4.2, '#ffffff'); lb.floor = n + 1; this.wp.push({ p: new V3(x, this.genY, z), b: lb });
    const s = textSprite(`ÉTAGE ${n + 1}`, 0.7, { size: 64, w: 480, h: 110, bg: hue, stroke: null }); s.position.set(x, this.genY + 2.2, z); W.group.add(s);
    this.floors.push(this.genY);
  }
  update(dt) {
    const G = this.G, W = G.world, P = G.player; this.T += dt; const run = this.state === 'run';
    for (const m of this.movers) { m.ph += dt * 1.3; const k = 1 + Math.sin(m.ph) * m.amp / 6.2; W.moveDyn(m.b, m.x * k, m.y, m.z * k); }
    if (run) { const sp = 0.32 + this.T * 0.0105; if (this.T > 4) this.lava += sp * dt; }
    this.lavaM.position.set(0, this.lava - 20, 0); this.lavaL.position.set(P.pos.x * 0.5, this.lava + 2, P.pos.z * 0.5); this.lavaM.material.color.setRGB(1, 0.33 + Math.sin(this.T * 2) * 0.06, 0.08);
    const hi = Math.max(...this.climbers.filter(c => !c.data.dead).map(c => c.pos.y), 0);
    if (hi > this.genY - 26) this.genFloor();
    if (!P.data.dead) G.ctlPlayer(dt, { noMove: !run, noJump: !run });
    for (const c of this.climbers) {
      if (c.data.dead) continue;
      if (c !== P) this.botThink(c, dt, run);
      if (c.ground && c.ground.floor && c.ground.floor > c.data.fl) { c.data.fl = c.ground.floor; if (c === P) { G.sfx('check'); G.big(`Étage ${c.data.fl}`, '+4 ◆', 1); } }
      if (c.ground && c.ground.delta) { for (let i = c.data.wi; i < Math.min(this.wp.length, c.data.wi + 6); i++) if (this.wp[i].b === c.ground) c.data.wi = i; }
      if (c.touchKill) { c.vel.y = 12; c.knock = new V3((Math.random() - 0.5) * 6, 10, (Math.random() - 0.5) * 6); if (c === P) G.sfx('hurt'); }
      if (c.pos.y < this.lava) { c.data.dead = true; c.data.deadT = this.T; G.bits.burst(c.pos.clone().setY(this.lava + 0.5), 24, ['#ff5a1a', '#ffd23d', '#222'], 6); c.av.group.visible = false; if (c === P) { G.sfx('die'); Input.rumble(0.8, 0.5, 300); this.end(); } else if (!P.data.dead) G.toast(`${c.name} est tombé dans la lave`, `Étage ${c.data.fl}`, '#ff8a3d'); }
    }
    if (run && !P.data.dead && this.climbers.every(c => c === P || c.data.dead) && !this.lastAlone) { this.lastAlone = true; G.big('Dernier survivant !', 'Continue à grimper', 1.8); }
    G.board([...this.climbers].sort((a, b) => b.data.fl - a.data.fl || b.pos.y - a.pos.y).map(c => ({ n: c === P ? 'Toi' : c.name, v: `Ét. ${c.data.fl}`, me: c === P, out: c.data.dead })));
    G.info(`🗼 Étage ${P.data.fl} · 🌋 lave à ${Math.max(0, (P.pos.y - this.lava)).toFixed(0)} m`);
    if (P.data.dead) { G.ocam.update(dt, null, { x: dt * 0.3, y: 0 }, new V3(0, this.lava + 6, 0), { dist: 18 }); } else G.updateCam(dt);
  }
  botThink(b, dt, run) {
    const G = this.G, W = G.world; if (!run) { G.moveBot(b, dt, new V3(), false); return; }
    const w = this.wp[Math.min(b.data.wi + 1, this.wp.length - 1)], tp = w.b ? new V3((w.b.min.x + w.b.max.x) / 2, w.b.max.y, (w.b.min.z + w.b.max.z) / 2) : w.p;
    if (Math.hypot(b.pos.x - tp.x, b.pos.z - tp.z) < 0.9 && b.pos.y > tp.y - 0.35) b.data.wi++;
    // retomber : reprendre au waypoint le plus proche sous soi
    if (b.onGround && b.pos.y < tp.y - 3) { let best = b.data.wi, bd = 1e9; for (let i = Math.max(0, b.data.wi - 20); i <= b.data.wi; i++) { const p = this.wp[i].p, d = Math.abs(p.y - b.pos.y) + Math.hypot(p.x - b.pos.x, p.z - b.pos.z) * 0.3; if (d < bd) { bd = d; best = i; } } b.data.wi = Math.max(0, best - 1); }
    const mv = steer(b, tp.x, tp.z, 0.25); let jump = false;
    if (b.onGround) { const d = Math.hypot(b.pos.x - tp.x, b.pos.z - tp.z); if (tp.y > b.pos.y + 0.4 && d < 2.9) jump = true; else jump = needJump(b, W, mv, 0.6); }
    const slow = Math.random() < 0.006 * (1.3 - b.skill) ? 0 : 1;
    G.moveBot(b, dt, mv.multiplyScalar(slow), jump, { speed: RUN * (0.7 + b.skill * 0.22) });
  }
  end() {
    if (this.state === 'end') return; this.state = 'end'; const G = this.G, P = G.player;
    const out = this.climbers.filter(c => c !== P && c.data.dead && c.data.deadT < this.T).length, place = this.climbers.filter(c => c.data.fl > P.data.fl).length + 1;
    G.finish({ win: out === this.climbers.length - 1, place, coins: P.data.fl * 4 + out * 4, best: P.data.fl, bestTxt: `étage ${P.data.fl}`, title: `Étage ${P.data.fl}`, lines: [`Tu as atteint l’<b>étage ${P.data.fl}</b>`, `Bots tombés avant toi : <b>${out}</b>`, `Temps dans la tour : <b>${this.T.toFixed(0)} s</b>`], delay: 1800 });
  }
  destroy() { this.G.player.av.group.visible = true; this.G.touchLabels(null); }
}

/* ============================================================ */
/* 3. USINE À JETONS (tycoon persistant)                         */
/* ============================================================ */
const TY = [
  { id: 'd1', n: 'Distributeur 1', p: 0 }, { id: 'd2', n: 'Distributeur 2', p: 60 }, { id: 'wall', n: 'Clôture', p: 120 }, { id: 'd3', n: 'Distributeur 3', p: 220 },
  { id: 'up1', n: 'Améliorateur ×2', p: 380 }, { id: 'speed', n: 'Tapis rapide', p: 550 }, { id: 'd4', n: 'Distributeur 4', p: 800 }, { id: 'deco', n: 'Jardin & fontaine', p: 1000 },
  { id: 'up2', n: 'Laser ×3', p: 1600 }, { id: 'super', n: 'Super distributeur', p: 2500 }, { id: 'deck', n: 'Belvédère', p: 3400 }, { id: 'gold', n: 'Collecteur doré ×2', p: 5000 }, { id: 'statue', n: 'Statue géante', p: 7500 },
];
export class Tycoon {
  constructor(G) { this.G = G; }
  help() { return `<p>Les distributeurs déposent des cubes sur le tapis. Au bout, le collecteur les transforme en <b>argent</b>, qui s’accumule dans le <b>coffre</b> : marche dessus pour l’encaisser. Marche ensuite sur les <b>boutons verts</b> pour acheter la suite. Quand tout est acheté, la <b>renaissance</b> recommence l’usine avec un multiplicateur permanent.</p><p>Chaque achat rapporte des ◆ CUBIKA. L’usine continue un peu de produire quand tu n’es pas là.</p>`; }
  start() {
    const G = this.G, W = G.world;
    G.setSky('#5cb6ff', '#c4e8ff', '#fff6dc', 0xd8f0ff, 80, 260);
    const S = this.S = G.S.tycoon = G.S.tycoon || { cash: 0, bought: ['d1'], reb: 0, pend: 0, at: Date.now(), total: 0, rivals: [0, 0, 0] };
    this.cubes = []; this.items = {}; this.btns = [];
    // terrain
    top(W, 0, 0, 0, 120, 120, '#7ddc4a');
    top(W, 0, 0.05, 0, 30, 30, '#cfd6e0', {}, 0.3);
    // tapis
    this.belt = W.add(-1, 0.6, 0, 20, 1.2, 2.2, '#3a3f4a'); this.belt.conv = [3, 0];
    this.beltTop = new THREE.Mesh(new THREE.PlaneGeometry(20, 2), new THREE.MeshBasicMaterial({ map: this.stripeTex(), color: 0xffffff })); this.beltTop.rotation.x = -Math.PI / 2; this.beltTop.position.set(-1, 1.21, 0); W.group.add(this.beltTop);
    W.add(9.5, 1.3, 0, 2.2, 2.6, 3, '#5b6270'); // collecteur
    // coffre
    this.chest = W.add(10, 0.35, 6, 3, 0.4, 3, '#ffd23d'); this.chestS = textSprite('COFFRE', 0.55, { size: 60, w: 600, h: 110, bg: 'rgba(30,24,0,.8)', stroke: null, color: '#ffe066' }); this.chestS.position.set(10, 2.2, 6); W.group.add(this.chestS);
    // sortie
    const ex = top(W, -12, 0.3, 12, 3, 3, '#3d8bff'); ex.exit = true; const es = textSprite('↩ Place', 0.5, { size: 60, w: 400, h: 110, bg: 'rgba(61,139,255,.9)', stroke: null }); es.position.set(-12, 1.8, 12); W.group.add(es);
    // terrains des rivaux
    this.rivalBots = G.makeBots(3);
    this.rivalPlots = [[-34, 0], [34, 0], [0, -34]].map((p, i) => { top(W, p[0], 0.05, p[1], 28, 28, '#d6c9b8', {}, 0.3); const b = this.rivalBots[i]; b.pos.set(p[0], 0.4, p[1] + 4); b.data = { home: p, t: 0 }; return { p, built: 0, meshes: [], i }; });
    W.build();
    for (const id of S.bought) this.buildItem(id, true);
    this.layoutButtons();
    // gains hors ligne
    const away = Math.min(7200, (Date.now() - (S.at || Date.now())) / 1000);
    if (away > 60) { const off = Math.floor(this.rate() * away * 0.15); if (off > 0) { S.pend += off; setTimeout(() => G.toast('Pendant ton absence', `+${fmt(off)} $ dans le coffre`, '#7dffb0'), 900); } }
    const P = G.player; P.pos.set(0, 0.5, 9); P.yaw = Math.PI; G.ocam.yaw = 0; G.ocam.pitch = 0.5;
    this.dropT = {}; this.beltSpeed = S.bought.includes('speed') ? 4.5 : 3; this.belt.conv = [this.beltSpeed, 0];
    const cm = new THREE.MeshLambertMaterial({ color: 0xffffff }); this.cubeIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), cm, 160); this.cubeIM.count = 0; this.cubeIM.frustumCulled = false; W.group.add(this.cubeIM);
    G.touchLabels({ attack: null, alt: null, crouch: null }); G.info(''); this.rivalT = 0;
  }
  stripeTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#2a2e38'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#3a404d'; for (let i = 0; i < 4; i++) x.fillRect(i * 16, 0, 8, 16); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 1); return t; }
  mult() { return (1 + this.S.reb * 0.5) * (this.S.bought.includes('gold') ? 2 : 1); }
  rate() { let v = 0; const b = this.S.bought, up = (b.includes('up1') ? 2 : 1) * (b.includes('up2') ? 3 : 1); [['d1', 2], ['d2', 3], ['d3', 5], ['d4', 8]].forEach(([id, val]) => { if (b.includes(id)) v += val / 1.8; }); if (b.includes('super')) v += 30 / 2.5; return v * up * this.mult(); }
  buildItem(id, quiet) {
    const G = this.G, W = G.world, L = (x, y, z, w, h, d, c, o) => W.addLive(x, y, z, w, h, d, c, o);
    const dx = { d1: -9, d2: -6, d3: -3, d4: 0, super: -7.5 }[id];
    if (dx != null) { const big = id === 'super', c = big ? '#d65cff' : '#ff8a3d'; L(dx, 1.6, -2.2, 0.4, 3.2, 0.4, '#5b6270'); L(dx, 3.4, -1.2, big ? 1.8 : 1.4, 0.9, 2.4, c); L(dx, 2.9, -0.2, 0.7, 0.5, 0.7, '#2a2e38'); this.items[id] = { x: dx, iv: big ? 2.5 : 1.8, v: { d1: 2, d2: 3, d3: 5, d4: 8, super: 30 }[id] }; if (big) { L(dx, 5.2, -1.2, 0.3, 2, 0.3, '#ffd23d'); } }
    if (id === 'wall') { for (const s of [-1, 1]) { L(s * 15, 1, 0, 0.5, 2, 30, '#ffffff'); L(0, 1, s * 15, 30, 2, 0.5, '#ffffff'); } }
    if (id === 'up1') { L(3, 2.2, -1.3, 0.5, 2.8, 0.5, '#3d8bff'); L(3, 2.2, 1.3, 0.5, 2.8, 0.5, '#3d8bff'); L(3, 3.7, 0, 0.6, 0.4, 3.1, '#3d8bff', { passable: true }); }
    if (id === 'up2') { L(6, 2.2, -1.3, 0.5, 2.8, 0.5, '#ff4d6d'); L(6, 2.2, 1.3, 0.5, 2.8, 0.5, '#ff4d6d'); const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0xff2a3c, transparent: true, opacity: 0.6 })); m.position.set(6, 2.1, 0); W.group.add(m); this.laser = m; }
    if (id === 'speed') { this.beltSpeed = 4.5; if (this.belt) this.belt.conv = [4.5, 0]; this.beltTop && this.beltTop.material.color.set('#9fe8ff'); }
    if (id === 'deco') { L(-9, 0.5, 9, 4, 1, 4, '#9fb4c8'); L(-9, 1.2, 9, 3, 0.2, 3, '#4fc3ff', { passable: true }); for (const [x, z] of [[12, -12], [-12, -12], [12, 12]]) { L(x, 1.5, z, 0.7, 3, 0.7, '#8a5a3c'); L(x, 3.6, z, 2.6, 2, 2.6, '#3aa34a'); } }
    if (id === 'deck') { for (let i = 0; i < 6; i++) L(-12 + i * 1.2, 0.5 + i * 0.7, -10, 1.2, 0.4, 2, '#8a5a3c'); L(-2, 4.4, -10, 8, 0.4, 5, '#c58a5a'); L(-2, 5.2, -12.4, 8, 1.2, 0.2, '#ffffff'); }
    if (id === 'gold') { const m = W.dyn.length; L(9.5, 3, 0, 2.4, 0.6, 3.2, '#ffd23d'); }
    if (id === 'statue') { const av = buildAvatar(G.S.look); av.group.scale.setScalar(3); av.group.position.set(-2, 4.6, -10); av.group.rotation.y = 0.3; W.group.add(av.group); this.statue = av; if (!G.S.tycoon.bought.includes('deck')) av.group.position.set(-11, 0.2, -10); }
    if (!quiet) { G.bits.burst(new V3(dx ?? 0, 3, dx != null ? -1 : 0), 30, ['#ffd23d', '#7dffb0', '#fff'], 6); }
  }
  layoutButtons() {
    const G = this.G, W = G.world; for (const b of this.btns) { W.remove(b.b); W.group.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); } this.btns = [];
    const S = this.S, next = TY.filter(t => !S.bought.includes(t.id)).slice(0, 3);
    const all = TY.every(t => S.bought.includes(t.id));
    const list = all ? [{ id: 'reb', n: `Renaissance (×${(1 + (S.reb + 1) * 0.5).toFixed(1)})`, p: 10000 + S.reb * 5000 }] : next;
    list.forEach((t, i) => { const x = -6 + i * 5, z = 9; const b = W.addLive(x, 0.3, z, 2, 0.3, 2, t.id === 'reb' ? '#d65cff' : '#3ddc84'); b.btn = t; const s = textSprite(`${t.n}\n${fmt(t.p)} $`, 0.95, { size: 50, w: 520, h: 140, bg: 'rgba(10,14,20,.78)', stroke: null }); s.position.set(x, 2.1, z); W.group.add(s); this.btns.push({ b, s, t }); });
  }
  buy(t) {
    const G = this.G, S = this.S;
    if (S.cash < t.p) { if (this._nag !== t.id) { G.toast('Pas assez d’argent', `${t.n} : ${fmt(t.p)} $`, '#ff8a3d'); G.sfx('nope'); } this._nag = t.id; return; }
    S.cash -= t.p; G.sfx('buy');
    if (t.id === 'reb') { S.reb++; S.bought = ['d1']; S.cash = 0; G.addCoins(300); G.addXP(120); G.big('RENAISSANCE !', `Multiplicateur ×${(1 + S.reb * 0.5).toFixed(1)} · +300 ◆`, 2.4); this.persist(); G.save(); setTimeout(() => { if (this.G.mg === this) { this.G.endMini(); this.G.startMini('tycoon'); } }, 1800); return; }
    S.bought.push(t.id); this.buildItem(t.id); this.layoutButtons(); this.btnLock = true;
    const c = Math.max(3, Math.ceil(t.p / 45)); G.addCoins(c); G.addXP(8 + Math.ceil(t.p / 80)); G.toast(`Acheté : ${t.n}`, `+${c} ◆`, '#7dffb0');
    if (TY.every(x => S.bought.includes(x.id))) { G.big('Usine complète !', 'La renaissance est disponible', 2.4); const st = G.S.stats.tycoon = G.S.stats.tycoon || { plays: 0, wins: 0 }; st.wins = (st.wins || 0) + 1; }
    this.persist();
  }
  update(dt) {
    const G = this.G, P = G.player, S = this.S;
    G.ctlPlayer(dt);
    // distributeurs
    for (const [id, it] of Object.entries(this.items)) { this.dropT[id] = (this.dropT[id] || Math.random() * it.iv) - dt; if (this.dropT[id] <= 0) { this.dropT[id] = it.iv; if (this.cubes.length < 150) this.cubes.push({ x: it.x, y: 2.6, z: (Math.random() - 0.5) * 0.4, vy: 0, v: it.v, f: 0 }); } }
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0, earned = 0;
    for (let i = this.cubes.length - 1; i >= 0; i--) {
      const c = this.cubes[i];
      if (c.y > 1.5) { c.vy -= 20 * dt; c.y = Math.max(1.5, c.y + c.vy * dt); } else c.x += this.beltSpeed * dt;
      if (!(c.f & 1) && c.x > 3 && S.bought.includes('up1')) { c.v *= 2; c.f |= 1; }
      if (!(c.f & 2) && c.x > 6 && S.bought.includes('up2')) { c.v *= 3; c.f |= 2; }
      if (c.x > 8.6) { earned += c.v * this.mult(); this.cubes.splice(i, 1); continue; }
      m4.makeTranslation(c.x, c.y, c.z); this.cubeIM.setMatrixAt(n, m4); this.cubeIM.setColorAt(n, col.set(c.f & 2 ? '#ff4d6d' : c.f & 1 ? '#3d8bff' : c.v >= 30 ? '#d65cff' : '#ffd23d')); n++;
    }
    this.cubeIM.count = n; this.cubeIM.instanceMatrix.needsUpdate = true; if (this.cubeIM.instanceColor) this.cubeIM.instanceColor.needsUpdate = true;
    if (earned) { S.pend += earned; S.total += earned; }
    if (this.laser) this.laser.material.opacity = 0.4 + Math.sin(G.time * 12) * 0.2;
    // coffre / boutons / sortie
    const g = P.ground;
    if (g === this.chest && S.pend >= 1) { const v = Math.floor(S.pend); S.cash += v; S.pend -= v; G.sfx('coin'); G.bits.burst(P.pos.clone().setY(1.5), 12, '#7dffb0', 4); }
    if (g && g.btn) { if (!this.btnLock) this.buy(g.btn); } else { this._nag = null; this.btnLock = false; }
    if (g && g.exit && !this.leaving) { this.leaving = true; this.persist(); G.backToPlaza(); }
    if (this._cs !== Math.floor(S.pend)) { this._cs = Math.floor(S.pend); this.chestS.material.map.dispose(); const t = textSprite(`COFFRE\n${fmt(S.pend)} $`, 0.8, { size: 54, w: 600, h: 150, bg: 'rgba(30,24,0,.8)', stroke: null, color: '#ffe066' }); this.chestS.material.map = t.material.map; this.chestS.scale.copy(t.scale); t.material.dispose(); }
    // rivaux (simulés)
    this.rivalT += dt; S.rivals = S.rivals || [0, 0, 0];
    for (const rp of this.rivalPlots) { S.rivals[rp.i] += dt * (1.5 + rp.i) * (1 + S.reb * 0.3); const lvl = Math.min(10, Math.floor(Math.sqrt(S.rivals[rp.i] / 25))); while (rp.built < lvl) { this.rivalBuild(rp); rp.built++; } }
    for (const b of this.rivalBots) { b.data.t -= dt; if (b.data.t <= 0) { b.data.goal = new V3(b.data.home[0] + (Math.random() - 0.5) * 20, 0, b.data.home[1] + (Math.random() - 0.5) * 20); b.data.t = 3 + Math.random() * 4; } G.moveBot(b, dt, steer(b, b.data.goal.x, b.data.goal.z, 1).multiplyScalar(0.6), b.hitWall ? (b.hitWall = null, true) : false); }
    const rows = [{ n: 'Toi', v: fmt(S.total) + ' $', me: true, t: S.total }, ...this.rivalBots.map((b, i) => ({ n: b.name, v: fmt(S.rivals[i] * 12) + ' $', t: S.rivals[i] * 12 }))].sort((a, b) => b.t - a.t);
    G.board(rows);
    const nb = TY.filter(t => S.bought.includes(t.id)).length;
    G.info(`💵 ${fmt(S.cash)} $ · +${this.rate().toFixed(1)} $/s · ${nb}/${TY.length}${S.reb ? ` · ×${(1 + S.reb * 0.5).toFixed(1)}` : ''}`);
    G.updateCam(dt);
  }
  rivalBuild(rp) { const W = this.G.world, [px, pz] = rp.p, k = rp.built, c = ['#ff8a3d', '#3d8bff', '#ff4d6d', '#7ddc4a', '#d65cff'][k % 5]; const x = px - 10 + (k % 4) * 6.5, z = pz - 8 + Math.floor(k / 4) * 7, h = 2 + (k % 3) * 1.5; W.addLive(x, h / 2 + 0.3, z, 3.2, h, 3.2, c); W.addLive(x, h + 0.55, z, 3.6, 0.5, 3.6, '#ffffff'); }
  persist() { if (!this.S) return; this.S.at = Date.now(); this.G.S.tycoon = this.S; }
  destroy() { this.persist(); if (this.statue) disposeAvatar(this.statue); this.G.touchLabels(null); }
}

/* ============================================================ */
/* 4. FERME À FAMILIERS (simulateur persistant)                  */
/* ============================================================ */
const RAR = [['Commun', '#c8d0dc', 1], ['Rare', '#3d8bff', 2.6], ['Épique', '#d65cff', 6.5], ['Légendaire', '#ffd23d', 16]];
const PET_T = { chaton: ['Chaton', '#ffb36b'], chiot: ['Chiot', '#c58a5a'], lapin: ['Lapin', '#f4f4f4'], poussin: ['Poussin', '#ffe14a'], renard: ['Renardeau', '#ff7a2e'], pingouin: ['Pingouin', '#2a3040'], dragon: ['Dragonnet', '#5fd65a'], slime: ['Gelée', '#7af0ff'], hibou: ['Hibou', '#8a6a4a'], etoile: ['Astrelin', '#ffe066'] };
const EGGS = [
  { n: 'Œuf de prairie', p: 100, z: 0, mult: 1, pool: ['chaton', 'chiot', 'lapin', 'poussin'], w: [62, 28, 9, 1], col: '#f4f0e0' },
  { n: 'Œuf des dunes', p: 900, z: 1, mult: 3.5, pool: ['renard', 'pingouin', 'hibou', 'lapin'], w: [55, 31, 12, 2], col: '#ffc98a' },
  { n: 'Œuf cosmique', p: 5000, z: 2, mult: 12, pool: ['dragon', 'slime', 'etoile', 'renard'], w: [45, 35, 16, 4], col: '#9a7aff' },
];
const ZONES = [{ n: 'Prairie', x: 0, col: '#7ddc4a', cr: '#7af0ff', hp: 24, val: 6, cost: 0 }, { n: 'Dunes sucrées', x: 44, col: '#ffd9a0', cr: '#ff7ac8', hp: 110, val: 30, cost: 600 }, { n: 'Volcan de cristal', x: 88, col: '#5a4a5e', cr: '#ffd23d', hp: 480, val: 140, cost: 3500 }];
function petModel(t, rar) {
  const g = new THREE.Group(), c = PET_T[t][1], B = (w, h, d, col, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat(col, { smooth: true })); m.position.set(x, y, z); g.add(m); return m; };
  if (t === 'slime') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 0.75 })); m.position.y = 0.35; g.add(m); }
  else { B(0.7, 0.55, 0.8, c, 0, 0.4, 0); B(0.6, 0.55, 0.55, c, 0, 0.85, 0.32); }
  const eye = (x) => B(0.09, 0.12, 0.02, '#1a1a22', x, t === 'slime' ? 0.45 : 0.9, t === 'slime' ? 0.41 : 0.6); eye(-0.13); eye(0.13);
  if (t === 'chaton' || t === 'renard') { B(0.14, 0.2, 0.08, c, -0.2, 1.2, 0.3); B(0.14, 0.2, 0.08, c, 0.2, 1.2, 0.3); B(0.16, 0.16, 0.5, t === 'renard' ? '#fff' : c, 0, 0.55, -0.6); }
  if (t === 'chiot') { B(0.12, 0.3, 0.2, '#7a4c2c', -0.34, 0.85, 0.3); B(0.12, 0.3, 0.2, '#7a4c2c', 0.34, 0.85, 0.3); B(0.16, 0.12, 0.08, '#1a1a22', 0, 0.8, 0.62); }
  if (t === 'lapin') { B(0.12, 0.45, 0.08, c, -0.14, 1.35, 0.3); B(0.12, 0.45, 0.08, c, 0.14, 1.35, 0.3); B(0.2, 0.2, 0.2, '#fff', 0, 0.5, -0.45); }
  if (t === 'poussin' || t === 'hibou' || t === 'pingouin') { B(0.18, 0.1, 0.16, '#ff9a2e', 0, 0.8, 0.66); if (t === 'pingouin') B(0.5, 0.5, 0.05, '#ffffff', 0, 0.45, 0.41); if (t === 'hibou') { B(0.12, 0.14, 0.08, c, -0.22, 1.16, 0.32); B(0.12, 0.14, 0.08, c, 0.22, 1.16, 0.32); } }
  if (t === 'dragon') { const w1 = B(0.6, 0.06, 0.4, '#3aa34a', -0.5, 0.7, 0); w1.rotation.z = 0.4; const w2 = B(0.6, 0.06, 0.4, '#3aa34a', 0.5, 0.7, 0); w2.rotation.z = -0.4; B(0.1, 0.2, 0.1, '#ffd23d', -0.15, 1.2, 0.3); B(0.1, 0.2, 0.1, '#ffd23d', 0.15, 1.2, 0.3); }
  if (t === 'etoile') { B(0.9, 0.12, 0.12, '#fff6b0', 0, 1.3, 0); B(0.12, 0.9, 0.12, '#fff6b0', 0, 1.3, 0); }
  if (rar >= 1) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 18), boxMat(RAR[rar][1], { basic: true })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring); }
  g.scale.setScalar(0.85); return g;
}
export class Pets {
  constructor(G) { this.G = G; }
  help() { return `<p>Frappe un <b>cristal</b> (${'▢ / clic'}) : tes familiers foncent dessus pour t’aider. Les cristaux donnent des <b>gemmes</b>. À la <b>couveuse</b>, achète des œufs : chaque familier a une rareté (Commun, Rare, Épique, Légendaire) et une puissance. Tes 3 meilleurs t’accompagnent. Ouvre les <b>portes</b> pour atteindre des zones plus riches.</p><p>Toutes les 40 gemmes gagnées, tu reçois 1 ◆ CUBIKA.</p>`; }
  start() {
    const G = this.G, W = G.world;
    G.setSky('#62c0ff', '#c8ecff', '#fff4e0', 0xd8f0ff, 70, 240);
    const S = this.S = G.S.pets = G.S.pets || { gems: 0, acc: 0, pets: [{ t: 'chaton', r: 0, p: 2 }], zone: 0, hatched: 0 };
    this.crystals = []; this.petObjs = [];
    ZONES.forEach((z, i) => { top(W, z.x + 20, 0, 0, 44, 46, z.col); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; W.add(z.x + 20 + Math.cos(a) * 20, 0.5, Math.sin(a) * 21, 1.4, 1, 1.4, i === 2 ? '#3a2e40' : '#ffffff', { solid: false }); } });
    for (const s of [-1, 1]) W.add(66, 3, s * 23.5, 132, 6, 1, '#ffffff', { visual: false });
    W.add(-2.5, 3, 0, 1, 6, 46, '#fff', { visual: false }); W.add(132.5, 3, 0, 1, 6, 46, '#fff', { visual: false });
    // couveuse + sortie
    top(W, 6, 0.3, 14, 5, 5, '#ffffff', {}, 0.3); W.add(6, 1.5, 16, 4, 2.4, 1, '#ff7ac8'); this.hatchPos = new V3(6, 0, 13);
    const hs = textSprite('🥚 Couveuse', 0.7, { size: 60, w: 600, h: 110, bg: 'rgba(255,122,200,.92)', stroke: null }); hs.position.set(6, 3.6, 15); W.group.add(hs);
    const ex = top(W, 3, 0.3, -16, 3, 3, '#3d8bff'); ex.exit = true; const es = textSprite('↩ Place', 0.5, { size: 60, w: 400, h: 110, bg: 'rgba(61,139,255,.9)', stroke: null }); es.position.set(3, 1.8, -16); W.group.add(es);
    W.build();
    // portes de zones
    this.gates = [1, 2].map(i => { const z = ZONES[i], open = S.zone >= i; const parts = open ? [] : [W.addLive(z.x - 2.2, 3, -12, 1, 6, 22, '#ff4d6d'), W.addLive(z.x - 2.2, 3, 12, 1, 6, 22, '#ff4d6d'), W.addLive(z.x - 2.2, 3, 0, 1, 6, 2.6, '#ff4d6d', { opacity: 0.5 })]; let s = null; if (!open) { s = textSprite(`🔒 ${z.n}\n${fmt(z.cost)} gemmes`, 1.1, { size: 54, w: 600, h: 150, bg: 'rgba(10,12,22,.85)', stroke: null }); s.position.set(z.x - 3, 4.2, 0); W.group.add(s); } return { i, open, parts, s, pos: new V3(z.x - 3.2, 0, 0) }; });
    for (let z = 0; z < 3; z++) for (let k = 0; k < 12; k++) this.spawnCrystal(z);
    this.pickups = [];
    const P = G.player; P.pos.set(4, 0.2, 4); P.yaw = 0; G.ocam.yaw = Math.PI; G.ocam.pitch = 0.45;
    this.bots = G.makeBots(3); this.bots.forEach((b, i) => { b.pos.set(10 + i * 3, 0.2, -6); b.data = { pets: [this.makePetObj({ t: Object.keys(PET_T)[(Math.random() * 6) | 0], r: (Math.random() * 2) | 0, p: 2 + Math.random() * 3 }, b)], tgt: null }; });
    this.refreshPets(); G.touchLabels({ attack: 'FRAPPER', alt: null, crouch: null });
  }
  makePetObj(p, owner) { const m = petModel(p.t, p.r); this.G.world.group.add(m); const o = { p, m, owner, pos: owner.pos.clone().add(new V3(Math.random() - 0.5, 0, -1)), ph: Math.random() * 6 }; m.position.copy(o.pos); return o; }
  refreshPets() { for (const o of this.petObjs) this.G.world.group.remove(o.m); this.petObjs = []; const best = [...this.S.pets].sort((a, b) => b.p - a.p).slice(0, 3); for (const p of best) this.petObjs.push(this.makePetObj(p, this.G.player)); }
  spawnCrystal(zi) {
    const W = this.G.world, z = ZONES[zi], x = z.x + 4 + Math.random() * 34, y = 0, zz = (Math.random() - 0.5) * 38;
    if (zi === 0 && Math.hypot(x - 6, zz - 14) < 5) return this.spawnCrystal(zi);
    const big = Math.random() < 0.18, s = big ? 1.6 : 1;
    const g = new THREE.Group(); const m1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.8 * s, 0), boxMat(z.cr, { smooth: true, emissive: new THREE.Color(z.cr).multiplyScalar(0.25).getHex() })); m1.position.y = 0.9 * s; m1.scale.y = 1.5; g.add(m1);
    const m2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 * s, 0), m1.material); m2.position.set(0.6 * s, 0.5 * s, 0.2); m2.scale.y = 1.4; g.add(m2);
    g.position.set(x, y, zz); W.group.add(g);
    const col = W.addLive(x, 0.9 * s, zz, 1.2 * s, 1.8 * s, 1.2 * s, z.cr, { visual: false }); col.mesh.visible = false;
    const c = { g, col, zi, hp: z.hp * (big ? 3 : 1), max: z.hp * (big ? 3 : 1), val: z.val * (big ? 3.5 : 1), pos: new V3(x, 0, zz), bar: null };
    this.crystals.push(c); return c;
  }
  damage(c, n, byPlayer) {
    const G = this.G; if (c.hp <= 0) return; c.hp -= n; c.g.scale.setScalar(0.92 + 0.08 * Math.random());
    if (!c.bar) { c.bar = textSprite('', 0.32, { w: 256, h: 64 }); c.bar.position.set(c.pos.x, 3.2, c.pos.z); G.world.group.add(c.bar); }
    this.drawBar(c);
    if (c.hp <= 0) {
      G.bits.burst(c.pos.clone().setY(1), 22, ZONES[c.zi].cr, 6); G.sfx('break');
      G.world.group.remove(c.g); G.world.remove(c.col); if (c.bar) G.world.group.remove(c.bar);
      this.crystals.splice(this.crystals.indexOf(c), 1);
      const gems = Math.round(c.val); if (byPlayer) { for (let i = 0; i < Math.min(6, 2 + gems / 20); i++) this.pickups.push({ p: c.pos.clone().add(new V3((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2)), v: gems / Math.min(6, 2 + gems / 20), t: 0, m: null }); }
      setTimeout(() => { if (this.G.mg === this) this.spawnCrystal(c.zi); }, 6000);
      if (this.target === c) this.target = null;
    }
  }
  drawBar(c) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(8, 20, 240, 24); x.fillStyle = '#7dffb0'; x.fillRect(12, 24, 232 * Math.max(0, c.hp / c.max), 16); if (c.bar.material.map) c.bar.material.map.dispose(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; c.bar.material.map = t; c.bar.material.needsUpdate = true; }
  update(dt) {
    const G = this.G, P = G.player, S = this.S;
    G.ctlPlayer(dt);
    // frapper
    if (G.inp.act) { P.swing = 0.3; let best = null, bd = 3.4; for (const c of this.crystals) { const d = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z); if (d < bd) { bd = d; best = c; } } if (best) { this.target = best; this.damage(best, 4 + G.S.level * 0.5, true); G.sfx('hit'); } }
    if (this.target && Math.hypot(this.target.pos.x - P.pos.x, this.target.pos.z - P.pos.z) > 18) this.target = null;
    // familiers
    const all = [...this.petObjs, ...this.bots.flatMap(b => b.data.pets)];
    for (const o of all) {
      const tgt = o.owner === P ? this.target : o.owner.data.tgt; o.ph += dt * 5;
      let goal;
      if (tgt && tgt.hp > 0) { const a = o.ph * 0.5 + all.indexOf(o); goal = tgt.pos.clone().add(new V3(Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3)); if (o.pos.distanceTo(goal) < 2) this.damage(tgt, o.p * dt * 2.2, o.owner === P); }
      else { const i = all.indexOf(o) % 3; goal = o.owner.pos.clone().add(new V3(Math.sin(o.owner.yaw + 2.4 + i * 0.7) * 2, 0, Math.cos(o.owner.yaw + 2.4 + i * 0.7) * 2)); }
      o.pos.x = damp(o.pos.x, goal.x, 5, dt); o.pos.z = damp(o.pos.z, goal.z, 5, dt); o.pos.y = Math.abs(Math.sin(o.ph)) * 0.35;
      o.m.position.copy(o.pos); o.m.rotation.y = Math.atan2(goal.x - o.pos.x, goal.z - o.pos.z) || o.m.rotation.y;
    }
    // bots
    for (const b of this.bots) {
      if (!b.data.tgt || b.data.tgt.hp <= 0) { const zc = this.crystals.filter(c => c.zi === 0); b.data.tgt = zc[(Math.random() * zc.length) | 0]; }
      const t = b.data.tgt; let mv = new V3();
      if (t) { mv = steer(b, t.pos.x, t.pos.z, 2.2); if (mv.lengthSq() === 0) { b.data.hitT = (b.data.hitT || 0) - dt; if (b.data.hitT <= 0) { b.data.hitT = 0.6; b.swing = 0.3; this.damage(t, 3, false); } } }
      G.moveBot(b, dt, mv.multiplyScalar(0.8), b.hitWall ? (b.hitWall = null, true) : false);
    }
    // gemmes au sol
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]; k.t += dt;
      if (!k.m) { k.m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), boxMat(ZONES[0].cr, { basic: true })); k.m.position.copy(k.p); G.world.group.add(k.m); }
      const d = k.m.position.distanceTo(P.pos.clone().setY(P.pos.y + 1));
      if (k.t > 0.4) k.m.position.lerp(P.pos.clone().setY(P.pos.y + 1), Math.min(1, dt * (d < 8 ? 9 : 2)));
      k.m.rotation.y += dt * 4;
      if (d < 0.8 || k.t > 3) { G.world.group.remove(k.m); k.m.geometry.dispose(); this.pickups.splice(i, 1); this.gain(k.v); }
    }
    // portes & couveuse & sortie
    let pr = '';
    for (const gt of this.gates) if (!gt.open && P.pos.distanceTo(gt.pos) < 4) { pr = `△ Ouvrir ${ZONES[gt.i].n} (${fmt(ZONES[gt.i].cost)} gemmes)`; if (G.inp.inter) this.openGate(gt); }
    if (P.pos.distanceTo(this.hatchPos) < 3) { pr = '△ Couveuse & familiers'; if (G.inp.inter) this.openHatch(); }
    G.prompt(pr.replace('△', '<i class="g g-t">△</i>'));
    if (P.ground && P.ground.exit && !this.leaving) { this.leaving = true; this.persist(); G.backToPlaza(); }
    for (const c of this.crystals) c.g.rotation.y += dt * 0.3;
    const zi = P.pos.x > 86 ? 2 : P.pos.x > 42 ? 1 : 0;
    G.info(`💎 ${fmt(S.gems)} gemmes · ${ZONES[zi].n} · 🐾 ${S.pets.length} familier(s)`);
    G.board([...S.pets].sort((a, b) => b.p - a.p).slice(0, 3).map(p => ({ n: `${PET_T[p.t][0]} · ${RAR[p.r][0]}`, v: '⚔ ' + p.p.toFixed(1) })));
    G.updateCam(dt);
  }
  gain(v) { const S = this.S, G = this.G; v = Math.round(v); S.gems += v; S.acc += v; G.sfx('pop'); while (S.acc >= 40) { S.acc -= 40; G.addCoins(1); } }
  openGate(gt) {
    const G = this.G, S = this.S, z = ZONES[gt.i];
    if (S.zone < gt.i - 1) { G.toast('Ouvre d’abord la zone précédente', '', '#ff8a3d'); return; }
    if (S.gems < z.cost) { G.toast('Pas assez de gemmes', `Il en faut ${fmt(z.cost)}`, '#ff8a3d'); G.sfx('nope'); return; }
    S.gems -= z.cost; S.zone = gt.i; gt.open = true; for (const p of gt.parts) G.world.remove(p); if (gt.s) G.world.group.remove(gt.s);
    G.big(`${z.n} ouverte !`, 'Cristaux plus riches', 2); G.sfx('win'); G.addXP(40); G.addCoins(20 * gt.i);
    if (gt.i === 2) { const st = G.S.stats.pets = G.S.stats.pets || { plays: 0, wins: 0 }; st.wins++; }
    this.persist();
  }
  openHatch() {
    const G = this.G, S = this.S; G.exitLock();
    const ov = el('div', 'gmenu'); ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">FERME À FAMILIERS · COUVEUSE</div><h2>💎 ${fmt(S.gems)} gemmes</h2><div class="gm-list"></div><div class="gm-foot"><i class="g g-o">○</i> Fermer · tes 3 familiers les plus puissants t’accompagnent</div></div>`; G.root.appendChild(ov);
    const close = () => { ov.remove(); G.ui = null; G.last = performance.now(); };
    const items = () => [...EGGS.map(e => ({ label: `🥚 ${e.n}`, sub: S.zone < e.z ? `Ouvre ${ZONES[e.z].n} pour l’acheter` : `${e.pool.map(p => PET_T[p][0]).join(', ')} · légendaire ${e.w[3]} %`, get: () => `${fmt(e.p)} 💎`, disabled: () => S.zone < e.z || S.gems < e.p || S.pets.length >= 30, act: () => { close(); this.hatch(e); } })),
      ...[...S.pets].sort((a, b) => b.p - a.p).map((p, i) => ({ label: `${i < 3 ? '★ ' : ''}${PET_T[p.t][0]}`, sub: `<span style="color:${RAR[p.r][1]}">${RAR[p.r][0]}</span>${i < 3 ? ' · équipé' : ''}`, get: () => `⚔ ${p.p.toFixed(1)}`, act: () => { if (S.pets.length <= 1 || i < 3) { G.toast('Familier équipé', 'Il reste avec toi', '#8fb4ff'); return; } Modal.confirm('Relâcher ?', `${PET_T[p.t][0]} (${RAR[p.r][0]}) retournera dans la nature contre ${Math.round(p.p * 10)} gemmes.`, { yes: 'Relâcher' }).then(ok => { if (ok) { S.pets.splice(S.pets.indexOf(p), 1); this.gain(p.p * 10); list.setItems(items()); this.refreshPets(); } }); } })),
      { label: 'Fermer', cls: 'exit', act: close }];
    const list = new ListMenu(ov.querySelector('.gm-list'), items());
    G.ui = { update: nav => { list.update(nav); if (G.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  async hatch(e) {
    const G = this.G, S = this.S; S.gems -= e.p;
    let roll = Math.random() * 100, r = 0; for (let i = 0; i < 4; i++) { if (roll < e.w[i]) { r = i; break; } roll -= e.w[i]; }
    const t = e.pool[(Math.random() * e.pool.length) | 0], p = { t, r, p: +(e.mult * RAR[r][2] * (1.6 + Math.random() * 0.8)).toFixed(1) };
    G.ui = { update() {} };
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), boxMat(e.col, { smooth: true })); egg.scale.y = 1.25; const P = G.player; const fp = P.pos.clone().add(new V3(Math.sin(P.yaw) * 2.6, 1.4, Math.cos(P.yaw) * 2.6)); egg.position.copy(fp); G.world.group.add(egg);
    for (let i = 0; i < 14; i++) { egg.rotation.z = Math.sin(i * 1.4) * 0.25 * (i / 14 + 0.3); G.sfx('tick'); await G.wait(110 + i * 8); }
    G.world.group.remove(egg); egg.geometry.dispose(); G.bits.burst(fp, 40, [RAR[r][1], '#fff'], 7); G.sfx(r >= 2 ? 'win' : 'pop');
    S.pets.push(p); S.hatched++; G.addXP(10 + r * 15); this.refreshPets();
    const ov = el('div', 'ck-hatch'); ov.innerHTML = `<div class="glass" style="border:3px solid ${RAR[r][1]}"><b style="color:${RAR[r][1]}">${RAR[r][0]} !</b><span>${PET_T[t][0]} · puissance ${p.p}</span></div>`; G.root.appendChild(ov);
    await G.wait(1900); ov.remove(); G.ui = null; G.last = performance.now(); this.persist(); G.save();
  }
  persist() { if (this.S) this.G.S.pets = this.S; }
  destroy() { this.persist(); this.G.touchLabels(null); this.G.prompt(''); }
}

/* ============================================================ */
/* 5. CACHE-CACHE                                                */
/* ============================================================ */
const H_EDGES = [[0, 1, -6.3, -7, 'x'], [1, 2, 6.3, -7, 'x'], [3, 4, -6.3, 7, 'x'], [4, 5, 6.3, 7, 'x'], [0, 3, -12.6, 0, 'z'], [1, 4, 0, 0, 'z'], [2, 5, 12.6, 0, 'z'], [2, 6, 19, -8, 'x'], [4, 6, 0, 14, 'z']];
const H_RC = [[-12.6, -7], [0, -7], [12.6, -7], [-12.6, 7], [0, 7], [12.6, 7], [30, 0]];
function roomOf(p) { if (Math.abs(p.x) > 19.2 || Math.abs(p.z) > 14.2) return 6; const col = p.x < -6.3 ? 0 : p.x < 6.3 ? 1 : 2; return (p.z < 0 ? 0 : 3) + col; }
export function navTarget(pos, goal, edges = H_EDGES, rc = H_RC, rof = roomOf) {
  const a = rof(pos), b = rof(goal); if (a === b) return goal;
  const prev = { [a]: null }, q = [a];
  while (q.length) { const n = q.shift(); if (n === b) break; for (const e of edges) { const m = e[0] === n ? e[1] : e[1] === n ? e[0] : -1; if (m < 0 || m in prev) continue; prev[m] = [n, e]; q.push(m); } }
  if (!(b in prev)) return goal;
  let n = b; while (prev[n] && prev[n][0] !== a) n = prev[n][0];
  const [, , dx, dz, ax] = prev[n][1], X = ax === 'x';
  const sign = n === 6 ? 1 : a === 6 ? -1 : Math.sign((X ? rc[n][0] : rc[n][1]) - (X ? dx : dz)) || 1;
  const off = new V3(X ? sign : 0, 0, X ? 0 : sign), d = new V3(dx, 0, dz), appr = d.clone().addScaledVector(off, -1.1);
  const before = X ? (pos.x - dx) * sign : (pos.z - dz) * sign;
  if (before < -0.9 && Math.hypot(pos.x - appr.x, pos.z - appr.z) > 0.6) return appr;
  return d.addScaledVector(off, 1.6);
}
export class HideSeek {
  constructor(G) { this.G = G; }
  help() { return this.role === 'hide' ? `<p>Tu te <b>caches</b>. Pendant 20 secondes, le chercheur est enfermé dans le garage : trouve un coin derrière un meuble. Accroupis-toi (${'○ / C'}) : on te voit beaucoup moins. Survis jusqu’à la fin du chrono.</p>` : `<p>Tu <b>cherches</b>. Compte d’abord, puis fouille la maison. Approche-toi d’un caché et appuie sur <b>▢ / clic</b> pour l’attraper. Attention, certains changent de cachette s’ils te voient arriver !</p>`; }
  start() {
    const G = this.G, W = G.world, r = Math.random;
    G.setSky('#2a3a6a', '#7a8ac8', '#ffd0a0', 0x8090c0, 60, 160);
    const st = G.S.stats.hide || {}; this.role = (st.plays || 0) % 2 === 0 ? 'hide' : 'seek';
    this.spots = [];
    top(W, 0, 0, 0, 90, 90, '#5fae4a'); top(W, 0, 0.1, 0, 38, 28, '#d8b48a', {}, 0.2);
    const H = 4, wall = (x, z, w, d) => W.add(x, H / 2 + 0.1, z, w, H, d, '#f1ebe0');
    wall(0, -14, 38, 0.5); wall(-10.25, 14, 17.5, 0.5); wall(10.25, 14, 17.5, 0.5); wall(-19, 0, 0.5, 28); wall(19, 4, 0.5, 20);
    W.add(19, H / 2 + 0.1, -12, 0.5, H, 4, '#f1ebe0');
    // cloisons intérieures avec portes
    for (const x of [-6.3, 6.3]) { wall(x, -11.1, 0.4, 5.8); wall(x, -2.9, 0.4, 5.8); wall(x, 2.9, 0.4, 5.8); wall(x, 11.1, 0.4, 5.8); }
    for (const cx of [-12.6, 0, 12.6]) { wall(cx - 4.1, 0, 4.4, 0.4); wall(cx + 4.1, 0, 4.4, 0.4); }
    W.add(0, H + 0.3, 0, 38.6, 0.4, 28.6, '#c46a4a', { visual: false, noCam: true });
    const rooms = [['Salon', -12.6, -7, '#e9c8a0'], ['Cuisine', 0, -7, '#cfe6ef'], ['Garage', 12.6, -7, '#b8bcc4'], ['Chambre', -12.6, 7, '#d8c8ef'], ['Bureau', 0, 7, '#d6e8c8'], ['Salle de jeux', 12.6, 7, '#ffd8c8']];
    const furn = { tall: ['#8a5a3c', '#5b6270', '#3d8bff', '#f4f4f4', '#c58a5a'], low: ['#ff7a8a', '#7a5cff', '#2ec4b6', '#ffd23d', '#8a5a3c'] };
    this.roomPts = [];
    rooms.forEach(([n, cx, cz, col], ri) => {
      top(W, cx, 0.22, cz, 12.2, 13.4, col, {}, 0.1);
      this.roomPts.push(new V3(cx, 0, cz));
      if (n === 'Garage') { this.garage = new V3(cx, 0, cz); return; }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], k) => {
        const tall = (k + ri) % 2 === 0 || r() < 0.3, fx = cx + sx * 3.6, fz = cz + sz * 4.3;
        if (tall) { const w = 1.6 + r(), d = 1.1; W.add(fx, 1.5, fz, w, 2.8, d, furn.tall[(ri + k) % 5]); this.spots.push(new V3(fx + sx * 1.45, 0.2, fz + sz * 1.35)); }
        else { W.add(fx, 0.75, fz, 2.6, 1.2, 1.6, furn.low[(ri + k) % 5]); W.add(fx, 1.5, fz + sz * 0.6, 2.6, 0.5, 0.4, furn.low[(ri + k) % 5]); this.spots.push(new V3(fx + sx * 0.2, 0.2, fz + sz * 1.55)); }
      });
      W.add(cx, 0.6, cz, 2.6, 0.2, 1.6, '#8a5a3c'); W.add(cx, 0.3, cz, 0.3, 0.6, 0.3, '#5b3a22');
      const s = textSprite(n, 0.45, { size: 56, w: 420, h: 100, bg: 'rgba(10,12,22,.6)', stroke: null }); s.position.set(cx, 3.6, cz); W.group.add(s);
    });
    // garage : cartons et voiture
    W.add(12.6, 0.8, -8, 3.6, 1.4, 5.6, '#ff4d6d'); W.add(12.6, 1.8, -8.6, 3, 0.8, 3, '#ff4d6d');
    for (let i = 0; i < 4; i++) W.add(9 + (i % 2) * 1.1, 0.6 + Math.floor(i / 2) * 1, -12, 1, 1, 1, '#c58a5a');
    this.spots.push(new V3(9.5, 0.2, -10.6), new V3(16.5, 0.2, -11.5));
    // jardin
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, x = Math.cos(a) * 30, z = Math.sin(a) * 26; W.add(x, 1.5, z, 0.8, 3, 0.8, '#8a5a3c'); W.add(x, 3.8, z, 3, 2.4, 3, '#3aa34a'); W.add(x + 1.6, 0.6, z + 1.2, 2.2, 1.2, 2.2, '#4bbf4a'); this.spots.push(new V3(x + 3, 0, z + 2.6)); }
    W.build();
    // porte du garage (fermée pendant la cachette)
    this.door = [W.addLive(6.3, 2.1, -7, 0.4, 4, 2.4, '#8a5a3c'), W.addLive(12.6, 2.1, 0, 3.8, 4, 0.4, '#8a5a3c')];
    this.bots = G.makeBots(5);
    const P = G.player; P.data = { found: false };
    this.found = 0; this.T = 0;
    if (this.role === 'hide') {
      this.seeker = this.bots[0]; this.hiders = [P, ...this.bots.slice(1)];
      this.seeker.pos.copy(this.garage).setY(0.3); this.seeker.data = { mode: 'wait', tgt: null, lost: 0, patrol: null };
      P.pos.set(-2, 0.3, 10); this.ocamYaw(0);
      const free = [...this.spots].sort(() => r() - 0.5);
      this.hiders.slice(1).forEach((b, i) => { b.pos.set((r() - 0.5) * 10, 0.3, 8 + r() * 4); b.data = { spot: free[i], found: false }; });
      this.phase = 'hide'; this.left = 20; G.big('Cache-toi !', 'Le chercheur compte jusqu’à 20', 2.2);
    } else {
      this.hiders = this.bots; this.seeker = P;
      P.pos.copy(this.garage).setY(0.3); this.ocamYaw(Math.PI);
      const free = [...this.spots].sort(() => r() - 0.5);
      this.hiders.forEach((b, i) => { b.data = { spot: free[i], found: false, moved: 0 }; b.pos.copy(free[i]); b.crouch = r() < 0.7; });
      this.phase = 'hide'; this.left = 12; G.big('Compte jusqu’à 12…', 'Les autres se cachent', 2.2);
      this.dark = el('div', 'ck-fade on'); this.dark.style.opacity = '0.92'; this.dark.style.fontSize = '22px'; this.dark.textContent = 'Les yeux fermés…'; G.hud.root.appendChild(this.dark);
    }
    G.touchLabels({ attack: this.role === 'seek' ? 'TOUCHER' : null, alt: null, crouch: 'ACCROUPI' });
  }
  ocamYaw(y) { this.G.ocam.yaw = y; this.G.ocam.pitch = 0.4; }
  sees(eyeC, tgt, maxD) {
    const eye = eyeC.pos.clone().setY(eyeC.pos.y + 1.6), tp = tgt.pos.clone().setY(tgt.pos.y + (tgt.crouch ? 0.6 : 1.3));
    const d = eye.distanceTo(tp), lim = tgt.crouch ? maxD * 0.4 : maxD; if (d > lim) return false;
    const dir = tp.clone().sub(eye).normalize(); const fx = Math.sin(eyeC.yaw), fz = Math.cos(eyeC.yaw);
    if (d > 2.5 && dir.x * fx + dir.z * fz < 0.35) return false;
    return this.G.world.ray(eye, dir, d) >= d - 0.3;
  }
  update(dt) {
    const G = this.G, P = G.player, I = Input; this.T += dt; this.left -= dt;
    if (I.pressed('crouch') && P !== this.seeker) P.crouch = !P.crouch;
    const frozen = this.phase === 'hide' && P === this.seeker;
    G.ctlPlayer(dt, { noMove: frozen || P.data.found || this.phase === 'end', speed: RUN * (P === this.seeker ? 1.05 : 0.95) });
    if (this.phase === 'hide' && this.left <= 0) {
      this.phase = 'seek'; this.left = this.role === 'hide' ? 80 : 100; for (const d of this.door) G.world.remove(d);
      if (this.dark) { this.dark.remove(); this.dark = null; }
      G.big(this.role === 'hide' ? 'Le chercheur arrive !' : 'Trouve-les !', '', 1.6); G.sfx('go'); this.seeker.data.mode = 'patrol';
    }
    // bots cachés
    for (const b of this.hiders) {
      if (b === P || b.data.found) { if (b !== P) G.moveBot(b, dt, new V3(), false); continue; }
      let mv = new V3(); const sp = b.data.spot;
      if (sp) { const nt = navTarget(b.pos, sp); mv = steer(b, nt.x, nt.z, 0.35); if (mv.lengthSq() === 0) { b.crouch = b.data.crouchPref ?? (b.data.crouchPref = Math.random() < 0.75); } else b.crouch = false; }
      if (this.phase === 'seek' && this.role === 'seek' && !b.data.fleeing && b.data.moved < 1 && P.pos.distanceTo(b.pos) < 5.5 && this.sees(b, P, 10) && Math.random() < 0.012) { const far = this.spots.filter(s => s.distanceTo(P.pos) > 14); b.data.spot = far[(Math.random() * far.length) | 0]; b.data.moved++; b.data.fleeing = true; setTimeout(() => b.data.fleeing = false, 4000); G.toast('Quelqu’un s’enfuit !', 'Tu as fait du bruit', '#2ec4b6'); }
      G.moveBot(b, dt, mv, b.hitWall && b.onGround ? (b.hitWall = null, true) : false, { speed: RUN * (b.data.fleeing ? 1.05 : 0.85) });
    }
    // chercheur bot
    if (this.role === 'hide') this.seekerAI(dt);
    // le joueur cherche
    if (this.role === 'seek' && this.phase === 'seek' && (G.inp.act || G.inp.inter)) { P.swing = 0.3; for (const b of this.hiders) if (!b.data.found && b.pos.distanceTo(P.pos) < 2.3) { this.catchH(b); break; } }
    if (this.role === 'seek' && this.phase === 'seek') for (const b of this.hiders) if (!b.data.found && b.pos.distanceTo(P.pos) < 1.0) this.catchH(b);
    // fin
    if (this.phase === 'seek') {
      G.timer(this.left);
      const remain = this.hiders.filter(h => !h.data.found).length;
      if (this.role === 'hide' && P.data.found) this.end(false);
      else if (remain === 0) this.end(this.role === 'seek');
      else if (this.left <= 0) this.end(this.role === 'hide');
    } else if (this.phase === 'hide') G.timer(this.left);
    G.info(this.role === 'hide' ? `🙈 Tu te caches${P.crouch ? ' · accroupi' : ''} · ${this.hiders.filter(h => !h.data.found).length} caché(s)` : `🔎 Tu cherches · trouvés ${this.found}/${this.hiders.length}`);
    G.board(this.hiders.map(h => ({ n: h === P ? 'Toi' : h.name, v: h.data.found ? 'trouvé' : 'caché', me: h === P, out: h.data.found })));
    G.updateCam(dt, { dist: 6 });
  }
  seekerAI(dt) {
    const G = this.G, s = this.seeker, D = s.data;
    if (D.mode === 'wait' || this.phase === 'end') { G.moveBot(s, dt, new V3(), false); return; }
    D.scan = (D.scan || 0) - dt;
    if (D.scan <= 0) { D.scan = 0.2; let best = null, bd = 1e9; for (const h of this.hiders) if (!h.data.found && this.sees(s, h, 15)) { const d = h.pos.distanceTo(s.pos); if (d < bd) { bd = d; best = h; } } if (best) { if (D.tgt !== best && best === G.player) { G.toast('Tu es repéré !', 'Cours !', '#ff4d6d'); G.sfx('beep'); Input.rumble(0.4, 0.3, 120); } D.tgt = best; D.last = best.pos.clone(); D.lost = 0; } else if (D.tgt) { D.lost += 0.2; if (D.lost > 2.5) D.tgt = null; } }
    let goal;
    if (D.tgt) { goal = D.tgt.data && D.lost > 0 ? D.last : D.tgt.pos; if (s.pos.distanceTo(D.tgt.pos) < 1.2) { this.catchH(D.tgt); D.tgt = null; } }
    else { if (!D.patrol || s.pos.distanceTo(D.patrol) < 1.2 || (D.pt = (D.pt || 0) - dt) < 0) { const pts = Math.random() < 0.55 ? this.spots : this.roomPts; D.patrol = pts[(Math.random() * pts.length) | 0].clone(); D.pt = 9; } goal = D.patrol; }
    const ng = navTarget(s.pos, goal), mv = steer(s, ng.x, ng.z, 0.3);
    if (s.hitWall) { s.hitWall = null; D.side = (D.side || 1) * -1; mv.applyAxisAngle(new V3(0, 1, 0), D.side * 1.1); D.pt -= 1.5; }
    G.moveBot(s, dt, mv, false, { speed: RUN * (D.tgt ? 0.98 : 0.7) });
  }
  catchH(h) {
    const G = this.G; if (h.data.found) return; h.data.found = true; this.found++;
    G.bits.burst(h.pos.clone().setY(1.2), 20, ['#2ec4b6', '#fff'], 5); G.sfx(h === G.player ? 'die' : 'pop');
    if (h !== G.player) { h.crouch = false; h.av.group.visible = false; G.toast(`${h.name} trouvé !`, this.role === 'seek' ? '+12 ◆' : '', '#2ec4b6'); }
    else { G.big('Trouvé !', 'Le chercheur t’a attrapé', 1.8); }
  }
  end(win) {
    if (this.phase === 'end') return; this.phase = 'end'; const G = this.G, P = G.player;
    let coins, lines;
    if (this.role === 'hide') { const surv = Math.round(80 - Math.max(0, this.left)); coins = win ? 70 : 15 + Math.floor(surv / 5); lines = [win ? 'Le chercheur ne t’a pas trouvé !' : `Trouvé après <b>${surv} s</b>`, `Autres cachés trouvés : <b>${this.found - (P.data.found ? 1 : 0)}</b>`, 'Prochaine manche : tu cherches !']; }
    else { coins = this.found * 12 + (win ? 25 : 0); lines = [`Cachés trouvés : <b>${this.found} / ${this.hiders.length}</b>`, win ? `En <b>${(100 - this.left).toFixed(0)} s</b>` : 'Le temps est écoulé', 'Prochaine manche : tu te caches !']; }
    G.finish({ win, coins, title: win ? (this.role === 'hide' ? 'Introuvable !' : 'Tous trouvés !') : 'Manche terminée', lines, best: this.role === 'seek' ? this.found : null, bestTxt: this.role === 'seek' ? `${this.found} trouvés` : null });
  }
  destroy() { const P = this.G.player; P.crouch = false; if (this.dark) this.dark.remove(); for (const b of this.bots) b.av.group.visible = true; this.G.touchLabels(null); }
}
