/**
 * 2.5D isometric helpers.
 * World (x,y) flat plane → screen with classic iso feel.
 */

const DEG = Math.PI / 180;
/** Horizontal scale of diamond */
export const ISO_A = 0.92;
/** Vertical scale (depth) */
export const ISO_B = 0.48;

/** World → local iso (before camera) */
export function worldToIso(x, y) {
  return {
    x: (x - y) * ISO_A,
    y: (x + y) * ISO_B
  };
}

/** Inverse iso → world (approx) */
export function isoToWorld(ix, iy) {
  const x = (ix / ISO_A + iy / ISO_B) / 2;
  const y = (iy / ISO_B - ix / ISO_A) / 2;
  return { x, y };
}

/** Depth key for painter's algorithm */
export function depthKey(x, y) {
  return x + y;
}

/** Unit direction in world for a vehicle heading (dx,dy world) → angle for sprite */
export function headingAngle(dx, dy) {
  // Convert world delta to iso screen delta for visual rotation
  const a = worldToIso(dx, dy);
  const b = worldToIso(0, 0);
  const sx = a.x - b.x;
  const sy = a.y - b.y;
  return Math.atan2(sy, sx);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
