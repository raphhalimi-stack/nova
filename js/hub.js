// NOVA — le hub (accueil façon console)
import { Input, Sound, Store, Modal, ListMenu, el, fmtDuration, timeAgo, rng, isTV, isTouch, lowEnd } from './core.js';

/* ---------------- illustrations générées (SVG) ---------------- */
function artSkyline(W = 1600, H = 900) {
  const r = rng(7);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050816"/><stop offset=".55" stop-color="#1a1240"/><stop offset=".8" stop-color="#6b1f5c"/><stop offset="1" stop-color="#ff6a4a"/></linearGradient>
    <radialGradient id="moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#cfe6ff"/><stop offset="1" stop-color="#cfe6ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".9"/></linearGradient>
    <filter id="gl"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sk)"/>`;
  for (let i = 0; i < 120; i++) s += `<circle cx="${r() * W}" cy="${r() * H * 0.5}" r="${r() * 1.4 + 0.3}" fill="#fff" opacity="${0.3 + r() * 0.7}"/>`;
  s += `<circle cx="${W * 0.78}" cy="${H * 0.2}" r="120" fill="url(#moon)" opacity=".5"/><circle cx="${W * 0.78}" cy="${H * 0.2}" r="46" fill="#eef6ff"/>`;
  const layer = (base, hmin, hmax, col, win, n) => {
    let x = -20, out = '';
    while (x < W + 20) {
      const w = 40 + r() * 90, h = hmin + r() * (hmax - hmin);
      out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h + 400}" fill="${col}"/>`;
      if (win) for (let yy = base - h + 10; yy < base; yy += 16) for (let xx = x + 6; xx < x + w - 8; xx += 13) if (r() < 0.32) out += `<rect x="${xx}" y="${yy}" width="6" height="8" fill="${r() < 0.85 ? '#ffd9a0' : '#7fe8ff'}" opacity="${0.5 + r() * 0.5}"/>`;
      if (r() < 0.18 && n) { const c = ['#ff3df2', '#36e9ff', '#ffd23d', '#7dff6b'][(r() * 4) | 0]; out += `<rect x="${x + w * 0.2}" y="${base - h + 20 + r() * 60}" width="${8}" height="${40 + r() * 30}" fill="${c}" filter="url(#gl)"/><rect x="${x + w * 0.2}" y="${base - h + 20}" width="8" height="50" fill="${c}"/>`; }
      x += w + r() * 10;
    }
    return out;
  };
  s += layer(H * 0.82, 120, 320, '#120f2a', false, false);
  // tour Nova
  const tx = W * 0.5;
  s += `<rect x="${tx - 50}" y="${H * 0.12}" width="100" height="${H}" fill="#0d0c22"/><rect x="${tx - 34}" y="${H * 0.08}" width="68" height="60" fill="#0d0c22"/><rect x="${tx - 4}" y="${H * 0.01}" width="8" height="${H * 0.08}" fill="#1c1b3a"/>`;
  for (let k = 0; k < 3; k++) s += `<ellipse cx="${tx}" cy="${H * 0.09 - k * 18}" rx="${110 + k * 40}" ry="${16 + k * 6}" fill="none" stroke="#35e8ff" stroke-width="3" opacity="${0.7 - k * 0.18}" filter="url(#gl)"/><ellipse cx="${tx}" cy="${H * 0.09 - k * 18}" rx="${110 + k * 40}" ry="${16 + k * 6}" fill="none" stroke="#bff8ff" stroke-width="1.2" opacity=".8"/>`;
  s += `<circle cx="${tx}" cy="${H * 0.008}" r="6" fill="#ff2a3c" filter="url(#gl)"/>`;
  s += layer(H * 0.9, 160, 430, '#0a0918', true, true);
  s += layer(H * 1.02, 220, 520, '#05050d', true, true);
  // câble + héros (silhouette originale)
  const hx = W * 0.3, hy = H * 0.42;
  s += `<path d="M ${W * 0.62} ${-10} Q ${W * 0.48} ${H * 0.2} ${hx + 18} ${hy - 30}" stroke="#35e8ff" stroke-width="10" fill="none" opacity=".45" filter="url(#gl)"/><path d="M ${W * 0.62} ${-10} Q ${W * 0.48} ${H * 0.2} ${hx + 18} ${hy - 30}" stroke="#d6fbff" stroke-width="2.5" fill="none"/>`;
  s += `<g transform="translate(${hx} ${hy}) rotate(-24)"><circle cx="0" cy="-48" r="17" fill="#0b0d14"/><rect x="-12" y="-52" width="24" height="6" rx="3" fill="#35e8ff"/><path d="M-20 -28 Q0 -36 20 -28 L16 18 L-16 18 Z" fill="#0b0d14"/><path d="M14 -26 L32 -70" stroke="#0b0d14" stroke-width="11" stroke-linecap="round"/><circle cx="33" cy="-72" r="7" fill="#35e8ff"/><path d="M-16 -24 L-40 0" stroke="#0b0d14" stroke-width="11" stroke-linecap="round"/><path d="M-8 16 L-30 54" stroke="#0b0d14" stroke-width="13" stroke-linecap="round"/><path d="M8 16 L22 46 L4 70" stroke="#0b0d14" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-6 -22 L0 0 L6 -22" stroke="#35e8ff" stroke-width="3" fill="none"/></g>`;
  s += `<rect width="${W}" height="${H}" fill="url(#fade)"/></svg>`;
  return s;
}
function artBlocks(W = 1600, H = 900) {
  const r = rng(11);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a4a"/><stop offset=".7" stop-color="#3fa6c9"/><stop offset="1" stop-color="#ffd38a"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".92"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#a)"/>`;
  const S = 46;
  for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 24; gx++) {
    const h = Math.floor(2 + Math.sin(gx * 0.5) * 1.5 + Math.cos(gy * 0.6) * 1.5 + r() * 1.5);
    const ox = W * 0.5 + (gx - gy) * S * 0.87, oy = H * 0.12 + (gx + gy) * S * 0.5;
    for (let k = 0; k < h; k++) {
      const y = oy - k * S * 0.62 + 200;
      const top = k === h - 1 ? '#5bd36a' : '#8a5a3c', l = k === h - 1 ? '#3e9a4b' : '#6b4329', rr = k === h - 1 ? '#2f7a3a' : '#55341f';
      s += `<path d="M${ox} ${y} l${S * 0.87} ${S * 0.5} l${-S * 0.87} ${S * 0.5} l${-S * 0.87} ${-S * 0.5}z" fill="${top}"/><path d="M${ox - S * 0.87} ${y + S * 0.5} l${S * 0.87} ${S * 0.5} v${S * 0.62} l${-S * 0.87} ${-S * 0.5}z" fill="${l}"/><path d="M${ox} ${y + S} l${S * 0.87} ${-S * 0.5} v${S * 0.62} l${-S * 0.87} ${S * 0.5}z" fill="${rr}"/>`;
    }
  }
  // cristal lumineux, lanterne, glisseur et bâtisseur (silhouettes originales)
  s += `<defs><filter id="bg"><feGaussianBlur stdDeviation="14"/></filter></defs>`;
  s += `<circle cx="${W * 0.72}" cy="${H * 0.36}" r="70" fill="#6ff0ff" opacity=".45" filter="url(#bg)"/><path d="M${W * 0.72} ${H * 0.36 - 60} l34 50 -34 60 -34 -60z" fill="#9ff8ff"/><path d="M${W * 0.72} ${H * 0.36 - 60} l34 50 -34 10z" fill="#e6fdff"/>`;
  s += `<circle cx="${W * 0.26}" cy="${H * 0.3}" r="60" fill="#ffd27a" opacity=".45" filter="url(#bg)"/><rect x="${W * 0.26 - 18}" y="${H * 0.3 - 22}" width="36" height="44" fill="#ffe2a0" stroke="#4a3a24" stroke-width="6"/>`;
  s += `<g transform="translate(${W * 0.55} ${H * 0.22}) rotate(-8)"><rect x="-90" y="-10" width="180" height="20" rx="6" fill="#2b2f45"/><rect x="-80" y="10" width="160" height="6" fill="#5bd36a"/><rect x="-14" y="-62" width="28" height="52" fill="#1f2430"/><rect x="-12" y="-90" width="24" height="24" fill="#f2c79a"/><rect x="-30" y="-58" width="16" height="36" fill="#3d8bff"/><rect x="14" y="-58" width="16" height="36" fill="#3d8bff"/></g>`;
  for (let i = 0; i < 7; i++) { const x = W * (0.1 + r() * 0.8), y = H * (0.08 + r() * 0.25), z = 18 + r() * 22; s += `<path d="M${x} ${y} l${z} ${z * 0.55} l${-z} ${z * 0.55} l${-z} ${-z * 0.55}z" fill="#5bd36a" opacity=".85"/><path d="M${x - z} ${y + z * 0.55} l${z} ${z * 0.55} v${z * 0.7} l${-z} ${-z * 0.55}z" fill="#3e9a4b" opacity=".85"/><path d="M${x} ${y + z * 1.1} l${z} ${-z * 0.55} v${z * 0.7} l${-z} ${z * 0.55}z" fill="#2f7a3a" opacity=".85"/>`; }
  s += `<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`;
  return s;
}
function artEmpire(W = 1600, H = 900) {
  const r = rng(5);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1203"/><stop offset=".6" stop-color="#5a3a05"/><stop offset="1" stop-color="#ffb32e"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".92"/></linearGradient><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#d48a12"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#a)"/>`;
  let x = 0; while (x < W) { const w = 80 + r() * 120, h = 150 + r() * 300; s += `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="#1b1206" opacity=".85"/>`; if (r() < 0.5) s += `<rect x="${x + w * 0.6}" y="${H - h - 120}" width="22" height="120" fill="#1b1206"/><circle cx="${x + w * 0.6 + 11}" cy="${H - h - 140}" r="${20 + r() * 20}" fill="#fff" opacity=".07"/>`; x += w + 20; }
  let p = `M 0 ${H * 0.75}`; for (let i = 1; i <= 16; i++) p += ` L ${i * W / 16} ${H * 0.75 - i * 26 - r() * 50}`;
  s += `<path d="${p}" stroke="#ffe08a" stroke-width="8" fill="none" opacity=".9"/>`;
  for (let k = 0; k < 7; k++) { const cx = W * 0.55 + k * 70, n = 4 + k * 2; for (let j = 0; j < n; j++) s += `<ellipse cx="${cx}" cy="${H * 0.82 - j * 16}" rx="30" ry="10" fill="url(#c)" stroke="#8a5806" stroke-width="2"/>`; }
  s += `<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`;
  return s;
}
function artRoyale(W = 1600, H = 900) {
  const r = rng(3);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="o" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#1d6a8a"/><stop offset="1" stop-color="#071a2c"/></radialGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".92"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#o)"/>`;
  let p = ''; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rr = 300 + r() * 90; p += `${i ? 'L' : 'M'} ${W / 2 + Math.cos(a) * rr * 1.3} ${H / 2 + Math.sin(a) * rr} `; }
  s += `<path d="${p}Z" fill="#e8d49a"/><path d="${p}Z" fill="#3f8a3a" transform="translate(${W / 2} ${H / 2}) scale(.88) translate(${-W / 2} ${-H / 2})"/>`;
  for (let i = 0; i < 60; i++) s += `<circle cx="${W / 2 + (r() - 0.5) * 700}" cy="${H / 2 + (r() - 0.5) * 520}" r="${8 + r() * 14}" fill="#2a6a2a"/>`;
  s += `<circle cx="${W * 0.55}" cy="${H * 0.48}" r="230" fill="none" stroke="#b34dff" stroke-width="14" opacity=".9"/><circle cx="${W * 0.55}" cy="${H * 0.48}" r="230" fill="none" stroke="#b34dff" stroke-width="60" opacity=".2"/><path d="M -50 ${H * 0.2} L ${W + 50} ${H * 0.7}" stroke="#fff" stroke-width="3" stroke-dasharray="20 18" opacity=".6"/>`;
  s += `<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`;
  return s;
}
function artRush(W = 1600, H = 900) {
  const r = rng(9);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0b3a"/><stop offset=".6" stop-color="#c2366a"/><stop offset="1" stop-color="#ff9a3d"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".92"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#a)"/>`;
  const cols = ['#ff3d6e', '#3dd6ff', '#ffd23d', '#7dff6b', '#a46bff'];
  for (let i = 0; i < 14; i++) { const x = 60 + i * 115, y = H * 0.75 - i * 32 + Math.sin(i) * 40, w = 90 + r() * 40, c = cols[i % 5]; s += `<rect x="${x}" y="${y}" width="${w}" height="26" rx="6" fill="${c}"/><rect x="${x}" y="${y + 26}" width="${w}" height="16" rx="4" fill="#000" opacity=".25"/>`; }
  s += `<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`;
  return s;
}
function artRivage(W = 1600, H = 900) {
  const r = rng(21);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>
  <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1b3a"/><stop offset=".45" stop-color="#3a4a86"/><stop offset=".62" stop-color="#e0806a"/><stop offset=".7" stop-color="#ffd08a"/></linearGradient>
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2ab7b0"/><stop offset="1" stop-color="#062a40"/></linearGradient>
  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".92"/></linearGradient>
  <radialGradient id="g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d8"/><stop offset=".3" stop-color="#ffd08a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd08a" stop-opacity="0"/></radialGradient><filter id="b"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <rect width="${W}" height="${H}" fill="url(#s)"/>`;
  for (let i = 0; i < 70; i++) s += `<circle cx="${r() * W}" cy="${r() * H * 0.35}" r="${r() * 1.3 + 0.3}" fill="#fff" opacity="${0.3 + r() * 0.6}"/>`;
  s += `<circle cx="${W * 0.7}" cy="${H * 0.62}" r="240" fill="url(#g)"/><circle cx="${W * 0.7}" cy="${H * 0.62}" r="52" fill="#fff3cf"/>`;
  s += `<path d="M${W * 0.18} ${H * 0.66} C ${W * 0.3} ${H * 0.5}, ${W * 0.38} ${H * 0.3}, ${W * 0.47} ${H * 0.26} C ${W * 0.55} ${H * 0.3}, ${W * 0.6} ${H * 0.5}, ${W * 0.86} ${H * 0.66} Z" fill="#12222e"/>`;
  s += `<g transform="translate(${W * 0.47} ${H * 0.2})"><rect x="-22" y="0" width="8" height="52" fill="#0a141c"/><rect x="14" y="0" width="8" height="52" fill="#0a141c"/><rect x="-28" y="-8" width="56" height="10" fill="#0a141c"/><rect x="-14" y="2" width="28" height="50" fill="#7ff6ff" opacity=".9" filter="url(#b)"/><rect x="-13" y="3" width="26" height="48" fill="#d6fbff" opacity=".8"/></g>`;
  s += `<rect y="${H * 0.66}" width="${W}" height="${H * 0.34}" fill="url(#w)"/>`;
  for (let i = 0; i < 26; i++) s += `<rect x="${W * 0.7 - 120 + r() * 240}" y="${H * 0.67 + i * 9}" width="${30 + r() * 120}" height="2.5" fill="#ffe2a8" opacity="${0.6 - i * 0.02}"/>`;
  s += `<path d="M0 ${H * 0.84} Q ${W * 0.2} ${H * 0.76} ${W * 0.46} ${H * 0.86} T ${W} ${H * 0.82} V${H} H0Z" fill="#c9a86a"/><path d="M0 ${H * 0.88} Q ${W * 0.25} ${H * 0.82} ${W * 0.5} ${H * 0.9} T ${W} ${H * 0.87} V${H} H0Z" fill="#0c0f12"/>`;
  const palm = (x, y, sc, lean) => { let o = `<g transform="translate(${x} ${y}) scale(${sc}) rotate(${lean})"><path d="M0 0 Q 14 -120 -6 -250" stroke="#0a0d10" stroke-width="13" fill="none"/>`; for (let k = 0; k < 8; k++) { const a = -170 + k * 48; o += `<path d="M-6 -250 q ${Math.cos(a * Math.PI / 180) * 80} ${Math.sin(a * Math.PI / 180) * 60 - 30} ${Math.cos(a * Math.PI / 180) * 150} ${Math.sin(a * Math.PI / 180) * 90 + 30}" stroke="#0a0d10" stroke-width="12" fill="none" stroke-linecap="round"/>`; } return o + '</g>'; };
  s += palm(W * 0.14, H * 0.9, 1.5, 8) + palm(W * 0.24, H * 0.92, 1.1, -10) + palm(W * 0.9, H * 0.9, 1.3, -14);
  s += `<g transform="translate(${W * 0.36} ${H * 0.84})"><circle cx="0" cy="-64" r="11" fill="#0a0d10"/><path d="M-10 -52 h20 l4 46 h-28z" fill="#0a0d10"/><path d="M12 -44 l22 -34" stroke="#0a0d10" stroke-width="7" stroke-linecap="round"/><path d="M34 -110 v70" stroke="#0a0d10" stroke-width="4"/><path d="M-6 -8 l-6 40 M6 -8 l8 40" stroke="#0a0d10" stroke-width="9" stroke-linecap="round"/></g>`;
  s += `<g transform="translate(${W * 0.44} ${H * 0.87})"><path d="M-14 0 l14 -30 l14 30z" fill="#ff8a30" filter="url(#b)"/><path d="M-9 0 l9 -22 l9 22z" fill="#ffd08a"/></g>`;
  s += `<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`;
  return s;
}
function artCubika(W = 1600, H = 900) {
  const r = rng(33);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6cff"/><stop offset=".55" stop-color="#8fd0ff"/><stop offset="1" stop-color="#ffe7b0"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03040a" stop-opacity=".92"/></linearGradient><filter id="gl"><feGaussianBlur stdDeviation="8"/></filter></defs><rect width="${W}" height="${H}" fill="url(#a)"/>`;
  for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H * 0.35, w = 120 + r() * 160; s += `<rect x="${x}" y="${y}" width="${w}" height="${w * 0.32}" rx="${w * 0.16}" fill="#fff" opacity=".75"/><rect x="${x + w * 0.2}" y="${y - w * 0.14}" width="${w * 0.5}" height="${w * 0.3}" rx="${w * 0.15}" fill="#fff" opacity=".75"/>`; }
  // place en perspective
  s += `<path d="M0 ${H * 0.62} L${W} ${H * 0.62} L${W} ${H} L0 ${H}Z" fill="#6cc84a"/><ellipse cx="${W / 2}" cy="${H * 0.8}" rx="${W * 0.42}" ry="${H * 0.16}" fill="#e9e2d0"/><ellipse cx="${W / 2}" cy="${H * 0.8}" rx="${W * 0.12}" ry="${H * 0.05}" fill="#9fb4c8"/><ellipse cx="${W / 2}" cy="${H * 0.79}" rx="${W * 0.1}" ry="${H * 0.035}" fill="#5fd0ff"/>`;
  const cols = ['#ff5d8f', '#ff8a3d', '#ffd23d', '#7ddc4a', '#2ec4b6', '#3d8bff', '#7a5cff', '#d65cff', '#ff4d6d', '#ff7ac8'];
  cols.forEach((c, i) => { const a = (i / 10) * Math.PI * 2 + 0.3, x = W / 2 + Math.cos(a) * W * 0.36, y = H * 0.78 + Math.sin(a) * H * 0.12, k = 0.55 + (Math.sin(a) + 1) * 0.3; if (Math.sin(a) > 0.2) return; s += `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-70" y="-200" width="26" height="200" fill="${c}"/><rect x="44" y="-200" width="26" height="200" fill="${c}"/><rect x="-80" y="-226" width="160" height="34" fill="${c}"/><rect x="-44" y="-192" width="88" height="192" fill="${c}" opacity=".45" filter="url(#gl)"/><rect x="-44" y="-192" width="88" height="192" fill="#fff" opacity=".25"/></g>`; });
  // personnages cubiques originaux
  const fig = (x, y, k, shirt, pants, hat) => { let o = `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-22" y="-60" width="18" height="60" fill="${pants}"/><rect x="4" y="-60" width="18" height="60" fill="${pants}"/><rect x="-28" y="-122" width="56" height="62" fill="${shirt}"/><rect x="-46" y="-120" width="18" height="56" fill="${shirt}"/><rect x="28" y="-120" width="18" height="56" fill="${shirt}"/><rect x="-22" y="-166" width="44" height="44" rx="6" fill="#f2c79a"/><rect x="-12" y="-152" width="7" height="10" fill="#1a1a22"/><rect x="5" y="-152" width="7" height="10" fill="#1a1a22"/><path d="M-10 -138 q10 8 20 0" stroke="#1a1a22" stroke-width="3" fill="none"/>`; if (hat === 1) o += `<rect x="-24" y="-176" width="48" height="12" fill="#ff4d6d"/><rect x="0" y="-168" width="34" height="5" fill="#ff4d6d"/>`; if (hat === 2) o += `<rect x="-20" y="-178" width="40" height="12" fill="#ffd23d"/><path d="M-20 -178 l6 -12 l6 12 l8 -14 l8 14 l6 -12 l6 12z" fill="#ffd23d"/>`; if (hat === 3) o += `<rect x="-16" y="-170" width="10" height="14" fill="#ff8a3d"/><rect x="6" y="-170" width="10" height="14" fill="#ff8a3d"/>`; return o + '</g>'; };
  const fx = W > H * 1.3 ? 0.3 : 0; s += fig(W * (0.36 + fx), H * 0.86, 1.5, '#3d8bff', '#1f2430', 1) + fig(W * (0.5 + fx), H * 0.9, 1.9, '#ff5d8f', '#2a2e38', 2) + fig(W * (0.63 + fx * 0.85), H * 0.85, 1.4, '#7ddc4a', '#5b6270', 3);
  s += `<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`;
  return s;
}
const icoCloud = `<svg viewBox="0 0 64 64"><path d="M20 46h26a11 11 0 0 0 1-22 15 15 0 0 0-29 4A9 9 0 0 0 20 46z" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><path d="M32 30v12m-5-5 5 5 5-5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
const icoGear = `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="8" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M18 46l4-4M42 22l4-4" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="32" r="16" fill="none" stroke="#fff" stroke-width="3.5"/></svg>`;
const toURI = svg => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

/* ---------------- catalogue ---------------- */
const GAMES = [
  { id: 'blockverse', title: 'BLOCKVERSE', sub: 'Bac à sable moddé', kicker: 'NOUVEAU · CONSTRUCTION', acc: '#5bd36a', art: artBlocks, playable: true, mod: 'blockverse', cls: 'Blockverse',
    desc: 'Un monde de cubes à ta façon : casse, récolte, construis. Créatif ou Survie, quatre types de mondes, des nuits peuplées d’Ombrelins et 13 mods intégrés à activer en un clic : vol, glisseur, gravité lunaire, étoiles filantes…',
    chips: ['Créatif & Survie', '13 mods intégrés', '18 défis', 'Fabrication', 'Jour & nuit'],
    tips: ['Appuie deux fois sur saut pour voler en Créatif.', 'En Survie, un tronc donne quatre planches.', 'Les lanternes éclairent les grottes et les maisons.', 'Les Ombrelins disparaissent au lever du soleil.', 'Les cristaux se cachent sous la couche 16.', 'Chaque niveau débloque de nouveaux mods.', 'Le bloc rebond renvoie plus haut quand tu tombes de haut.', 'La dynamite s’allume avec △ (E au clavier).'],
    controls: `<div class="ctrl-grid"><div><h4>Manette PS5</h4><ul><li><b>Joystick gauche</b> bouger · <b>L3</b> sprint</li><li><b>Joystick droit</b> regarder</li><li><b>✕</b> sauter · deux fois pour voler</li><li><b>R2</b> casser · <b>L2</b> poser</li><li><b>R1 / L1</b> changer de bloc</li><li><b>△</b> interagir · <b>▢</b> sac</li><li><b>○</b> descendre · <b>Pavé</b> mods · <b>Options</b> pause</li></ul></div><div><h4>Clavier & souris</h4><ul><li><b>ZQSD / WASD</b> bouger · <b>Maj</b> sprint</li><li><b>Souris</b> regarder (clique pour verrouiller)</li><li><b>Espace</b> sauter · deux fois pour voler</li><li><b>Clic G / F</b> casser · <b>Clic D</b> poser</li><li><b>Molette / 1-9</b> choisir un bloc</li><li><b>E</b> interagir · <b>I</b> sac · <b>M</b> mods</li></ul></div><div><h4>Tactile</h4><ul><li>Joystick à gauche, glisser à droite pour regarder</li><li>CASSER (maintenir) · POSER · △</li><li>Barre de blocs en haut, SAC et MODS à gauche</li></ul></div></div>` },
  { id: 'cubika', title: 'CUBIKA', sub: 'La place aux mini-jeux', kicker: 'MINI-JEUX · 10 PORTAILS', acc: '#ffd23d', art: artCubika, playable: true, mod: 'cubika', cls: 'Cubika',
    desc: 'Crée ton avatar cubique, gagne des jetons et passe les portails de la place : parcours, tour infinie, usine, familiers, cache-cache, catastrophes, karts, défilé, guerre des lits et enquête. Hors ligne, contre des bots.',
    chips: ['10 mini-jeux', 'Avatar & garde-robe', 'Niveaux & jetons', 'Bots'],
    tips: ['Les drapeaux verts du parcours sont des points de contrôle.', 'Dans l’usine, pense à vider le coffre pour acheter la suite.', 'Accroupis-toi derrière un meuble pour rester caché.', 'Dans la Guerre des lits, maintiens L2 pour construire un pont.', 'Au défilé, les objets liés au thème rapportent le plus d’étoiles.', 'Au manoir, les innocents disent toujours la vérité.'],
    controls: `<div class="ctrl-grid"><div><h4>Manette PS5</h4><ul><li><b>Joystick gauche</b> bouger · <b>L3</b> sprint</li><li><b>Joystick droit</b> caméra</li><li><b>✕</b> sauter · <b>▢ / R2</b> action</li><li><b>L2</b> poser un bloc · <b>○</b> s’accroupir</li><li><b>△</b> interagir, entrer dans un portail</li><li><b>Options</b> pause</li></ul></div><div><h4>Clavier & souris</h4><ul><li><b>ZQSD / WASD</b> bouger · <b>Maj</b> sprint</li><li><b>Souris</b> caméra (clique pour verrouiller)</li><li><b>Espace</b> sauter · <b>Clic G / F</b> action</li><li><b>Clic D / Q</b> bloc · <b>C</b> accroupi</li><li><b>E / R</b> interagir · <b>Échap</b> pause</li></ul></div><div><h4>Tactile</h4><ul><li>Joystick à gauche, caméra à droite</li><li>Boutons : saut, action, △, bloc, bas</li><li>Touche l’invite en haut pour interagir</li></ul></div></div>` },
  { id: 'rivage', title: 'RIVAGE', sub: 'Survivre. Bâtir. Passer.', kicker: 'SURVIE · MONDE OUVERT', acc: '#ffb36b', art: artRivage, playable: true, mod: 'rivage', cls: 'Rivage',
    desc: 'Échoué sur une île qui n’est sur aucune carte. Creuse, construis, chasse, plonge. Trouve les cinq fragments, et décide qui franchira le Passage. Trois îles, trois époques, des mods et plusieurs fins.',
    chips: ['3 îles · 3 époques', 'Creuser & construire', 'Histoire à choix', 'Mods'],
    tips: ['Un feu de camp réchauffe, cuit la viande et distille l’eau de mer.', 'La viande crue rend malade : cuis-la.', 'Creuse profond pour trouver du fer et des cristaux.', 'Construis un couchage : c’est ton point de réapparition.', 'La nuit, les prédateurs sortent. Reste près du feu.', 'Sous l’eau, surveille ta jauge d’oxygène.'] },
  { id: 'skyline', title: 'SKYLINE', sub: 'Haneul City', kicker: 'MONDE OUVERT · ACTION', acc: '#35e8ff', art: artSkyline, playable: true, mod: 'skyline', cls: 'Skyline',
    desc: 'Balance-toi entre les gratte-ciel au grappin, grimpe les tours, libère les quartiers envahis par les drones d’AXIOM. Une ville entière, de jour comme de nuit.',
    chips: ['Grappin & zip', 'Combats aériens', 'Courses', 'Cycle jour/nuit'] },
  { id: 'empire', title: 'EMPIRE', sub: 'Tycoon monde ouvert', kicker: 'BIENTÔT · GESTION', acc: '#ffb32e', art: artEmpire,
    desc: 'Explore une carte 3D et bâtis ton empire : usines, boutiques, argent qui tombe et améliorations sans fin.', chips: ['Tycoon', 'Exploration', 'Améliorations'] },
  { id: 'royale', title: 'ZONE ROYALE', sub: 'Battle royale contre bots', kicker: 'BIENTÔT · SURVIE', acc: '#b34dff', art: artRoyale,
    desc: 'Atterris sur l’île, récupère ton équipement, construis vite et sois le dernier debout pendant que la zone se referme.', chips: ['Construction rapide', 'Bots', 'Zone'] },
];
const SYS = [
  { id: 'saves', title: 'Sauvegardes', kicker: 'SYSTÈME', acc: '#8fb4ff', icon: icoCloud, sys: true },
  { id: 'settings', title: 'Paramètres', kicker: 'SYSTÈME', acc: '#8fb4ff', icon: icoGear, sys: true },
];
const TILES = [...GAMES, ...SYS];

/* ---------------- hub ---------------- */
export const Hub = {
  focusZone: 'rail', idx: 0, aIdx: 0, cIdx: 0, active: true, game: null, panel: null,
  init() {
    Store.init(); Input.init();
    this.$ = s => document.querySelector(s);
    this.buildRail();
    this.select(0, true);
    Store.on(() => { this.paintStatus(); if (!this.game) this.paintHero(false); });
    Input.on((t, v) => { this.paintStatus(); if (t === 'gamepad' && v) this.notify(`${Input.gpName} connectée`, 'Prêt à jouer'); if (t === 'device' && !this.game) this.paintHints(); });
    setInterval(() => this.paintClock(), 10000); this.paintClock(); this.paintStatus(); this.paintHints();
    this.initFx();
    document.body.classList.toggle('tv', isTV); document.body.classList.toggle('lowend', lowEnd || isTV); document.body.classList.toggle('is-touch', isTouch);
    const splash = this.$('#splash');
    const go = () => {
      if (!splash.classList.contains('gone')) {
        Sound.unlock(); Sound.applyVolumes(); Sound.sfx('boot'); Sound.playMusic('hub');
        splash.classList.add('gone'); setTimeout(() => splash.remove(), 900);
        if (isTouch || isTV) { try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      }
    };
    splash.addEventListener('click', go); splash.addEventListener('pointerup', go); splash.addEventListener('touchend', go);
    if (isTouch) splash.querySelector('.press').textContent = 'Touche l’écran pour commencer';
    this.splashGo = go;
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },
  buildRail() {
    const rail = this.$('.rail');
    rail.innerHTML = '';
    this.tileEls = TILES.map((t, i) => {
      const d = el('button', 'tile' + (t.sys ? ' sys' : '') + (!t.playable && !t.sys ? ' soon' : ''));
      if (t.sys) d.innerHTML = `<div class="tile-ico">${t.icon}</div><span class="tile-name">${t.title}</span>`;
      else { d.style.backgroundImage = toURI(t.art(600, 600)); d.innerHTML = `<span class="tile-logo">${t.title}</span>${t.playable ? '' : '<em>Bientôt</em>'}<span class="tile-name">${t.title}</span>`; }
      if (i === GAMES.length) rail.appendChild(el('div', 'rail-sep'));
      d.addEventListener('click', () => { Sound.unlock(); if (this.idx === i && this.focusZone === 'rail' && !isTouch) this.activateTile(); else { this.focusZone = 'rail'; this.select(i); } });
      rail.appendChild(d);
      return d;
    });
    this.arts = {};
  },
  select(i, first) {
    this.idx = i; this.aIdx = 0; this.cIdx = 0;
    const t = TILES[i];
    this.tileEls.forEach((e, k) => e.classList.toggle('focus', k === i));
    const te = this.tileEls[i]; if (te.scrollIntoView) te.scrollIntoView({ block: 'nearest', inline: 'center', behavior: first ? 'auto' : 'smooth' });
    document.documentElement.style.setProperty('--acc', t.acc);
    // fond
    const bg = this.$('#bg');
    const layer = el('div', 'bg-art');
    if (!t.sys) { this.arts[t.id] = this.arts[t.id] || toURI(t.art()); layer.style.backgroundImage = this.arts[t.id]; }
    else layer.classList.add('sysbg');
    bg.insertBefore(layer, bg.querySelector('.bg-shade'));
    requestAnimationFrame(() => layer.classList.add('in'));
    const olds = bg.querySelectorAll('.bg-art'); olds.forEach((o, k) => { if (k < olds.length - 1) { o.classList.add('out'); setTimeout(() => o.remove(), 900); } });
    this.paintHero(true);
    if (!first) Sound.sfx('move');
  },
  heroActions(t) {
    const g = Store.getGame(t.id);
    if (t.playable) {
      const acts = [{ label: g ? 'Continuer' : 'Jouer', primary: true, ico: '▶', act: () => this.launch(t.id) }];
      if (g) acts.push({ label: 'Nouvelle partie', act: async () => { if (await Modal.confirm('Nouvelle partie ?', `Ta progression actuelle dans ${t.title} sera effacée sur tous tes appareils synchronisés.`, { yes: 'Recommencer', danger: true })) { Store.deleteGame(t.id); this.launch(t.id); } } });
      if (t.id === 'skyline') acts.push({ label: 'Commandes', act: () => this.showControls() });
      else if (t.controls) acts.push({ label: 'Commandes', act: () => Modal.info(`Commandes · ${t.title}`, t.controls, { button: 'Compris' }) });
      return acts;
    }
    if (t.id === 'saves') return [
      { label: 'Copier le code de transfert', primary: true, act: () => this.exportCode() },
      { label: 'Importer un code', act: () => this.importCode() },
      { label: 'Effacer une partie', danger: true, act: async () => { const have = GAMES.filter(x => x.playable && Store.getGame(x.id)); if (!have.length) return this.notify('Rien à effacer', 'Aucune sauvegarde'); for (const x of have) { if (await Modal.confirm(`Effacer ${x.title} ?`, `Toute ta progression dans ${x.title} sera supprimée. Cette action est définitive.`, { yes: 'Effacer', no: 'Garder', danger: true })) { Store.deleteGame(x.id); this.notify('Sauvegarde effacée', `${x.title} repart de zéro`); } } } },
    ];
    if (t.id === 'settings') return [{ label: 'Ouvrir les paramètres', primary: true, act: () => this.openSettings() }, { label: 'Changer de pseudo', act: () => this.rename() }];
    return [{ label: 'En développement', disabled: true }];
  },
  paintHero(anim) {
    const t = TILES[this.idx], hero = this.$('.hero');
    const g = Store.getGame(t.id), sm = g && g.summary;
    let html = `<div class="hero-kicker">${t.kicker}</div>`;
    if (t.sys) {
      html += `<h1 class="hero-title sys">${t.title}</h1>`;
      if (t.id === 'saves') {
        const st = { on: 'Synchronisée avec ton compte Claude', connecting: 'Connexion au cloud…', error: 'Cloud indisponible : sauvegarde locale', readonly: 'Lecture seule : sauvegarde locale', off: 'Sauvegarde sur cet appareil' }[Store.cloud];
        html += `<p class="hero-desc">${st}${Store.cloud === 'on' && Store.lastSync ? ` · ${timeAgo(Store.lastSync)}` : ''}. Le code de transfert te permet de reprendre ta partie sur un autre appareil (télé, téléphone, ordinateur).</p>`;
        html += `<div class="hero-chips">${GAMES.filter(x => x.playable).map(x => { const s2 = Store.getGame(x.id); return `<span>${x.title} · ${s2 && s2.summary ? s2.summary.completion + ' %' : 'aucune partie'}</span>`; }).join('')}</div>`;
      } else html += `<p class="hero-desc">Caméra, son, vibrations de la manette, qualité graphique et pseudo. Les réglages suivent ta sauvegarde.</p>`;
    } else {
      html += `<h1 class="hero-title">${t.title}</h1><div class="hero-sub">${t.sub}</div><p class="hero-desc">${t.desc}</p>`;
      html += `<div class="hero-chips">${t.chips.map(c => `<span>${c}</span>`).join('')}<span class="dev">🎮 Manette · ⌨ Clavier · ✋ Tactile</span></div>`;
    }
    this.actions = this.heroActions(t);
    html += `<div class="hero-actions">${this.actions.map((a, i) => `<button class="hbtn${a.primary ? ' primary' : ''}${a.danger ? ' danger' : ''}${a.disabled ? ' disabled' : ''}" data-i="${i}">${a.ico ? `<i>${a.ico}</i>` : ''}${a.label}</button>`).join('')}</div>`;
    if (t.playable && sm) html += `<div class="hero-progress"><div class="pbar"><i style="width:${sm.completion}%"></i></div><span>${sm.completion} % · ${sm.line || 'Niveau ' + sm.level} · ${fmtDuration(sm.playTime)} · ${timeAgo(g.updatedAt)}</span></div>`;
    hero.innerHTML = html;
    if (anim) { hero.classList.remove('in'); void hero.offsetWidth; hero.classList.add('in'); }
    hero.querySelectorAll('.hbtn').forEach(b => b.addEventListener('click', () => { Sound.unlock(); this.focusZone = 'actions'; this.aIdx = +b.dataset.i; this.paintFocus(); this.activateAction(); }));
    // cartes d'activité
    const cards = this.$('.cards');
    this.cardData = [];
    if (t.playable && sm && sm.cards) this.cardData = sm.cards.map(c => ({ k: c[0], v: c[1], s: c[2], bar: c[3] }));
    else if (t.id === 'blockverse') this.cardData = [{ k: 'Nouveau', v: 'Crée ton monde', s: 'Prairies, archipel, montagnes, plat' }, { k: '13 mods', v: 'Vol, glisseur, lune…', s: 'Débloqués en montant de niveau' }, { k: 'Astuce', v: 'Survie : casse un tronc', s: 'puis fabrique des planches' }];
    else if (t.id === 'cubika') this.cardData = [{ k: 'Nouveau', v: 'Crée ton avatar', s: 'Couleurs, chapeaux, accessoires' }, { k: '10 portails', v: 'Parcours, karts, enquête…', s: 'Joue contre des bots' }, { k: 'Astuce', v: '△ devant un portail', s: 'pour lancer un mini-jeu' }];
    else if (t.id === 'rivage') this.cardData = [{ k: 'Nouveau', v: 'Choisis ton île', s: 'Tropicale, volcanique ou nordique' }, { k: 'Astuce', v: 'Bois avant tout', s: 'Noix de coco, pluie ou source' }, { k: 'Astuce', v: 'Un feu avant la nuit', s: '3 bâtons, 3 pierres' }];
    else if (t.id === 'skyline') {
      if (sm) this.cardData = [
        { k: 'Reprendre', v: sm.chapter, s: sm.story >= 9 ? 'Histoire terminée' : `Contrat ${Math.max(0, sm.story)} / 8` },
        { k: 'Éclats d’énergie', v: `${sm.shards} / 50`, s: 'Cachés sur les toits', bar: sm.shards / 50 },
        { k: 'Zones libérées', v: `${sm.zones} / 6`, s: 'Quartiers de Haneul City', bar: sm.zones / 6 },
        { k: 'Crédits', v: `₵ ${(sm.credits || 0).toLocaleString('fr-FR')}`, s: 'Pour les améliorations' },
      ];
      else this.cardData = [{ k: 'Nouveau', v: 'Commence l’aventure', s: 'Tutoriel guidé par IRIS' }, { k: 'Astuce', v: 'Maintiens R2', s: 'pour te balancer au grappin' }, { k: 'Astuce', v: 'L2 = zip', s: 'vise un toit et propulse-toi' }];
    }
    cards.innerHTML = this.cardData.map((c, i) => `<div class="card glass" data-i="${i}"><div class="card-k">${c.k}</div><div class="card-v">${c.v}</div><div class="card-s">${c.s}</div>${c.bar != null ? `<div class="card-bar"><i style="width:${c.bar * 100}%"></i></div>` : ''}</div>`).join('');
    cards.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => { if (t.playable) this.launch(t.id); }));
    this.paintFocus();
  },
  paintFocus() {
    document.querySelectorAll('.hbtn').forEach((b, i) => b.classList.toggle('focus', this.focusZone === 'actions' && i === this.aIdx));
    document.querySelectorAll('.card').forEach((b, i) => b.classList.toggle('focus', this.focusZone === 'cards' && i === this.cIdx));
    this.tileEls.forEach((e, k) => { e.classList.toggle('focus', k === this.idx); e.classList.toggle('dim', this.focusZone !== 'rail' && k === this.idx); });
    document.body.dataset.zone = this.focusZone;
  },
  paintHints() {
    const h = this.$('.hints');
    if (!h) return;
    h.innerHTML = Input.device === 'touch' ? '' : `${Input.glyph('confirm')} Valider &nbsp;&nbsp; ${Input.glyph('back')} Retour`;
  },
  paintClock() { const d = new Date(); this.$('.clock').textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); },
  paintStatus() {
    const c = { on: '☁ Synchronisé', connecting: '☁ Connexion…', error: '☁ Hors ligne', readonly: '☁ Lecture seule', off: '💾 Local' }[Store.cloud];
    this.$('.st-cloud').textContent = c;
    this.$('.st-cloud').className = 'st-cloud ' + Store.cloud;
    this.$('.st-pad').innerHTML = Input.gpIndex != null ? `<svg viewBox="0 0 32 20"><path d="M8 2h16a7 7 0 0 1 7 8l-1 5a4 4 0 0 1-7 1l-2-3H11l-2 3a4 4 0 0 1-7-1l-1-5a7 7 0 0 1 7-8z" fill="currentColor"/></svg>${Input.gpName}` : '';
    this.$('.st-name').textContent = Store.data.profile.name;
    this.$('.avatar').textContent = (Store.data.profile.name || 'J')[0].toUpperCase();
  },
  notify(title, text) {
    const n = el('div', 'notif glass', `<b>${title}</b><span>${text}</span>`);
    this.$('.notifs').appendChild(n);
    setTimeout(() => n.classList.add('out'), 3000); setTimeout(() => n.remove(), 3600);
  },
  activateTile() {
    const t = TILES[this.idx];
    if (t.playable) this.launch(t.id);
    else if (t.sys) { this.focusZone = 'actions'; this.aIdx = 0; this.paintFocus(); Sound.sfx('select'); }
    else { Sound.sfx('fizzle'); this.notify(t.title, 'En développement : bientôt dans NOVA'); }
  },
  activateAction() {
    const a = this.actions[this.aIdx];
    if (!a || a.disabled) { Sound.sfx('fizzle'); return; }
    Sound.sfx('select'); a.act();
  },
  showControls() {
    Modal.info('Commandes · SKYLINE', `<div class="ctrl-grid">
      <div><h4>Manette PS5</h4>
      <ul><li><b>Joystick gauche</b> se déplacer · <b>L3</b> sprint</li><li><b>Joystick droit</b> caméra</li><li><b>✕</b> saut / double saut</li><li><b>R2</b> grappin (maintenir)</li><li><b>L2</b> zip vers le viseur</li><li><b>▢</b> frapper · <b>○</b> dash</li><li><b>△</b> action · <b>Pavé</b> carte · <b>Options</b> pause</li></ul></div>
      <div><h4>Clavier & souris</h4><ul><li><b>ZQSD / WASD</b> se déplacer · <b>Maj</b> sprint</li><li><b>Souris</b> caméra (clique pour verrouiller)</li><li><b>Espace</b> saut</li><li><b>Clic droit / E</b> grappin</li><li><b>A / Q</b> (selon clavier) zip</li><li><b>Clic gauche / F</b> frapper · <b>C</b> dash</li><li><b>R</b> action · <b>M</b> carte · <b>Échap</b> pause</li></ul></div>
      <div><h4>Tactile</h4><ul><li>Moitié gauche : joystick</li><li>Moitié droite : glisser pour la caméra</li><li>Boutons à droite : saut, grappin, zip, frappe, dash</li></ul></div></div>`, { button: 'Compris' });
  },
  exportCode() {
    const code = Store.exportCode();
    let copied = false;
    try { if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => { copied = true; this.notify('Code copié', 'Colle-le sur ton autre appareil'); }).catch(() => {}); } catch (e) {}
    Modal.info('Code de transfert', `<p>Sur ton autre appareil, ouvre NOVA → Sauvegardes → <b>Importer un code</b>, puis colle ce code :</p><div class="code select-all">${code}</div><p class="small">Touche le code pour le sélectionner. Il contient toute ta progression (${(code.length / 1024).toFixed(1)} Ko).</p>`, { button: 'Fermer' });
  },
  async importCode() {
    const v = await Modal.info('Importer un code', '<p>Colle le code de transfert (il commence par <b>NOVA1-</b>).</p>', { input: true, button: 'Importer' });
    if (!v) return;
    try { Store.importCode(v); this.notify('Sauvegarde importée', 'Ta progression est à jour'); this.paintHero(false); }
    catch (e) { Sound.sfx('fail'); this.notify('Code invalide', 'Vérifie que le code est complet'); }
  },
  async rename() {
    const v = await Modal.info('Pseudo', '<p>Comment veux-tu t’appeler ?</p>', { input: true, value: Store.data.profile.name, button: 'Valider' });
    if (v && v.trim()) { Store.data.profile.name = v.trim().slice(0, 18); Store.touch(); }
  },
  openSettings() {
    const S = Store.settings;
    const qual = ['auto', 'low', 'medium', 'high'], qn = { auto: 'Auto', low: 'Bas', medium: 'Moyen', high: 'Haut' };
    const tg = k => ({ left: () => { S[k] = !S[k]; Store.touch(); }, right: () => { S[k] = !S[k]; Store.touch(); }, get: () => S[k] ? 'Oui' : 'Non' });
    const num = (k, step, min, max, fmt, after) => ({ get: () => fmt(S[k]), left: () => { S[k] = Math.max(min, +(S[k] - step).toFixed(2)); after && after(); Store.touch(); }, right: () => { S[k] = Math.min(max, +(S[k] + step).toFixed(2)); after && after(); Store.touch(); } });
    const items = [
      { label: 'Pseudo', get: () => Store.data.profile.name, act: () => this.rename() },
      { label: 'Sensibilité caméra', ...num('sens', 0.1, 0.3, 3, v => v.toFixed(1)) },
      { label: 'Inverser l’axe vertical', ...tg('invertY') },
      { label: 'Musique', ...num('music', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) },
      { label: 'Effets sonores', ...num('sfx', 0.1, 0, 1, v => Math.round(v * 100) + ' %', () => Sound.applyVolumes()) },
      { label: 'Vibrations de la manette', ...tg('rumble') },
      { label: 'Qualité graphique', sub: 'Auto = adaptée à l’appareil (télé, téléphone, PC)', get: () => qn[S.quality], left: () => { S.quality = qual[(qual.indexOf(S.quality) + 3) % 4]; Store.touch(); }, right: () => { S.quality = qual[(qual.indexOf(S.quality) + 1) % 4]; Store.touch(); } },
      { label: 'Afficher les FPS en jeu', ...tg('fps') },
      { label: 'Mode télé', sub: 'Pour Chromecast et navigateurs TV : qualité basse, pas de boutons tactiles, effets allégés. Recharge la page.', get: () => isTV ? '<b class="eq">Activé</b>' : 'Désactivé', left: () => this.toggleTV(), right: () => this.toggleTV() },
      { label: 'Plein écran', act: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => this.notify('Plein écran indisponible', 'Ton navigateur le refuse ici')); } } catch (e) { this.notify('Plein écran indisponible', 'Ton navigateur le refuse ici'); } } },
      { label: 'Fermer', cls: 'exit', act: () => this.closePanel() },
    ];
    const p = el('div', 'panel-back');
    p.innerHTML = `<div class="panel glass"><div class="gm-kicker">NOVA</div><h2>Paramètres</h2><div class="gm-list"></div><div class="gm-foot">${Input.glyph('confirm')} Valider &nbsp; ◀ ▶ Ajuster &nbsp; ${Input.glyph('back')} Fermer</div></div>`;
    document.body.appendChild(p);
    p.addEventListener('click', e => { if (e.target === p) this.closePanel(); });
    this.panel = { el: p, list: new ListMenu(p.querySelector('.gm-list'), items) };
  },
  toggleTV() { try { localStorage.setItem('nova.tv', isTV ? '0' : '1'); } catch (e) {} location.reload(); },
  closePanel() { if (!this.panel) return; this.panel.el.remove(); this.panel = null; Sound.sfx('back'); },
  async launch(id) {
    if (this.game || this.launching) return;
    this.launching = true;
    Sound.unlock(); Sound.sfx('select');
    const ld = this.$('#loading');
    const G0 = GAMES.find(x => x.id === id); ld.querySelector('.ld-title').textContent = G0.title;
    const tips = G0.tips || ['Relâche le grappin en haut de la courbe pour monter plus haut.', 'Cours droit vers un mur pour l’escalader.', 'Un atterrissage de très haut crée une onde de choc.', 'Le dash rend invincible un court instant : esquive les tirs !', 'Les éclats d’énergie se cachent sur les toits les plus hauts.', 'Frappe en l’air pour enchaîner les combos sans toucher le sol.'];
    ld.querySelector('.ld-tip').textContent = tips[(Math.random() * tips.length) | 0];
    ld.classList.add('show');
    document.body.classList.add('ingame-loading');
    await new Promise(r => setTimeout(r, 450));
    try {
      const mod = await import(`./${G0.mod}.js`);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
      const root = this.$('#game'); root.innerHTML = ''; root.classList.add('on');
      document.body.classList.add('ingame');
      Sound.playMusic(null);
      this.game = new mod[G0.cls](root, { onExit: () => this.backToHub() });
      window.__nova = this;
    } catch (e) {
      console.error(e);
      this.notify('Impossible de lancer le jeu', String(e && e.message || e).slice(0, 120));
      this.$('#game').classList.remove('on'); document.body.classList.remove('ingame');
    }
    ld.classList.remove('show'); document.body.classList.remove('ingame-loading');
    this.launching = false;
  },
  backToHub() {
    this.game = null;
    const root = this.$('#game'); root.classList.remove('on'); root.innerHTML = '';
    document.body.classList.remove('ingame');
    Sound.playMusic('hub');
    this.focusZone = 'rail'; this.paintHero(true); this.paintStatus(); this.paintHints();
    this.last = performance.now();
  },
  initFx() {
    const c = this.$('#fx'), x = c.getContext('2d');
    const pts = Array.from({ length: isTV ? 26 : 50 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.02 + 0.006, a: Math.random() }));
    if (isTV || lowEnd) { c.style.display = 'none'; return; }
    const draw = () => {
      if (!this.game) {
        const w = c.width = c.clientWidth, h = c.height = c.clientHeight;
        x.clearRect(0, 0, w, h);
        const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#35e8ff';
        for (const p of pts) {
          p.y -= p.s * 0.016; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
          p.a += 0.01;
          x.globalAlpha = 0.25 + Math.sin(p.a) * 0.2; x.fillStyle = acc;
          x.beginPath(); x.arc(p.x * w, p.y * h, p.r, 0, 7); x.fill();
        }
      }
      setTimeout(() => requestAnimationFrame(draw), isTV ? 66 : 33);
    };
    draw();
  },
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    if (this.game) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    Input.poll();
    const nav = Input.nav(dt);
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('gone')) {
      if (Input.pressed('confirm') || Input.pressed('jump') || Object.keys(Input.cur).some(k => Input.cur[k] && !Input.prev[k])) this.splashGo();
      return;
    }
    if (Modal.active) { Modal.active.update(nav); return; }
    if (this.panel) { this.panel.list.update(nav); if (Input.pressed('back') && this.panel) this.closePanel(); return; }
    if (this.launching) return;
    const z = this.focusZone;
    if (z === 'rail') {
      if (nav === 'left' && this.idx > 0) this.select(this.idx - 1);
      else if (nav === 'right' && this.idx < TILES.length - 1) this.select(this.idx + 1);
      else if (nav === 'down') { this.focusZone = 'actions'; this.aIdx = 0; this.paintFocus(); Sound.sfx('move'); }
      if (Input.pressed('confirm')) this.activateTile();
    } else if (z === 'actions') {
      if (nav === 'left' && this.aIdx > 0) { this.aIdx--; this.paintFocus(); Sound.sfx('move'); }
      else if (nav === 'right' && this.aIdx < this.actions.length - 1) { this.aIdx++; this.paintFocus(); Sound.sfx('move'); }
      else if (nav === 'up') { this.focusZone = 'rail'; this.paintFocus(); Sound.sfx('move'); }
      else if (nav === 'down' && this.cardData.length) { this.focusZone = 'cards'; this.cIdx = 0; this.paintFocus(); Sound.sfx('move'); }
      if (Input.pressed('confirm')) this.activateAction();
      else if (Input.pressed('back')) { this.focusZone = 'rail'; this.paintFocus(); Sound.sfx('back'); }
    } else if (z === 'cards') {
      if (nav === 'left' && this.cIdx > 0) { this.cIdx--; this.paintFocus(); Sound.sfx('move'); }
      else if (nav === 'right' && this.cIdx < this.cardData.length - 1) { this.cIdx++; this.paintFocus(); Sound.sfx('move'); }
      else if (nav === 'up') { this.focusZone = 'actions'; this.paintFocus(); Sound.sfx('move'); }
      if (Input.pressed('confirm')) { if (TILES[this.idx].playable) this.launch(TILES[this.idx].id); }
      else if (Input.pressed('back')) { this.focusZone = 'rail'; this.paintFocus(); Sound.sfx('back'); }
    }
  },
};
