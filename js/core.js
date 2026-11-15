// NOVA — cœur partagé : entrées (manette / clavier / tactile), audio, sauvegardes, menus
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
export function fmtDuration(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min`;
  return `${sec % 60} s`;
}
export function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
export function timeAgo(ts) {
  if (!ts) return 'jamais';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  return `il y a ${Math.floor(d / 86400)} j`;
}
export const isTV = /Android TV|AFT|BRAVIA|GoogleTV|Chromecast|CrKey|SmartTV|Tizen|Web0S/i.test(navigator.userAgent);
export const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && !isTV;

/* ------------------------------------------------------------------ */
/* Sauvegardes : local (toujours) + cloud Claude (si dispo) + code     */
/* ------------------------------------------------------------------ */
const LS_KEY = 'nova.v1';
const defaults = () => ({
  v: 1,
  profile: { name: 'Raphael', avatar: 0 },
  settings: { quality: 'auto', sens: 1, invertY: false, music: 0.45, sfx: 0.8, rumble: true, fps: false },
  games: {},
  updatedAt: 0,
});
function lsGet() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function lsSet(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }

export const Store = {
  data: null,
  cloud: 'off', // off | connecting | on | error | readonly
  lastSync: 0,
  _ls: new Set(),
  init() {
    const d = lsGet() || {};
    const def = defaults();
    this.data = Object.assign(def, d);
    this.data.settings = Object.assign(defaults().settings, d.settings || {});
    this.data.profile = Object.assign(defaults().profile, d.profile || {});
    this.data.games = d.games || {};
    this.connectCloud();
  },
  on(fn) { this._ls.add(fn); return () => this._ls.delete(fn); },
  emit() { for (const f of this._ls) { try { f(this); } catch (e) { console.error(e); } } },
  get settings() { return this.data.settings; },
  touch() {
    this.data.updatedAt = Date.now();
    lsSet(this.data);
    this.scheduleCloud();
    this.emit();
  },
  getGame(id) { const g = this.data.games[id]; return g && !g.deleted ? g : null; },
  setGame(id, obj) { obj.updatedAt = Date.now(); this.data.games[id] = obj; this.touch(); },
  deleteGame(id) { this.data.games[id] = { deleted: true, updatedAt: Date.now() }; this.touch(); },
  merge(remote) {
    if (!remote || typeof remote !== 'object') return;
    const loc = this.data;
    if ((remote.updatedAt || 0) > (loc.updatedAt || 0)) {
      loc.settings = Object.assign(loc.settings, remote.settings || {});
      loc.profile = Object.assign(loc.profile, remote.profile || {});
    }
    const ids = new Set([...Object.keys(loc.games), ...Object.keys(remote.games || {})]);
    for (const id of ids) {
      const a = loc.games[id], b = (remote.games || {})[id];
      if (b && (!a || (b.updatedAt || 0) > (a.updatedAt || 0))) loc.games[id] = b;
    }
    loc.updatedAt = Math.max(loc.updatedAt || 0, remote.updatedAt || 0);
    lsSet(loc);
  },
  async connectCloud() {
    // attendre l'éventuel runtime Claude (page publiée sur claude.ai)
    for (let i = 0; i < 30 && !(window.claude && typeof window.claude.use === 'function'); i++) await new Promise(r => setTimeout(r, 100));
    if (!(window.claude && typeof window.claude.use === 'function')) { this.cloud = 'off'; this.emit(); return; }
    this.cloud = 'connecting'; this.emit();
    const timer = setTimeout(() => { if (this.cloud === 'connecting') { this.cloud = 'error'; this.emit(); } }, 12000);
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) { clearTimeout(timer); this.cloud = 'off'; this.emit(); return; }
      const uid = await user.id();
      if (!uid) { clearTimeout(timer); this.cloud = 'off'; this.emit(); return; }
      this.ref = db.doc('data/users/' + uid + '/nova');
      const snap = await this.ref.get();
      clearTimeout(timer);
      if (snap.exists) {
        const body = snap.data();
        try { this.merge(JSON.parse(body.json)); } catch (e) {}
      }
      this.cloud = 'on'; this.lastSync = Date.now();
      this.emit();
      await this.pushNow();
    } catch (e) {
      clearTimeout(timer);
      this.cloud = 'error'; this.emit();
    }
  },
  scheduleCloud() {
    if (!this.ref || this.cloud === 'readonly') return;
    clearTimeout(this._t);
    this._t = setTimeout(() => this.pushNow(), 3500);
  },
  async pushNow() {
    if (!this.ref || this.cloud === 'readonly') return;
    if (this._writing) { this._again = true; return; }
    this._writing = true;
    try {
      await this.ref.set({ json: JSON.stringify(this.data), at: Date.now() });
      this.cloud = 'on'; this.lastSync = Date.now();
    } catch (e) {
      if (e && e.code === 'invalid_argument') this.cloud = 'readonly';
      else if (e && e.code === 'unavailable') { this.cloud = 'error'; setTimeout(() => this.pushNow(), 8000 + Math.random() * 4000); }
      else this.cloud = 'error';
    }
    this._writing = false;
    this.emit();
    if (this._again) { this._again = false; this.pushNow(); }
  },
  exportCode() {
    const json = JSON.stringify({ games: this.data.games, profile: this.data.profile, settings: this.data.settings });
    return 'NOVA1-' + btoa(unescape(encodeURIComponent(json)));
  },
  importCode(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    if (!code.startsWith('NOVA1-')) throw new Error('Code invalide');
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.slice(6)))));
    const now = Date.now();
    for (const [id, g] of Object.entries(obj.games || {})) { g.updatedAt = now; this.data.games[id] = g; }
    if (obj.profile) Object.assign(this.data.profile, obj.profile);
    if (obj.settings) Object.assign(this.data.settings, obj.settings);
    this.touch();
  },
};

/* ------------------------------------------------------------------ */
/* Entrées unifiées                                                    */
/* ------------------------------------------------------------------ */
const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, create: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, pad: 17 };
function prettyPad(id) {
  if (/dualsense|0ce6/i.test(id)) return 'DualSense';
  if (/dualshock|05c4|09cc/i.test(id)) return 'DualShock 4';
  if (/xbox|xinput|045e/i.test(id)) return 'Manette Xbox';
  if (/pro controller|057e/i.test(id)) return 'Manette Switch';
  return 'Manette';
}
const dz = (x, y, d = 0.16) => {
  const m = Math.hypot(x, y);
  if (m < d) return [0, 0];
  const k = Math.min(1, (m - d) / (1 - d)) / m;
  return [x * k, y * k];
};

export const Input = {
  wheel: 0, keys: new Set(), tapped: new Set(), mbtn: 0, mtapped: 0, mdx: 0, mdy: 0, mbtn: 0, locked: false,
  gpIndex: null, gpName: '', device: isTouch ? 'touch' : 'kb',
  touch: { mx: 0, my: 0, dx: 0, dy: 0, btn: {}, tap: {} },
  cur: {}, prev: {}, ax: { mx: 0, my: 0, lx: 0, ly: 0 },
  layout: null, _nav: { dir: null, t: 0 }, _ls: new Set(), _sprint: false,
  init() {
    addEventListener('keydown', e => {
      this.keys.add(e.code); this.tapped.add(e.code); this.setDevice('kb');
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mbtn = 0; });
    addEventListener('mousemove', e => { if (this.locked || this.mbtn) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; } });
    addEventListener('mousedown', e => { this.mbtn |= 1 << e.button; this.mtapped |= 1 << e.button; if (this.device !== 'gp') this.setDevice('kb'); });
    addEventListener('mouseup', e => { this.mbtn &= ~(1 << e.button); });
    addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = !!document.pointerLockElement; });
    addEventListener('gamepadconnected', e => { this.gpIndex = e.gamepad.index; this.gpName = prettyPad(e.gamepad.id); this.setDevice('gp'); this.fire('gamepad', true); });
    addEventListener('gamepaddisconnected', e => { if (this.gpIndex === e.gamepad.index) { this.gpIndex = null; this.fire('gamepad', false); } });
    addEventListener('touchstart', () => this.setDevice('touch'), { passive: true });
    try { navigator.keyboard && navigator.keyboard.getLayoutMap && navigator.keyboard.getLayoutMap().then(m => { this.layout = m; }).catch(() => {}); } catch (e) {}
  },
  on(fn) { this._ls.add(fn); return () => this._ls.delete(fn); },
  fire(type, v) { for (const f of this._ls) { try { f(type, v); } catch (e) {} } },
  setDevice(d) { if (this.device !== d) { this.device = d; this.fire('device', d); } },
  keyName(code) {
    const m = { Space: 'Espace', ShiftLeft: 'Maj', Escape: 'Échap', Tab: 'Tab', Enter: 'Entrée', ControlLeft: 'Ctrl', MouseL: 'Clic G', MouseR: 'Clic D' };
    if (m[code]) return m[code];
    if (this.layout && this.layout.get(code)) return this.layout.get(code).toUpperCase();
    return code.replace('Key', '').replace('Digit', '');
  },
  getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.gpIndex != null && pads[this.gpIndex]) return pads[this.gpIndex];
    for (const p of pads) if (p && p.connected) { this.gpIndex = p.index; this.gpName = prettyPad(p.id); this.fire('gamepad', true); return p; }
    return null;
  },
  poll() {
    this.prev = this.cur;
    const c = {}, t = this.touch;
    const k = this.tapped.size ? new Set([...this.keys, ...this.tapped]) : this.keys; this.tapped.clear();
    const mb = this.mbtn | this.mtapped; this.mtapped = 0;
    let mx = 0, my = 0, lx = 0, ly = 0;
    if (k.has('KeyD')) mx += 1; if (k.has('KeyA')) mx -= 1;
    if (k.has('KeyW')) my += 1; if (k.has('KeyS')) my -= 1;
    if (k.has('ArrowRight')) lx += 1; if (k.has('ArrowLeft')) lx -= 1;
    if (k.has('ArrowDown')) ly += 1; if (k.has('ArrowUp')) ly -= 1;
    const mL = this.locked && (mb & 1), mR = mb & 4, mM = mb & 2;
    c.jump = k.has('Space');
    c.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    c.swing = k.has('KeyE') || !!mR;
    c.zip = k.has('KeyQ') || !!mM;
    c.attack = k.has('KeyF') || !!mL;
    c.dash = k.has('KeyC') || k.has('ControlLeft');
    c.interact = k.has('KeyR');
    c.pause = k.has('Escape') || k.has('KeyP');
    c.map = k.has('KeyM') || k.has('Tab');
    c.confirm = k.has('Enter') || k.has('Space') || k.has('NumpadEnter');
    c.back = k.has('Escape') || k.has('Backspace');
    c.up = k.has('ArrowUp'); c.down = k.has('ArrowDown'); c.left = k.has('ArrowLeft'); c.right = k.has('ArrowRight');
    c.tabL = k.has('KeyQ') || k.has('PageUp'); c.tabR = k.has('KeyE') || k.has('PageDown');

    // actions génériques (jeux de survie, etc.)
    c.use = !!mL; c.alt = !!mR; c.inv = k.has('KeyI') || k.has('Tab'); c.act = k.has('KeyE'); c.crouch = k.has('KeyC') || k.has('ControlLeft');
    c.build = k.has('KeyB'); c.eat = k.has('KeyG'); c.drink = k.has('KeyH'); c.light = k.has('KeyT'); c.journal = k.has('KeyM') || k.has('KeyJ');
    c.next = this.wheel > 0; c.prev = this.wheel < 0; this.wheel = 0;
    c.digit = 0; for (let n = 1; n <= 9; n++) if (k.has('Digit' + n)) c.digit = n;
    const p = this.getPad();
    if (p) {
      const bt = i => (p.buttons[i] ? p.buttons[i].pressed || p.buttons[i].value > 0.35 : false);
      let any = false;
      for (let i = 0; i < p.buttons.length; i++) if (bt(i)) { any = true; break; }
      const [ax, ay] = dz(p.axes[0] || 0, p.axes[1] || 0);
      const [rx, ry] = dz(p.axes[2] || 0, p.axes[3] || 0, 0.12);
      if (any || Math.abs(ax) + Math.abs(ay) + Math.abs(rx) + Math.abs(ry) > 0.3) this.setDevice('gp');
      mx += ax; my -= ay; lx += rx; ly += ry;
      c.jump ||= bt(B.cross); c.dash ||= bt(B.circle); c.attack ||= bt(B.square); c.interact ||= bt(B.triangle);
      c.swing ||= bt(B.r2) || bt(B.r1); c.zip ||= bt(B.l2) || bt(B.l1);
      c.pause ||= bt(B.options); c.map ||= bt(B.pad) || bt(B.create);
      c.confirm ||= bt(B.cross); c.back ||= bt(B.circle);
      c.up ||= bt(B.up) || ay < -0.55; c.down ||= bt(B.down) || ay > 0.55;
      c.left ||= bt(B.left) || ax < -0.55; c.right ||= bt(B.right) || ax > 0.55;
      c.tabL ||= bt(B.l1); c.tabR ||= bt(B.r1);
      c.l3 = bt(B.l3);
      c.use ||= bt(B.r2); c.alt ||= bt(B.l2); c.inv ||= bt(B.square); c.act ||= bt(B.triangle); c.crouch ||= bt(B.circle);
      c.build ||= bt(B.up); c.eat ||= bt(B.down); c.drink ||= bt(B.right); c.light ||= bt(B.left); c.journal ||= bt(B.pad) || bt(B.create);
      c.next ||= bt(B.r1); c.prev ||= bt(B.l1);
    }
    // tactile
    mx += t.mx; my += t.my;
    for (const a in t.btn) if (t.btn[a]) c[a] = true;
    for (const a in t.tap) if (t.tap[a]) c[a] = true; t.tap = {};
    // sprint : Maj maintenu, L3 (bascule) ou joystick tactile poussé à fond
    if (c.l3 && !this.prev.l3) this._sprint = !this._sprint;
    if (Math.hypot(mx, my) < 0.2) this._sprint = false;
    c.sprint = c.sprint || this._sprint || (this.device === 'touch' && Math.hypot(t.mx, t.my) > 0.96);
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    this.ax.mx = mx; this.ax.my = my; this.ax.lx = clamp(lx, -1, 1); this.ax.ly = clamp(ly, -1, 1);
    this.cur = c;
  },
  down(a) { return !!this.cur[a]; },
  pressed(a) { return !!this.cur[a] && !this.prev[a]; },
  released(a) { return !this.cur[a] && !!this.prev[a]; },
  consumeLook() { const r = { x: this.mdx + this.touch.dx, y: this.mdy + this.touch.dy }; this.mdx = this.mdy = 0; this.touch.dx = this.touch.dy = 0; return r; },
  nav(dt) {
    const dirs = ['up', 'down', 'left', 'right'];
    const d = dirs.find(x => this.cur[x]) || null;
    const n = this._nav;
    if (!d) { n.dir = null; return null; }
    if (d !== n.dir) { n.dir = d; n.t = 0.38; return d; }
    n.t -= dt;
    if (n.t <= 0) { n.t = 0.11; return d; }
    return null;
  },
  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    if (!Store.data || !Store.settings.rumble) return;
    const p = this.getPad();
    try { if (p && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) {}
    if (this.device === 'touch' && navigator.vibrate && strong > 0.4) { try { navigator.vibrate(Math.min(60, ms / 2)); } catch (e) {} }
  },
  // libellé du bouton selon l'appareil utilisé
  glyph(action) {
    const gp = { jump: '<i class="g g-x">✕</i>', dash: '<i class="g g-o">○</i>', attack: '<i class="g g-s">▢</i>', interact: '<i class="g g-t">△</i>', swing: '<i class="g g-r">R2</i>', zip: '<i class="g g-r">L2</i>', pause: '<i class="g g-r">OPTIONS</i>', map: '<i class="g g-r">PAVÉ</i>', confirm: '<i class="g g-x">✕</i>', back: '<i class="g g-o">○</i>', sprint: '<i class="g g-r">L3</i>' };
    const kb = { jump: 'Space', dash: 'KeyC', attack: 'MouseL', interact: 'KeyR', swing: 'MouseR', zip: 'KeyQ', pause: 'Escape', map: 'KeyM', confirm: 'Enter', back: 'Escape', sprint: 'ShiftLeft' };
    const tc = { jump: 'SAUT', dash: 'DASH', attack: 'FRAPPE', interact: 'ACTION', swing: 'GRAPPIN', zip: 'ZIP', pause: '❚❚', map: 'CARTE', confirm: 'OK', back: 'RETOUR', sprint: 'JOYSTICK À FOND' };
    if (this.device === 'gp') return gp[action] || action;
    if (this.device === 'touch') return `<i class="g g-k">${tc[action] || action}</i>`;
    let key = this.keyName(kb[action] || action);
    if (action === 'swing') key += ' / ' + this.keyName('KeyE');
    if (action === 'attack') key += ' / ' + this.keyName('KeyF');
    return `<i class="g g-k">${key}</i>`;
  },
};

/* ------------------------------------------------------------------ */
/* Audio synthétisé (aucun fichier)                                    */
/* ------------------------------------------------------------------ */
export const Sound = {
  ctx: null, master: null, music: null, fx: null, _mode: null, _timer: null, _step: 0, _next: 0,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.comp = this.ctx.createDynamicsCompressor(); this.comp.connect(this.master);
      this.music = this.ctx.createGain(); this.music.connect(this.comp);
      this.fx = this.ctx.createGain(); this.fx.connect(this.comp);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this._pending) { const m = this._pending; this._pending = null; this.playMusic(m); }
    } catch (e) { this.ctx = null; }
  },
  applyVolumes() {
    if (!this.ctx || !Store.data) return;
    this.music.gain.value = Store.settings.music * 0.55;
    this.fx.gain.value = Store.settings.sfx;
  },
  tone(f, dur, { type = 'sine', vol = 0.2, to = null, delay = 0, attack = 0.005, dest = null, q = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.fx);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, { vol = 0.2, freq = 2000, type = 'lowpass', to = null, delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.fx);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  },
  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'move': this.tone(880, 0.06, { type: 'triangle', vol: 0.06 }); break;
      case 'select': this.tone(660, 0.09, { type: 'triangle', vol: 0.1 }); this.tone(1320, 0.14, { type: 'sine', vol: 0.07, delay: 0.05 }); break;
      case 'back': this.tone(520, 0.1, { type: 'triangle', vol: 0.08, to: 330 }); break;
      case 'boot': [262, 392, 523, 784].forEach((f, i) => this.tone(f, 1.6 - i * 0.2, { type: 'sine', vol: 0.09, delay: i * 0.12, attack: 0.08 })); this.noise(1.6, { vol: 0.05, freq: 300, to: 6000, type: 'bandpass' }); break;
      case 'jump': this.noise(0.15, { vol: 0.12, freq: 900, to: 2500, type: 'bandpass' }); break;
      case 'land': this.noise(0.18, { vol: 0.2, freq: 500, to: 120 }); break;
      case 'slam': this.tone(90, 0.5, { type: 'sine', vol: 0.4, to: 35 }); this.noise(0.5, { vol: 0.3, freq: 800, to: 80 }); break;
      case 'shoot': this.tone(1400, 0.12, { type: 'sawtooth', vol: 0.05, to: 500 }); this.noise(0.12, { vol: 0.12, freq: 3000, to: 900, type: 'bandpass' }); break;
      case 'release': this.noise(0.25, { vol: 0.1, freq: 2000, to: 400, type: 'bandpass' }); break;
      case 'fizzle': this.tone(300, 0.15, { type: 'square', vol: 0.04, to: 120 }); break;
      case 'zip': this.tone(300, 0.35, { type: 'sawtooth', vol: 0.05, to: 1600 }); this.noise(0.35, { vol: 0.1, freq: 600, to: 4000, type: 'bandpass' }); break;
      case 'dash': this.noise(0.22, { vol: 0.18, freq: 4000, to: 600, type: 'bandpass' }); break;
      case 'hit': this.tone(160, 0.12, { type: 'square', vol: 0.12, to: 60 }); this.noise(0.1, { vol: 0.25, freq: 2500, to: 400 }); break;
      case 'crit': this.tone(220, 0.2, { type: 'square', vol: 0.14, to: 50 }); this.noise(0.2, { vol: 0.3, freq: 4000, to: 300 }); this.tone(1200, 0.15, { vol: 0.06, delay: 0.03 }); break;
      case 'hurt': this.tone(200, 0.2, { type: 'sawtooth', vol: 0.1, to: 90 }); break;
      case 'enemyShot': this.tone(900, 0.18, { type: 'square', vol: 0.035, to: 300 }); break;
      case 'boom': this.noise(0.7, { vol: 0.35, freq: 1500, to: 60 }); this.tone(70, 0.6, { vol: 0.3, to: 30 }); break;
      case 'shard': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.25, { type: 'sine', vol: 0.07, delay: i * 0.05 })); break;
      case 'ring': this.tone(1568, 0.18, { type: 'triangle', vol: 0.08 }); this.tone(2093, 0.25, { type: 'sine', vol: 0.06, delay: 0.06 }); break;
      case 'coin': this.tone(1318, 0.08, { type: 'square', vol: 0.04 }); this.tone(1760, 0.16, { type: 'square', vol: 0.04, delay: 0.07 }); break;
      case 'level': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.08, delay: i * 0.08 })); break;
      case 'mission': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.7, { type: 'sine', vol: 0.09, delay: i * 0.1, attack: 0.02 })); this.tone(1046, 1.2, { type: 'triangle', vol: 0.06, delay: 0.4 }); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.08, delay: i * 0.15 })); break;
      case 'beep': this.tone(1046, 0.1, { type: 'square', vol: 0.05 }); break;
      case 'go': this.tone(1568, 0.4, { type: 'square', vol: 0.06 }); break;
      case 'radio': this.noise(0.08, { vol: 0.05, freq: 3000, type: 'bandpass' }); this.tone(1200, 0.05, { type: 'square', vol: 0.03, delay: 0.06 }); break;
    }
  },
  // musique procédurale très légère
  playMusic(mode) {
    if (!this.ctx) { this._pending = mode; return; }
    if (this._mode === mode) return;
    this._mode = mode;
    clearInterval(this._timer);
    this._step = 0; this._next = this.ctx.currentTime + 0.1;
    if (!mode) return;
    const bpm = mode === 'hub' ? 84 : 104, spb = 60 / bpm / 2;
    const prog = mode === 'hub'
      ? [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392], [164.8, 207.7, 246.9, 329.6]]
      : [[146.8, 174.6, 220, 293.7], [116.5, 146.8, 174.6, 233.1], [130.8, 164.8, 196, 261.6], [110, 138.6, 164.8, 220]];
    this._timer = setInterval(() => {
      if (!this.ctx || this._mode !== mode) return;
      while (this._next < this.ctx.currentTime + 0.3) {
        const s = this._step, t = this._next - this.ctx.currentTime;
        const ch = prog[Math.floor(s / 16) % prog.length];
        if (s % 16 === 0) ch.forEach(f => this.tone(f, spb * 16, { type: 'sine', vol: 0.035, delay: t, attack: 0.6, dest: this.music }));
        if (mode === 'hub') {
          if (s % 2 === 0) this.tone(ch[(s / 2) % 4] * 2, spb * 1.8, { type: 'triangle', vol: 0.025, delay: t, attack: 0.01, dest: this.music });
        } else {
          if (s % 4 === 0) this.tone(ch[0] / 2, spb * 2, { type: 'sine', vol: 0.12, delay: t, to: ch[0] / 2.2, dest: this.music });
          if (s % 8 === 4) this.noise(0.12, { vol: 0.05, freq: 1800, type: 'bandpass', delay: t, dest: this.music });
          if (s % 2 === 1) this.noise(0.04, { vol: 0.025, freq: 8000, type: 'highpass', delay: t, dest: this.music });
          if (s % 4 === 2) this.tone(ch[(s / 2 | 0) % 4] * 2, spb, { type: 'square', vol: 0.012, delay: t, dest: this.music });
        }
        this._step++; this._next += spb;
      }
    }, 100);
  },
};

/* ------------------------------------------------------------------ */
/* Fenêtres modales (aucun alert/confirm natif)                        */
/* ------------------------------------------------------------------ */
export const Modal = {
  stack: [],
  get active() { return this.stack.length ? this.stack[this.stack.length - 1] : null; },
  confirm(title, text, { yes = 'Confirmer', no = 'Annuler', danger = false } = {}) {
    return new Promise(res => {
      const root = el('div', 'modal-back');
      root.innerHTML = `<div class="modal glass"><h3>${title}</h3><p>${text}</p><div class="modal-btns"><button class="btn ghost" data-v="0">${no}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${yes}</button></div></div>`;
      document.body.appendChild(root);
      const btns = [...root.querySelectorAll('button')];
      const m = { focus: 1, close: v => { root.remove(); this.stack.splice(this.stack.indexOf(m), 1); Sound.sfx(v ? 'select' : 'back'); res(v); } };
      const paint = () => btns.forEach((b, i) => b.classList.toggle('focus', i === m.focus));
      btns.forEach((b, i) => b.addEventListener('click', () => m.close(!!+b.dataset.v)));
      m.update = (nav) => {
        if (nav === 'left' || nav === 'right') { m.focus = 1 - m.focus; paint(); Sound.sfx('move'); }
        if (Input.pressed('confirm')) m.close(!!+btns[m.focus].dataset.v);
        else if (Input.pressed('back')) m.close(false);
      };
      paint(); this.stack.push(m);
    });
  },
  info(title, html, { button = 'OK', input = false, value = '' } = {}) {
    return new Promise(res => {
      const root = el('div', 'modal-back');
      root.innerHTML = `<div class="modal glass wide"><h3>${title}</h3><div class="modal-body">${html}</div>${input ? `<textarea class="modal-input" spellcheck="false" placeholder="Colle ton code ici">${value}</textarea>` : ''}<div class="modal-btns">${input ? '<button class="btn ghost" data-v="0">Annuler</button>' : ''}<button class="btn primary focus" data-v="1">${button}</button></div></div>`;
      document.body.appendChild(root);
      const ta = root.querySelector('textarea');
      const m = { close: v => { root.remove(); this.stack.splice(this.stack.indexOf(m), 1); res(v ? (ta ? ta.value : true) : null); } };
      root.querySelectorAll('button').forEach(b => b.addEventListener('click', () => m.close(!!+b.dataset.v)));
      m.update = () => {
        if (document.activeElement === ta) { if (Input.keys.has('Escape')) { ta.blur(); } return; }
        if (Input.pressed('confirm')) m.close(true);
        else if (Input.pressed('back')) m.close(false);
      };
      this.stack.push(m);
      const sel = root.querySelector('.select-all'); if (sel) { sel.addEventListener('click', () => { const r = document.createRange(); r.selectNodeContents(sel); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); }
    });
  },
};

/* ------------------------------------------------------------------ */
/* Liste navigable (paramètres, améliorations, menus pause)            */
/* ------------------------------------------------------------------ */
export class ListMenu {
  constructor(root, items, opts = {}) {
    this.root = root; this.items = items; this.focus = 0; this.opts = opts;
    this.render();
  }
  setItems(items) { this.items = items; this.focus = Math.min(this.focus, items.length - 1); this.render(); }
  render() {
    this.root.innerHTML = '';
    this.rows = this.items.map((it, i) => {
      const r = el('div', 'lm-row' + (it.cls ? ' ' + it.cls : ''));
      const adj = !!(it.left || it.right);
      r.innerHTML = `<div class="lm-main"><div class="lm-label">${it.label}</div>${it.sub ? `<div class="lm-sub">${typeof it.sub === 'function' ? it.sub() : it.sub}</div>` : ''}</div>` +
        `<div class="lm-val">${adj ? '<button class="lm-arrow" data-d="-1">‹</button>' : ''}<span class="lm-v"></span>${adj ? '<button class="lm-arrow" data-d="1">›</button>' : ''}</div>`;
      r.addEventListener('click', e => {
        const d = e.target.closest('.lm-arrow');
        this.focus = i; this.paint();
        if (d) { (+d.dataset.d < 0 ? it.left : it.right)?.(); Sound.sfx('move'); this.refresh(); }
        else this.activate();
      });
      this.root.appendChild(r);
      return r;
    });
    this.refresh();
  }
  refresh() {
    this.items.forEach((it, i) => {
      const r = this.rows[i]; if (!r) return;
      r.querySelector('.lm-v').innerHTML = it.get ? it.get() : '';
      const sub = r.querySelector('.lm-sub'); if (sub && typeof it.sub === 'function') sub.innerHTML = it.sub();
      r.classList.toggle('disabled', !!(it.disabled && it.disabled()));
    });
    this.paint();
  }
  paint() {
    this.rows.forEach((r, i) => r.classList.toggle('focus', i === this.focus));
    const r = this.rows[this.focus]; if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
  }
  activate() {
    const it = this.items[this.focus]; if (!it) return;
    if (it.disabled && it.disabled()) { Sound.sfx('fizzle'); return; }
    if (it.act) { it.act(); Sound.sfx('select'); }
    else if (it.right) { it.right(); Sound.sfx('move'); }
    this.refresh();
  }
  update(nav) {
    if (nav === 'up' || nav === 'down') {
      const n = this.items.length; if (!n) return;
      this.focus = (this.focus + (nav === 'down' ? 1 : n - 1)) % n; this.paint(); Sound.sfx('move');
    } else if (nav === 'left' || nav === 'right') {
      const it = this.items[this.focus];
      const f = nav === 'left' ? it && it.left : it && it.right;
      if (f) { f(); Sound.sfx('move'); this.refresh(); }
    }
    if (Input.pressed('confirm')) this.activate();
  }
}
