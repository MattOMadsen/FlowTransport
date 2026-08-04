import { Game } from './game.js';
import { SCENARIOS, getScenario } from './scenarios.js';
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
      </button>`;
  }).join('');
  list.querySelectorAll('.scenario-card').forEach((btn) => {
    btn.addEventListener('click', () => start(btn.dataset.id));
  });
  document.getElementById('meta-level').textContent = `Level ${meta.level}`;
  document.getElementById('meta-xp').textContent = `${meta.xp} XP`;
}

async function start(id) {
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  if (!game.running) await game.init();
  game.startScenario(id);
}

document.getElementById('btn-fit')?.addEventListener('click', () => game.fitCamera());
document.getElementById('btn-undo')?.addEventListener('click', () => game.undo());
document.getElementById('btn-menu')?.addEventListener('click', () => {
  game.running = false;
  hud.classList.add('hidden');
  menu.classList.remove('hidden');
  renderMenu();
});

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => game.setTool(btn.dataset.tool));
});

document.getElementById('shop-close')?.addEventListener('click', () => game.closeShop());
document.querySelectorAll('[data-buy]').forEach((btn) => {
  btn.addEventListener('click', () => game.buyVehicle(btn.dataset.buy));
});

renderMenu();
// Auto-init assets in background
game.init();
