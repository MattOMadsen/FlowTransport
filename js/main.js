import { Game } from './game.js';
import {
  SCENARIOS,
  isScenarioUnlocked,
  unlockHint,
  getScenario,
  totalStars
} from './scenarios.js';
import { loadMeta, getScenarioStars } from './meta.js';
import {
  TUTORIAL_STEPS,
  shouldShowTutorial,
  setTutorialDone
} from './tutorial.js';
import { isMuted } from './audio.js';

const canvas = document.getElementById('game');
const ui = {
  money: document.getElementById('money'),
  level: document.getElementById('level'),
  delivered: document.getElementById('delivered'),
  fleet: document.getElementById('fleet'),
  jobs: document.getElementById('job-list'),
  goals: document.getElementById('goal-list'),
  toast: document.getElementById('toast'),
  shop: document.getElementById('shop'),
  globalShop: document.getElementById('global-shop')
};

const game = new Game(canvas, ui);
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const btnContinue = document.getElementById('btn-continue');

// Tutorial
let tutStep = 0;
const tutEl = document.getElementById('tutorial');
const tutTitle = document.getElementById('tut-title');
const tutBody = document.getElementById('tut-body');
const tutHint = document.getElementById('tut-hint');
const tutNext = document.getElementById('tut-next');

function showTutorialStep(i) {
  const step = TUTORIAL_STEPS[i];
  if (!step || !tutEl) {
    hideTutorial();
    return;
  }
  tutStep = i;
  if (tutTitle) tutTitle.textContent = step.title;
  if (tutBody) tutBody.textContent = step.body;
  if (tutHint) tutHint.textContent = step.hint;
  if (tutNext) tutNext.textContent = i >= TUTORIAL_STEPS.length - 1 ? 'Spil' : 'Næste';
  tutEl.classList.remove('hidden');
}

function hideTutorial() {
  tutEl?.classList.add('hidden');
}

function maybeStartTutorial() {
  if (shouldShowTutorial()) showTutorialStep(0);
  else hideTutorial();
}

document.getElementById('tut-skip')?.addEventListener('click', () => {
  setTutorialDone();
  hideTutorial();
});
tutNext?.addEventListener('click', () => {
  if (tutStep >= TUTORIAL_STEPS.length - 1) {
    setTutorialDone();
    hideTutorial();
    return;
  }
  showTutorialStep(tutStep + 1);
});

// Minimap: tryk → hop kamera
const minimap = document.getElementById('minimap');
function minimapToWorld(clientX, clientY) {
  if (!minimap || !game._minimapMap) return null;
  const r = minimap.getBoundingClientRect();
  const mx = clientX - r.left;
  const my = clientY - r.top;
  const { ox, oy, scale, worldW, worldH } = game._minimapMap;
  if (!scale) return null;
  const wx = (mx - ox) / scale;
  const wy = (my - oy) / scale;
  if (wx < 0 || wy < 0 || wx > worldW || wy > worldH) return null;
  // Snap to nearest place if close
  let best = null;
  let bestD = 80;
  for (const p of game.places || []) {
    const d = Math.hypot(p.x - wx, p.y - wy);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best) return { x: best.x, y: best.y, name: best.name };
  return { x: wx, y: wy, name: null };
}
function onMinimapPointer(e) {
  e.preventDefault();
  e.stopPropagation();
  const w = minimapToWorld(e.clientX, e.clientY);
  if (!w) return;
  game.centerOnWorld(w.x, w.y);
  if (w.name) game.toast(w.name);
}
minimap?.addEventListener('pointerdown', onMinimapPointer);

function renderMenu() {
  const meta = loadMeta();
  const list = document.getElementById('scenario-list');
  list.innerHTML = SCENARIOS.map((s) => {
    const stars = getScenarioStars(meta, s.id);
    const locked = !isScenarioUnlocked(s, meta);
    const hint = locked ? unlockHint(s, meta) : '';
    return `
      <button class="scenario-card${locked ? ' locked' : ''}" data-id="${s.id}" ${locked ? 'disabled' : ''} title="${hint}">
        <strong>${locked ? '🔒 ' : ''}${s.name}</strong>
        <span class="blurb">${locked ? hint : s.blurb}</span>
        <span class="stars">${locked ? hint : '⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
        ${locked ? '' : '<span class="new-tag">Nyt spil</span>'}
      </button>`;
  }).join('');
  list.querySelectorAll('.scenario-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      startNewGame(btn.dataset.id);
    });
  });
  document.getElementById('meta-level').textContent = `Level ${meta.level}`;
  document.getElementById('meta-xp').textContent = `${meta.xp} XP · ${totalStars(meta)}★`;

  const disk = game.hasDiskSession?.() || (game.hasActiveSession && game.scenario);
  if (disk || (game.hasActiveSession && game.scenario)) {
    btnContinue.classList.remove('hidden');
    const name = game.scenario?.name || 'gemt spil';
    btnContinue.textContent = game.hasActiveSession
      ? `▶️ Fortsæt: ${name}`
      : `▶️ Fortsæt gemt spil`;
  } else {
    btnContinue.classList.add('hidden');
  }
}

async function startNewGame(id) {
  const meta = loadMeta();
  const sc = getScenario(id);
  if (!isScenarioUnlocked(sc, meta)) {
    alert(unlockHint(sc, meta) || 'Banen er låst');
    return;
  }
  if (game.hasActiveSession) {
    const ok = confirm(
      'Starte et nyt spil?\n\nDet nuværende spil på kortet slettes (stjerner/level huskes).'
    );
    if (!ok) return;
  }
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  await game.init();
  game.startScenario(id);
  maybeStartTutorial();
}

function continueGame() {
  if (!game.resumeSession()) {
    renderMenu();
    return;
  }
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  hideTutorial();
}

function openMenu() {
  closeGameMenu();
  game.goToMenu();
  hideTutorial();
  hud.classList.add('hidden');
  menu.classList.remove('hidden');
  renderMenu();
}

const gameMenuEl = document.getElementById('game-menu');

function syncGameMenuLabels() {
  const pauseBtn = document.getElementById('game-menu-pause');
  const muteBtn = document.getElementById('game-menu-mute');
  if (pauseBtn) {
    pauseBtn.textContent = game.paused ? '▶️ Fortsæt spil' : '⏸️ Pause';
  }
  if (muteBtn) {
    muteBtn.textContent = isMuted() ? '🔇 Lyd er slået fra' : '🔊 Lyd er slået til';
  }
}

function openGameMenu() {
  if (!gameMenuEl) return;
  // Pause mens menu er åben, så man ikke mister overblik
  if (game.hasActiveSession && !game.paused) {
    game.paused = true;
    game.syncUI?.();
  }
  syncGameMenuLabels();
  gameMenuEl.classList.add('open');
}

function closeGameMenu() {
  gameMenuEl?.classList.remove('open');
}

document.getElementById('btn-fit')?.addEventListener('click', () => game.fitCamera());
document.getElementById('btn-undo')?.addEventListener('click', () => game.undo());
document.getElementById('btn-menu')?.addEventListener('click', () => {
  if (gameMenuEl?.classList.contains('open')) closeGameMenu();
  else openGameMenu();
});
document.getElementById('game-menu-close')?.addEventListener('click', () => {
  closeGameMenu();
  if (game.hasActiveSession && game.paused) {
    game.paused = false;
    game.syncUI?.();
    game.toast?.('Fortsæt');
  }
});
document.getElementById('game-menu-resume')?.addEventListener('click', () => {
  closeGameMenu();
  if (game.hasActiveSession) {
    game.paused = false;
    game.syncUI?.();
    game.toast?.('Fortsæt');
  }
});
document.getElementById('game-menu-pause')?.addEventListener('click', () => {
  game.togglePause();
  syncGameMenuLabels();
});
document.getElementById('game-menu-mute')?.addEventListener('click', () => {
  game.toggleMute();
  syncGameMenuLabels();
});
document.getElementById('game-menu-tutorial')?.addEventListener('click', () => {
  closeGameMenu();
  showTutorialStep(0);
});
document.getElementById('game-menu-home')?.addEventListener('click', () => {
  const ok = window.confirm(
    'Gå til startmenu?\n\nDit spil gemmes – du kan trykke «Fortsæt spil» bagefter.'
  );
  if (!ok) return;
  openMenu();
});
document.getElementById('btn-continue')?.addEventListener('click', () => continueGame());
document.getElementById('btn-pause')?.addEventListener('click', () => game.togglePause());
document.getElementById('btn-mute')?.addEventListener('click', () => game.toggleMute());
document.getElementById('daily-claim')?.addEventListener('click', () => game.claimDailyReward());
document.getElementById('end-run-continue')?.addEventListener('click', () => game.continueAfterEndRun());
document.getElementById('end-run-next')?.addEventListener('click', () => {
  game.startNextScenarioFromEnd();
  maybeStartTutorial();
});
document.getElementById('end-run-menu')?.addEventListener('click', () => {
  game.hideEndRun();
  openMenu();
});

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => game.setTool(btn.dataset.tool));
});

document.getElementById('shop-close')?.addEventListener('click', () => game.closeShop());
document.getElementById('global-shop-close')?.addEventListener('click', () => game.closeGlobalShop());
document.getElementById('btn-global-shop')?.addEventListener('click', () => game.openGlobalShop());
document.querySelectorAll('[data-buy]').forEach((btn) => {
  btn.addEventListener('click', () => game.buyVehicle(btn.dataset.buy));
});
// Upgrade / sell / bygninger (dynamiske knapper)
document.getElementById('shop')?.addEventListener('click', (e) => {
  const up = e.target.closest?.('[data-upgrade-id]');
  if (up) {
    game.upgradeVehicle(up.getAttribute('data-upgrade-id'));
    return;
  }
  const svc = e.target.closest?.('[data-service-id]');
  if (svc) {
    game.serviceVehicle(svc.getAttribute('data-service-id'));
    return;
  }
  const sell = e.target.closest?.('[data-sell-id]');
  if (sell) {
    game.sellVehicle(sell.getAttribute('data-sell-id'));
    return;
  }
  const build = e.target.closest?.('[data-build]');
  if (build) {
    game.buyBuilding(build.getAttribute('data-build'));
  }
});
document.getElementById('global-shop')?.addEventListener('click', (e) => {
  const buff = e.target.closest?.('[data-buff]');
  if (buff) game.buyBuff(buff.getAttribute('data-buff'));
});

// Tryk på opgave → vis linje A→B på kortet
document.getElementById('job-list')?.addEventListener('click', (e) => {
  const item = e.target.closest?.('[data-job-id]');
  if (!item) return;
  game.selectJob(item.getAttribute('data-job-id'));
});

// Fold opgaver & mål
const panel = document.getElementById('side-panel');
const panelBody = document.getElementById('panel-body');
const panelToggle = document.getElementById('btn-toggle-panel');
const chevron = document.getElementById('panel-chevron');
let panelOpen = true;
try {
  panelOpen = localStorage.getItem('ft_panel_open') !== '0';
} catch {
  /* ignore */
}
function applyPanel() {
  panel?.classList.toggle('collapsed', !panelOpen);
  panelBody?.classList.toggle('hidden', !panelOpen);
  if (chevron) chevron.textContent = panelOpen ? '▼' : '▶';
  panelToggle?.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
}
panelToggle?.addEventListener('click', () => {
  panelOpen = !panelOpen;
  try {
    localStorage.setItem('ft_panel_open', panelOpen ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyPanel();
});
applyPanel();

// Default collapsed on narrow screens first visit
if (window.innerWidth < 480 && localStorage.getItem('ft_panel_open') == null) {
  panelOpen = false;
  applyPanel();
}

// Gem ved fane-skift / luk
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') game.persistSession?.();
});
window.addEventListener('pagehide', () => game.persistSession?.());

renderMenu();
game.init().then(() => {
  // Fortsæt-knap hvis der er disk-session
  renderMenu();
});
