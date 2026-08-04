/**
 * Decorative scenery: lakes, trees, forest patches (not collidable).
 */

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tooCloseToPlace(x, y, places, minDist) {
  for (const p of places) {
    if (Math.hypot(p.x - x, p.y - y) < minDist + (p.r || 40)) return true;
  }
  return false;
}

/**
 * @returns {{ lakes: object[], trees: object[], forests: object[], hills: object[] }}
 */
export function buildScenery(worldW, worldH, places, seed = 1) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const lakes = [];
  const trees = [];
  const forests = [];
  const hills = [];

  const lakeCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < lakeCount; i++) {
    let x;
    let y;
    let ok = false;
    for (let t = 0; t < 40; t++) {
      x = worldW * (0.12 + rng() * 0.76);
      y = worldH * (0.12 + rng() * 0.76);
      if (!tooCloseToPlace(x, y, places, 90)) {
        ok = true;
        break;
      }
    }
    if (!ok) continue;
    lakes.push({
      x,
      y,
      rx: 55 + rng() * 90,
      ry: 40 + rng() * 60,
      rot: rng() * Math.PI
    });
  }

  // Near harbors: extra water blob
  for (const p of places) {
    if (p.type !== 'harbor') continue;
    lakes.push({
      x: p.x - 40 - rng() * 50,
      y: p.y + 30 + rng() * 40,
      rx: 70 + rng() * 40,
      ry: 45 + rng() * 30,
      rot: -0.3 + rng() * 0.4
    });
  }

  const forestCount = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < forestCount; i++) {
    let x;
    let y;
    let ok = false;
    for (let t = 0; t < 30; t++) {
      x = worldW * (0.08 + rng() * 0.84);
      y = worldH * (0.08 + rng() * 0.84);
      if (!tooCloseToPlace(x, y, places, 70) && !tooCloseToLake(x, y, lakes, 50)) {
        ok = true;
        break;
      }
    }
    if (!ok) continue;
    const r = 50 + rng() * 80;
    forests.push({ x, y, r });
    const n = 8 + Math.floor(rng() * 14);
    for (let k = 0; k < n; k++) {
      const ang = rng() * Math.PI * 2;
      const d = rng() * r * 0.85;
      trees.push({
        x: x + Math.cos(ang) * d,
        y: y + Math.sin(ang) * d,
        s: 0.7 + rng() * 0.7,
        tint: rng()
      });
    }
  }

  // Scattered trees
  const scatter = 40 + Math.floor((worldW * worldH) / 50000);
  for (let i = 0; i < scatter; i++) {
    const x = worldW * (0.05 + rng() * 0.9);
    const y = worldH * (0.05 + rng() * 0.9);
    if (tooCloseToPlace(x, y, places, 55)) continue;
    if (tooCloseToLake(x, y, lakes, 35)) continue;
    trees.push({ x, y, s: 0.55 + rng() * 0.55, tint: rng() });
  }

  // Soft hills (visual only)
  const hillN = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < hillN; i++) {
    hills.push({
      x: worldW * (0.1 + rng() * 0.8),
      y: worldH * (0.1 + rng() * 0.8),
      r: 80 + rng() * 120,
      shade: 0.04 + rng() * 0.06
    });
  }

  return { lakes, trees, forests, hills };
}

function tooCloseToLake(x, y, lakes, pad) {
  for (const L of lakes) {
    const dx = (x - L.x) / (L.rx + pad);
    const dy = (y - L.y) / (L.ry + pad);
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
}
