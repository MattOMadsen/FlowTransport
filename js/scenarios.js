import { LAYOUT_INTRO, LAYOUT_COAST, LAYOUT_VALLEY, LAYOUT_ISLANDS } from './places.js';

/**
 * @typedef {{ type: 'deliver'|'connect_all'|'money', amount?: number, stars: number }} Goal
 * @typedef {{ scenarioId: string, stars: number }} UnlockFrom
 */

export const SCENARIOS = [
  {
    id: 'intro',
    name: 'Første forbindelser',
    blurb: 'Større dal med byer, farme, fabrik og havn – lær netværket.',
    seed: 101,
    startMoney: 2200,
    worldW: 2200,
    worldH: 1700,
    unlockLevel: 1,
    unlockFrom: null,
    layout: LAYOUT_INTRO,
    goals: [
      { type: 'deliver', amount: 12, stars: 1 },
      { type: 'deliver', amount: 30, stars: 2 },
      { type: 'connect_all', stars: 3 }
    ]
  },
  {
    id: 'valley',
    name: 'Indre dal',
    blurb: 'Tættere byer – byg et smart knudepunkt og tjen penge.',
    seed: 303,
    startMoney: 2500,
    worldW: 2000,
    worldH: 1600,
    /** Åben ved level 2 ELLER 1★ på intro (første stjerne-mål). */
    unlockLevel: 2,
    unlockFrom: { scenarioId: 'intro', stars: 1 },
    layout: LAYOUT_VALLEY,
    goals: [
      { type: 'deliver', amount: 20, stars: 1 },
      { type: 'money', amount: 2800, stars: 2 },
      { type: 'deliver', amount: 45, stars: 3 }
    ]
  },
  {
    id: 'coast',
    name: 'Kystlinjen',
    blurb: 'To havne, mange fabrikker og farme – mere gods og længere ruter.',
    seed: 202,
    startMoney: 2800,
    worldW: 2600,
    worldH: 1900,
    unlockLevel: 3,
    unlockFrom: { scenarioId: 'valley', stars: 2 },
    layout: LAYOUT_COAST,
    goals: [
      { type: 'deliver', amount: 18, stars: 1 },
      { type: 'money', amount: 3200, stars: 2 },
      { type: 'deliver', amount: 50, stars: 3 }
    ]
  },
  {
    id: 'islands',
    name: 'Ø-broerne',
    blurb: 'To kyster og en hovedby midt i – byg broer og forbinde nettet.',
    seed: 404,
    startMoney: 3000,
    worldW: 2400,
    worldH: 1800,
    unlockLevel: 4,
    unlockFrom: { scenarioId: 'coast', stars: 2 },
    layout: LAYOUT_ISLANDS,
    goals: [
      { type: 'deliver', amount: 16, stars: 1 },
      { type: 'connect_all', stars: 2 },
      { type: 'deliver', amount: 40, stars: 3 }
    ]
  }
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}

/**
 * Bane er åben hvis level ≥ unlockLevel ELLER nok stjerner på forrige bane.
 * Intro er altid åben.
 * @param {{ unlockLevel?: number, unlockFrom?: UnlockFrom|null }} scenario
 * @param {{ level?: number, stars?: Record<string, number> }} meta
 */
export function isScenarioUnlocked(scenario, meta) {
  if (!scenario) return false;
  if (!scenario.unlockFrom && (scenario.unlockLevel || 1) <= 1) return true;
  const level = meta?.level || 1;
  const levelOk = level >= (scenario.unlockLevel || 1);
  const from = scenario.unlockFrom;
  if (!from) return levelOk;
  const have = (meta?.stars && meta.stars[from.scenarioId]) || 0;
  const starsOk = have >= (from.stars || 1);
  return levelOk || starsOk;
}

/** Kort tekst til låst kort / toast. */
export function unlockHint(scenario, meta) {
  if (!scenario || isScenarioUnlocked(scenario, meta)) return '';
  const parts = [];
  const from = scenario.unlockFrom;
  if (from) {
    const prev = getScenario(from.scenarioId);
    const need = from.stars || 1;
    parts.push(`${need}★ på «${prev.name}»`);
  }
  if (scenario.unlockLevel > 1) {
    parts.push(`level ${scenario.unlockLevel}`);
  }
  if (!parts.length) return 'Låst';
  return `Lås op: ${parts.join(' eller ')}`;
}

/** Næste bane i listen (wrap) – ignorerer lås. */
export function nextScenarioId(currentId) {
  const i = SCENARIOS.findIndex((s) => s.id === currentId);
  if (i < 0) return SCENARIOS[0].id;
  return SCENARIOS[(i + 1) % SCENARIOS.length].id;
}

/**
 * Næste ulåste bane efter current (wrap). Null hvis kun current er åben.
 * @param {string} currentId
 * @param {{ level?: number, stars?: Record<string, number> }} meta
 */
export function nextUnlockedScenarioId(currentId, meta) {
  const i = SCENARIOS.findIndex((s) => s.id === currentId);
  const start = i < 0 ? 0 : i;
  for (let k = 1; k < SCENARIOS.length; k++) {
    const s = SCENARIOS[(start + k) % SCENARIOS.length];
    if (isScenarioUnlocked(s, meta)) return s.id;
  }
  return null;
}

/**
 * Baner der netop blev åbne ved skift fra prevMeta → meta (stjerner/level).
 * @returns {{ id: string, name: string }[]}
 */
export function newlyUnlockedScenarios(prevMeta, meta) {
  const out = [];
  for (const s of SCENARIOS) {
    if (!isScenarioUnlocked(s, prevMeta) && isScenarioUnlocked(s, meta)) {
      out.push({ id: s.id, name: s.name });
    }
  }
  return out;
}

/** Samlet antal stjerner på tværs af baner (0–12). */
export function totalStars(meta) {
  let n = 0;
  for (const s of SCENARIOS) {
    n += (meta?.stars && meta.stars[s.id]) || 0;
  }
  return n;
}

export function goalLabel(g) {
  if (g.type === 'deliver') return `Lever ${g.amount} enheder`;
  if (g.type === 'connect_all') return 'Forbind alle steder';
  if (g.type === 'money') return `Tjen ${g.amount} kr (saldo)`;
  return 'Mål';
}

/**
 * @returns {number} stars earned 0–3
 */
export function evaluateStars(scenario, stats) {
  let stars = 0;
  for (const g of scenario.goals) {
    let ok = false;
    if (g.type === 'deliver') ok = stats.delivered >= g.amount;
    else if (g.type === 'connect_all') ok = !!stats.allConnected;
    else if (g.type === 'money') ok = stats.money >= g.amount;
    if (ok) stars = Math.max(stars, g.stars);
  }
  return stars;
}
