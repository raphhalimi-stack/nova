// RIVAGE — données : objets, recettes, constructions, faune, histoire, styles.
import * as THREE from './three.module.min.js';

export const ITEMS = {
  stick: ['Bâton', '🪵'], stone: ['Pierre', '🪨'], flint: ['Silex', '◆'], fiber: ['Fibre', '🌿'], wood: ['Bûche', '🟫'], leaf: ['Feuillage', '🍃'],
  coconut: ['Noix de coco', '🥥', { food: 12, water: 24 }], berry: ['Baies', '🫐', { food: 7, water: 3 }], aloe: ['Aloès', '🌵'], shell: ['Coquillage', '🐚'],
  rawmeat: ['Viande crue', '🥩', { food: 14, sick: 1 }], meat: ['Viande cuite', '🍖', { food: 40 }], rawfish: ['Poisson cru', '🐟', { food: 10, sick: 1 }], fish: ['Poisson grillé', '🍣', { food: 32 }],
  hide: ['Peau', '🟤'], ore: ['Minerai de fer', '🟠'], iron: ['Lingot de fer', '🔩'], crystal: ['Cristal', '💎'], rope: ['Corde', '🪢'],
  bandage: ['Bandage', '🩹', { heal: 35 }], gourd: ['Gourde', '🧴'], water: ['Eau potable', '💧', { water: 42 }], ration: ['Ration', '🥫', { food: 45, water: 10 }],
  frag: ['Fragment du Passage', '✴'], key: ['Clé du Passage', '🗝'], coat: ['Manteau de peau', '🧥'],
  axe1: ['Hache de pierre', '🪓'], axe2: ['Hache de fer', '🪓'], pick1: ['Pioche de pierre', '⛏'], pick2: ['Pioche de fer', '⛏'], spear: ['Lance', '🔱'], knife: ['Couteau de silex', '🔪'], torch: ['Torche', '🔥'], hammer: ['Marteau', '🔨'],
};
export const TOOLS = {
  hands: { n: 'Mains', icon: '✋', dmg: 6, reach: 2.4 },
  axe1: { chop: 2, dmg: 16, reach: 2.7 }, axe2: { chop: 5, dmg: 28, reach: 2.7 },
  pick1: { mine: 2, dig: 0.5, dmg: 12, reach: 2.7 }, pick2: { mine: 5, dig: 0.9, dmg: 18, reach: 2.7 },
  spear: { dmg: 32, reach: 3.6 }, knife: { dmg: 20, reach: 2.4 }, torch: { dmg: 8, reach: 2.4, light: 1 }, hammer: { dmg: 8, reach: 3.5, demol: 1 },
};
export const RECIPES = [
  { id: 'axe1', need: { stick: 2, stone: 2, fiber: 1 }, d: 'Abattre les arbres' },
  { id: 'pick1', need: { stick: 2, stone: 3, fiber: 1 }, d: 'Casser la roche et creuser le sol' },
  { id: 'knife', need: { flint: 1, stick: 1, fiber: 1 }, d: 'Arme rapide' },
  { id: 'spear', need: { stick: 3, flint: 1, fiber: 2 }, d: 'Chasse et pêche, longue portée' },
  { id: 'torch', need: { stick: 1, fiber: 2 }, d: 'Éclaire la nuit' },
  { id: 'hammer', need: { stick: 1, stone: 1, fiber: 1 }, d: 'Démonter une construction' },
  { id: 'rope', need: { fiber: 3 }, d: 'Pour les portes et les outils en fer' },
  { id: 'bandage', need: { fiber: 2, aloe: 1 }, d: 'Soigne 35 points de santé' },
  { id: 'gourd', need: { coconut: 1, fiber: 1 }, d: 'Transporte 2 doses d’eau potable' },
  { id: 'coat', need: { hide: 3, fiber: 4 }, st: 'bench', d: 'Protège du froid (+10°)' },
  { id: 'iron', need: { ore: 2, wood: 1 }, st: 'furnace', d: 'Fondre le minerai' },
  { id: 'axe2', need: { iron: 2, stick: 2, rope: 1 }, st: 'bench', d: 'Abat un arbre en deux coups' },
  { id: 'pick2', need: { iron: 3, stick: 2, rope: 1 }, st: 'bench', d: 'Creuse profond, plus de cristaux' },
  { id: 'key', need: { frag: 5, crystal: 3 }, st: 'altar', d: 'Ouvre le Passage' },
];
export const STATION_NAMES = { bench: 'un établi', furnace: 'un fourneau', altar: 'l’autel du sommet' };
export const PIECES = [
  { id: 'found', n: 'Fondation', size: [2, 0.4, 2], cost: { wood: 2 }, k: 'cell', mat: 'wood' },
  { id: 'wall', n: 'Mur en bois', size: [2, 2.4, 0.2], cost: { wood: 2 }, k: 'edge', mat: 'wood' },
  { id: 'door', n: 'Porte', size: [2, 2.4, 0.2], cost: { wood: 2, rope: 1 }, k: 'edge', mat: 'wood', door: 1 },
  { id: 'floor', n: 'Plancher / plafond', size: [2, 0.2, 2], cost: { wood: 2 }, k: 'cell', mat: 'wood' },
  { id: 'roof', n: 'Toit de feuillage', size: [2, 0.25, 2], cost: { stick: 2, leaf: 3 }, k: 'cell', mat: 'thatch' },
  { id: 'stairs', n: 'Escalier', size: [2, 2.4, 2], cost: { wood: 3 }, k: 'cell', mat: 'wood', stairs: 1 },
  { id: 'fence', n: 'Palissade', size: [2, 1.6, 0.25], cost: { stick: 4 }, k: 'edge', mat: 'wood' },
  { id: 'sfound', n: 'Dalle de pierre', size: [2, 0.4, 2], cost: { stone: 5 }, k: 'cell', mat: 'stone' },
  { id: 'swall', n: 'Mur de pierre', size: [2, 2.4, 0.4], cost: { stone: 6 }, k: 'edge', mat: 'stone' },
  { id: 'fire', n: 'Feu de camp', size: [1, 0.35, 1], cost: { stick: 3, stone: 3 }, k: 'free', st: 1 },
  { id: 'bed', n: 'Couchage', size: [1.1, 0.35, 2.1], cost: { leaf: 4, fiber: 3, stick: 2 }, k: 'free', st: 1 },
  { id: 'bench', n: 'Établi', size: [1.6, 0.9, 0.8], cost: { wood: 4, stone: 2 }, k: 'free', st: 1 },
  { id: 'furnace', n: 'Fourneau', size: [1.1, 1.5, 1.1], cost: { stone: 10 }, k: 'free', st: 1 },
  { id: 'collector', n: 'Collecteur de pluie', size: [1.2, 0.9, 1.2], cost: { stick: 4, leaf: 3 }, k: 'free', st: 1 },
];
export const ANIMALS = {
  crab: { n: 'Crabe', hp: 10, spd: 2.4, flee: 5, drop: { rawmeat: 1 }, r: 0.4 },
  goat: { n: 'Chèvre sauvage', hp: 40, spd: 8.5, flee: 13, drop: { rawmeat: 2, hide: 2 }, r: 0.8 },
  boar: { n: 'Sanglier', hp: 65, spd: 6.8, dmg: 12, drop: { rawmeat: 3, hide: 1 }, r: 0.8, neutral: 1 },
  pred: { n: 'Fauve', hp: 60, spd: 8.6, dmg: 16, aggro: 22, drop: { rawmeat: 2, hide: 2 }, r: 0.85 },
  shark: { n: 'Requin', hp: 130, spd: 6.4, dmg: 24, aggro: 26, drop: { rawmeat: 4 }, r: 1.3, water: 1 },
  fish: { n: 'Poisson', hp: 5, spd: 3.2, flee: 3.5, drop: { rawfish: 1 }, r: 0.45, water: 1 },
};
export const PRED_NAMES = { tropic: 'Jaguar', volcan: 'Varan', nord: 'Loup' };
export const ERAS = {
  e1720: { n: '1720', sub: 'Naufrage du galion', wreck: 'le galion', start: { knife: 1, rope: 1 }, role: 'navigatrice', intro: 'La tempête a brisé le galion sur les récifs. Tu reprends connaissance sur le sable, la bouche pleine de sel.' },
  e2026: { n: '2026', sub: 'Crash de l’hydravion', wreck: 'l’hydravion', start: { gourd: 1, water: 2, bandage: 1 }, role: 'pilote', intro: 'Le moteur a lâché au-dessus de l’océan. Tu reprends connaissance sur le sable. Aucun réseau, aucune balise.' },
  e2190: { n: '2190', sub: 'Chute de la capsule', wreck: 'la capsule', start: { ration: 3, torch: 1 }, role: 'ingénieure de bord', intro: 'La capsule de secours a traversé le ciel comme une pierre. Tu reprends connaissance sur le sable. Cette île n’est sur aucune carte.' },
};
export const MODES = {
  story: { n: 'Histoire', sub: 'Survie équilibrée, on réapparaît après une mort' },
  hard: { n: 'Hardcore', sub: 'Besoins ×1,6, dégâts ×1,5, une seule vie : la mort efface la partie' },
  creative: { n: 'Créatif', sub: 'Aucun besoin, tout est gratuit, vol libre (maintenir Saut)' },
};
export const MODS = {
  rich: ['Ressources ×3', 'Chaque récolte rapporte trois fois plus'],
  lowgrav: ['Gravité lunaire', 'Sauts immenses, chutes lentes'],
  speed: ['Sprint surhumain', 'Tu cours deux fois plus vite'],
  giants: ['Faune géante', 'Animaux deux fois plus gros et plus résistants'],
  peace: ['Faune pacifique', 'Aucun animal n’attaque'],
  storm: ['Tempête permanente', 'Pluie, vent et éclairs sans fin'],
  longnight: ['Nuits sans fin', 'Les nuits durent trois fois plus longtemps'],
};
export const JOURNAL = [
  ['Carnet d’Ilan Kerr — I', 'Jour 12. Je ne suis pas le premier à m’échouer ici. Il y a des pierres dressées, bien plus vieilles que nos cartes. Elles forment un chemin : la tanière, les ruines sous l’eau, le sanctuaire, puis le sommet. Chacune garde un fragment. J’ai marqué les lieux sur la carte.'],
  ['Carnet d’Ilan Kerr — II', 'Jour 80. La femelle de la tanière ne m’attaque que si j’avance vers ses petits. Je pourrais la tuer, j’ai une lance. Sora dit qu’on ne prend pas à l’île sans lui rendre. Je lui ai laissé de la viande. Elle m’a regardé passer.'],
  ['Carnet d’Ilan Kerr — III', 'Jour 211. Les ruines englouties. Retiens ton souffle et compte. Les anciens plongeaient pour mériter le fragment. Le requin tourne, mais il préfère les nageurs qui paniquent.'],
  ['Carnet d’Ilan Kerr — IV', 'Jour 340. Le fragment du sanctuaire nourrit les sources. Si on l’arrache, l’eau douce se tait. On peut le remplacer par six cristaux taillés, pris au fond de la terre. C’est long. Sora a creusé tout un hiver.'],
  ['Carnet d’Ilan Kerr — V', 'Jour 1 902. La clé se brise quand quelqu’un passe. Une clé, un voyageur. Sora est passée. J’ai tenu la porte. Je croyais forger une seconde clé, mais l’île ne donne ses fragments qu’une fois par vie. À moins… les anciens écrivent que le Passage reste ouvert pour ceux qui n’ont rien pris à l’île par force.'],
  ['Carnet d’Ilan Kerr — VI', 'Dernière page. Si tu lis ceci, tu as les cinq. Monte. Et si tu n’es pas seul, choisis avant d’arriver en haut. Là-haut, on n’a plus le temps de réfléchir, seulement celui de regretter.'],
];
export const CSS = `
.rv-hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-family:Inter,sans-serif;text-shadow:0 1px 5px rgba(0,0,0,.65)}
.rv-stats{position:absolute;left:calc(16px + var(--safe-l));bottom:calc(16px + var(--safe-b));display:flex;flex-direction:column;gap:6px;width:clamp(150px,17vw,230px)}
.rv-bar{display:flex;align-items:center;gap:8px;font-size:13px}.rv-bar em{font-style:normal;width:18px;text-align:center}
.rv-bar div{flex:1;height:8px;border-radius:5px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);overflow:hidden}
.rv-bar i{display:block;height:100%;border-radius:5px;transition:width .25s}
.rv-bar.hp i{background:linear-gradient(90deg,#ff4d5e,#ff8a7a)}.rv-bar.food i{background:linear-gradient(90deg,#ffa23d,#ffd06b)}.rv-bar.water i{background:linear-gradient(90deg,#3db8ff,#8fe0ff)}.rv-bar.en i{background:linear-gradient(90deg,#7be86b,#c8ff8a)}.rv-bar.o2 i{background:linear-gradient(90deg,#b8f3ff,#fff)}
.rv-bar.low div{animation:blink .7s infinite;border-color:#ff5a6a}
.rv-top{position:absolute;right:calc(16px + var(--safe-r));top:calc(14px + var(--safe-t));display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.rv-chip{padding:6px 12px;border-radius:20px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.15);font-weight:600;font-size:13px;white-space:nowrap}
.rv-chip.cold{color:#9fd8ff}.rv-chip.hot{color:#ffae7a}
.rv-obj{position:absolute;left:calc(16px + var(--safe-l));top:calc(14px + var(--safe-t));max-width:min(400px,44vw);padding:10px 14px;border-left:3px solid var(--acc);background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,0))}
.rv-obj b{display:block;font-family:var(--fd);font-size:12px;letter-spacing:.1em;color:var(--acc);text-transform:uppercase}.rv-obj span{font-size:14px;line-height:1.4}.rv-obj small{display:block;font-size:12px;opacity:.75;margin-top:2px}
.rv-hot{position:absolute;left:50%;bottom:calc(14px + var(--safe-b));transform:translateX(-50%);display:flex;gap:6px}
.rv-slot{width:48px;height:48px;border-radius:12px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;font-size:22px;text-shadow:none}
.rv-slot.on{border-color:#fff;box-shadow:0 0 14px var(--acc);background:rgba(255,255,255,.14);transform:translateY(-4px)}
.rv-prompt{position:absolute;left:50%;top:58%;transform:translateX(-50%);padding:8px 16px;border-radius:22px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.2);font-weight:600;font-size:14px;white-space:nowrap;opacity:0;transition:opacity .15s;display:flex;gap:8px;align-items:center}
.rv-prompt.show{opacity:1}
.rv-build{position:absolute;left:50%;top:calc(60px + var(--safe-t));transform:translateX(-50%);padding:10px 18px;border-radius:16px;background:rgba(0,0,0,.6);border:1px solid var(--acc);text-align:center;font-size:13px;display:none}
.rv-build b{display:block;font-family:var(--fd);font-size:16px}.rv-build .no{color:#ff7a8a}
.rv-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity 1.2s;display:grid;place-items:center;text-align:center;font-family:var(--fd);font-size:clamp(18px,2.6vw,30px);padding:10vw;line-height:1.5;z-index:15}
.rv-fade.on{opacity:1}
.rv-under{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(10,90,110,.25),rgba(2,30,50,.65));opacity:0;transition:opacity .3s}
.rv-under.on{opacity:1}
.rv-hurt{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(255,0,30,.5));opacity:0}
.rv-hurt.hit{animation:vig .5s ease-out}
.rv-cold{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(170,220,255,.4));opacity:0;transition:opacity 1s}
.rv-dlg{position:absolute;left:50%;bottom:calc(20px + var(--safe-b));transform:translateX(-50%);width:min(760px,94vw);border-radius:22px;padding:20px 22px;pointer-events:auto;z-index:18;max-height:86vh;overflow:auto}
.rv-dlg h4{font-family:var(--fd);font-size:13px;letter-spacing:.2em;color:var(--acc);text-transform:uppercase;margin-bottom:8px}
.rv-dlg p{font-size:16px;line-height:1.6;margin-bottom:14px;white-space:pre-line}
.rv-tabs{display:flex;gap:8px;margin:6px 0 12px}.rv-tab{padding:8px 16px;border-radius:20px;background:rgba(255,255,255,.07);font-weight:700;font-size:13px;border:1px solid transparent;pointer-events:auto}
.rv-tab.on{background:#fff;color:#05060a}
.rv-setup{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:radial-gradient(1200px 700px at 70% 10%,#12384a 0,transparent 60%),radial-gradient(900px 600px at 10% 90%,#3a2410 0,transparent 60%),#04070c;pointer-events:auto}
.rv-setup .gmenu-panel{width:min(720px,95vw)}
.rv-end{position:absolute;inset:0;z-index:25;background:rgba(2,3,8,.92);display:grid;place-items:center;pointer-events:auto;animation:fade 2s}
.rv-end>div{width:min(720px,92vw);text-align:center}.rv-end h1{font-family:var(--fd);font-size:clamp(30px,5vw,60px);letter-spacing:.1em;margin-bottom:6px}.rv-end h3{font-family:var(--fd);color:var(--acc);letter-spacing:.3em;font-size:13px;margin-bottom:20px}
.rv-end p{font-size:17px;line-height:1.7;color:rgba(255,255,255,.88);white-space:pre-line;margin-bottom:22px}
.rv-map{display:flex;gap:18px;padding:18px;border-radius:26px;width:min(1120px,96vw);height:min(720px,92vh)}
.rv-map canvas{height:100%;aspect-ratio:1;border-radius:18px;max-width:56%}
.has-touch .rv-stats{bottom:auto;top:calc(128px + var(--safe-t));width:120px;gap:4px}.has-touch .rv-obj small{display:none}.has-touch .rv-hot{bottom:auto;top:calc(14px + var(--safe-t));transform:translateX(-50%) scale(.8);transform-origin:top center}.has-touch .rv-obj{max-width:34vw}.has-touch .rv-top{top:calc(56px + var(--safe-t))}
.t-top.rv{right:calc(14px + var(--safe-r));top:auto;bottom:calc(250px + var(--safe-b));flex-wrap:wrap;justify-content:flex-end;width:250px}
@media (max-height:560px){.rv-obj span{font-size:12px}.rv-slot{width:40px;height:40px;font-size:18px}.rv-dlg p{font-size:14px}.t-top.rv{bottom:calc(216px + var(--safe-b))}}
`;

/* ---------------- modèles ---------------- */
const L = c => new THREE.MeshLambertMaterial({ color: c });
export function buildHuman({ skin = 0xc68e6a, top = 0x2f5d7a, bottom = 0x3b3a36, hair = 0x2a1c12, long = false }) {
  const g = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  const mk = (geo, mat, x, y, z, p = hips) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const mS = L(skin), mT = L(top), mB = L(bottom), mH = L(hair);
  const torso = mk(new THREE.CapsuleGeometry(0.21, 0.36, 4, 10), mT, 0, 0.4, 0); torso.scale.set(1, 1, 0.7);
  mk(new THREE.CapsuleGeometry(0.2, 0.1, 4, 10), mB, 0, 0.06, 0).scale.set(1, 1, 0.72);
  const head = new THREE.Group(); head.position.y = 0.92; hips.add(head);
  mk(new THREE.SphereGeometry(0.17, 16, 12), mS, 0, 0, 0, head);
  mk(new THREE.SphereGeometry(0.18, 14, 10, 0, 6.3, 0, 1.7), mH, 0, 0.02, -0.02, head);
  mk(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), mS, 0, -0.18, 0, head);
  if (long) mk(new THREE.CapsuleGeometry(0.07, 0.3, 3, 8), mH, 0, -0.16, -0.16, head);
  const limb = (x, y, len, rad, m1, m2, foot) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); hips.add(piv);
    mk(new THREE.CapsuleGeometry(rad, len * 0.5, 3, 8), m1, 0, -len * 0.27, 0, piv);
    mk(new THREE.CapsuleGeometry(rad * 0.86, len * 0.45, 3, 8), m2, 0, -len * 0.77, 0, piv);
    const end = foot ? mk(new THREE.BoxGeometry(0.13, 0.08, 0.26), L(0x2a2420), 0, -len - 0.06, 0.05, piv) : mk(new THREE.SphereGeometry(0.065, 8, 6), mS, 0, -len - 0.03, 0, piv);
    piv.userData.end = end; return piv;
  };
  const armL = limb(-0.29, 0.66, 0.56, 0.06, mT, mS), armR = limb(0.29, 0.66, 0.56, 0.06, mT, mS);
  const legL = limb(-0.11, 0, 0.82, 0.085, mB, mS, true), legR = limb(0.11, 0, 0.82, 0.085, mB, mS, true);
  g.userData = { hips, head, armL, armR, legL, legR };
  return g;
}
export function toolMesh(id) {
  const g = new THREE.Group(); if (!id || id === 'hands') return g;
  const wood = L(0x6e5539), stone = L(0x86837e), iron = L(0xb9c0c8), dark = L(0x2b2d33);
  const add = (geo, m, x, y, z, rx = 0, rz = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.rotation.set(rx, 0, rz); k.castShadow = true; g.add(k); };
  const handle = (l = 0.7) => add(new THREE.CylinderGeometry(0.02, 0.025, l, 6), wood, 0, -l / 2 + 0.08, 0);
  if (id.startsWith('axe')) { handle(); add(new THREE.BoxGeometry(0.2, 0.14, 0.035), id === 'axe2' ? iron : stone, 0.09, -0.52, 0); }
  else if (id.startsWith('pick')) { handle(); add(new THREE.BoxGeometry(0.42, 0.05, 0.05), id === 'pick2' ? iron : stone, 0, -0.56, 0); }
  else if (id === 'spear') { add(new THREE.CylinderGeometry(0.018, 0.02, 1.7, 6), wood, 0, -0.5, 0); add(new THREE.ConeGeometry(0.04, 0.2, 5), dark, 0, -1.44, 0, Math.PI); }
  else if (id === 'knife') { handle(0.16); add(new THREE.ConeGeometry(0.03, 0.22, 4), dark, 0, -0.2, 0, Math.PI); }
  else if (id === 'hammer') { handle(0.5); add(new THREE.BoxGeometry(0.2, 0.1, 0.1), stone, 0, -0.42, 0); }
  else if (id === 'torch') { handle(0.5); const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xffa23d })); f.position.y = -0.55; f.rotation.x = Math.PI; g.add(f); g.userData.flame = f; }
  return g;
}
export function buildAnimal(type, island) {
  const g = new THREE.Group(), legs = [];
  const add = (geo, m, x, y, z, p = g) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.castShadow = true; p.add(k); return k; };
  if (type === 'crab') {
    const m = L(0xc8452c); add(new THREE.SphereGeometry(0.22, 10, 8), m, 0, 0.14, 0).scale.set(1.3, 0.5, 1);
    for (let i = 0; i < 6; i++) legs.push(add(new THREE.BoxGeometry(0.2, 0.03, 0.03), m, (i < 3 ? -1 : 1) * 0.32, 0.08, (i % 3 - 1) * 0.12));
    add(new THREE.SphereGeometry(0.07, 6, 5), m, -0.2, 0.14, 0.24); add(new THREE.SphereGeometry(0.07, 6, 5), m, 0.2, 0.14, 0.24);
  } else if (type === 'fish') {
    const m = L([0xffa23d, 0x5ec8ff, 0xe8e06b][(Math.random() * 3) | 0]); add(new THREE.SphereGeometry(0.2, 10, 8), m, 0, 0, 0).scale.set(0.45, 0.8, 1.5);
    const t = add(new THREE.ConeGeometry(0.14, 0.2, 4), m, 0, 0, -0.36); t.rotation.x = -Math.PI / 2; t.scale.x = 0.3; g.userData.tail = t;
  } else if (type === 'shark') {
    const m = L(0x5e6c78), w = L(0xdfe6ea); const b = add(new THREE.CapsuleGeometry(0.42, 1.9, 4, 10), m, 0, 0, 0); b.rotation.x = Math.PI / 2; b.scale.set(0.9, 1, 1);
    add(new THREE.ConeGeometry(0.42, 0.9, 10), m, 0, 0, 1.75).rotation.x = Math.PI / 2;
    add(new THREE.ConeGeometry(0.22, 0.6, 4), m, 0, 0.55, -0.1).scale.z = 0.3;
    const t = add(new THREE.ConeGeometry(0.4, 0.7, 4), m, 0, 0, -1.6); t.rotation.x = -Math.PI / 2; t.scale.x = 0.2; g.userData.tail = t;
    add(new THREE.SphereGeometry(0.3, 8, 6), w, 0, -0.2, 0.6).scale.set(1, 0.5, 2);
  } else {
    const col = type === 'boar' ? 0x4a3a2c : type === 'goat' ? 0xb9a78a : island === 'nord' ? 0x8a8f96 : island === 'volcan' ? 0x4f5b3a : 0xc59a45;
    const m = L(col), d = L(0x231c16);
    const bl = type === 'boar' ? 1.0 : 1.15, bh = type === 'boar' ? 0.62 : 0.72;
    const b = add(new THREE.CapsuleGeometry(type === 'boar' ? 0.34 : 0.26, bl - 0.4, 4, 10), m, 0, bh, 0); b.rotation.x = Math.PI / 2;
    const head = new THREE.Group(); head.position.set(0, bh + 0.12, bl / 2 + 0.12); g.add(head);
    add(new THREE.SphereGeometry(0.19, 10, 8), m, 0, 0, 0, head).scale.set(0.9, 0.9, 1.25);
    add(new THREE.SphereGeometry(0.09, 8, 6), d, 0, -0.04, 0.2, head);
    if (type === 'goat') { add(new THREE.ConeGeometry(0.03, 0.26, 5), d, -0.08, 0.22, -0.05, head).rotation.x = -0.5; add(new THREE.ConeGeometry(0.03, 0.26, 5), d, 0.08, 0.22, -0.05, head).rotation.x = -0.5; }
    else { add(new THREE.ConeGeometry(0.05, 0.12, 4), m, -0.11, 0.17, -0.02, head); add(new THREE.ConeGeometry(0.05, 0.12, 4), m, 0.11, 0.17, -0.02, head); }
    if (type === 'boar') { add(new THREE.ConeGeometry(0.02, 0.12, 4), L(0xeee6d0), -0.1, -0.08, 0.2, head); add(new THREE.ConeGeometry(0.02, 0.12, 4), L(0xeee6d0), 0.1, -0.08, 0.2, head); }
    for (let i = 0; i < 4; i++) { const piv = new THREE.Group(); piv.position.set((i % 2 ? 1 : -1) * 0.17, bh - 0.1, (i < 2 ? 1 : -1) * (bl / 2 - 0.12)); g.add(piv); add(new THREE.CylinderGeometry(0.05, 0.04, bh - 0.1, 6), m, 0, -(bh - 0.1) / 2, 0, piv); legs.push(piv); }
    if (type === 'pred') { const t = add(new THREE.CylinderGeometry(0.03, 0.02, 0.7, 5), m, 0, bh + 0.05, -bl / 2 - 0.3); t.rotation.x = 1.1; }
    g.userData.head = head;
  }
  g.userData.legs = legs;
  return g;
}
