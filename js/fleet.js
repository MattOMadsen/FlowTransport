/** Fleet classes, upgrade & sell (MVP) */

export const FLEET = {
  maxUpgradeRank: 3,
  /** Sell refund as fraction of base + upgrade value */
  sellRefund: 0.55,
  sellUpgradeBonus: 28
};

export const VEHICLE_CLASSES = {
  car: {
    id: 'car',
    label: 'Personbil',
    kind: 'car',
    speed: 95,
    capacity: 4,
    buyPrice: 220,
    sprite: 'car',
    icon: '🚗',
    blurb: 'Personer · cap 4'
  },
  bus: {
    id: 'bus',
    label: 'Bus',
    kind: 'car',
    speed: 78,
    capacity: 10,
    buyPrice: 420,
    sprite: 'bus',
    icon: '🚌',
    blurb: 'Mange passagerer · cap 10'
  },
  van: {
    id: 'van',
    label: 'Varebil',
    kind: 'truck',
    speed: 88,
    capacity: 5,
    buyPrice: 300,
    sprite: 'van',
    icon: '🚐',
    blurb: 'Hurtig gods · cap 5'
  },
  truck: {
    id: 'truck',
    label: 'Lastbil',
    kind: 'truck',
    speed: 72,
    capacity: 8,
    buyPrice: 380,
    sprite: 'truck',
    icon: '🚚',
    blurb: 'Gods · cap 8'
  }
};

/** Order shown in shop */
export const SHOP_CLASS_IDS = ['car', 'bus', 'van', 'truck'];

export function vehicleCanDoJob(classId, job) {
  const cls = VEHICLE_CLASSES[classId] || VEHICLE_CLASSES.car;
  if (job.type === 'cargo') return cls.kind === 'truck';
  return cls.kind === 'car';
}

export function buyPrice(classId) {
  return VEHICLE_CLASSES[classId]?.buyPrice ?? 220;
}

export function getClass(classId) {
  return VEHICLE_CLASSES[classId] || VEHICLE_CLASSES.car;
}

/** Capacity grows +1 per upgrade rank (capped). */
export function cargoCapacity(classId, upgradeRank = 0) {
  const c = getClass(classId);
  const rank = Math.max(0, Math.min(FLEET.maxUpgradeRank, upgradeRank | 0));
  return c.capacity + rank;
}

/** Mild speed boost from upgrades. */
export function speedForClass(classId, upgradeRank = 0) {
  const c = getClass(classId);
  const rank = Math.max(0, Math.min(FLEET.maxUpgradeRank, upgradeRank | 0));
  return Math.round(c.speed * (1 + rank * 0.03));
}

export function upgradePrice(upgradeRank = 0, classId = 'car') {
  const rank = Math.max(0, upgradeRank | 0);
  const c = getClass(classId);
  const premium = Math.round((c.buyPrice - 220) * 0.12);
  return 55 + rank * 42 + Math.max(0, premium);
}

export function canUpgrade(upgradeRank) {
  return (upgradeRank | 0) < FLEET.maxUpgradeRank;
}

/** Refund when selling (idle vehicles only). */
export function sellPriceForClass(classId, upgradeRank = 0) {
  const c = getClass(classId);
  const rank = Math.max(0, Math.min(FLEET.maxUpgradeRank, upgradeRank | 0));
  const value = c.buyPrice + rank * FLEET.sellUpgradeBonus;
  return Math.max(20, Math.round(value * FLEET.sellRefund));
}

export function classIcon(classId) {
  return getClass(classId).icon || '🚗';
}
