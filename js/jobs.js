/** Jobs: passengers, cargo & ekspres A→B */

export const JOB_TYPES = {
  passengers: {
    id: 'passengers',
    label: 'Personer',
    icon: '👤',
    vehicle: 'car',
    unit: 'personer',
    baseReward: 30,
    rewardPerUnit: 18,
    color: '#2563eb'
  },
  cargo: {
    id: 'cargo',
    label: 'Gods',
    icon: '📦',
    vehicle: 'truck',
    unit: 'kasser',
    baseReward: 36,
    rewardPerUnit: 22,
    color: '#b45309'
  },
  /** Hurtig person-opgave: færre enheder, højere betaling */
  express: {
    id: 'express',
    label: 'Ekspres',
    icon: '⚡',
    vehicle: 'car',
    unit: 'pakker',
    baseReward: 55,
    rewardPerUnit: 32,
    color: '#7c3aed'
  }
};

let nextJobId = 1;

export function setNextJobId(n) {
  nextJobId = Math.max(1, n | 0);
}

export function peekNextJobId() {
  return nextJobId;
}

export function createJob(from, to, typeKey, amount) {
  const type = JOB_TYPES[typeKey] || JOB_TYPES.passengers;
  const dist = Math.hypot((to.x || 0) - (from.x || 0), (to.y || 0) - (from.y || 0));
  const distBonus = Math.round(dist * 0.014);
  const reward = type.baseReward + amount * type.rewardPerUnit + distBonus;
  return {
    id: nextJobId++,
    type: type.id,
    typeMeta: type,
    from,
    to,
    amount,
    delivered: 0,
    reward,
    active: true,
    claimedBy: null
  };
}

export function jobComplete(job) {
  return job.delivered >= job.amount;
}

export function jobLabel(job) {
  const left = Math.max(0, job.amount - job.delivered);
  return `${job.typeMeta.icon} ${left} ${job.typeMeta.unit}: ${job.from.name} → ${job.to.name}`;
}

/**
 * Mængder der typisk kræver 2+ ture (undtagen ekspres).
 * Gods: 12–22 · Personer: 10–18 · Ekspres: 5–9
 */
export function randomAmount(typeKey) {
  if (typeKey === 'cargo') return 12 + Math.floor(Math.random() * 11);
  if (typeKey === 'express') return 5 + Math.floor(Math.random() * 5);
  return 10 + Math.floor(Math.random() * 9);
}

/**
 * Spawn a job between connected-looking places (any places; path checked at assign).
 * @param {object[]} places
 * @param {{ expressBias?: number, cargoBias?: number }} [opts]
 */
export function generateJob(places, opts = {}) {
  if (!places || places.length < 2) return null;
  const expressBias = opts.expressBias || 0;
  const cargoBias = opts.cargoBias || 0;
  const roll = Math.random();
  let typeKey = 'passengers';
  const cargoCut = 0.38 + cargoBias;
  const expressCut = cargoCut + 0.14 + expressBias;
  if (roll < cargoCut) typeKey = 'cargo';
  else if (roll < expressCut) typeKey = 'express';

  let from;
  let to;
  const towns = places.filter(
    (p) => p.type === 'capital' || p.type === 'town' || p.type === 'harbor'
  );
  const cargoSrc = places.filter(
    (p) => p.type === 'farm' || p.type === 'factory' || p.type === 'harbor'
  );
  const cargoDst = places.filter(
    (p) =>
      p.type === 'capital' ||
      p.type === 'town' ||
      p.type === 'factory' ||
      p.type === 'harbor'
  );

  // Prefer stations for passenger/express, warehouses for cargo
  if (typeKey === 'cargo') {
    const wh = places.filter((p) => p.buildings?.warehouse);
    const srcPool = wh.length ? [...cargoSrc, ...wh, ...wh] : cargoSrc;
    if (srcPool.length && cargoDst.length) {
      from = srcPool[Math.floor(Math.random() * srcPool.length)];
      const dsts = cargoDst.filter((p) => p.id !== from.id);
      to = dsts[Math.floor(Math.random() * dsts.length)];
    }
  } else {
    const st = places.filter((p) => p.buildings?.station);
    const pool = st.length ? [...towns, ...st, ...st] : towns;
    if (pool.length >= 2) {
      from = pool[Math.floor(Math.random() * pool.length)];
      const dsts = towns.filter((p) => p.id !== from.id);
      to = dsts[Math.floor(Math.random() * dsts.length)];
    }
  }

  if (!from || !to) {
    from = places[Math.floor(Math.random() * places.length)];
    const rest = places.filter((p) => p.id !== from.id);
    to = rest[Math.floor(Math.random() * rest.length)];
  }
  if (!from || !to) return null;
  return createJob(from, to, typeKey, randomAmount(typeKey));
}

/** Rebuild job from saved data + place map */
export function restoreJob(data, placesById) {
  const from = placesById.get(data.fromId);
  const to = placesById.get(data.toId);
  if (!from || !to) return null;
  const type = JOB_TYPES[data.type] || JOB_TYPES.passengers;
  return {
    id: data.id,
    type: type.id,
    typeMeta: type,
    from,
    to,
    amount: data.amount | 0,
    delivered: data.delivered | 0,
    reward: data.reward | 0,
    active: true,
    claimedBy: null
  };
}
