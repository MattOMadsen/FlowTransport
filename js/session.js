/** Gem / genindlæs igangværende spil (localStorage) */

const SESSION_KEY = 'flowtransport_session_v1';
const VERSION = 1;

export function hasSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!(data && data.version === VERSION && data.scenarioId && Array.isArray(data.roads));
  } catch {
    return false;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSessionRaw() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION || !data.scenarioId) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {import('./game.js').Game} game
 */
export function serializeSession(game) {
  if (!game?.scenario || !game.hasActiveSession) return null;

  const roads = (game.roads || []).map((r) => ({
    id: r.id,
    points: (r.points || []).map((p) => ({ x: p.x, y: p.y })),
    lanes: r.lanes || 1,
    isBridge: !!r.isBridge,
    paidCost: r.paidCost || 0
  }));

  const jobs = (game.jobs || [])
    .filter((j) => j.active)
    .map((j) => ({
      id: j.id,
      type: j.type,
      fromId: j.from?.id,
      toId: j.to?.id,
      amount: j.amount,
      delivered: j.delivered || 0,
      reward: j.reward
    }));

  const fleet = (game.vehicles || []).map((v) => ({
    classId: v.classId,
    upgradeRank: v.upgradeRank | 0,
    homeId: v.homePlace?.id || null,
    x: v.x,
    y: v.y
  }));

  const buildings = (game.places || []).map((p) => ({
    id: p.id,
    station: !!p.buildings?.station,
    warehouse: !!p.buildings?.warehouse,
    depot: !!p.buildings?.depot
  }));

  return {
    version: VERSION,
    savedAt: Date.now(),
    scenarioId: game.scenario.id,
    money: Math.floor(game.money),
    stats: {
      delivered: game.stats?.delivered | 0,
      jobsDone: game.stats?.jobsDone | 0
    },
    camera: {
      x: game.camera?.x || 0,
      y: game.camera?.y || 0,
      zoom: game.camera?.zoom || 1
    },
    roads,
    jobs,
    fleet,
    buildings,
    nextJobId: Math.max(
      1,
      ...(game.jobs || []).map((j) => (j.id | 0) + 1),
      1
    )
  };
}

export function saveSession(game) {
  const data = serializeSession(game);
  if (!data) return false;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
