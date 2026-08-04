import { Game } from './game.js';
import { SCENARIOS } from './scenarios.js';
import { loadMeta, getScenarioStars } from './meta.js';

const canvas = document.getElementById('game');
const ui = {
  money: document.getElementById('money'),
  level: document.getElementById('level'),
  delivered: document.getElementById('delivered'),
  fleet: document.getElementById('fleet'),
  jobs: document.getElementById('job-list'),
  goals: document.getElementById('goal-list'),
  toast: document.getElementById('toast'),
  shop: document.getElementById('shop')
};

const game = new Game(canvas, ui);
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const btnContinue = document.getElementById('btn-continue');

function renderMenu() {
  const meta = loadMeta();
  const list = document.getElementById('scenario-list');
  list.innerHTML = SCENARIOS.map((s) => {
    const stars = getScenarioStars(meta, s.id);
    const locked = meta.level < s.unlockLevel;
    return `
      <button class="scenario-card" data-id="${s.id}" ${locked ? 'disabled' : ''}>
        <strong>${s.name}</strong>
        <span class="blurb">${s.blurb}</span>
        <span class="stars">${locked ? `🔒 Lvl ${s.unlockLevel}` : '⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
        <span class="new-tag">Nyt spil</span>
      </button>`;
  }).join('');
  list.querySelectorAll('.scenario-card').forEach((btn) => {
    btn.addEventListener('click', () => startNewGame(btn.dataset.id));
  });
  document.getElementById('meta-level').textContent = `Level ${meta.level}`;
  document.getElementById('meta-xp').textContent = `${meta.xp} XP`;

  if (game.hasActiveSession && game.scenario) {
    btnContinue.classList.remove('hidden');
    btnContinue.textContent = `▶️ Fortsæt: ${game.scenario.name}`;
  } else {
    btnContinue.classList.add('hidden');
  }
}

async function startNewGame(id) {
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
}

function continueGame() {
  if (!game.resumeSession()) {
    renderMenu();
    return;
  }
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
}

function openMenu() {
  game.goToMenu();
  hud.classList.add('hidden');
  menu.classList.remove('hidden');
  renderMenu();
}

document.getElementById('btn-fit')?.addEventListener('click', () => game.fitCamera());
document.getElementById('btn-undo')?.addEventListener('click', () => game.undo());
document.getElementById('btn-menu')?.addEventListener('click', () => openMenu());
document.getElementById('btn-continue')?.addEventListener('click', () => continueGame());
document.getElementById('btn-pause')?.addEventListener('click', () => game.togglePause());
document.getElementById('btn-mute')?.addEventListener('click', () => game.toggleMute());

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => game.setTool(btn.dataset.tool));
});

document.getElementById('shop-close')?.addEventListener('click', () => game.closeShop());
document.querySelectorAll('[data-buy]').forEach((btn) => {
  btn.addEventListener('click', () => game.buyVehicle(btn.dataset.buy));
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

renderMenu();
game.init();
