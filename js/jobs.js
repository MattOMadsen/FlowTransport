/** Jobs: passengers & cargo A→B */

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
  }
};

let nextJobId = 1;

export function setNextJobId(n) {
  nextJobId = Math.max(1, n | 0);
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
 * Mængder der typisk kræver 2+ ture med standard-bil (cap 4 / 8).
 * Gods: 12–22 · Personer: 10–18
 */
export function randomAmount(typeKey) {
  if (typeKey === 'cargo') return 12 + Math.floor(Math.random() * 11);
  return 10 + Math.floor(Math.random() * 9);
}

/**
 * Spawn a job between connected-looking places (any places; path checked at assign).
 */
export function generateJob(places) {
  if (!places || places.length < 2) return null;
  const typeKey = Math.random() < 0.45 ? 'cargo' : 'passengers';
  // Prefer sensible pairs
  let from;
  let to;
  const towns = places.filter((p) => p.type === 'capital' || p.type === 'town' || p.type === 'harbor');
  const cargoSrc = places.filter((p) => p.type === 'farm' || p.type === 'factory' || p.type === 'harbor');
  const cargoDst = places.filter((p) => p.type === 'capital' || p.type === 'town' || p.type === 'factory' || p.type === 'harbor');

  if (typeKey === 'cargo' && cargoSrc.length && cargoDst.length) {
    from = cargoSrc[Math.floor(Math.random() * cargoSrc.length)];
    const dsts = cargoDst.filter((p) => p.id !== from.id);
    to = dsts[Math.floor(Math.random() * dsts.length)];
  } else if (towns.length >= 2) {
    from = towns[Math.floor(Math.random() * towns.length)];
    const dsts = towns.filter((p) => p.id !== from.id);
    to = dsts[Math.floor(Math.random() * dsts.length)];
  } else {
    from = places[Math.floor(Math.random() * places.length)];
    to = places.filter((p) => p.id !== from.id)[Math.floor(Math.random() * (places.length - 1))];
  }
  if (!from || !to) return null;
  return createJob(from, to, typeKey, randomAmount(typeKey));
}
