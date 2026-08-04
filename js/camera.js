/** Pan + zoom camera in screen/iso space */

import { clamp } from './iso.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.35;
    this.maxZoom = 2.4;
  }

  setZoom(z, pivotX, pivotY) {
    const nz = clamp(z, this.minZoom, this.maxZoom);
    if (pivotX != null && pivotY != null) {
      // Keep world point under pivot
      const before = this.screenToView(pivotX, pivotY);
      this.zoom = nz;
      const after = this.screenToView(pivotX, pivotY);
      this.x += before.x - after.x;
      this.y += before.y - after.y;
    } else {
      this.zoom = nz;
    }
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /** Screen pixel → view (iso space before world) */
  screenToView(sx, sy) {
    return {
      x: (sx - this.x) / this.zoom,
      y: (sy - this.y) / this.zoom
    };
  }

  viewToScreen(vx, vy) {
    return {
      x: vx * this.zoom + this.x,
      y: vy * this.zoom + this.y
    };
  }

  apply(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.x, this.y);
  }

  fitIsoBounds(minX, minY, maxX, maxY, screenW, screenH, pad = 48) {
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const zx = (screenW - pad * 2) / w;
    const zy = (screenH - pad * 2) / h;
    this.zoom = clamp(Math.min(zx, zy), this.minZoom, this.maxZoom);
    this.x = screenW / 2 - ((minX + maxX) / 2) * this.zoom;
    this.y = screenH / 2 - ((minY + maxY) / 2) * this.zoom;
  }
}
