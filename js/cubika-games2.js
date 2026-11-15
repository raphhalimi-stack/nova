// CUBIKA — mini-jeux 6 à 10 : catastrophes, karts, défilé, guerre des lits, manoir mystère
import { Input, Modal, ListMenu, rng, el } from './core.js';
import { THREE, V3, steer, needJump, textSprite, boxMat, RUN, animate, randomLook, HATS, BACKS, FACES, DECALS, COLORS, clamp, damp, lerp } from './cubika-engine.js';
import { navTarget } from './cubika-games1.js';

const top = (W, x, y, z, w, d, c, o = {}, h = 1) => W.add(x, y - h / 2, z, w, h, d, c, o);
const shuffle = (a, r = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ord = n => n === 1 ? '1ʳᵉ' : n + 'ᵉ';

/* ============================================================ */
/* 6. CATASTROPHES                                               */
/* ============================================================ */
const DIS = { flood: ['Inondation', 'Grimpe le plus haut possible !', '#3d8bff'], meteor: ['Pluie de météores', 'Évite les cercles rouges au sol !', '#ff8a3d'], tornado: ['Tornade', 'Éloigne-toi du tourbillon !', '#b8c0cc'], quake: ['Séisme', 'Des blocs tombent du ciel : surveille les ombres !', '#c58a5a'], lava: ['Sol de lave', 'Quitte le sol, vite !', '#ff4d6d'] };
export class Disasters {
  constructor(G) { this.G = G; }
  help() { return `<p>Trois catastrophes s’enchaînent sur l’île. Survis à chacune pour marquer des points. Le nom de la catastrophe s’affiche quelques secondes avant : prépare-toi ! Les toits, la pyramide et la grande tour sont tes alliés contre l’eau et la lave.</p>`; }
  start() {
    const G = this.G, W = G.world;
    G.setSky('#5aa8ff', '#bfe0ff', '#ffe8c8', 0xcfe6ff, 70, 220);
    top(W, 0, 0, 0, 60, 60, '#7ddc4a'); top(W, 0, -1, 0, 64, 64, '#ffe0a0', {}, 1.5);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x2a8ad0 })); this.sea.rotation.x = -Math.PI / 2; this.sea.position.y = -1.2; W.group.add(this.sea);
    this.paths = [];
    // pyramide à gradins
    const zc = [-15, -15]; const zp = []; for (let k = 0; k < 6; k++) { const s = 12 - k * 2; top(W, zc[0], k + 1, zc[1], s, s, ['#e8d49a', '#dcc489', '#d0b478'][k % 3]); zp.push(new V3(zc[0], k + 1, zc[1] + s / 2 - 0.6)); } this.paths.push(zp.reverse().slice().reverse());
    // maisons avec escalier
    [[12, 12, '#ff7a8a'], [-14, 12, '#7a5cff'], [2, -2, '#ffd23d']].forEach(([x, z, c]) => { top(W, x, 4, z, 6, 6, c, {}, 4); top(W, x, 5, z, 7, 7, '#c46a4a', {}, 1); const p = []; for (let k = 0; k < 4; k++) { top(W, x - 4.2, 1.2 * (k + 1), z - 2.6 + k * 1.6, 1.6, 1.6, '#ffffff'); p.push(new V3(x - 4.2, 1.2 * (k + 1), z - 2.6 + k * 1.6)); } p.push(new V3(x, 5, z)); this.paths.push(p); });
    // grande tour en spirale
    const tc = [15, -14]; top(W, tc[0], 12, tc[1], 4, 4, '#b8c0cc', {}, 12); top(W, tc[0], 12.3, tc[1], 5, 5, '#5b6270', {}, 0.3); const tp = []; let a = 0;
    for (let k = 0; k < 12; k++) { a += 0.52; const x = tc[0] + Math.sin(a) * 3.3, z = tc[1] + Math.cos(a) * 3.3; top(W, x, (k + 1) * 0.95, z, 1.7, 1.7, '#ffffff'); tp.push(new V3(x, (k + 1) * 0.95, z)); } tp.push(new V3(tc[0], 12.3, tc[1])); this.paths.push(tp);
    for (let i = 0; i < 14; i++) { const x = (Math.random() - 0.5) * 50, z = (Math.random() - 0.5) * 50; if (Math.hypot(x - 15, z + 14) < 7 || Math.hypot(x + 15, z + 15) < 9 || Math.abs(x - 2) < 6 && Math.abs(z + 2) < 6) continue; W.add(x, 1, z, 0.6, 2, 0.6, '#8a5a3c'); W.add(x, 2.6, z, 2.2, 1.6, 2.2, '#3aa34a'); }
    W.build();
    this.water = new THREE.Mesh(new THREE.BoxGeometry(64, 20, 64), new THREE.MeshLambertMaterial({ color: 0x2f8fe8, transparent: true, opacity: 0.62, depthWrite: false })); this.water.visible = false; W.group.add(this.water);
    this.lavaM = new THREE.Mesh(new THREE.BoxGeometry(60.2, 4, 60.2), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.92 })); this.lavaM.visible = false; W.group.add(this.lavaM);
    this.tor = new THREE.Group(); for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + i * 0.55, 0.4 + i * 0.5, 2.2, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xc8ccd6, transparent: true, opacity: 0.5 - i * 0.03, side: THREE.DoubleSide, depthWrite: false })); m.position.y = i * 2; this.tor.add(m); } this.tor.visible = false; W.group.add(this.tor);
    this.list = shuffle(Object.keys(DIS)).slice(0, 3); this.idx = -1; this.T = 0; this.survived = 0; this.objs = [];
    this.all = [G.player, ...G.makeBots(7)];
    this.resetPositions(); G.touchLabels({ attack: null, alt: null, crouch: null });
    G.ocam.pitch = 0.5; this.next();
  }
  resetPositions() { this.all.forEach((c, i) => { const a = i / this.all.length * 6.28; c.pos.set(Math.sin(a) * 8, 0.2, Math.cos(a) * 8 + 6); c.vel.set(0, 0, 0); c.alive = true; c.av.group.visible = true; c.data = { o2: 1, path: null, pi: 0 }; c.sync(); }); }
  next() {
    const G = this.G; this.idx++; this.clearObjs();
    if (this.idx >= this.list.length) return this.end();
    this.kind = this.list[this.idx]; this.phase = 'warn'; this.T = 0;
    const d = DIS[this.kind]; G.big(d[0], d[1], 3); G.sfx('radio'); this.water.visible = false; this.lavaM.visible = false; this.tor.visible = false; this.waterY = -2; this.lavaY = -1;
    G.root.style.setProperty('--acc', d[2]);
    // les bots choisissent un plan
    for (const b of this.all) if (b.bot) { b.data.path = this.paths[(Math.random() * this.paths.length) | 0]; b.data.pi = 0; b.data.wander = null; }
  }
  clearObjs() { for (const o of this.objs) { if (o.m) { this.G.world.group.remove(o.m); o.m.geometry && o.m.geometry.dispose(); } if (o.ring) this.G.world.group.remove(o.ring); if (o.b) this.G.world.remove(o.b); } this.objs = []; }
  kill(c, why) {
    const G = this.G; if (!c.alive) return; c.alive = false; G.bits.burst(c.pos.clone().setY(c.pos.y + 1), 22, [c.look.shirt, '#fff', DIS[this.kind][2]], 6); c.av.group.visible = false;
    if (c === G.player) { G.sfx('die'); Input.rumble(0.7, 0.5, 260); G.big('Éliminé !', why + ' · attends la prochaine catastrophe', 2.2); } else G.toast(`${c.name} éliminé`, why, '#ff8a3d');
  }
  marker(x, z, r) { const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 24), new THREE.MeshBasicMaterial({ color: 0xff2a3c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; const gb = this.G.world.groundBelow(x, z, 40); ring.position.set(x, (gb ? gb.y : 0) + 0.06, z); this.G.world.group.add(ring); return ring; }
  update(dt) {
    const G = this.G, W = G.world, P = G.player; this.T += dt;
    if (this.phase === 'warn' && this.T > 3.5) { this.phase = 'run'; this.T = 0; this.dur = 28; G.sfx('go'); if (this.kind === 'tornado') { this.tor.visible = true; this.tpos = new V3(-28, 0, 28); this.tgoal = new V3(); } if (this.kind === 'flood') { this.water.visible = true; this.wMax = 4.6 + Math.random() * 1.6; } }
    const run = this.phase === 'run';
    let push = null;
    // catastrophes
    if (run) {
      const k = this.kind, t = this.T;
      if (k === 'flood') { this.waterY = Math.min(this.wMax, -1.2 + t * 0.45); this.water.position.y = this.waterY - 10; }
      if (k === 'lava') { this.lavaY = t < 3 ? -1 : Math.min(1.5, (t - 3) * 0.35); this.lavaM.visible = t > 1.5; this.lavaM.position.y = this.lavaY - 2; this.lavaM.material.color.setRGB(1, 0.32 + Math.sin(t * 3) * 0.06, 0.08); }
      if (k === 'meteor' || k === 'quake') {
        this.spawnT = (this.spawnT || 0) - dt;
        if (this.spawnT <= 0) { this.spawnT = k === 'meteor' ? Math.max(0.16, 0.42 - t * 0.008) : 0.3; const tgt = Math.random() < 0.35 ? this.all.filter(c => c.alive)[(Math.random() * this.all.filter(c => c.alive).length) | 0] : null; const x = tgt ? tgt.pos.x + (Math.random() - 0.5) * 3 : (Math.random() - 0.5) * 56, z = tgt ? tgt.pos.z + (Math.random() - 0.5) * 3 : (Math.random() - 0.5) * 56; const r = k === 'meteor' ? 2.4 : 1.3; const ring = this.marker(x, z, r); const gb = W.groundBelow(x, z, 40); const m = k === 'meteor' ? new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xff7a2a })) : new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), boxMat('#a88a6a')); m.position.set(x + (k === 'meteor' ? 14 : 0), 34, z); W.group.add(m); this.objs.push({ m, ring, x, z, r, gy: gb ? gb.y : 0, t: 1.4, k }); }
        if (k === 'quake') { G.ocam.shake = Math.max(G.ocam.shake, 0.35); if (Math.random() < dt * 1.5) for (const c of this.all) if (c.onGround && c.alive) c.knock = new V3((Math.random() - 0.5) * 5, 4, (Math.random() - 0.5) * 5); }
        for (let i = this.objs.length - 1; i >= 0; i--) { const o = this.objs[i]; if (!o.ring) continue; o.t -= dt; const f = Math.max(0, o.t / 1.4); o.m.position.set(o.x + (o.k === 'meteor' ? 14 * f : 0), o.gy + 1 + 33 * f, o.z); o.m.rotation.x += dt * 5; o.ring.material.opacity = 0.5 + Math.sin(this.T * 20) * 0.3; if (o.t <= 0) { W.group.remove(o.ring); o.ring.geometry.dispose(); o.ring = null; G.bits.burst(new V3(o.x, o.gy + 0.5, o.z), 16, o.k === 'meteor' ? ['#ff7a2a', '#ffd23d', '#333'] : ['#a88a6a', '#d0b478'], 7); if (P.pos.distanceTo(new V3(o.x, o.gy, o.z)) < 12) { G.sfx(o.k === 'meteor' ? 'boom' : 'land'); G.ocam.shake = 0.3; } for (const c of this.all) if (c.alive && Math.hypot(c.pos.x - o.x, c.pos.z - o.z) < o.r + 0.2 && Math.abs(c.pos.y - o.gy) < 2.5) this.kill(c, o.k === 'meteor' ? 'touché par un météore' : 'écrasé par un bloc'); W.group.remove(o.m); o.m.geometry.dispose(); this.objs.splice(i, 1); } }
      }
      if (k === 'tornado') {
        if (!this.tgoal || this.tpos.distanceTo(this.tgoal) < 2) { const al = this.all.filter(c => c.alive); const tg = Math.random() < 0.5 && al.length ? al[(Math.random() * al.length) | 0].pos : new V3((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50); this.tgoal = new V3(tg.x, 0, tg.z); }
        const d = this.tgoal.clone().sub(this.tpos); d.y = 0; const sp = 4.2 + t * 0.12; if (d.length() > 0.1) this.tpos.addScaledVector(d.normalize(), sp * dt);
        this.tor.position.copy(this.tpos); this.tor.children.forEach((m, i) => { m.rotation.y += dt * (6 - i * 0.4); m.position.x = Math.sin(this.T * 3 + i) * 0.3 * i; });
        for (const c of this.all) { if (!c.alive) continue; const dx = this.tpos.x - c.pos.x, dz = this.tpos.z - c.pos.z, dd = Math.hypot(dx, dz); if (dd < 2.6) { c.knock = new V3(-dx * 4, 16, -dz * 4); this.kill(c, 'emporté par la tornade'); } else if (dd < 10) { const f = (10 - dd) / 10 * 5.2; c.data.push = new V3(dx / dd * f - dz / dd * f * 0.6, 0, dz / dd * f + dx / dd * f * 0.6); } else c.data.push = null; }
      }
      if (this.T > this.dur) this.roundEnd();
    }
    // joueur
    if (P.alive) { G.ctlPlayer(dt, { push: P.data.push, speed: RUN * (this.inWater(P) ? 0.55 : 1) }); }
    // bots
    for (const b of this.all) if (b !== P && b.alive) this.botThink(b, dt);
    // noyade / lave / chute
    for (const c of this.all) {
      if (!c.alive) continue;
      if (run && this.kind === 'flood') { if (c.pos.y + 1.25 < this.waterY) { c.data.o2 -= dt / 3.2; if (c.data.o2 <= 0) this.kill(c, 'noyé'); } else c.data.o2 = Math.min(1, c.data.o2 + dt); }
      if (run && this.kind === 'lava' && c.pos.y < this.lavaY + 0.05) this.kill(c, 'tombé dans la lave');
      if (c.pos.y < -6) this.kill(c, 'tombé à l’eau');
    }
    const alive = this.all.filter(c => c.alive).length;
    G.info(this.idx < this.list.length ? `${['🌊', '☄', '🌪', '💥', '🌋'][Object.keys(DIS).indexOf(this.kind)]} ${DIS[this.kind][0]} · ${this.idx + 1}/3 · survivants ${alive}${P.alive && this.kind === 'flood' && P.data.o2 < 1 ? ` · 🫧 ${Math.round(P.data.o2 * 100)} %` : ''}` : '');
    G.timer(run ? this.dur - this.T : null);
    G.board(this.all.map(c => ({ n: c === P ? 'Toi' : c.name, v: c.alive ? '✓' : '✗', me: c === P, out: !c.alive })));
    if (P.alive) G.updateCam(dt, { dist: 10 }); else G.ocam.update(dt, null, { x: dt * 0.25, y: 0 }, new V3(0, 4, 0), { dist: 34 });
  }
  inWater(c) { return this.kind === 'flood' && this.phase === 'run' && c.pos.y < this.waterY; }
  botThink(b, dt) {
    const G = this.G, W = G.world, D = b.data, k = this.kind; let mv = new V3(), jump = false;
    const climb = k === 'flood' || k === 'lava';
    if (climb && D.path) {
      const p = D.path[Math.min(D.pi, D.path.length - 1)];
      if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 0.8 && b.pos.y > p.y - 0.4) D.pi = Math.min(D.path.length - 1, D.pi + 1);
      if (b.onGround && b.pos.y < p.y - 2.5 && D.pi > 0) D.pi = 0;
      mv = steer(b, p.x, p.z, 0.3); if (b.onGround && mv.lengthSq()) { jump = needJump(b, W, mv, 0.6) || (p.y > b.pos.y + 0.4 && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 2.6); }
      if (Math.random() < 0.003 * (1.3 - b.skill)) D.path = null;
    } else {
      if (!D.wander || Math.hypot(b.pos.x - D.wander.x, b.pos.z - D.wander.z) < 1 || Math.random() < 0.005) D.wander = new V3((Math.random() - 0.5) * 44, 0, (Math.random() - 0.5) * 44);
      if (climb && !D.path) D.path = this.paths[(Math.random() * this.paths.length) | 0];
      mv = steer(b, D.wander.x, D.wander.z, 0.5).multiplyScalar(this.phase === 'run' ? 1 : 0.5);
      for (const o of this.objs) if (o.ring && Math.hypot(b.pos.x - o.x, b.pos.z - o.z) < o.r + 1.6 && Math.random() < b.skill) { mv = new V3(b.pos.x - o.x, 0, b.pos.z - o.z).normalize(); break; }
      if (k === 'tornado' && this.phase === 'run' && this.tpos) { const dx = b.pos.x - this.tpos.x, dz = b.pos.z - this.tpos.z, d = Math.hypot(dx, dz); if (d < 14 * b.skill + 3) mv = new V3(dx / d, 0, dz / d); }
      if (b.hitWall && b.onGround) { b.hitWall = null; jump = true; }
      if (Math.abs(b.pos.x) > 27 || Math.abs(b.pos.z) > 27) mv = steer(b, 0, 0, 0);
    }
    G.moveBot(b, dt, mv, jump, { push: D.push, speed: RUN * (0.8 + b.skill * 0.15) * (this.inWater(b) ? 0.55 : 1) });
  }
  roundEnd() {
    const G = this.G, P = G.player; this.phase = 'done';
    const surv = this.all.filter(c => c.alive);
    if (P.alive) { this.survived++; G.sfx('check'); G.big('Survécu !', `${surv.length} survivant(s)`, 2); } else G.big(`${DIS[this.kind][0]} terminée`, `${surv.length} survivant(s)`, 2);
    this.water.visible = false; this.lavaM.visible = false; this.tor.visible = false;
    setTimeout(() => { if (this.G.mg !== this || this.done) return; if (this.idx < this.list.length - 1) { this.resetPositions(); } this.next(); }, 2600);
  }
  end() {
    const G = this.G; this.phase = 'end'; G.info('');
    const all = this.survived === 3;
    G.finish({ win: all, coins: this.survived * 20 + (all ? 20 : 0), title: all ? 'Survivant ultime !' : `${this.survived} / 3 survécues`, best: this.survived, bestTxt: `${this.survived}/3`, lines: [`Catastrophes : <b>${this.list.map(k => DIS[k][0]).join(', ')}</b>`, `Tu en as survécu à <b>${this.survived} sur 3</b>`], delay: 400 });
  }
  destroy() { const P = this.G.player; P.alive = true; P.av.group.visible = true; this.G.touchLabels(null); }
}

/* ============================================================ */
/* 7. GRAND PRIX CUBIQUE (karts)                                 */
/* ============================================================ */
export class Kart {
  constructor(G) { this.G = G; }
  help() { return `<p><b>✕ ou R2</b> (Espace / Z / W) pour accélérer, <b>○ ou L2</b> (C / S) pour freiner et reculer, joystick gauche pour tourner. Les flèches jaunes au sol donnent un <b>turbo</b>. Sortir de la piste ralentit. Trois tours, six pilotes.</p>`; }
  start() {
    const G = this.G, W = G.world; G.setSky('#4aa3ff', '#bfe4ff', '#fff0d8', 0xd0e8ff, 120, 420);
    const pts = [[20, -46], [50, -42], [88, -8], [72, 30], [34, 22], [12, 52], [-28, 58], [-62, 38], [-44, 12], [-84, 4], [-70, -30], [-10, -48]].map(p => new V3(p[0], 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); const N = this.N = 500; this.samp = curve.getSpacedPoints(N).slice(0, N); this.tan = this.samp.map((p, i) => this.samp[(i + 1) % N].clone().sub(this.samp[(i - 1 + N) % N]).normalize());
    this.len = curve.getLength(); this.HW = 7;
    top(W, 0, 0, 0, 260, 220, '#6cc84a', {}, 1);
    // route
    const pos = [], uv = [], idx = []; let acc = 0;
    for (let i = 0; i <= N; i++) { const p = this.samp[i % N], t = this.tan[i % N], n = new V3(t.z, 0, -t.x); if (i) acc += p.distanceTo(this.samp[(i - 1) % N]); for (const s of [-1, 1]) { pos.push(p.x + n.x * this.HW * s, 0.03, p.z + n.z * this.HW * s); uv.push(s < 0 ? 0 : 1, acc / 10); } if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const road = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: this.roadTex(), side: THREE.DoubleSide })); road.receiveShadow = true; W.group.add(road);
    // bordures et décor
    for (let i = 0; i < N; i += 3) { const p = this.samp[i], t = this.tan[i], n = new V3(t.z, 0, -t.x); for (const s of [-1, 1]) W.add(p.x + n.x * (this.HW + 0.7) * s, 0.35, p.z + n.z * (this.HW + 0.7) * s, 1.1, 0.7, 1.1, (i / 3) % 2 ? '#ff4d6d' : '#ffffff', { solid: false }); }
    const r = rng(42); for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 240, z = (r() - 0.5) * 200; if (this.nearest(new V3(x, 0, z), -1).d < this.HW + 6) continue; const h = 2 + r() * 2; W.add(x, h / 2, z, 0.7, h, 0.7, '#8a5a3c', { solid: false }); W.add(x, h + 1, z, 3, 2.4, 3, ['#3aa34a', '#4bbf4a', '#2f8a3a'][i % 3], { solid: false }); }
    // tribune + arche
    const s0 = this.samp[0], t0 = this.tan[0], n0 = new V3(t0.z, 0, -t0.x);
    for (let k = 0; k < 4; k++) W.add(s0.x + n0.x * (this.HW + 5 + k), 0.6 + k * 0.6, s0.z + n0.z * (this.HW + 5 + k), 1, 1.2 + k * 1.2, 22, '#5b6270', { solid: false });
    const ar = new THREE.Group(); ar.position.copy(s0); ar.rotation.y = Math.atan2(t0.x, t0.z); W.group.add(ar);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), boxMat('#7a5cff')); m.position.set(s * (this.HW + 0.8), 3, 0); ar.add(m); }
    const tb = new THREE.Mesh(new THREE.BoxGeometry(this.HW * 2 + 2.4, 1.2, 0.8), boxMat('#ffffff')); tb.position.y = 6.4; ar.add(tb);
    const lab = textSprite('GRAND PRIX CUBIQUE', 1.1, { size: 64, w: 1024, h: 120, color: '#7a5cff', stroke: '#fff' }); lab.position.set(0, 6.4, -0.7); ar.add(lab);
    W.build();
    // turbos
    this.boosts = []; [40, 120, 205, 290, 370, 445].forEach((i, k) => { const p = this.samp[i], t = this.tan[i], n = new V3(t.z, 0, -t.x), off = ((k % 3) - 1) * 3.5; const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshBasicMaterial({ map: this.arrowTex(), transparent: true })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(t.x, t.z) + Math.PI; m.position.set(p.x + n.x * off, 0.06, p.z + n.z * off); W.group.add(m); this.boosts.push({ i, off, m }); });
    // karts
    const P = G.player, bots = G.makeBots(5); this.racers = [P, ...bots];
    this.racers.forEach((c, k) => {
      const kg = new THREE.Group(); const col = c === P ? G.S.look.shirt : c.look.shirt;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 2.8), boxMat(col, { smooth: true })); body.position.y = 0.55; kg.add(body);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.7), boxMat('#1f2430', { smooth: true })); nose.position.set(0, 0.55, 1.6); kg.add(nose);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), boxMat(col, { smooth: true })); sp.position.set(0, 1.25, -1.3); kg.add(sp);
      const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 12); wg.rotateZ(Math.PI / 2); for (const [x, z] of [[-0.95, 0.95], [0.95, 0.95], [-0.95, -0.95], [0.95, -0.95]]) { const w = new THREE.Mesh(wg, boxMat('#1a1a22', { smooth: true })); w.position.set(x, 0.38, z); kg.add(w); }
      c.sit = true; c.av.group.position.set(0, 0.35, -0.35); c.av.group.rotation.set(0, 0, 0); c.av.group.scale.setScalar(0.82); W.group.remove(c.av.group); kg.add(c.av.group); G.scene.add(kg);
      const row = Math.floor(k / 2), lane = k % 2 ? 2.6 : -2.6, si = (N - 6 - row * 5) % N, p = this.samp[si], t = this.tan[si], n = new V3(t.z, 0, -t.x);
      c.data = { kg, x: p.x + n.x * lane, z: p.z + n.z * lane, yaw: Math.atan2(t.x, t.z), spd: 0, boost: 0, i: si, lap: 0, half: false, done: false, lane: (Math.random() - 0.5) * 6, prog: 0 };
      kg.position.set(c.data.x, 0, c.data.z); kg.rotation.y = c.data.yaw;
    });
    this.T = 0; this.state = 'count'; this.laps = 3; this.order = [];
    G.touchLabels({ jump: 'GAZ', attack: null, alt: 'FREIN', interact: null, crouch: null });
    this.camPos = new V3(P.data.x, 6, P.data.z - 10);
    G.countdown(3).then(() => { if (this.state === 'count') { this.state = 'run'; this.T = 0; } });
  }
  roadTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#4a4f5c'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } x.fillStyle = '#ffffff'; x.fillRect(0, 0, 6, 128); x.fillRect(122, 0, 6, 128); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(62, 0, 4, 64); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  arrowTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,210,61,.95)'; for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(32, 6 + k * 42); x.lineTo(60, 40 + k * 42); x.lineTo(46, 40 + k * 42); x.lineTo(32, 26 + k * 42); x.lineTo(18, 40 + k * 42); x.lineTo(4, 40 + k * 42); x.closePath(); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  nearest(p, hint) {
    const N = this.N; let best = 0, bd = 1e9;
    const from = hint < 0 ? 0 : hint - 25, to = hint < 0 ? N : hint + 25;
    for (let j = from; j < to; j += hint < 0 ? 2 : 1) { const i = (j + N) % N, s = this.samp[i], d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } }
    const s = this.samp[best], t = this.tan[best], n = new V3(t.z, 0, -t.x); const lat = (p.x - s.x) * n.x + (p.z - s.z) * n.z;
    return { i: best, d: Math.sqrt(bd), lat };
  }
  drive(c, dt, acc, brake, steerIn) {
    const D = c.data, N = this.N;
    const nr = this.nearest(new V3(D.x, 0, D.z), D.i), off = Math.abs(nr.lat) > this.HW + 0.3;
    const max = (D.boost > 0 ? 40 : 29) * (off ? 0.5 : 1) * (c.bot ? D.maxK : 1);
    if (acc) D.spd += (D.spd < 0 ? 30 : 18) * dt; else if (brake) D.spd -= (D.spd > 0 ? 34 : 9) * dt; else D.spd = damp(D.spd, 0, 0.9, dt);
    D.spd = clamp(D.spd, -9, D.boost > 0 ? Math.max(max, D.spd) : max); if (D.spd > max) D.spd = damp(D.spd, max, 3, dt);
    D.yaw -= steerIn * dt * 2.3 * clamp(Math.abs(D.spd) / 9, 0, 1) * Math.sign(D.spd || 1);
    D.x += Math.sin(D.yaw) * D.spd * dt; D.z += Math.cos(D.yaw) * D.spd * dt;
    if (Math.abs(nr.lat) > this.HW + 4) { const s = this.samp[nr.i], t = this.tan[nr.i], n = new V3(t.z, 0, -t.x), k = Math.sign(nr.lat) * (this.HW + 4); D.x = s.x + n.x * k; D.z = s.z + n.z * k; D.spd *= 0.6; if (c === this.G.player) { this.G.sfx('hit'); Input.rumble(0.4, 0.3, 100); } }
    D.boost -= dt;
    for (const b of this.boosts) { const p = b.m.position; if (Math.hypot(D.x - p.x, D.z - p.z) < 2.1 && D.boost < 0.8) { D.boost = 1.4; D.spd = Math.max(D.spd, 36); if (c === this.G.player) { this.G.sfx('dash'); Input.rumble(0.3, 0.6, 200); } } }
    // tours
    if (nr.i > N * 0.45 && nr.i < N * 0.55) D.half = true;
    if (D.i > N * 0.85 && nr.i < N * 0.15 && D.half) { D.lap++; D.half = false; if (c === this.G.player && D.lap < this.laps) { this.G.big(D.lap === this.laps - 1 ? 'Dernier tour !' : `Tour ${D.lap + 1} / ${this.laps}`, '', 1.4); this.G.sfx('check'); } if (D.lap >= this.laps && !D.done) { D.done = true; D.t = this.T; this.order.push(c); } }
    if (D.i < N * 0.15 && nr.i > N * 0.85 && D.lap > 0 && !D.done) { /* marche arrière sur la ligne */ }
    D.i = nr.i; D.prog = D.lap * N + nr.i + (D.done ? 1e5 - this.order.indexOf(c) * 1000 : 0);
    D.kg.position.set(D.x, Math.sin(this.T * 30) * 0.02 * Math.min(1, Math.abs(D.spd) / 10), D.z); D.kg.rotation.y = D.yaw; D.kg.rotation.z = damp(D.kg.rotation.z, steerIn * 0.06 * Math.min(1, D.spd / 20), 6, dt);
    animate(c, dt, 0);
  }
  update(dt) {
    const G = this.G, P = G.player, I = Input, D = P.data, run = this.state === 'run' || this.state === 'fin'; this.T += dt;
    const acc = run && !D.done && (I.down('jump') || I.down('use') || I.ax.my > 0.45 || I.down('confirm'));
    const brake = run && !D.done && (I.down('crouch') || I.down('alt') || I.down('zip') || I.ax.my < -0.45 || I.down('back'));
    this.drive(P, dt, acc || (D.done && D.spd < 12), brake, run ? I.ax.mx : 0);
    for (const b of this.racers) if (b !== P) {
      const B = b.data; if (B.maxK == null) B.maxK = 0.86 + b.skill * 0.12;
      const lead = P.data.prog - B.prog; B.maxK = clamp(0.86 + b.skill * 0.12 + clamp(lead / 400, -0.08, 0.1), 0.78, 1.04);
      const look = (B.i + 14) % this.N, tp = this.samp[look], tt = this.tan[look], n = new V3(tt.z, 0, -tt.x); if (Math.random() < 0.004) B.lane = (Math.random() - 0.5) * 7;
      const tx = tp.x + n.x * B.lane, tz = tp.z + n.z * B.lane; let want = Math.atan2(tx - B.x, tz - B.z), dy = Math.atan2(Math.sin(want - B.yaw), Math.cos(want - B.yaw));
      this.drive(b, dt, run, false, run ? clamp(-dy * 2.4, -1, 1) : 0);
    }
    // collisions entre karts
    for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) { const a = this.racers[i].data, b = this.racers[j].data, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 2.3 && d > 0.01) { const k = (2.3 - d) / 2; a.x -= dx / d * k; a.z -= dz / d * k; b.x += dx / d * k; b.z += dz / d * k; if (this.racers[i] === P || this.racers[j] === P) { if (!this._bump) { G.sfx('hit'); Input.rumble(0.3, 0.2, 80); } this._bump = 0.3; } } }
    this._bump = Math.max(0, (this._bump || 0) - dt);
    if (D.done && this.state === 'run') { this.state = 'fin'; const pl = this.order.indexOf(P) + 1; G.big(pl === 1 ? 'VICTOIRE !' : `${ord(pl)} place`, `${D.t.toFixed(1)} s`, 2.2); if (pl <= 3) G.bits.burst(new V3(D.x, 2, D.z), 50, ['#ff4d6d', '#ffd23d', '#7ddc4a', '#3d8bff'], 9); setTimeout(() => this.end(), 2400); }
    const sorted = [...this.racers].sort((a, b) => b.data.prog - a.data.prog), place = sorted.indexOf(P) + 1;
    G.board(sorted.map(c => ({ n: c === P ? 'Toi' : c.name, v: c.data.done ? `${c.data.t.toFixed(1)} s` : `Tour ${Math.min(this.laps, c.data.lap + 1)}`, me: c === P })));
    G.info(`🏎 ${ord(place)} / 6 · Tour ${Math.min(this.laps, D.lap + 1)}/${this.laps} · ${Math.round(Math.abs(D.spd) * 3.6)} km/h${D.boost > 0 ? ' · TURBO' : ''}`);
    if (run && !D.done) G.timer(this.T); else if (!run) G.timer(null);
    // caméra de poursuite
    const fwd = new V3(Math.sin(D.yaw), 0, Math.cos(D.yaw)), want = new V3(D.x, 0, D.z).addScaledVector(fwd, -8.5); want.y = 4.2 + Math.min(1.5, Math.abs(D.spd) / 25);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 6)); G.camera.position.copy(this.camPos); G.camera.lookAt(D.x + fwd.x * 5, 1.2, D.z + fwd.z * 5);
    G.camera.fov = damp(G.camera.fov, D.boost > 0 ? 74 : 62 + Math.abs(D.spd) * 0.15, 4, dt); G.camera.updateProjectionMatrix(); G.ocam.cur.set(D.x, 0, D.z);
  }
  end() {
    const G = this.G, P = G.player; if (this.state === 'end') return; this.state = 'end';
    const sorted = [...this.racers].sort((a, b) => b.data.prog - a.data.prog), place = sorted.indexOf(P) + 1;
    G.finish({ win: place === 1, place, coins: [90, 65, 50, 35, 28, 22][place - 1], title: place === 1 ? 'Victoire au Grand Prix !' : `${ord(place)} place`, best: +P.data.t.toFixed(1), low: true, bestTxt: `${P.data.t.toFixed(1)} s`, lines: [`Classement : <b>${ord(place)} sur 6</b>`, `Temps : <b>${P.data.t.toFixed(1)} s</b> pour ${this.laps} tours`], delay: 300 });
  }
  destroy() {
    const G = this.G, P = G.player; for (const c of this.racers) { const kg = c.data.kg; if (!kg) continue; kg.remove(c.av.group); G.scene.remove(kg); kg.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    P.sit = false; P.av.group.scale.setScalar(1); P.av.group.position.set(0, 0, 0); G.scene.add(P.av.group); G.camera.fov = 62; G.camera.updateProjectionMatrix(); G.touchLabels(null);
  }
}

/* ============================================================ */
/* 8. DÉFILÉ DE MODE                                             */
/* ============================================================ */
const THEMES = { plage: ['Plage', ['#ffd23d', '#2ec4b6', '#ff8a3d', '#ffffff', '#ff7ac8']], espace: ['Conquête spatiale', ['#1f2430', '#7a5cff', '#b8c0cc', '#3d8bff', '#ffffff']], pirate: ['Pirates', ['#1f2430', '#8a5a3c', '#ff4d6d', '#ffffff', '#ffd23d']], chic: ['Soirée chic', ['#1f2430', '#ffffff', '#d65cff', '#ffd23d', '#0f3a6e']], sport: ['Sportif', ['#3d8bff', '#ffffff', '#ff4d6d', '#7ddc4a', '#1f2430']], hiver: ['Grand froid', ['#ffffff', '#3d8bff', '#b8c0cc', '#0f3a6e', '#ff4d6d']], fantaisie: ['Monde enchanté', ['#ff7ac8', '#d65cff', '#ffd23d', '#7a5cff', '#2ec4b6']], robot: ['Robots', ['#b8c0cc', '#5b6270', '#2ec4b6', '#1f2430', '#ffffff']], foret: ['Forêt', ['#1e7a4a', '#7ddc4a', '#8a5a3c', '#ffd23d', '#5b6270']], retro: ['Rétro arcade', ['#ff4d6d', '#ffd23d', '#2ec4b6', '#ff8a3d', '#7a5cff']] };
function outfitScore(L, th) {
  const pal = THEMES[th][1]; let s = 0;
  for (const [tbl, k] of [[HATS, 'hat'], [BACKS, 'back'], [FACES, 'face'], [DECALS, 'decal']]) { const it = tbl[L[k]]; if (it && it[3] && it[3].includes(th)) s += 2; }
  for (const k of ['shirt', 'pants', 'shoes', 'hatC', 'backC']) if (pal.includes(L[k])) s += k === 'shirt' || k === 'pants' ? 1.2 : 0.6;
  if (L.shirt !== L.pants) s += 0.5; if (L.hat !== 'none') s += 0.3;
  return s; // ≈ 0 à 12
}
function themedLook(th, skill) {
  const L = randomLook(), pal = THEMES[th][1], pick = a => a[(Math.random() * a.length) | 0];
  for (const [tbl, k] of [[HATS, 'hat'], [BACKS, 'back'], [FACES, 'face'], [DECALS, 'decal']]) { const ok = Object.keys(tbl).filter(id => tbl[id][3] && tbl[id][3].includes(th)); if (ok.length && Math.random() < skill * 0.8) L[k] = pick(ok); }
  for (const k of ['shirt', 'pants', 'shoes', 'hatC', 'backC']) if (Math.random() < skill * 0.85) L[k] = pick(pal);
  return L;
}
export class Fashion {
  constructor(G) { this.G = G; }
  help() { return `<p>Un <b>thème</b> est tiré au sort. Tu as 60 secondes pour composer ta tenue : tous les objets sont disponibles pendant le défilé. Chapeaux, accessoires, visages et motifs liés au thème rapportent le plus, comme les couleurs de la palette. Pendant ton passage, appuie sur <b>▢ / clic</b> quand tu arrives dans la zone lumineuse au bout du podium : la pose parfaite rapporte des étoiles.</p>`; }
  start() {
    const G = this.G, W = G.world; G.setSky('#140a24', '#3a1a4a', '#7a2a5a', 0x1a0e2a, 40, 120); G.hemi.intensity = 1.05;
    this.theme = shuffle(Object.keys(THEMES))[0];
    top(W, 0, 0, 0, 60, 60, '#2a1a3a');
    top(W, 0, 1.2, 4, 4, 26, '#f4f4f4', {}, 1.2); top(W, 0, 1.24, 4, 3.2, 26, '#ff7ac8', {}, 0.1);
    top(W, 0, 1.2, -11, 12, 6, '#3a2a4a', {}, 1.2); W.add(0, 4, -14.5, 14, 8, 1, '#5a2a6a');
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) W.add(s * (5 + k * 1.6), 0.4 + k * 0.6, 4, 1.4, 0.8 + k * 1.2, 22, '#4a3a5a');
    // podium final
    [[0, 2.4, '#ffd23d'], [-3, 1.7, '#d8dde6'], [3, 1.2, '#e09a5a']].forEach(([x, h, c]) => top(W, x, h, 27, 2.8, 2.8, c, {}, h));
    W.build();
    this.zone = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, depthWrite: false })); this.zone.rotation.x = -Math.PI / 2; this.zone.position.set(0, 1.32, 14.6); W.group.add(this.zone);
    const sign = textSprite(`THÈME : ${THEMES[this.theme][0].toUpperCase()}`, 1.2, { size: 72, w: 1100, h: 140, color: '#ffe066', stroke: '#5a2050' }); sign.position.set(0, 7, -13.8); W.group.add(sign);
    if (G.quality !== 'low') { this.spots = [-1, 1].map(s => { const l = new THREE.SpotLight(s < 0 ? 0xff7ac8 : 0x7ad8ff, 60, 40, 0.5, 0.5, 1.2); l.position.set(s * 8, 12, 18); l.target.position.set(0, 1, 8); W.group.add(l, l.target); return l; }); }
    this.bots = G.makeBots(5); const P = G.player; this.models = [P, ...this.bots];
    this.bots.forEach((b, i) => { b.setLook(themedLook(this.theme, 0.35 + Math.random() * 0.6)); b.pos.set(-4 + i * 2, 1.2, -12.6); b.yaw = 0; b.sync(); });
    P.pos.set(0, 1.2, -9.4); P.yaw = 0; P.sync();
    // spectateurs
    this.crowd = []; const crowdN = G.quality === 'low' ? 6 : 12; for (let i = 0; i < crowdN; i++) { const s = i % 2 ? 1 : -1, k = (i >> 1) % 3, c = G.spawnChar(randomLook(), null, true); c.pos.set(s * (5 + k * 1.6), 0.8 + k * 1.2, -4 + ((i >> 1) / 3 | 0) * 4 + (k * 1.3)); c.yaw = -s * Math.PI / 2; c.sync(); this.crowd.push(c); }
    this.phase = 'dress'; this.left = 60; this.T = 0;
    G.touchLabels({ jump: null, attack: 'POSE', alt: null, interact: null, crouch: null });
    G.big(THEMES[this.theme][0], 'Compose ta tenue !', 2);
    this.camFront();
    setTimeout(() => this.dress(), 900);
  }
  camFront() { const C = this.G.camera; C.position.set(0, 5.2, 24); C.lookAt(0, 2, 2); }
  dress() {
    const G = this.G; if (G.mg !== this) return;
    const pal = THEMES[this.theme][1].map(c => `<span class="ck-sw" style="background:${c}"></span>`).join('');
    const w = G.openWardrobe({ free: true, look: JSON.parse(JSON.stringify(G.S.look)), kicker: 'DÉFILÉ · CABINE', title: `Thème : ${THEMES[this.theme][0]}`, extra: `<div style="font-size:12.5px;color:var(--mut);margin-bottom:8px">Palette du thème : ${pal}<br>Temps restant : <b class="ck-dl">60</b> s</div>`, done: '✓ Je suis prêt·e', onDone: L => { this.look = L; this.runway(); } });
    const dl = G.ui.el.querySelector('.ck-dl');
    G.ui.tick = dt => { this.left -= dt; dl.textContent = Math.max(0, Math.ceil(this.left)); if (this.left <= 0) w.close(true); };
  }
  runway() {
    const G = this.G; this.phase = 'show'; this.queue = shuffle([...this.models]); this.cur = -1; this.scores = new Map(); G.player.setLook(this.look);
    this.nextWalker();
  }
  nextWalker() {
    const G = this.G; this.cur++;
    if (this.cur >= this.queue.length) return this.podium();
    this.walker = this.queue[this.cur]; this.wt = 0; this.posed = 0; const w = this.walker; w.pos.set(0, 1.25, -9.5); w.yaw = 0; w.sync();
    G.big(w === G.player ? 'À toi !' : w.name, w === G.player ? 'Prends la pose dans la zone lumineuse' : '', 1.4);
  }
  podium() {
    const G = this.G; this.phase = 'podium'; this.T = 0;
    const rank = [...this.models].sort((a, b) => this.scores.get(b) - this.scores.get(a)); this.rank = rank;
    rank.slice(0, 3).forEach((c, i) => { const p = [[0, 2.4], [-3, 1.7], [3, 1.2]][i]; c.pos.set(p[0], p[1], 27); c.yaw = 0; c.pose = true; c.sync(); });
    rank.slice(3).forEach((c, i) => { c.pos.set(-6 + i * 2, 0, 29.4); c.yaw = Math.PI * 0; c.pose = false; c.sync(); });
    G.bits.burst(new V3(0, 5, 27), 70, ['#ff7ac8', '#ffd23d', '#7ad8ff', '#fff'], 10, 0.2, 1.8); G.sfx('win');
    const C = G.camera; C.position.set(0, 4.5, 38); C.lookAt(0, 2.6, 27);
    setTimeout(() => this.end(), 3000);
  }
  update(dt) {
    const G = this.G, P = G.player; this.T += dt;
    for (const c of this.crowd) { c.onGround = true; c.anim += dt; const p = c.av.parts; p.armL.rotation.x = p.armR.rotation.x = this.phase === 'show' && this.walker && this.wt > 2.4 && this.wt < 4 ? -2.6 + Math.sin(G.time * 12 + c.pos.x) * 0.4 : -0.2; }
    for (const c of this.models) if (c !== this.walker) { c.onGround = true; animate(c, dt, 0); }
    if (this.phase === 'show' && this.walker) {
      const w = this.walker; this.wt += dt; let z, sp = 3.6;
      if (this.wt < 3.2) z = -9.5 + this.wt / 3.2 * 24.5; else if (this.wt < 4.8) { z = 15; sp = 0; w.pose = true; } else { z = 15 - (this.wt - 4.8) / 2.6 * 24.5; sp = 3.6; w.pose = false; w.yaw = Math.PI; }
      w.pos.set(0, 1.25, z); w.onGround = true; animate(w, dt, sp); w.sync();
      if (this.wt > 2.6 && this.wt < 4.8 && Math.random() < dt * 6) G.bits.burst(new V3((Math.random() - 0.5) * 12, 3 + Math.random() * 2, 8 + Math.random() * 6), 2, '#ffffff', 1, 0.25, 0.25);
      this.zone.material.opacity = w === P ? 0.25 + Math.sin(G.time * 8) * 0.15 : 0.12;
      if (w === P && !this.posed && G.inp.act) { this.posed = z > 13.4 && z <= 15.2 ? 2 : 1; G.sfx(this.posed === 2 ? 'check' : 'pop'); G.big(this.posed === 2 ? 'Pose parfaite !' : 'Pose', this.posed === 2 ? '+ étoiles bonus' : 'un peu tôt…', 1); P.swing = 0.3; }
      if (w.bot && !this.posed && this.wt > 3.2 + Math.random()) this.posed = Math.random() < w.skill ? 2 : 1;
      if (this.wt > 7.4) {
        const base = outfitScore(w === P ? this.look : w.look, this.theme), sc = clamp(1 + base / 10 * 3.6 + (this.posed === 2 ? 0.55 : this.posed ? 0.15 : 0) + (Math.random() - 0.5) * 0.5, 1, 5);
        this.scores.set(w, sc); const st = textSprite('★'.repeat(Math.round(sc)) + '☆'.repeat(5 - Math.round(sc)), 0.5, { size: 70, w: 420, h: 96, color: '#ffd23d' }); st.position.y = 2.95; w.av.group.add(st);
        if (w === P) G.toast('Note du jury', `${sc.toFixed(1)} / 5`, '#ffd23d');
        w.pos.set(-4 + this.cur * 1.6, 1.2, -12.6); w.yaw = 0; w.sync(); this.nextWalker();
      }
      const C = G.camera, wp = this.walker ? this.walker.pos : new V3(); C.position.lerp(new V3(wp.x + 4.5, 3.8, Math.min(21, Math.max(-2, wp.z) + 8)), 1 - Math.exp(-dt * 3)); C.lookAt(wp.x, 2.3, wp.z);
    }
    if (this.phase === 'dress') this.camFront();
    if (this.phase === 'podium') { const C = G.camera; C.position.x = Math.sin(this.T * 0.5) * 3; C.lookAt(0, 2.6, 27); if (Math.random() < dt * 3) G.bits.burst(new V3((Math.random() - 0.5) * 8, 6, 27), 8, ['#ff7ac8', '#ffd23d', '#7ad8ff'], 4); }
    G.info(this.phase === 'show' ? `👗 ${THEMES[this.theme][0]} · passage ${Math.min(this.cur + 1, 6)} / 6` : `👗 Thème : ${THEMES[this.theme][0]}`);
    if (this.scores && this.scores.size) G.board([...this.scores].sort((a, b) => b[1] - a[1]).map(([c, s]) => ({ n: c === P ? 'Toi' : c.name, v: s.toFixed(1) + ' ★', me: c === P })));
  }
  end() {
    const G = this.G, P = G.player, place = this.rank.indexOf(P) + 1, sc = this.scores.get(P);
    G.finish({ win: place === 1, place, coins: [80, 55, 40, 28, 22, 20][place - 1], title: place === 1 ? 'Reine/roi du podium !' : `${ord(place)} place`, best: +sc.toFixed(1), bestTxt: `${sc.toFixed(1)} ★`, lines: [`Thème : <b>${THEMES[this.theme][0]}</b>`, `Ta note : <span class="ck-stars">${'★'.repeat(Math.round(sc))}${'☆'.repeat(5 - Math.round(sc))}</span> <b>${sc.toFixed(1)}</b>`, `Classement : <b>${ord(place)} sur 6</b>`], delay: 200 });
  }
  destroy() { const G = this.G, P = G.player; P.pose = false; P.setLook(G.S.look); for (const c of this.crowd || []) G.removeChar(c); G.hemi.intensity = 1.25; G.touchLabels(null); }
}

/* ============================================================ */
/* 9. GUERRE DES LITS                                            */
/* ============================================================ */
const TEAMS = [['Rouge', '#ff4d6d'], ['Bleu', '#3d8bff'], ['Vert', '#7ddc4a'], ['Jaune', '#ffd23d']];
const ISL = [[0, 16], [16, 0], [0, -16], [-16, 0]];
export class BedWars {
  constructor(G) { this.G = G; }
  help() { return `<p>Chaque équipe a une île et un <b>lit</b>. Tant que ton lit tient, tu réapparais après une chute ou un K.O. Ramasse le <b>fer</b> au générateur de ton île (et l’<b>or</b> au centre), achète des blocs et des épées chez le marchand (${'△'}), puis construis un pont avec <b>L2 / clic droit</b> (maintenir) pour aller casser les lits adverses (<b>▢ / clic</b>, 6 coups). Dernière équipe debout = victoire. Après 4 minutes, tous les lits tombent : mort subite !</p>`; }
  start() {
    const G = this.G, W = G.world; G.setSky('#3a7ad8', '#9ac8ff', '#ffe0c0', 0xa8c8f0, 60, 200);
    this.blocks = new Map(); this.T = 0;
    // îles (dalles)
    ISL.forEach(([x, z], t) => { W.add(x, -0.5, z, 8, 1, 8, '#e8e0d0'); W.add(x, -1.5, z, 6, 1, 6, '#8a5a3c'); W.add(x, -2.5, z, 4, 1, 4, '#6b4329'); });
    W.add(0, -0.5, 0, 6, 1, 6, '#b8c0cc'); W.add(0, -1.5, 0, 4, 1, 4, '#8a5a3c');
    for (let i = 0; i < 30; i++) W.add((Math.random() - 0.5) * 120, -20 - Math.random() * 20, (Math.random() - 0.5) * 120, 8, 2, 8, '#ffffff', { solid: false });
    W.build();
    this.im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), W.instMat, 1500); this.im.count = 0; this.im.frustumCulled = false; W.group.add(this.im); this.free = []; this.imN = 0;
    const P = G.player, bots = G.makeBots(3); this.all = [P, ...bots];
    this.teams = TEAMS.map(([n, c], t) => {
      const [ix, iz] = ISL[t], out = new V3(ix, 0, iz).normalize(), side = new V3(-out.z, 0, out.x);
      const bp = new V3(ix, 0, iz).addScaledVector(out, 2.4);
      const bed = [W.addLive(bp.x, 0.3, bp.z, out.x ? 2 : 1.2, 0.6, out.z ? 2 : 1.2, c), W.addLive(bp.x - out.x * 0.6, 0.65, bp.z - out.z * 0.6, out.x ? 0.7 : 1.1, 0.25, out.z ? 0.7 : 1.1, '#ffffff', { solid: false })];
      const gen = new V3(ix, 0, iz).addScaledVector(side, 2.6); const gm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), boxMat('#5b6270')); gm.position.copy(gen).setY(0.15); W.group.add(gm);
      const shop = new V3(ix, 0, iz).addScaledVector(side, -2.6);
      const member = this.all[t]; member.data = { team: t, hp: 20, iron: 0, gold: 0, blocks: 8, sword: 0, armor: 0, cd: 0, dead: false, resp: 0, kills: 0, lastHit: null, placeCd: 0, ai: { mode: 'gather', t: 0 } };
      if (member.bot) { member.setLook(Object.assign(member.look, { shirt: c })); }
      const lab = textSprite(`🛏 ${n}`, 0.32, { size: 60, w: 400, h: 100, bg: c, stroke: null }); lab.position.copy(bp).setY(2.4); W.group.add(lab);
      const ss = textSprite('🛒 Marchand', 0.45, { size: 56, w: 420, h: 100, bg: 'rgba(10,12,22,.75)', stroke: null }); ss.position.copy(shop).setY(2.9); W.group.add(ss);
      return { n, c, t, bed, bedHp: 6, bedAlive: true, bedPos: bp, gen, gm, stock: 0, shop, spawn: new V3(ix, 0.2, iz).addScaledVector(out, -1.2), member, out, lab };
    });
    // marchands
    this.merchants = this.teams.map(tm => { const m = G.spawnChar({ skin: '#eac096', shirt: '#8a5a3c', pants: '#1f2430', shoes: '#1f2430', hat: 'cowboy', hatC: '#5b3a22', back: 'none', backC: '#000', face: 'happy', decal: 'none' }, null, false); m.pos.copy(tm.shop); m.yaw = Math.atan2(-tm.out.x, -tm.out.z); m.sync(); return m; });
    this.center = { gen: new V3(0, 0, 0), stock: 0 }; const cg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), boxMat('#ffd23d')); cg.position.y = 0.15; W.group.add(cg);
    this.ingots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.2, 0.25), new THREE.MeshLambertMaterial({ color: 0xffffff }), 5); this.ingots.frustumCulled = false; W.group.add(this.ingots);
    for (const tm of this.teams) { tm.member.pos.copy(tm.spawn); tm.member.yaw = Math.atan2(-tm.out.x, -tm.out.z); tm.member.sync(); }
    G.ocam.yaw = Math.atan2(this.teams[0].out.x, this.teams[0].out.z); G.ocam.pitch = 0.45;
    this.flash = el('div'); this.flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px rgba(255,40,60,.7);opacity:0;transition:opacity .25s'; G.hud.root.appendChild(this.flash);
    G.touchLabels({ attack: 'FRAPPER', alt: 'BLOC', interact: 'BOUTIQUE', crouch: null });
    G.big('Protège ton lit !', 'Ramasse du fer, achète des blocs, construis un pont', 2.6); this.state = 'run';
  }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  cellFree(x, y, z) { return !this.blocks.has(this.key(x, y, z)) && !this.G.world.solidAt(x + 0.5, y + 0.5, z + 0.5); }
  place(c, x, y, z) {
    if (!this.cellFree(x, y, z) || y < -4 || y > 12) return false;
    for (const o of this.all) if (!o.data.dead && o.pos.x + o.r > x && o.pos.x - o.r < x + 1 && o.pos.z + o.r > z && o.pos.z - o.r < z + 1 && o.pos.y < y + 1 && o.pos.y + o.h > y) return false;
    const support = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([a, b, d]) => !this.cellFree(x + a, y + b, z + d));
    if (!support) return false;
    const col = this.teams[c.data.team].c, i = this.free.length ? this.free.pop() : this.imN++;
    if (i >= 1500) return false;
    const box = this.G.world.add(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, col, { visual: false });
    this.im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + 0.5, y + 0.5, z + 0.5)); this.im.setColorAt(i, new THREE.Color(col)); this.im.count = Math.max(this.im.count, i + 1); this.im.instanceMatrix.needsUpdate = true; this.im.instanceColor.needsUpdate = true;
    this.blocks.set(this.key(x, y, z), { box, i }); c.data.blocks--;
    if (c === this.G.player) this.G.sfx('place');
    return true;
  }
  tryPlace(c) {
    const f = Math.abs(Math.sin(c.yaw)) > Math.abs(Math.cos(c.yaw)) ? [Math.sign(Math.sin(c.yaw)), 0] : [0, Math.sign(Math.cos(c.yaw))];
    const fy = Math.round(c.pos.y) - 1, bx = Math.floor(c.pos.x + f[0] * 0.9), bz = Math.floor(c.pos.z + f[1] * 0.9);
    if (c.data.blocks <= 0) { if (c === this.G.player) { this.G.toast('Plus de blocs', 'Achète-en chez le marchand', '#ff8a3d'); this.G.sfx('nope'); } return false; }
    return this.place(c, bx, fy, bz) || this.place(c, bx, fy + 1, bz) || this.place(c, Math.floor(c.pos.x), fy, Math.floor(c.pos.z));
  }
  hit(a) {
    const G = this.G, A = a.data; if (A.cd > 0 || A.dead) return; A.cd = 0.38; a.swing = 0.3;
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw); let best = null, bd = 2.7;
    for (const o of this.all) { if (o === a || o.data.dead || o.data.team === A.team) continue; const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz); if (d < bd && Math.abs(o.pos.y - a.pos.y) < 2 && (d < 1 || (dx * fx + dz * fz) / d > 0.1)) { bd = d; best = o; } }
    if (best) { const dmg = (2 + A.sword * 1.5) * (best.data.armor ? 0.65 : 1), dir = new V3(best.pos.x - a.pos.x, 0, best.pos.z - a.pos.z).normalize(); best.data.hp -= dmg; best.data.lastHit = a; best.data.lastT = this.T; best.knock = new V3(dir.x * 8, 6, dir.z * 8); G.bits.burst(best.pos.clone().setY(best.pos.y + 1.3), 8, '#ff4d6d', 4); G.sfx('hit'); if (best === G.player) { Input.rumble(0.6, 0.4, 120); this.flash.style.opacity = 1; setTimeout(() => this.flash.style.opacity = 0, 160); } if (best.data.hp <= 0) this.die(best, a); return; }
    for (const tm of this.teams) { if (!tm.bedAlive || tm.t === A.team) continue; if (Math.hypot(tm.bedPos.x - a.pos.x, tm.bedPos.z - a.pos.z) < 2.6 && Math.abs(a.pos.y - 0) < 2.5) { tm.bedHp--; G.bits.burst(tm.bedPos.clone().setY(0.8), 10, tm.c, 4); G.sfx('break'); if (tm.bedHp <= 0) this.breakBed(tm, a); return; } }
  }
  breakBed(tm, by) { const G = this.G; tm.bedAlive = false; for (const b of tm.bed) G.world.remove(b); G.world.group.remove(tm.lab); G.bits.burst(tm.bedPos.clone().setY(0.6), 40, [tm.c, '#fff'], 7); G.sfx('boom'); G.big(`Lit ${tm.n} détruit !`, by ? (by === G.player ? 'Bien joué !' : `par ${by.name}`) : 'Mort subite', 2); if (tm.member === G.player) { Input.rumble(0.8, 0.6, 400); } }
  die(c, by) {
    const G = this.G, D = c.data; if (D.dead) return; D.dead = true; c.av.group.visible = false; G.bits.burst(c.pos.clone().setY(c.pos.y + 1), 20, [this.teams[D.team].c, '#fff'], 6);
    const killer = by || (D.lastHit && this.T - D.lastT < 6 ? D.lastHit : null); if (killer && killer !== c) killer.data.kills++;
    const tm = this.teams[D.team]; D.final = !tm.bedAlive; D.resp = 4; D.iron = Math.floor(D.iron / 2); D.gold = 0;
    if (c === G.player) { G.sfx('die'); G.big(D.final ? 'Éliminé !' : 'K.O. !', D.final ? 'Ton lit n’existe plus' : 'Réapparition dans 4 s', 2); }
    else if (killer === G.player) G.toast(D.final ? 'Élimination finale !' : 'K.O. !', c.name, '#ff4d6d');
  }
  update(dt) {
    const G = this.G, P = G.player, I = Input; this.T += dt;
    if (this.T > 240 && !this.sudden) { this.sudden = true; for (const tm of this.teams) if (tm.bedAlive) this.breakBed(tm, null); G.big('MORT SUBITE', 'Tous les lits sont tombés', 2.4); }
    // générateurs
    for (const tm of this.teams) { tm.genT = (tm.genT || 0) + dt; if (tm.genT > 1.1 && tm.stock < 30) { tm.genT = 0; tm.stock++; } }
    this.center.t = (this.center.t || 0) + dt; if (this.center.t > 4 && this.center.stock < 8) { this.center.t = 0; this.center.stock++; }
    const m4 = new THREE.Matrix4(); let n = 0; for (const tm of this.teams) if (tm.stock > 0 && n < 5) { m4.makeTranslation(tm.gen.x, 0.5 + Math.sin(this.T * 3) * 0.1, tm.gen.z); this.ingots.setMatrixAt(n, m4); this.ingots.setColorAt(n, new THREE.Color('#d8dde6')); n++; }
    if (this.center.stock > 0 && n < 5) { m4.makeTranslation(0, 0.5 + Math.sin(this.T * 3) * 0.1, 0); this.ingots.setMatrixAt(n, m4); this.ingots.setColorAt(n, new THREE.Color('#ffd23d')); n++; } this.ingots.count = n; this.ingots.instanceMatrix.needsUpdate = true; if (this.ingots.instanceColor) this.ingots.instanceColor.needsUpdate = true;
    // joueur
    const D = P.data;
    if (!D.dead) {
      G.ctlPlayer(dt);
      if (G.inp.act) this.hit(P);
      D.placeCd -= dt; if ((I.down('alt') || I.down('zip')) && D.placeCd <= 0) { if (this.tryPlace(P)) D.placeCd = 0.17; else D.placeCd = 0.12; }
      const tm = this.teams[D.team];
      let pr = ''; if (Math.hypot(P.pos.x - tm.shop.x, P.pos.z - tm.shop.z) < 2.6) { pr = '<i class="g g-t">△</i> Marchand'; if (G.inp.inter) this.openShop(); }
      G.prompt(pr);
    } else G.prompt('');
    for (const b of this.all) if (b !== P) this.botThink(b, dt);
    // ramassage, chute, réapparition
    for (const c of this.all) {
      const C = c.data; C.cd -= dt;
      if (C.dead) { if (!C.final) { C.resp -= dt; if (C.resp <= 0) { const tm = this.teams[C.team]; C.dead = false; C.hp = 20; c.pos.copy(tm.spawn); c.vel.set(0, 0, 0); c.av.group.visible = true; if (c === P) G.big('De retour !', '', 1); } } continue; }
      const tm = this.teams[C.team]; if (tm.stock > 0 && Math.hypot(c.pos.x - tm.gen.x, c.pos.z - tm.gen.z) < 1.6 && Math.abs(c.pos.y) < 1) { C.iron += tm.stock; tm.stock = 0; if (c === P) G.sfx('coin'); }
      if (this.center.stock > 0 && Math.hypot(c.pos.x, c.pos.z) < 1.6 && Math.abs(c.pos.y) < 1) { C.gold += this.center.stock; this.center.stock = 0; if (c === P) G.sfx('coin'); }
      if (c.pos.y < -16) this.die(c, null);
      if (C.hp < 20 && C.lastT && this.T - C.lastT > 5) C.hp = Math.min(20, C.hp + dt * 0.8);
    }
    // victoire ?
    const alive = this.teams.filter(tm => !tm.member.data.dead || !tm.member.data.final);
    if (this.state === 'run' && (alive.length <= 1 || (D.dead && D.final) || this.T > 360)) this.end();
    G.info(D.dead ? (D.final ? '💀 Éliminé' : `Réapparition dans ${Math.ceil(D.resp)} s`) : `❤ ${Math.ceil(D.hp)}/20 · ⛓ ${D.iron} fer · ✦ ${D.gold} or · ▣ ${D.blocks} blocs${D.sword ? ' · ⚔' + ['', ' pierre', ' cristal'][D.sword] : ''}${D.armor ? ' · 🛡' : ''}`);
    G.timer(this.T < 240 ? 240 - this.T : 360 - this.T);
    G.board(this.teams.map(tm => ({ n: `${tm.member === P ? 'Toi' : tm.member.name} (${tm.n})`, v: `${tm.bedAlive ? '🛏' : '✗'} ${tm.member.data.kills}☠`, me: tm.member === P, out: tm.member.data.dead && tm.member.data.final })));
    if (!D.dead) G.updateCam(dt, { dist: 8 }); else G.ocam.update(dt, null, { x: dt * 0.2, y: 0 }, new V3(0, 2, 0), { dist: 36 });
  }
  openShop() {
    const G = this.G, D = G.player.data; G.exitLock();
    const ov = el('div', 'gmenu'); ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">GUERRE DES LITS · MARCHAND</div><h2>⛓ ${D.iron} fer · ✦ ${D.gold} or</h2><div class="gm-list"></div><div class="gm-foot"><i class="g g-o">○</i> Fermer</div></div>`; G.root.appendChild(ov);
    const close = () => { ov.remove(); G.ui = null; G.last = performance.now(); };
    const h2 = ov.querySelector('h2'), upd = () => { h2.textContent = `⛓ ${D.iron} fer · ✦ ${D.gold} or`; };
    const buy = (cost, cur, fn) => () => { if (D[cur] < cost) { G.sfx('nope'); return; } D[cur] -= cost; fn(); G.sfx('buy'); upd(); };
    const list = new ListMenu(ov.querySelector('.gm-list'), [
      { label: '▣ 16 blocs', sub: 'Pour construire des ponts et protéger ton lit', get: () => '4 fer', disabled: () => D.iron < 4, act: buy(4, 'iron', () => D.blocks += 16) },
      { label: '⚔ Épée de pierre', sub: 'Dégâts +75 %', get: () => D.sword >= 1 ? '✓' : '10 fer', disabled: () => D.sword >= 1 || D.iron < 10, act: buy(10, 'iron', () => D.sword = 1) },
      { label: '🛡 Armure', sub: 'Encaisse 35 % de dégâts en moins', get: () => D.armor ? '✓' : '14 fer', disabled: () => D.armor || D.iron < 14, act: buy(14, 'iron', () => D.armor = 1) },
      { label: '⚔ Épée de cristal', sub: 'Dégâts ×2,5', get: () => D.sword >= 2 ? '✓' : '4 or', disabled: () => D.sword >= 2 || D.gold < 4, act: buy(4, 'gold', () => D.sword = 2) },
      { label: '🍎 Pomme dorée', sub: 'Soigne entièrement', get: () => '2 or', disabled: () => D.gold < 2, act: buy(2, 'gold', () => D.hp = 20) },
      { label: 'Fermer', cls: 'exit', act: close }]);
    G.ui = { update: nav => { list.update(nav); if (G.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  botThink(b, dt) {
    const G = this.G, D = b.data, A = D.ai, W = G.world; if (D.dead) return;
    const tm = this.teams[D.team]; A.t -= dt;
    // achats automatiques près du marchand
    if (Math.hypot(b.pos.x - tm.shop.x, b.pos.z - tm.shop.z) < 2.8) { if (D.iron >= 10 && !D.sword) { D.iron -= 10; D.sword = 1; } while (D.iron >= 4 && D.blocks < 40) { D.iron -= 4; D.blocks += 16; } if (D.iron >= 14 && !D.armor) { D.iron -= 14; D.armor = 1; } if (D.gold >= 4 && D.sword < 2) { D.gold -= 4; D.sword = 2; } }
    // ennemi proche ?
    let foe = null, fd = 7 * (0.7 + b.skill * 0.5); for (const o of this.all) { if (o === b || o.data.dead || o.data.team === D.team) continue; const d = o.pos.distanceTo(b.pos); if (d < fd && Math.abs(o.pos.y - b.pos.y) < 2.5) { fd = d; foe = o; } }
    let goal = null, mode = A.mode;
    if (A.t <= 0) { A.t = 1.5; if (D.blocks < 10) mode = D.iron >= 4 ? 'shop' : 'gather'; else mode = this.T > 25 + b.skill * 20 || D.blocks > 24 ? 'attack' : (D.iron < 14 ? 'gather' : 'shop'); A.mode = mode; }
    if (foe) { goal = foe.pos; if (fd < 2.3 && Math.random() < dt * (2 + b.skill * 3)) this.hit(b); }
    else if (mode === 'gather') goal = tm.gen; else if (mode === 'shop') goal = tm.shop;
    else { const tgt = this.teams.filter(t => t.t !== D.team && (t.bedAlive || !t.member.data.dead)).sort((a, c) => a.bedPos.distanceTo(b.pos) - c.bedPos.distanceTo(b.pos))[0]; if (!tgt) goal = tm.spawn; else { A.tgt = tgt; goal = tgt.bedAlive ? tgt.bedPos : tgt.member.pos; if (tgt.bedAlive && Math.hypot(b.pos.x - tgt.bedPos.x, b.pos.z - tgt.bedPos.z) < 2.3 && Math.random() < dt * (2 + b.skill * 3)) this.hit(b); } }
    let mv = new V3();
    if (goal) {
      const dx = goal.x - b.pos.x, dz = goal.z - b.pos.z;
      // déplacement en « L » pour des ponts droits
      if (Math.abs(dx) > 0.6 && (Math.abs(dx) >= Math.abs(dz) || Math.abs(dz) < 0.6)) mv.set(Math.sign(dx), 0, 0); else if (Math.abs(dz) > 0.6) mv.set(0, 0, Math.sign(dz));
      if (Math.hypot(dx, dz) < 1.4) mv.set(0, 0, 0);
      if (mv.lengthSq() && b.onGround) {
        const nx = b.pos.x + mv.x * 0.75, nz = b.pos.z + mv.z * 0.75, gb = W.groundBelow(nx, nz, b.pos.y + 0.1, 0.02);
        if (!gb || b.pos.y - gb.y > 1.2) { b.yaw = Math.atan2(mv.x, mv.z); D.placeCd -= dt; if (D.blocks > 0) { if (D.placeCd <= 0) { D.placeCd = 0.32 - b.skill * 0.1; this.tryPlace(b); } mv.multiplyScalar(0); } else { mv.multiplyScalar(0); A.mode = 'gather'; } }
      }
    }
    const jump = b.onGround && mv.lengthSq() > 0 && W.solidAt(b.pos.x + mv.x * 0.8, b.pos.y + 0.5, b.pos.z + mv.z * 0.8) ? true : false;
    G.moveBot(b, dt, mv, jump, { speed: RUN * 0.82, noTurn: mv.lengthSq() === 0 });
  }
  end() {
    if (this.state === 'end') return; this.state = 'end'; const G = this.G, P = G.player, D = P.data;
    const alive = this.teams.filter(tm => !tm.member.data.dead || !tm.member.data.final);
    const win = !(D.dead && D.final) && (alive.length === 1 || (this.T > 360 && D.kills >= Math.max(...this.all.map(c => c.data.kills))));
    const beds = this.teams.filter(tm => !tm.bedAlive && tm.t !== D.team).length, place = win ? 1 : 1 + alive.filter(tm => tm.member !== P).length;
    G.finish({ win, place, coins: (win ? 70 : 20) + D.kills * 8 + beds * 10, title: win ? 'Dernière équipe debout !' : 'Éliminé', best: D.kills, bestTxt: `${D.kills} K.O.`, lines: [`K.O. : <b>${D.kills}</b>`, `Lits adverses tombés : <b>${beds}</b>`, `Durée : <b>${Math.floor(this.T / 60)} min ${String(Math.floor(this.T % 60)).padStart(2, '0')}</b>`], delay: 1200 });
  }
  destroy() { const G = this.G, P = G.player; P.av.group.visible = true; for (const m of this.merchants || []) G.removeChar(m); G.touchLabels(null); G.prompt(''); }
}

/* ============================================================ */
/* 10. LE MANOIR MYSTÈRE                                         */
/* ============================================================ */
const ATTR = {
  hat: { n: 'Chapeau', v: { tophat: 'haut-de-forme', cowboy: 'chapeau de ranch', beanie: 'bonnet', cap: 'casquette', none: 'aucun chapeau' } },
  shirt: { n: 'Haut', v: { '#ff4d6d': 'rouge', '#3d8bff': 'bleu', '#7ddc4a': 'vert', '#ffd23d': 'jaune', '#7a5cff': 'violet' } },
  back: { n: 'Dans le dos', v: { cape: 'une cape', bag: 'un sac à dos', scarf: 'une écharpe', none: 'rien' } },
  shoes: { n: 'Chaussures', v: { '#ffffff': 'blanches', '#1f2430': 'noires', '#ff8a3d': 'orange' } },
};
const CLUE_TXT = {
  hat: { tophat: 'Un ruban de haut-de-forme coincé dans la vitrine', cowboy: 'Un brin de paille tressée, comme sur un chapeau de ranch', beanie: 'Un pompon de laine tombé d’un bonnet', cap: 'Un morceau de visière de casquette', none: 'Le voleur ne portait pas de chapeau : le lustre bas n’a pas été touché' },
  shirt: c => `Un fil ${ATTR.shirt.v[c]} accroché à la poignée de la vitrine`,
  back: { cape: 'Un lambeau de tissu de cape près de la fenêtre', bag: 'Une boucle de bretelle de sac à dos', scarf: 'Une maille d’écharpe sur le buffet', none: 'Rien dans le dos : le passage étroit derrière la bibliothèque a été franchi sans frotter' },
  shoes: c => `Une empreinte de chaussure ${ATTR.shoes.v[c]} dans la terre du jardin d’hiver`,
};
const MROOMS = [['Grand salon', -12.6, -7, '#c8a078'], ['Bibliothèque', 0, -7, '#8a6a4a'], ['Cuisine', 12.6, -7, '#cfe6ef'], ['Salle de bal', -12.6, 7, '#e0c8ef'], ['Galerie', 0, 7, '#d8d0c0'], ['Jardin d’hiver', 12.6, 7, '#b8e0a8']];
export class Mystery {
  constructor(G) { this.G = G; }
  help() { return `<p>L’<b>Étoile de Cristal</b> a été volée. Fouille les pièces : les <b>indices brillants</b> décrivent le voleur (chapeau, couleur du haut, accessoire dans le dos, chaussures). <b>Parle</b> aux invités (${'△'}) : les innocents disent la vérité. Ouvre ton <b>carnet</b> (${'Pavé / M'}) : les suspects qui ne collent pas aux indices sont barrés. Quand tu es sûr·e, <b>accuse</b> ! Tu as droit à deux erreurs.</p>`; }
  start() {
    const G = this.G, W = G.world, r = Math.random; G.setSky('#0e0a24', '#2a1a4a', '#5a3a6a', 0x1a1230, 40, 140); G.hemi.intensity = 0.95;
    top(W, 0, 0, 0, 90, 90, '#2f4a2a'); top(W, 0, 0.1, 0, 38, 28, '#5a3a2a', {}, 0.2);
    const H = 4.4, wall = (x, z, w, d, c = '#e8dcc8') => W.add(x, H / 2 + 0.1, z, w, H, d, c);
    wall(0, -14, 38, 0.5); wall(-10.25, 14, 17.5, 0.5); wall(10.25, 14, 17.5, 0.5); wall(-19, 0, 0.5, 28); wall(19, 0, 0.5, 28);
    for (const x of [-6.3, 6.3]) { wall(x, -11.1, 0.4, 5.8); wall(x, -2.9, 0.4, 5.8); wall(x, 2.9, 0.4, 5.8); wall(x, 11.1, 0.4, 5.8); }
    for (const cx of [-12.6, 0, 12.6]) { wall(cx - 4.1, 0, 4.4, 0.4); wall(cx + 4.1, 0, 4.4, 0.4); }
    W.add(0, H + 0.4, 0, 38.6, 0.4, 28.6, '#000', { visual: false, noCam: true });
    this.spots = [];
    MROOMS.forEach(([n, cx, cz, col], ri) => {
      top(W, cx, 0.22, cz, 12.2, 13.4, col, {}, 0.1);
      const s = textSprite(n, 0.45, { size: 56, w: 460, h: 100, bg: 'rgba(10,8,22,.65)', stroke: null }); s.position.set(cx, 3.9, cz); W.group.add(s);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], k) => { const fx = cx + sx * 4.2, fz = cz + sz * 4.6; const tall = (ri + k) % 2 === 0; W.add(fx, tall ? 1.4 : 0.6, fz, tall ? 1.4 : 2.2, tall ? 2.6 : 1, tall ? 1 : 1.2, ['#5a3a22', '#8a5a3c', '#3a2a4a', '#5b6270'][k]); this.spots.push(new V3(cx + sx * 2.4, 0.3, cz + sz * 3.0)); });
      W.add(cx, 0.55, cz, 2.8, 0.15, 1.8, '#5a3a22'); W.add(cx, 0.28, cz, 0.3, 0.5, 0.3, '#3a2214');
      if (ri === 4) { W.add(cx, 0.7, cz - 4.2, 1.4, 1.2, 1.4, '#ffffff'); this.vitrine = new V3(cx, 0, cz - 4.2); }
    });
    W.build();
    // lustres lumineux
    if (G.quality !== 'low') for (const [, cx, cz] of MROOMS.filter((_, i) => i % 2 === 0)) { const l = new THREE.PointLight(0xffd8a0, 18, 18, 1.6); l.position.set(cx, 3.6, cz); W.group.add(l); }
    // invités
    const hats = Object.keys(ATTR.hat.v), shirts = Object.keys(ATTR.shirt.v), backs = Object.keys(ATTR.back.v), shoes = Object.keys(ATTR.shoes.v), used = new Set();
    this.guests = G.makeBots(6);
    this.guests.forEach((g, i) => {
      let a; do { a = { hat: hats[(r() * hats.length) | 0], shirt: shirts[(r() * shirts.length) | 0], back: backs[(r() * backs.length) | 0], shoes: shoes[(r() * shoes.length) | 0] }; } while (used.has(JSON.stringify(a))); used.add(JSON.stringify(a));
      g.attr = a; g.setLook(Object.assign(randomLook(), { hat: a.hat, hatC: a.hat === 'tophat' ? '#1f2430' : '#8a5a3c', shirt: a.shirt, back: a.back, backC: '#5a2a6a', shoes: a.shoes, pants: '#2a2e38', decal: 'none' }));
      const rm = MROOMS[i % 6]; g.pos.set(rm[1] + (r() - 0.5) * 4, 0.3, rm[2] + (r() - 0.5) * 4); g.data = { goal: null, t: r() * 4, cleared: false, talked: false, accused: false };
    });
    this.thief = this.guests[(r() * 6) | 0];
    // indices : on réduit jusqu'à un seul suspect
    const T = this.thief.attr, facts = [];
    for (const k of Object.keys(ATTR)) { facts.push({ k, v: T[k], neg: false }); for (const v of Object.keys(ATTR[k].v)) if (v !== T[k] && this.guests.some(g => g.attr[k] === v)) facts.push({ k, v, neg: true }); }
    const ok = (g, f) => f.neg ? g.attr[f.k] !== f.v : g.attr[f.k] === f.v;
    let rem = [...this.guests], chosen = [], pool = shuffle(facts.filter(f => !f.neg)).concat(shuffle(facts.filter(f => f.neg)));
    while (rem.length > 1 && pool.length) { pool.sort((a, b) => rem.filter(g => ok(g, a)).length - rem.filter(g => ok(g, b)).length + (Math.random() - 0.5) * 0.8); const f = pool.shift(); if (rem.filter(g => ok(g, f)).length === rem.length) continue; chosen.push(f); rem = rem.filter(g => ok(g, f)); }
    while (chosen.length < 4) { const f = facts.find(x => !chosen.includes(x) && !x.neg) || facts.find(x => !chosen.includes(x)); if (!f) break; chosen.push(f); }
    this.facts = chosen; this.known = [];
    // la moitié des indices est physique, le reste vient des témoins
    const phys = chosen.filter((_, i) => i % 3 !== 2), told = chosen.filter((_, i) => i % 3 === 2);
    const spots = shuffle([...this.spots]);
    this.clues = phys.map((f, i) => { const p = spots[i]; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xfff0a0 })); m.position.set(p.x, 0.9, p.z); W.group.add(m); return { f, m, found: false, p }; });
    const innocents = shuffle(this.guests.filter(g => g !== this.thief));
    innocents.forEach((g, i) => { if (told[i]) g.data.say = { fact: told[i] }; else { const other = innocents[(i + 1) % innocents.length]; g.data.say = { clear: other }; } });
    this.thief.data.say = { lie: true };
    const P = G.player; P.pos.set(0, 0.3, 12.5); P.yaw = Math.PI; G.ocam.yaw = 0; G.ocam.pitch = 0.45;
    this.T = 0; this.limit = 240; this.wrong = 0; this.state = 'run';
    G.touchLabels({ attack: 'CARNET', alt: null, interact: 'PARLER', crouch: null });
    G.big('L’Étoile de Cristal a disparu !', 'Trouve les indices et démasque le voleur', 2.8);
  }
  factText(f) { const a = ATTR[f.k]; if (f.neg) return `Le voleur n’avait pas ${f.k === 'hat' ? 'de ' + a.v[f.v] : f.k === 'back' ? a.v[f.v] + ' dans le dos' : f.k === 'shirt' ? 'de haut ' + a.v[f.v] : 'de chaussures ' + a.v[f.v]}`; const t = CLUE_TXT[f.k]; return typeof t === 'function' ? t(f.v) : t[f.v]; }
  learn(f, src) { if (this.known.includes(f)) return; this.known.push(f); this.G.toast('Nouvel indice', src, '#d65cff'); this.G.sfx('check'); }
  suspects() { return this.guests.filter(g => !g.data.cleared && this.known.every(f => f.neg ? g.attr[f.k] !== f.v : g.attr[f.k] === f.v)); }
  update(dt) {
    const G = this.G, P = G.player; this.T += dt; const run = this.state === 'run';
    G.ctlPlayer(dt, { noMove: !run });
    for (const c of this.clues) { if (c.found) continue; c.m.rotation.y += dt * 2; c.m.position.y = 0.9 + Math.sin(G.time * 3 + c.p.x) * 0.12; if (P.pos.distanceTo(c.p) < 1.6 && run) { c.found = true; c.m.visible = false; G.bits.burst(c.m.position, 18, ['#fff0a0', '#d65cff'], 4); this.learn(c.f, this.factText(c.f)); } }
    // invités
    let near = null, nd = 2.4;
    for (const g of this.guests) {
      const D = g.data, d = g.pos.distanceTo(P.pos); if (d < nd) { nd = d; near = g; }
      if (d < 3) { g.yaw = Math.atan2(P.pos.x - g.pos.x, P.pos.z - g.pos.z); G.moveBot(g, dt, new V3(), false, { noTurn: true }); continue; }
      D.t -= dt; if (D.t <= 0 || !D.goal) { D.goal = this.spots[(Math.random() * this.spots.length) | 0].clone(); D.t = 6 + Math.random() * 8; }
      const nt = navTarget(g.pos, D.goal); let mv = steer(g, nt.x, nt.z, 0.6).multiplyScalar(0.45);
      if (g.hitWall) { g.hitWall = null; mv.applyAxisAngle(new V3(0, 1, 0), 1.2); }
      G.moveBot(g, dt, mv, false);
    }
    G.prompt(near && run ? `<i class="g g-t">△</i> Parler à ${near.name}` : '');
    if (run && near && G.inp.inter) this.talk(near);
    if (run && (G.inp.act || Input.pressed('map'))) this.notebook();
    if (run) { G.timer(this.limit - this.T); if (this.T > this.limit) this.end(false, 'Le voleur s’est enfui avec l’Étoile…'); }
    const sus = this.suspects().length;
    G.info(`🔎 Indices ${this.known.length} · suspects possibles ${sus} · erreurs ${this.wrong}/2`);
    G.board(this.guests.map(g => ({ n: g.name, v: this.suspects().includes(g) ? '?' : '✗', out: !this.suspects().includes(g) })));
    G.updateCam(dt, { dist: 6.5 });
  }
  desc(g) { const a = g.attr; return `${ATTR.hat.v[a.hat]} · haut ${ATTR.shirt.v[a.shirt]} · ${ATTR.back.v[a.back]} dans le dos · chaussures ${ATTR.shoes.v[a.shoes]}`; }
  talk(g) {
    const G = this.G, D = g.data; G.exitLock();
    let line;
    if (D.say.fact) { line = `« J’ai aperçu quelqu’un filer près de la vitrine… ${this.factText(D.say.fact).replace(/^Le voleur/, 'Cette personne')}. »`; this.learn(D.say.fact, `Témoignage de ${g.name}`); }
    else if (D.say.clear) { line = `« Ce n’est pas ${D.say.clear.name}, nous étions ensemble au buffet tout le temps. »`; if (!D.say.clear.data.cleared) { D.say.clear.data.cleared = true; G.toast(`${D.say.clear.name} innocenté·e`, `selon ${g.name}`, '#7dffb0'); } }
    else line = `« Moi ? Je n’ai rien vu, j’étais… euh… aux toilettes. Vous devriez fouiller la cuisine. »`;
    const ov = el('div', 'gmenu'); ov.innerHTML = `<div class="gmenu-panel glass"><div class="gm-kicker">MANOIR MYSTÈRE · ${g.name.toUpperCase()}</div><h2>${g.name}</h2><p style="font-size:15px;line-height:1.6;margin:0 0 6px">${line}</p><small style="color:var(--mut);display:block;margin-bottom:10px">${this.desc(g)}</small><div class="gm-list"></div></div>`; G.root.appendChild(ov);
    const close = () => { ov.remove(); G.ui = null; G.last = performance.now(); };
    const list = new ListMenu(ov.querySelector('.gm-list'), [{ label: 'Merci, au revoir', act: close }, { label: `☝ Accuser ${g.name}`, cls: 'exit', disabled: () => D.accused, act: () => { close(); this.accuse(g); } }, { label: '📓 Ouvrir le carnet', act: () => { close(); this.notebook(); } }]);
    G.ui = { update: nav => { list.update(nav); if (G.ui && (Input.pressed('back') || Input.pressed('pause'))) close(); } };
  }
  notebook() {
    const G = this.G; G.exitLock(); const sus = this.suspects();
    const ov = el('div', 'gmenu'); ov.innerHTML = `<div class="gmenu-panel glass" style="width:min(720px,94vw)"><div class="gm-kicker">MANOIR MYSTÈRE · CARNET</div><h2>Indices (${this.known.length})</h2><ul class="ck-notes">${this.known.length ? this.known.map(f => `<li>${this.factText(f)}</li>`).join('') : '<li style="opacity:.6">Aucun indice pour l’instant : fouille les pièces et parle aux invités.</li>'}</ul><h2 style="font-size:20px;margin-top:10px">Invités</h2><ul class="ck-notes">${this.guests.map(g => `<li class="${sus.includes(g) ? '' : 'x'}"><b>${g.name}</b> : ${this.desc(g)}${g.data.cleared ? ' (innocenté·e)' : ''}</li>`).join('')}</ul><div class="gm-list"></div></div>`; G.root.appendChild(ov);
    const close = () => { ov.remove(); G.ui = null; G.last = performance.now(); };
    const list = new ListMenu(ov.querySelector('.gm-list'), [{ label: 'Fermer le carnet', act: close }]);
    G.ui = { update: nav => { list.update(nav); if (G.ui && (Input.pressed('back') || Input.pressed('pause') || Input.pressed('map'))) close(); } };
  }
  async accuse(g) {
    const G = this.G; if (!(await Modal.confirm(`Accuser ${g.name} ?`, this.desc(g), { yes: 'Accuser', danger: true }))) return;
    if (g === this.thief) { G.bits.burst(g.pos.clone().setY(2), 50, ['#d65cff', '#fff0a0', '#fff'], 8); this.end(true); }
    else { this.wrong++; g.data.accused = true; g.data.cleared = true; G.sfx('fail'); G.big('Ce n’est pas moi !', `${g.name} est innocent·e`, 1.8); if (this.wrong > 2) this.end(false, 'Trop d’erreurs : le voleur en a profité pour filer.'); }
  }
  end(win, why) {
    if (this.state === 'end') return; this.state = 'end'; const G = this.G;
    const tb = Math.max(0, Math.round((this.limit - this.T) / 8));
    G.finish({ win, coins: win ? 60 + tb + (2 - this.wrong) * 10 : 10 + this.known.length * 5, title: win ? 'Affaire résolue !' : 'Affaire classée…', best: win ? +this.T.toFixed(0) : null, low: true, bestTxt: win ? `${this.T.toFixed(0)} s` : null, lines: [win ? `<b>${this.thief.name}</b> avait l’Étoile de Cristal dans la poche !` : (why || ''), `Le voleur : <b>${this.thief.name}</b> (${this.desc(this.thief)})`, `Indices trouvés : <b>${this.known.length}</b> · erreurs : <b>${this.wrong}</b>`], delay: 900 });
  }
  destroy() { this.G.hemi.intensity = 1.25; this.G.touchLabels(null); this.G.prompt(''); }
}
