/** Places: types, names, layouts */

export const PLACE_TYPES = {
  capital: { id: 'capital', label: 'Hovedby', icon: '⭐', color: '#a78bfa', passengers: 1.3, cargo: 0.7 },
  town: { id: 'town', label: 'By', icon: '🏠', color: '#60a5fa', passengers: 1.15, cargo: 0.55 },
  farm: { id: 'farm', label: 'Landbrug', icon: '🌾', color: '#84cc16', passengers: 0.35, cargo: 1.25 },
  factory: { id: 'factory', label: 'Fabrik', icon: '🏭', color: '#f59e0b', passengers: 0.55, cargo: 1.35 },
  harbor: { id: 'harbor', label: 'Havn', icon: '⚓', color: '#0ea5e9', passengers: 0.65, cargo: 1.2 }
};

const NAME_POOLS = {
  capital: ['Roskilde', 'Kolding', 'Viborg', 'Næstved', 'Horsens', 'Slagelse'],
  town: ['Birkehøj', 'Mølleby', 'Granlund', 'Solkær', 'Engsted', 'Klintborg', 'Lindelev', 'Ålholm', 'Sandved', 'Højby'],
  farm: ['Grønhøj Gods', 'Vestervang', 'Søndermark', 'Hvedemark', 'Kløverholt', 'Mosevang', 'Rugbjerg'],
  factory: ['Nordindustri', 'Jernværket', 'Betonværket', 'Papirfabrikken', 'Mejeriet Øst', 'Maskinfabrikken'],
  harbor: ['Havnsund', 'Fiskerup Havn', 'Kystterminalen', 'Ankerkaj', 'Strømhavn', 'Nordkajen']
};

export const LAYOUT_INTRO = [
  { rx: 0.45, ry: 0.42, rr: 0.045, type: 'capital' },
  { rx: 0.18, ry: 0.22, rr: 0.038, type: 'town' },
  { rx: 0.78, ry: 0.24, rr: 0.038, type: 'factory' },
  { rx: 0.14, ry: 0.58, rr: 0.036, type: 'farm' },
  { rx: 0.80, ry: 0.60, rr: 0.036, type: 'town' },
  { rx: 0.48, ry: 0.78, rr: 0.038, type: 'farm' }
];

export const LAYOUT_COAST = [
  { rx: 0.52, ry: 0.40, rr: 0.040, type: 'capital' },
  { rx: 0.12, ry: 0.32, rr: 0.040, type: 'harbor' },
  { rx: 0.30, ry: 0.16, rr: 0.034, type: 'town' },
  { rx: 0.78, ry: 0.18, rr: 0.036, type: 'factory' },
  { rx: 0.88, ry: 0.45, rr: 0.034, type: 'town' },
  { rx: 0.70, ry: 0.62, rr: 0.034, type: 'town' },
  { rx: 0.40, ry: 0.74, rr: 0.036, type: 'farm' },
  { rx: 0.18, ry: 0.70, rr: 0.034, type: 'farm' }
];

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickName(pool, used, rng) {
  const available = pool.filter((n) => !used.has(n));
  const list = available.length ? available : pool;
  const name = list[Math.floor(rng() * list.length)];
  used.add(name);
  return name;
}

/**
 * @param {number} worldW
 * @param {number} worldH
 * @param {object[]} layout
 * @param {number} seed
 */
export function buildPlaces(worldW, worldH, layout, seed = 101) {
  const rng = mulberry32(seed);
  const used = new Set();
  let townVariant = 0;
  return layout.map((def, i) => {
    const type = def.type || 'town';
    const meta = PLACE_TYPES[type] || PLACE_TYPES.town;
    const name = pickName(NAME_POOLS[type] || NAME_POOLS.town, used, rng);
    const x = def.rx * worldW;
    const y = def.ry * worldH;
    const r = def.rr * Math.min(worldW, worldH);
    const place = {
      id: `p${i}`,
      name,
      type,
      x,
      y,
      r,
      color: meta.color,
      icon: meta.icon,
      passengers: meta.passengers,
      cargo: meta.cargo,
      variant: type === 'town' ? townVariant++ : 0,
      nodeId: null
    };
    return place;
  });
}
