/** Global butik + by-bygninger */

export const SHOP_BUFFS = [
  {
    id: 'roads_cheap',
    icon: '🛤️',
    label: 'Billigere veje',
    desc: '−15 % på nye veje og broer',
    price: 200,
    unlockLevel: 1
  },
  {
    id: 'snap_boost',
    icon: '🧲',
    label: 'Snap-booster',
    desc: '+40 % snap-radius ved tegning',
    price: 160,
    unlockLevel: 1
  },
  {
    id: 'express_office',
    icon: '⚡',
    label: 'Ekspres-kontor',
    desc: 'Flere ekspres-jobs i spillet',
    price: 220,
    unlockLevel: 2
  },
  {
    id: 'cargo_hub',
    icon: '📦',
    label: 'Logistik-hub',
    desc: 'Lidt flere gods-jobs',
    price: 240,
    unlockLevel: 2
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
