import { LAYOUT_INTRO, LAYOUT_COAST } from './places.js';

/**
 * @typedef {{ type: 'deliver'|'connect_all'|'money', amount?: number, stars: number }} Goal
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
    layout: LAYOUT_INTRO,
    goals: [
      { type: 'deliver', amount: 12, stars: 1 },
      { type: 'deliver', amount: 30, stars: 2 },
      { type: 'connect_all', stars: 3 }
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
    unlockLevel: 1,
    layout: LAYOUT_COAST,
    goals: [
      { type: 'deliver', amount: 18, stars: 1 },
      { type: 'money', amount: 3200, stars: 2 },
      { type: 'deliver', amount: 50, stars: 3 }
    ]
  }
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
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
