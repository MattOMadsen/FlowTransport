/** Første-gangs tutorial – 3 trin */

const DONE_KEY = 'flowtransport_tutorial_done_v1';

export const TUTORIAL_STEPS = [
  {
    id: 'road',
    title: '1 · Tegn en vej',
    body: 'Træk med én finger fra by til by. Snap-ringen viser når enden fanger. Vej koster penge, men låser op for jobs.',
    hint: '✏️ Træk · 🛣️ 2-spor/motorvej · 🗑️ slet'
  },
  {
    id: 'buy',
    title: '2 · Køb og opgrader biler',
    body: 'Tryk midt i en by for shop. Køb bil, bus, varebil eller lastbil. Opgrader last (★), servicer slidte biler (🔧) eller sælg/udskift.',
    hint: '🏙️ Shop · 🔧 service · Sælg når slidt'
  },
  {
    id: 'jobs',
    title: '3 · Opgaver og stjerner',
    body: 'Biler henter selv jobs når der er sti. Tryk en opgave i listen for at se A→B på kortet. Opnå stjerner på banen.',
    hint: '📋 Tryk opgave · minimap nede til venstre'
  }
];

export function isTutorialDone() {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTutorialDone() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowTutorial() {
  return !isTutorialDone();
}
