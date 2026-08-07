/** 2.5D cozy renderer – DPR-safe camera, scenery */

import { worldToIso, isoToWorld, depthKey, ISO_A, ISO_B } from './iso.js';
import { getPlaceImage, getVehicleImage, getTileImage } from './assets.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
  }

  resize() {
    const parent = this.canvas.parentElement || document.body;
    const w = Math.max(1, parent.clientWidth || window.innerWidth || 1);
    const h = Math.max(1, parent.clientHeight || window.innerHeight || 1);
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cssW = w;
    this.cssH = h;
  }

  clear(camera) {
    const ctx = this.ctx;
    // Background in CSS pixels – soft cinematic sky (less flat “2010 flash”)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, '#9ec9ef');
    g.addColorStop(0.28, '#c5dff0');
    g.addColorStop(0.55, '#d4e8c8');
    g.addColorStop(0.82, '#a8c98a');
    g.addColorStop(1, '#7aab68');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    // Soft sun glow (top-right)
    const sun = ctx.createRadialGradient(
      this.cssW * 0.78,
      this.cssH * 0.12,
      8,
      this.cssW * 0.78,
      this.cssH * 0.12,
      Math.max(this.cssW, this.cssH) * 0.55
    );
    sun.addColorStop(0, 'rgba(255, 248, 220, 0.45)');
    sun.addColorStop(0.35, 'rgba(255, 236, 190, 0.12)');
    sun.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    // World: CSS camera * dpr (must match screenToWorld)
    camera.apply(ctx, this.dpr);
  }

  drawWorldGround(worldW, worldH, scenery) {
    const ctx = this.ctx;
    const corners = [
      worldToIso(0, 0),
      worldToIso(worldW, 0),
      worldToIso(worldW, worldH),
      worldToIso(0, worldH)
    ];
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Soft drop-shadow under the island (depth without hard outline)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0].x + 10, corners[0].y + 18);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x + 10, corners[i].y + 18);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 40, 25, 0.22)';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();

    // Base underpaint (visible if tiles missing)
    const grassGrad = ctx.createLinearGradient(cx, minY, cx, maxY);
    grassGrad.addColorStop(0, '#8bc98a');
    grassGrad.addColorStop(0.45, '#6db56a');
    grassGrad.addColorStop(1, '#5a9f58');
    ctx.fillStyle = grassGrad;
    ctx.fill();

    // Textured grass/dirt in world-space (iso transform) – tiles were loaded but unused
    ctx.save();
    ctx.clip();
    this._fillWorldTexture(worldW, worldH, 'grass', 0.92, 0.5);
    this._fillWorldTexture(worldW, worldH, 'grass2', 0.28, 0.62);

    // Soft field strips (subtle, over texture)
    ctx.globalAlpha = 0.1;
    const band = (maxY - minY) / 22;
    for (let i = 0; i < 22; i++) {
      const y = minY + band * i;
      ctx.fillStyle = i % 2 ? '#4d8f4a' : '#9ad498';
      ctx.fillRect(minX - 24, y, maxX - minX + 48, band + 1);
    }
    ctx.globalAlpha = 1;

    // Subtle warm light wash across board
    const wash = ctx.createRadialGradient(cx - 40, minY + 30, 20, cx, cy, (maxX - minX) * 0.65);
    wash.addColorStop(0, 'rgba(255, 255, 240, 0.14)');
    wash.addColorStop(0.55, 'rgba(255, 255, 255, 0.03)');
    wash.addColorStop(1, 'rgba(20, 60, 30, 0.1)');
    ctx.fillStyle = wash;
    ctx.fillRect(minX - 30, minY - 30, maxX - minX + 60, maxY - minY + 60);

    // Hills
    if (scenery?.hills) {
      for (const h of scenery.hills) {
        const iso = worldToIso(h.x, h.y);
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, h.r * 0.7, h.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, (h.shade || 0.12) * 1.15)})`;
        ctx.fill();
      }
    }

    // Forest floor patches (+ forest tile if loaded)
    if (scenery?.forests) {
      for (const f of scenery.forests) {
        const iso = worldToIso(f.x, f.y);
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, f.r * 0.75, f.r * 0.38, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(28, 72, 36, 0.28)';
        ctx.fill();
      }
      this._stampForestPatches(scenery.forests);
    }

    // Lakes
    if (scenery?.lakes) {
      for (const L of scenery.lakes) {
        this.drawLake(L);
      }
    }
    ctx.restore();

    // Rim: soft light edge + thin dark lip (no thick cartoon stroke)
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(22, 55, 32, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Fill current clip with a tile pattern mapped from world → iso.
   * @param {number} worldW
   * @param {number} worldH
   * @param {string} tileName
   * @param {number} alpha
   * @param {number} scale pattern scale (smaller = denser)
   */
  _fillWorldTexture(worldW, worldH, tileName, alpha = 1, scale = 0.55) {
    const ctx = this.ctx;
    const img = getTileImage(tileName);
    if (!img || !img.complete || !img.naturalWidth) return;
    let pat;
    try {
      pat = ctx.createPattern(img, 'repeat');
    } catch {
      return;
    }
    if (!pat) return;
    if (typeof pat.setTransform === 'function') {
      const m = new DOMMatrix();
      m.scaleSelf(scale, scale);
      pat.setTransform(m);
    }
    ctx.save();
    // Screen = world * [[A,-A],[B,B]]  →  ctx.transform(a,b,c,d,e,f)
    ctx.transform(ISO_A, ISO_B, -ISO_A, ISO_B, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pat;
    ctx.fillRect(-2, -2, worldW + 4, worldH + 4);
    ctx.restore();
  }

  _stampForestPatches(forests) {
    const ctx = this.ctx;
    const img = getTileImage('forest');
    if (!img || !img.complete || !img.naturalWidth) return;
    for (const f of forests) {
      const iso = worldToIso(f.x, f.y);
      const rw = (f.r || 40) * 1.2;
      const rh = (f.r || 40) * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(iso.x, iso.y, rw * 0.55, rh * 0.85, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.45;
      const s = Math.max(rw, rh) * 1.4;
      ctx.drawImage(img, iso.x - s / 2, iso.y - s / 2, s, s);
      ctx.restore();
    }
  }

  drawLake(L) {
    const ctx = this.ctx;
    const iso = worldToIso(L.x, L.y);
    // Approximate ellipse in iso: scale axes
    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.rotate(L.rot * 0.35);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx * 0.85, L.ry * 0.95, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, L.rx);
    grad.addColorStop(0, '#a8dff5');
    grad.addColorStop(0.4, '#4eb3d9');
    grad.addColorStop(0.75, '#2f8cb5');
    grad.addColorStop(1, '#1f6a8a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Shine
    ctx.beginPath();
    ctx.ellipse(-L.rx * 0.2, -L.ry * 0.15, L.rx * 0.35, L.ry * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    ctx.restore();
  }

  drawTree(t) {
    const ctx = this.ctx;
    const iso = worldToIso(t.x, t.y);
    const s = (t.s || 1) * 14;
    // Soft contact shadow
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 2, s * 0.48, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 40, 20, 0.2)';
    ctx.fill();
    // Trunk
    ctx.fillStyle = '#5c4030';
    ctx.fillRect(iso.x - s * 0.08, iso.y - s * 0.35, s * 0.16, s * 0.4);
    // Canopy – slightly richer greens
    const g = t.tint > 0.5 ? '#3a8f4a' : '#2a7340';
    const g2 = t.tint > 0.5 ? '#62c26a' : '#4aad5c';
    ctx.beginPath();
    ctx.arc(iso.x, iso.y - s * 0.55, s * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(iso.x - s * 0.2, iso.y - s * 0.4, s * 0.32, 0, Math.PI * 2);
    ctx.arc(iso.x + s * 0.22, iso.y - s * 0.42, s * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();
    // Specular speck on canopy
    ctx.beginPath();
    ctx.arc(iso.x - s * 0.08, iso.y - s * 0.62, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
  }

  drawRoad(points, opts = {}) {
    if (!points || points.length < 2) return;
    const ctx = this.ctx;
    const isoPts = points.map((p) => worldToIso(p.x, p.y));
    const lanes = opts.lanes || 1;
    const dual = lanes >= 2;
    const highway = lanes >= 3;
    const width = opts.width || (highway ? 24 : dual ? 18 : 14);

    // Soft layered shadow
    ctx.beginPath();
    ctx.moveTo(isoPts[0].x + 1.5, isoPts[0].y + 4);
    for (let i = 1; i < isoPts.length; i++) ctx.lineTo(isoPts[i].x + 1.5, isoPts[i].y + 4);
    ctx.strokeStyle = 'rgba(15, 25, 20, 0.22)';
    ctx.lineWidth = width + 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Outer curb
    ctx.beginPath();
    ctx.moveTo(isoPts[0].x, isoPts[0].y);
    for (let i = 1; i < isoPts.length; i++) ctx.lineTo(isoPts[i].x, isoPts[i].y);
    ctx.strokeStyle = highway ? '#0f2744' : dual ? '#3f3a36' : '#4a5560';
    ctx.lineWidth = width + 4.5;
    ctx.stroke();

    const bridge = !!opts.bridge;
    // Asphalt surface (texture when available)
    ctx.lineWidth = width;
    if (opts.preview) {
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.stroke();
    } else {
      const asphalt = getTileImage('asphalt');
      let usedTex = false;
      if (asphalt && asphalt.complete && asphalt.naturalWidth) {
        try {
          const pat = ctx.createPattern(asphalt, 'repeat');
          if (pat) {
            if (typeof pat.setTransform === 'function') {
              const m = new DOMMatrix();
              m.scaleSelf(0.45, 0.45);
              pat.setTransform(m);
            }
            ctx.strokeStyle = pat;
            ctx.stroke();
            usedTex = true;
            // Darken / grade by road class
            ctx.strokeStyle = highway
              ? 'rgba(15, 30, 55, 0.45)'
              : dual
                ? 'rgba(20, 24, 32, 0.32)'
                : bridge
                  ? 'rgba(40, 50, 65, 0.28)'
                  : 'rgba(25, 30, 38, 0.22)';
            ctx.stroke();
          }
        } catch {
          usedTex = false;
        }
      }
      if (!usedTex) {
        ctx.strokeStyle = bridge
          ? '#6b7c8f'
          : highway
            ? '#1a2740'
            : dual
              ? '#2f3540'
              : '#3d4450';
        ctx.stroke();
      }
    }

    // Subtle top highlight edge
    if (!opts.preview) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, width * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    if (bridge && !opts.preview) {
      ctx.strokeStyle = 'rgba(226,232,240,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (!opts.preview) {
      ctx.save();
      if (highway) {
        ctx.setLineDash([14, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      } else if (dual) {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.lineWidth = 1.15;
        ctx.stroke();
      } else {
        ctx.setLineDash(bridge ? [4, 8] : [9, 11]);
        ctx.strokeStyle = bridge ? 'rgba(203,213,225,0.9)' : 'rgba(253, 224, 71, 0.72)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPlace(place) {
    const ctx = this.ctx;
    const iso = worldToIso(place.x, place.y);
    const img = getPlaceImage(place.type, place.variant || 0);
    const base = Math.max(40, place.r * 1.28);

    // Soft ground contact + light pad
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 7, base * 0.88, base * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 30, 20, 0.2)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 2, base * 0.74, base * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();

    if (img && img.complete && img.naturalWidth) {
      const h = base * 1.85;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, iso.x - w / 2, iso.y - h + 10, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(iso.x, iso.y - 10, base * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = place.color || '#60a5fa';
      ctx.fill();
    }

    // Name pill (modern UI chip under place)
    const name = place.name || '';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(name).width;
    const px = 10;
    const py = 5;
    const pillW = tw + px * 2;
    const pillH = 18;
    const pillX = iso.x - pillW / 2;
    const pillY = iso.y + base * 0.48 + 4;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pillX, pillY, pillW, pillH, 9);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(name, iso.x, pillY + pillH / 2 + 0.5);

    // Building badges
    const b = place.buildings;
    if (b && (b.station || b.warehouse || b.depot)) {
      const icons = [];
      if (b.station) icons.push('🚉');
      if (b.warehouse) icons.push('🏭');
      if (b.depot) icons.push('🚏');
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icons.join(''), iso.x, iso.y - base * 0.9);
    }
  }

  drawVehicle(v) {
    const ctx = this.ctx;
    const iso = worldToIso(v.x, v.y);
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 4, 11, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 25, 18, 0.28)';
    ctx.fill();

    const img = getVehicleImage(v.sprite || v.classId);
    const d = 8;
    const a = worldToIso(v.x + Math.cos(v.angle) * d, v.y + Math.sin(v.angle) * d);
    const ang = Math.atan2(a.y - iso.y, a.x - iso.x);

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.rotate(ang + Math.PI / 2);
    if (img && img.complete && img.naturalWidth) {
      const s =
        v.classId === 'bus' ? 34 : v.classId === 'van' ? 28 : v.kind === 'truck' ? 32 : 26;
      // Soft under-glow so sprites read on textured grass
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(0, 2, s * 0.38, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = v.color || '#3b82f6';
      ctx.fillRect(-7, -10, 14, 20);
    }
    ctx.restore();

    if (v.cargo > 0) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v.kind === 'truck' ? '📦' : '👤', iso.x, iso.y - 18);
    }
  }

  drawPreview(points) {
    if (points?.length >= 2) this.drawRoad(points, { preview: true, width: 12 });
  }

  /**
   * Magnet-ring + label mens man tegner vej.
   * @param {{ kind:string, x:number, y:number, label?:string, strength?:number }|null} snap
   * @param {{ x:number, y:number }|null} tip raw finger/mouse world pos
   */
  drawSnapFeedback(snap, tip = null) {
    if (!snap || snap.kind === 'free') return;
    const ctx = this.ctx;
    const iso = worldToIso(snap.x, snap.y);
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 180);
    const colors = {
      place: {
        fill: 'rgba(245, 158, 11, 0.4)',
        stroke: '#d97706',
        ring: 'rgba(251, 191, 36, 0.35)'
      },
      node: {
        fill: 'rgba(14, 165, 233, 0.4)',
        stroke: '#0284c7',
        ring: 'rgba(56, 189, 248, 0.35)'
      },
      road: {
        fill: 'rgba(16, 185, 129, 0.38)',
        stroke: '#059669',
        ring: 'rgba(52, 211, 153, 0.3)'
      }
    };
    const c = colors[snap.kind] || colors.road;
    const r = (14 + (snap.strength || 0.5) * 10) * pulse;

    // Guide: finger → snap
    if (tip && Math.hypot(snap.x - tip.x, snap.y - tip.y) > 6) {
      const tipIso = worldToIso(tip.x, tip.y);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = c.stroke;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(tipIso.x, tipIso.y);
      ctx.lineTo(iso.x, iso.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(iso.x, iso.y, r * 1.55, 0, Math.PI * 2);
    ctx.fillStyle = c.ring;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(iso.x, iso.y, r, 0, Math.PI * 2);
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(iso.x - r * 0.55, iso.y);
    ctx.lineTo(iso.x + r * 0.55, iso.y);
    ctx.moveTo(iso.x, iso.y - r * 0.55);
    ctx.lineTo(iso.x, iso.y + r * 0.55);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const label =
      snap.kind === 'place'
        ? `◎ ${snap.label || 'By'}`
        : snap.kind === 'node'
          ? '⊕ Kryds'
          : '⊞ Vej';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(label, iso.x, iso.y - r - 6);
    ctx.fillStyle = c.stroke;
    ctx.fillText(label, iso.x, iso.y - r - 6);
  }

  drawScene(game, camera) {
    this.clear(camera);
    this.drawWorldGround(game.worldW, game.worldH, game.scenery);

    for (const road of game.roads) {
      const lanes = road.lanes || 1;
      this.drawRoad(road.points, {
        width: 12 + Math.min(lanes, 3) * 3 + (lanes >= 3 ? 2 : 0),
        lanes,
        bridge: !!road.isBridge
      });
    }
    if (game.strokePreview?.length) this.drawPreview(game.strokePreview);

    // Snap-magnet under tegning (start + slut)
    if (game.strokeSnap) {
      this.drawSnapFeedback(game.strokeSnap.start, null);
      this.drawSnapFeedback(game.strokeSnap.end, game.strokeSnap.tip);
    }

    const drawables = [];
    if (game.scenery?.trees) {
      for (const t of game.scenery.trees) {
        drawables.push({ z: depthKey(t.x, t.y), kind: 'tree', t });
      }
    }
    for (const p of game.places) {
      drawables.push({ z: depthKey(p.x, p.y), kind: 'place', p });
    }
    for (const v of game.vehicles) {
      drawables.push({ z: depthKey(v.x, v.y), kind: 'veh', v });
    }
    drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) {
      if (d.kind === 'tree') this.drawTree(d.t);
      else if (d.kind === 'place') this.drawPlace(d.p);
      else this.drawVehicle(d.v);
    }

    const ctx = this.ctx;
    for (const job of game.jobs) {
      if (!job.active) continue;
      const iso = worldToIso(job.from.x, job.from.y);
      ctx.beginPath();
      ctx.arc(iso.x + 18, iso.y - 28, 5, 0, Math.PI * 2);
      ctx.fillStyle = job.typeMeta.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const highlight = game.getSelectedJob?.() || null;
    if (highlight) this.drawJobHighlight(highlight);

    this.drawMinimap(game);
    this.drawScreenVignette();
  }

  /** Soft screen-space vignette – lille “premium” polish uden gameplay-ændring */
  drawScreenVignette() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = this.cssW;
    const h = this.cssH;
    const v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.65, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(12, 28, 22, 0.22)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Top-down minimap (world coords). Viewport = current camera AABB in world.
   */
  drawMinimap(game) {
    const canvas = document.getElementById('minimap');
    if (!canvas || !game?.worldW || !game.hasActiveSession) {
      if (canvas) canvas.classList.add('hidden');
      return;
    }
    canvas.classList.remove('hidden');

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 148;
    const cssH = canvas.clientHeight || 112;
    const pw = Math.max(1, Math.floor(cssW * dpr));
    const ph = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 6;
    const worldW = game.worldW;
    const worldH = game.worldH;
    const scale = Math.min((cssW - pad * 2) / worldW, (cssH - pad * 2) / worldH);
    const ox = (cssW - worldW * scale) / 2;
    const oy = (cssH - worldH * scale) / 2;
    const toMap = (x, y) => ({ x: ox + x * scale, y: oy + y * scale });

    // Cache for click handler
    game._minimapMap = { ox, oy, scale, cssW, cssH, worldW, worldH };

    ctx.fillStyle = '#1a3328';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#2d5a45';
    ctx.fillRect(ox, oy, worldW * scale, worldH * scale);

    // Roads
    for (const road of game.roads || []) {
      const pts = road.points;
      if (!pts?.length) continue;
      ctx.beginPath();
      const p0 = toMap(pts[0].x, pts[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = toMap(pts[i].x, pts[i].y);
        ctx.lineTo(p.x, p.y);
      }
      {
        const L = road.lanes || 1;
        ctx.strokeStyle = L >= 3 ? '#38bdf8' : L >= 2 ? '#fbbf24' : '#94a3b8';
        ctx.lineWidth = L >= 3 ? 2.6 : L >= 2 ? 2.2 : 1.4;
      }
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Places
    for (const p of game.places || []) {
      const m = toMap(p.x, p.y);
      ctx.beginPath();
      ctx.arc(m.x, m.y, p.type === 'capital' ? 3.5 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#60a5fa';
      ctx.fill();
    }

    // Vehicles
    for (const v of game.vehicles || []) {
      const m = toMap(v.x, v.y);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }

    // Viewport rectangle (screen corners → world)
    const cam = game.camera;
    const sw = this.cssW || window.innerWidth;
    const sh = this.cssH || window.innerHeight;
    const corners = [
      [0, 0],
      [sw, 0],
      [sw, sh],
      [0, sh]
    ].map(([sx, sy]) => {
      const view = cam.screenToView(sx, sy);
      return isoToWorld(view.x, view.y);
    });
    ctx.beginPath();
    const c0 = toMap(corners[0].x, corners[0].y);
    ctx.moveTo(c0.x, c0.y);
    for (let i = 1; i < corners.length; i++) {
      const c = toMap(corners[i].x, corners[i].y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(45, 212, 191, 0.12)';
    ctx.fill();
  }

  /** Stiplet linje + rings mellem job.from og job.to */
  drawJobHighlight(job) {
    if (!job?.from || !job?.to) return;
    const ctx = this.ctx;
    const a = worldToIso(job.from.x, job.from.y);
    const b = worldToIso(job.to.x, job.to.y);
    const color = job.typeMeta?.color || '#2563eb';
    const dashOff = (performance.now() / 40) % 20;

    ctx.save();
    // Soft glow under line
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.globalAlpha = 0.95;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -dashOff;
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Endpoint rings
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
    }

    // Labels A / B
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = (iso) => iso.y - 22;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(job.from.name, a.x, labelY(a));
    ctx.strokeText(job.to.name, b.x, labelY(b));
    ctx.fillStyle = color;
    ctx.fillText(job.from.name, a.x, labelY(a));
    ctx.fillText(job.to.name, b.x, labelY(b));
    ctx.restore();
  }
}
