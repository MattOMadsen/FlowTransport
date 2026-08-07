/**
 * Decorative scenery: lakes, trees, forest patches.
 * Lakes must never cover place hubs.
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

/** Approximate ellipse–point clearance (axis-aligned pad). */
function lakeOverlapsPlace(L, p, pad = 55) {
  const dx = p.x - L.x;
  const dy = p.y - L.y;
  const rx = L.rx + pad + (p.r || 30);
  const ry = L.ry + pad + (p.r || 30);
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1;
}

function lakeOk(L, places, pad = 55) {
  for (const p of places) {
    if (lakeOverlapsPlace(L, p, pad)) return false;
  }
  return true;
}

/**
 * Push lake center away from any overlapping place until clear or give up.
 */
function resolveLake(L, places, pad = 60) {
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (const p of places) {
      if (!lakeOverlapsPlace(L, p, pad)) continue;
      const dx = L.x - p.x;
      const dy = L.y - p.y;
      let dist = Math.hypot(dx, dy) || 1;
      const need = (L.rx + L.ry) * 0.55 + (p.r || 40) + pad;
      if (dist < need) {
        const push = (need - dist) / dist;
        L.x += dx * push * 1.05;
        L.y += dy * push * 1.05;
        moved = true;
      }
    }
    if (!moved && lakeOk(L, places, pad)) return true;
  }
  // Shrink and recheck
  L.rx *= 0.65;
  L.ry *= 0.65;
  return lakeOk(L, places, pad);
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

  const lakeCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < lakeCount; i++) {
    let L = null;
    for (let t = 0; t < 50; t++) {
      const cand = {
        x: worldW * (0.14 + rng() * 0.72),
        y: worldH * (0.14 + rng() * 0.72),
        rx: 50 + rng() * 70,
        ry: 36 + rng() * 50,
        rot: rng() * Math.PI
      };
      if (tooCloseToPlace(cand.x, cand.y, places, 120)) continue;
      if (!resolveLake(cand, places, 70)) continue;
      L = cand;
      break;
    }
    if (L) lakes.push(L);
  }

  // Harbor water: offset away from hub, never under the building
  for (const p of places) {
    if (p.type !== 'harbor') continue;
    // Prefer seaward: slightly left/down from hub
    const cand = {
      x: p.x - (p.r + 100 + rng() * 40),
      y: p.y + (p.r + 50 + rng() * 40),
      rx: 55 + rng() * 35,
      ry: 38 + rng() * 25,
      rot: -0.25 + rng() * 0.3
    };
    if (resolveLake(cand, places, 75)) lakes.push(cand);
  }

  // Final hard filter
  const cleanLakes = lakes.filter((L) => lakeOk(L, places, 50));

  const forestCount = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < forestCount; i++) {
    let x;
    let y;
    let ok = false;
    for (let t = 0; t < 30; t++) {
      x = worldW * (0.08 + rng() * 0.84);
      y = worldH * (0.08 + rng() * 0.84);
      if (!tooCloseToPlace(x, y, places, 75) && !tooCloseToLake(x, y, cleanLakes, 45)) {
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
      const tx = x + Math.cos(ang) * d;
      const ty = y + Math.sin(ang) * d;
      if (tooCloseToPlace(tx, ty, places, 50)) continue;
      trees.push({ x: tx, y: ty, s: 0.7 + rng() * 0.7, tint: rng() });
    }
  }

  const scatter = 35 + Math.floor((worldW * worldH) / 55000);
  for (let i = 0; i < scatter; i++) {
    const x = worldW * (0.05 + rng() * 0.9);
    const y = worldH * (0.05 + rng() * 0.9);
    if (tooCloseToPlace(x, y, places, 60)) continue;
    if (tooCloseToLake(x, y, cleanLakes, 40)) continue;
    trees.push({ x, y, s: 0.55 + rng() * 0.55, tint: rng() });
  }

  const hillN = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < hillN; i++) {
    hills.push({
      x: worldW * (0.1 + rng() * 0.8),
      y: worldH * (0.1 + rng() * 0.8),
      r: 80 + rng() * 120,
      shade: 0.04 + rng() * 0.06
    });
  }

  return { lakes: cleanLakes, trees, forests, hills };
}

function tooCloseToLake(x, y, lakes, pad) {
  for (const L of lakes) {
    const dx = (x - L.x) / (L.rx + pad);
    const dy = (y - L.y) / (L.ry + pad);
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
}

/** World point in any lake? (for bridges) */
export function pointInLake(x, y, lakes) {
  if (!lakes) return false;
  for (const L of lakes) {
    const dx = x - L.x;
    const dy = y - L.y;
    if ((dx * dx) / (L.rx * L.rx) + (dy * dy) / (L.ry * L.ry) < 1) return true;
  }
  return false;
}

export function strokeCrossesWater(points, lakes) {
  if (!points || points.length < 2 || !lakes?.length) return false;
  for (const p of points) {
    if (pointInLake(p.x, p.y, lakes)) return true;
  }
  // Sample midpoints
  for (let i = 1; i < points.length; i++) {
    const mx = (points[i - 1].x + points[i].x) / 2;
    const my = (points[i - 1].y + points[i].y) / 2;
    if (pointInLake(mx, my, lakes)) return true;
  }
  return false;
}
