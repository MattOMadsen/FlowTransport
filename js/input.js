/**
 * Touch/mouse state machine: idle | pending | draw | pan | pinch
 * Pinch never commits a road.
 */

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} hooks
   */
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.state = 'idle';
    this.pointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.pendingTimer = null;
    this.pointers = new Map(); // id → {x,y}
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1;
    this.lockUntil = 0;

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.hooks.onWheel?.(e.clientX, e.clientY, e.deltaY);
      },
      { passive: false }
    );
  }

  rect() {
    return this.canvas.getBoundingClientRect();
  }

  pos(e) {
    const r = this.rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  onDown(e) {
    if (performance.now() < this.lockUntil) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      // Enter pinch – cancel draw if any
      if (this.state === 'draw') this.hooks.onCancelDraw?.();
      this.state = 'pinch';
      const pts = [...this.pointers.values()];
      this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      this.pinchStartZoom = this.hooks.getZoom?.() ?? 1;
      this.hooks.onPinchStart?.();
      return;
    }

    if (this.state === 'pinch') return;

    this.pointerId = e.pointerId;
    this.startX = p.x;
    this.startY = p.y;
    this.lastX = p.x;
    this.lastY = p.y;
    this.state = 'pending';

    clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      if (this.state === 'pending') {
        this.state = 'pan';
        this.hooks.onPanStart?.(this.startX, this.startY);
      }
    }, 280);
  }

  onMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);

    if (this.state === 'pinch' && this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const scale = dist / this.pinchStartDist;
      this.hooks.onPinch?.(midX, midY, this.pinchStartZoom * scale);
      // Also pan by midpoint delta
      return;
    }

    if (e.pointerId !== this.pointerId) return;

    const dx = p.x - this.startX;
    const dy = p.y - this.startY;
    const dist = Math.hypot(dx, dy);

    if (this.state === 'pending' && dist > 10) {
      clearTimeout(this.pendingTimer);
      const tool = this.hooks.getTool?.() || 'draw';
      if (tool === 'pan' || e.buttons === 4) {
        this.state = 'pan';
        this.hooks.onPanStart?.(this.startX, this.startY);
      } else if (tool === 'draw') {
        this.state = 'draw';
        this.hooks.onDrawStart?.(this.startX, this.startY);
      } else {
        this.state = 'pan';
        this.hooks.onPanStart?.(this.startX, this.startY);
      }
    }

    if (this.state === 'draw') {
      this.hooks.onDrawMove?.(p.x, p.y);
    } else if (this.state === 'pan') {
      this.hooks.onPanMove?.(p.x - this.lastX, p.y - this.lastY);
    }
    this.lastX = p.x;
    this.lastY = p.y;
  }

  onUp(e) {
    this.pointers.delete(e.pointerId);

    if (this.state === 'pinch') {
      if (this.pointers.size < 2) {
        this.state = 'idle';
        this.lockUntil = performance.now() + 120;
        this.hooks.onPinchEnd?.();
      }
      return;
    }

    if (e.pointerId !== this.pointerId) return;
    clearTimeout(this.pendingTimer);

    if (this.state === 'draw') {
      this.hooks.onDrawEnd?.(this.lastX, this.lastY);
    } else if (this.state === 'pending') {
      this.hooks.onTap?.(this.startX, this.startY);
    } else if (this.state === 'pan') {
      this.hooks.onPanEnd?.();
    }

    this.state = 'idle';
    this.pointerId = null;
  }
}
