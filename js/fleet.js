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
  // Gods → lastbil/varebil; personer + ekspres → personbil/bus
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

/** Vejklasser: 1 alm · 2 2-spor · 3 motorvej */
export const ROAD_LANE_SPEED = {
  1: 1,
  2: 1.28,
  3: 1.72
};

/**
 * Hurtige personbiler/varebiler udnytter motorvej bedst;
 * bus/lastbil får stadig base-motorvejsfart men mindre ekstra bonus.
 */
export const HIGHWAY_CLASS_MUL = {
  car: 1.12,
  van: 1.08,
  bus: 0.98,
  truck: 0.94
};

/**
 * Effektiv farts-multiplikator for bil på vej med `lanes`.
 * @param {string} classId
 * @param {number} lanes
 */
export function roadSpeedMul(classId, lanes = 1) {
  const L = Math.max(1, Math.min(3, lanes | 0));
  let m = ROAD_LANE_SPEED[L] ?? 1;
  if (L >= 3) {
    m *= HIGHWAY_CLASS_MUL[classId] || 1;
  }
  return m;
}

export function roadLaneLabel(lanes = 1) {
  const L = lanes | 0;
  if (L >= 3) return 'Motorvej';
  if (L >= 2) return '2-spor';
  return 'Alm. vej';
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
