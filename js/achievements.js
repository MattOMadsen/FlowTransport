/** Simple achievements – localStorage via meta */

export const ACHIEVEMENTS = [
  { id: 'first_road', icon: '🛣️', label: 'Første vej', desc: 'Byg din første vej', xp: 20 },
  { id: 'first_delivery', icon: '📦', label: 'Første levering', desc: 'Lever én enhed', xp: 25 },
  { id: 'fleet_3', icon: '🚗', label: 'Lille flåde', desc: 'Hav 3 biler', xp: 30 },
  { id: 'dual_lane', icon: '🛤️', label: '2-spor', desc: 'Opgrader en vej til 2-spor', xp: 25 },
  { id: 'highway', icon: '🏎️', label: 'Motorvej', desc: 'Opgrader en vej til motorvej', xp: 35 },
  { id: 'upgrade_car', icon: '⬆', label: 'Tune', desc: 'Opgrader en bil', xp: 20 },
  { id: 'service_car', icon: '🔧', label: 'Mekaniker', desc: 'Servicer en bil', xp: 20 },
  { id: 'replace_worn', icon: '♻️', label: 'Udskift', desc: 'Sælg en meget slidt bil', xp: 25 },
  { id: 'sell_car', icon: '💰', label: 'Salg', desc: 'Sælg en bil', xp: 15 },
  { id: 'express', icon: '⚡', label: 'Ekspres', desc: 'Fuldfør et ekspres-job', xp: 30 },
  { id: 'connect_all', icon: '🔗', label: 'Netværk', desc: 'Forbind alle steder', xp: 40 },
  { id: 'star_1', icon: '⭐', label: 'Stjerne', desc: 'Få mindst 1 stjerne på en bane', xp: 25 }
];

export function hasAchievement(meta, id) {
  return !!(meta?.achievements && meta.achievements[id]);
}

/**
 * Unlock if not owned. Mutates meta.
 * @returns {{ id:string, label:string, xp:number }|null}
 */
export function tryUnlock(meta, id, addXpFn) {
  if (!meta) return null;
  if (!meta.achievements) meta.achievements = {};
  if (meta.achievements[id]) return null;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return null;
  meta.achievements[id] = Date.now();
  if (addXpFn && def.xp) addXpFn(meta, def.xp);
  return def;
}
