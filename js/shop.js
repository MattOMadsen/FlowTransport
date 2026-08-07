/** Global butik = ansæt folk (permanente buffs) + by-bygninger */

/**
 * Permanente «ansættelser» – gemmes i meta.shopOwned.
 * IDs for de fire første er uændrede (bagudkompatible saves).
 */
export const SHOP_BUFFS = [
  {
    id: 'roads_cheap',
    icon: '👷',
    role: 'Entreprenørhold',
    label: 'Entreprenørhold',
    desc: '−15 % på nye veje og broer (du tegner stadig selv)',
    price: 200,
    unlockLevel: 1
  },
  {
    id: 'snap_boost',
    icon: '📐',
    role: 'Landmåler',
    label: 'Landmåler',
    desc: '+40 % snap-radius når du tegner vej',
    price: 160,
    unlockLevel: 1
  },
  {
    id: 'express_office',
    icon: '⚡',
    role: 'Ekspres-dispatcher',
    label: 'Ekspres-dispatcher',
    desc: 'Flere ekspres-jobs i spillet',
    price: 220,
    unlockLevel: 2
  },
  {
    id: 'cargo_hub',
    icon: '📦',
    role: 'Gods-koordinator',
    label: 'Gods-koordinator',
    desc: 'Lidt flere gods-jobs',
    price: 240,
    unlockLevel: 2
  },
  {
    id: 'mechanic',
    icon: '🔧',
    role: 'Mekaniker',
    label: 'Mekaniker',
    desc: '−30 % på bil-service',
    price: 280,
    unlockLevel: 2
  },
  {
    id: 'foreman',
    icon: '🛣️',
    role: 'Vejformand',
    label: 'Vejformand',
    desc: '−20 % på 2-spor og motorvej-opgradering',
    price: 300,
    unlockLevel: 3
  },
  {
    id: 'planner',
    icon: '📋',
    role: 'Trafikplanlægger',
    label: 'Trafikplanlægger',
    desc: 'Jobs dukker lidt oftere op (stadig max 6 aktive)',
    price: 260,
    unlockLevel: 3
  }
];

export const BUILDINGS = {
  station: {
    id: 'station',
    icon: '🚉',
    label: 'Station',
    desc: '+passager-jobs fra byen',
    price: 180,
    color: '#2563eb'
  },
  warehouse: {
    id: 'warehouse',
    icon: '🏭',
    label: 'Lager',
    desc: '+gods-jobs fra byen',
    price: 180,
    color: '#b45309'
  },
  depot: {
    id: 'depot',
    icon: '🚏',
    label: 'Depot',
    desc: 'Biler her får job-prioritet',
    price: 210,
    color: '#0f766e'
  }
};

export function hasShopBuff(meta, buffId) {
  return !!(meta?.shopOwned && meta.shopOwned[buffId]);
}

export function roadCostMul(meta) {
  return hasShopBuff(meta, 'roads_cheap') ? 0.85 : 1;
}

export function snapRadiusMul(meta) {
  return hasShopBuff(meta, 'snap_boost') ? 1.4 : 1;
}

/** Service i by-shop */
export function serviceCostMul(meta) {
  return hasShopBuff(meta, 'mechanic') ? 0.7 : 1;
}

/** 2-spor / motorvej opgradering */
export function roadUpgradeCostMul(meta) {
  return hasShopBuff(meta, 'foreman') ? 0.8 : 1;
}

/** Sekunder mellem job-spawn (lavere = oftere) */
export function jobSpawnInterval(meta) {
  return hasShopBuff(meta, 'planner') ? 5.2 : 7;
}

export function hiredCount(meta) {
  if (!meta?.shopOwned) return 0;
  return Object.keys(meta.shopOwned).filter((k) => meta.shopOwned[k]).length;
}
