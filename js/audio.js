/** Soft Web Audio beeps – optional, mute-friendly */

let ctx = null;
let muted = false;

try {
  muted = localStorage.getItem('ft_mute') === '1';
} catch {
  /* ignore */
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  try {
    localStorage.setItem('ft_mute', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

function beep(freq, dur, type = 'sine', gain = 0.04) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  const t0 = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function playRoad() {
  beep(320, 0.08, 'triangle', 0.03);
}
export function playDeliver() {
  beep(520, 0.1, 'sine', 0.04);
  setTimeout(() => beep(680, 0.12, 'sine', 0.035), 80);
}
export function playBuy() {
  beep(400, 0.07, 'square', 0.025);
  setTimeout(() => beep(500, 0.09, 'square', 0.02), 60);
}
export function playError() {
  beep(180, 0.12, 'sawtooth', 0.03);
}
export function playJobDone() {
  beep(440, 0.08);
  setTimeout(() => beep(554, 0.1), 70);
  setTimeout(() => beep(659, 0.14), 140);
}
