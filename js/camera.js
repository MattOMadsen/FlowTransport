/** Pan + zoom camera in CSS-pixel / iso space */

import { clamp } from './iso.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.12;
    this.maxZoom = 2.8;
  }

  setZoom(z, pivotX, pivotY) {
    const nz = clamp(z, this.minZoom, this.maxZoom);
    if (pivotX != null && pivotY != null) {
      const before = this.screenToView(pivotX, pivotY);
      this.zoom = nz;
      // Keep same iso-point under the cursor
      this.x = pivotX - before.x * this.zoom;
      this.y = pivotY - before.y * this.zoom;
    } else {
      this.zoom = nz;
    }
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /** Screen CSS pixel → iso view space */
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

  /**
   * Apply camera in CSS pixels, scaled by devicePixelRatio.
   * Must match input (CSS coords) or roads draw in the wrong place.
   */
  apply(ctx, dpr = 1) {
    const s = this.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, this.x * dpr, this.y * dpr);
  }

  /** Fit iso-space AABB into screen (CSS px). */
  fitIsoBounds(minX, minY, maxX, maxY, screenW, screenH, pad = 48) {
    if (!screenW || !screenH) return;
    const w = Math.max(40, maxX - minX);
    const h = Math.max(40, maxY - minY);
    const zx = (screenW - pad * 2) / w;
    const zy = (screenH - pad * 2) / h;
    this.zoom = clamp(Math.min(zx, zy), this.minZoom, this.maxZoom);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.x = screenW / 2 - cx * this.zoom;
    this.y = screenH / 2 - cy * this.zoom;
  }
}
