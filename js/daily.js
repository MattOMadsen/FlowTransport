/**
 * Blødt dagligt mini-mål (localStorage).
 * Ingen mørke patterns – bare XP/penge-bonus + streak.
 */

const DAILY_KEY = 'flowtransport_daily_v1';

const POOL = [
  { id: 'deliver_15', type: 'deliver', amount: 15, label: 'Lever 15 enheder i dag', icon: '📦', xp: 18, money: 50 },
  { id: 'deliver_25', type: 'deliver', amount: 25, label: 'Lever 25 enheder i dag', icon: '📦', xp: 24, money: 70 },
  { id: 'jobs_3', type: 'jobs', amount: 3, label: 'Fuldfør 3 opgaver i dag', icon: '✅', xp: 16, money: 45 },
  { id: 'jobs_5', type: 'jobs', amount: 5, label: 'Fuldfør 5 opgaver i dag', icon: '✅', xp: 22, money: 60 },
  { id: 'buy_1', type: 'buy', amount: 1, label: 'Køb 1 bil i dag', icon: '🚗', xp: 12, money: 30 },
  { id: 'roads_3', type: 'roads', amount: 3, label: 'Byg 3 veje i dag', icon: '🛣️', xp: 14, money: 35 },
  { id: 'upgrade_1', type: 'upgrade', amount: 1, label: 'Opgrader 1 bil i dag', icon: '⬆', xp: 14, money: 35 }
];

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDate(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickGoal(dateStr) {
  const rng = mulberry32(hashDate(dateStr) ^ 0xf10a7);
  return POOL[Math.floor(rng() * POOL.length)];
}

function defaultState(dateStr) {
  const goal = pickGoal(dateStr);
  return {
    date: dateStr,
    goalId: goal.id,
    type: goal.type,
    amount: goal.amount,
    label: goal.label,
    icon: goal.icon,
    xp: goal.xp,
    money: goal.money,
    progress: 0,
    claimed: false,
    streak: 0
  };
}

export function loadDaily() {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) {
      const s = defaultState(today);
      saveDaily(s);
      return s;
    }
    const data = JSON.parse(raw);
    if (!data || data.date !== today) {
      const prev = data;
      const s = defaultState(today);
      if (prev?.claimed && prev.date) {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        const yk = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
        if (prev.date === yk) s.streak = (prev.streak | 0) + 1;
      }
      saveDaily(s);
      return s;
    }
    return { ...defaultState(today), ...data, date: today };
  } catch {
    const s = defaultState(today);
    saveDaily(s);
    return s;
  }
}

export function saveDaily(state) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Bump progress for matching type. */
export function bumpDaily(state, type, n = 1) {
  if (!state || state.claimed) return state;
  if (state.type !== type) return state;
  state.progress = Math.min(state.amount, (state.progress | 0) + (n | 0));
  saveDaily(state);
  return state;
}

export function isDailyComplete(state) {
  return !!state && (state.progress | 0) >= (state.amount | 0);
}

export function claimDaily(state) {
  if (!state) return { ok: false, reason: 'none' };
  if (state.claimed) return { ok: false, reason: 'claimed' };
  if (!isDailyComplete(state)) return { ok: false, reason: 'incomplete' };
  state.claimed = true;
  if ((state.streak | 0) < 1) state.streak = 1;
  saveDaily(state);
  const bonus = Math.min(30, (state.streak | 0) * 4);
  return {
    ok: true,
    xp: (state.xp | 0) + Math.floor(bonus / 2),
    money: (state.money | 0) + bonus,
    streak: state.streak | 0
  };
}

export function dailyUi(state) {
  if (!state) return { label: '—', progress: '0/0', ready: false, claimed: false };
  const p = state.progress | 0;
  const a = state.amount | 0;
  return {
    icon: state.icon || '🎯',
    label: state.label || 'Dagligt mål',
    progress: `${Math.min(p, a)}/${a}`,
    ready: isDailyComplete(state) && !state.claimed,
    claimed: !!state.claimed,
    streak: state.streak | 0
  };
}
