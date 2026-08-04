/** 2.5D cozy renderer – DPR-safe camera, scenery */

import { worldToIso, depthKey } from './iso.js';
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
    // Background in CSS pixels
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, '#b9d9f0');
    g.addColorStop(0.35, '#c5e0c8');
    g.addColorStop(1, '#8fbf7a');
    ctx.fillStyle = g;
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
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();

    ctx.fillStyle = '#6fad6c';
    ctx.fill();

    // Soft field strips inside board
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.22;
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    for (let i = 0; i < 18; i++) {
      const y = minY + ((maxY - minY) * i) / 18;
      ctx.fillStyle = i % 2 ? '#5f9a5c' : '#7fbe7a';
      ctx.fillRect(minX - 20, y, maxX - minX + 40, (maxY - minY) / 18 + 1);
    }
    ctx.globalAlpha = 1;

    // Hills
    if (scenery?.hills) {
      for (const h of scenery.hills) {
        const iso = worldToIso(h.x, h.y);
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, h.r * 0.7, h.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${h.shade})`;
        ctx.fill();
      }
    }

    // Forest floor patches
    if (scenery?.forests) {
      for (const f of scenery.forests) {
        const iso = worldToIso(f.x, f.y);
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, f.r * 0.75, f.r * 0.38, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34,90,40,0.28)';
        ctx.fill();
      }
    }

    // Lakes
    if (scenery?.lakes) {
      for (const L of scenery.lakes) {
        this.drawLake(L);
      }
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(30,70,40,0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
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
    grad.addColorStop(0, '#7ec8e8');
    grad.addColorStop(0.55, '#3a9bc5');
    grad.addColorStop(1, '#2a7a9e');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Shine
    ctx.beginPath();
    ctx.ellipse(-L.rx * 0.2, -L.ry * 0.15, L.rx * 0.35, L.ry * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.restore();
  }

  drawTree(t) {
    const ctx = this.ctx;
    const iso = worldToIso(t.x, t.y);
    const s = (t.s || 1) * 14;
    // Shadow
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 2, s * 0.45, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    // Trunk
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(iso.x - s * 0.08, iso.y - s * 0.35, s * 0.16, s * 0.4);
    // Canopy
    const g = t.tint > 0.5 ? '#3d8c40' : '#2f7a38';
    const g2 = t.tint > 0.5 ? '#5cb85c' : '#4a9c4f';
    ctx.beginPath();
    ctx.arc(iso.x, iso.y - s * 0.55, s * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(iso.x - s * 0.2, iso.y - s * 0.4, s * 0.32, 0, Math.PI * 2);
    ctx.arc(iso.x + s * 0.22, iso.y - s * 0.42, s * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();
  }

  drawRoad(points, opts = {}) {
    if (!points || points.length < 2) return;
    const ctx = this.ctx;
    const isoPts = points.map((p) => worldToIso(p.x, p.y));
    const width = opts.width || 14;

    ctx.beginPath();
    ctx.moveTo(isoPts[0].x + 2, isoPts[0].y + 3);
    for (let i = 1; i < isoPts.length; i++) ctx.lineTo(isoPts[i].x + 2, isoPts[i].y + 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = width + 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(isoPts[0].x, isoPts[0].y);
    for (let i = 1; i < isoPts.length; i++) ctx.lineTo(isoPts[i].x, isoPts[i].y);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = width + 5;
    ctx.stroke();

    const bridge = !!opts.bridge;
    ctx.strokeStyle = opts.preview
      ? 'rgba(55,65,81,0.55)'
      : bridge
        ? '#64748b'
        : '#4b5563';
    ctx.lineWidth = width;
    ctx.stroke();

    if (bridge && !opts.preview) {
      // Bridge rails
      ctx.strokeStyle = 'rgba(226,232,240,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (!opts.preview) {
      ctx.save();
      ctx.setLineDash(bridge ? [4, 8] : [8, 10]);
      ctx.strokeStyle = bridge ? 'rgba(148,163,184,0.9)' : 'rgba(251,191,36,0.75)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlace(place) {
    const ctx = this.ctx;
    const iso = worldToIso(place.x, place.y);
    const img = getPlaceImage(place.type, place.variant || 0);
    const base = Math.max(36, place.r * 1.15);

    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 6, base * 0.85, base * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 2, base * 0.72, base * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
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

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeText(place.name, iso.x, iso.y + base * 0.5 + 12);
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.fillText(place.name, iso.x, iso.y + base * 0.5 + 12);
  }

  drawVehicle(v) {
    const ctx = this.ctx;
    const iso = worldToIso(v.x, v.y);
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    const img = getVehicleImage(v.sprite || v.classId);
    const d = 8;
    const a = worldToIso(v.x + Math.cos(v.angle) * d, v.y + Math.sin(v.angle) * d);
    const ang = Math.atan2(a.y - iso.y, a.x - iso.x);

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.rotate(ang + Math.PI / 2);
    if (img && img.complete && img.naturalWidth) {
      const s = v.kind === 'truck' ? 28 : 22;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = v.color || '#3b82f6';
      ctx.fillRect(-7, -10, 14, 20);
    }
    ctx.restore();

    if (v.cargo > 0) {
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.fillText(v.kind === 'truck' ? '📦' : '👤', iso.x, iso.y - 16);
    }
  }

  drawPreview(points) {
    if (points?.length >= 2) this.drawRoad(points, { preview: true, width: 12 });
  }

  drawScene(game, camera) {
    this.clear(camera);
    this.drawWorldGround(game.worldW, game.worldH, game.scenery);

    for (const road of game.roads) {
      this.drawRoad(road.points, {
        width: 12 + (road.lanes || 1) * 2,
        bridge: !!road.isBridge
      });
    }
    if (game.strokePreview?.length) this.drawPreview(game.strokePreview);

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
  }
}
