/** XP, level, scenario stars – localStorage */

const KEY = 'flowtransport_meta_v1';

const defaultMeta = () => ({
  xp: 0,
  level: 1,
  stars: {}, // scenarioId → 0–3
  totalDelivered: 0
});

export function loadMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    return { ...defaultMeta(), ...JSON.parse(raw) };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function addXp(meta, amount) {
  meta.xp += amount;
  // Simple curve: 100 * level
  while (meta.xp >= meta.level * 100) {
    meta.xp -= meta.level * 100;
    meta.level += 1;
  }
  saveMeta(meta);
  return meta;
}

export function setScenarioStars(meta, scenarioId, stars) {
  const prev = meta.stars[scenarioId] || 0;
  if (stars > prev) {
    meta.stars[scenarioId] = stars;
    saveMeta(meta);
  }
  return meta;
}

export function getScenarioStars(meta, scenarioId) {
  return meta.stars[scenarioId] || 0;
}

export const XP_REWARDS = {
  deliver: 12,
  road: 2,
  connect: 25,
  star: 40
};
