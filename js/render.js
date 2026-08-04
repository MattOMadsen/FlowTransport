/** 2.5D cozy renderer */

import { worldToIso, depthKey } from './iso.js';
import { getPlaceImage, getVehicleImage, getTileImage } from './assets.js';
import { pointOnPoly } from './graph.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
  }

  resize() {
    const parent = this.canvas.parentElement || document.body;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
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
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Soft sky-to-grass gradient
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, '#c8e4f5');
    g.addColorStop(0.45, '#b8dcc8');
    g.addColorStop(1, '#9ecf9a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    camera.apply(ctx);
  }

  drawWorldGround(worldW, worldH) {
    const ctx = this.ctx;
    // Iso quad of world bounds
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

    const grass = getTileImage('grass');
    if (grass && grass.complete) {
      // Soft fill + pattern-ish by tiling in world then projecting is heavy; solid cozy green
      ctx.fillStyle = '#7cb87a';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.35;
      // Light noise strips
      for (let i = 0; i < 12; i++) {
        const y = corners[0].y + ((corners[2].y - corners[0].y) * i) / 12;
        ctx.fillStyle = i % 2 ? '#6aaa68' : '#8bc88a';
        ctx.fillRect(corners[0].x - 40, y, worldW + worldH, 18);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#7cb87a';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,80,50,0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawRoad(points, opts = {}) {
    if (!points || points.length < 2) return;
    const ctx = this.ctx;
    const isoPts = points.map((p) => worldToIso(p.x, p.y));
    const width = opts.width || 14;

    // Shadow
    ctx.beginPath();
    ctx.moveTo(isoPts[0].x + 2, isoPts[0].y + 3);
    for (let i = 1; i < isoPts.length; i++) ctx.lineTo(isoPts[i].x + 2, isoPts[i].y + 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = width + 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Shoulder
    ctx.beginPath();
    ctx.moveTo(isoPts[0].x, isoPts[0].y);
    for (let i = 1; i < isoPts.length; i++) ctx.lineTo(isoPts[i].x, isoPts[i].y);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = width + 5;
    ctx.stroke();

    // Asphalt
    ctx.strokeStyle = opts.preview ? 'rgba(55,65,81,0.55)' : '#4b5563';
    ctx.lineWidth = width;
    ctx.stroke();

    // Center dash
    if (!opts.preview) {
      ctx.save();
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = 'rgba(251,191,36,0.75)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlace(place) {
    const ctx = this.ctx;
    const iso = worldToIso(place.x, place.y);
    const img = getPlaceImage(place.type, place.variant || 0);
    const base = place.r * 1.6;

    // Ground disc shadow
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 6, base * 0.85, base * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // Soft platform
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 2, base * 0.75, base * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    if (img && img.complete && img.naturalWidth) {
      const h = base * 2.1;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, iso.x - w / 2, iso.y - h + 8, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(iso.x, iso.y - 10, base * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = place.color || '#60a5fa';
      ctx.fill();
    }

    // Label
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(15,23,42,0.88)';
    ctx.fillText(place.name, iso.x, iso.y + base * 0.55 + 14);
  }

  drawVehicle(v) {
    const ctx = this.ctx;
    const iso = worldToIso(v.x, v.y);
    // Shadow
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y + 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    const img = getVehicleImage(v.sprite || v.classId);
    const ang = (() => {
      // World heading → iso screen angle
      const d = 8;
      const a = worldToIso(v.x + Math.cos(v.angle) * d, v.y + Math.sin(v.angle) * d);
      return Math.atan2(a.y - iso.y, a.x - iso.x);
    })();

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.rotate(ang + Math.PI / 2); // sprites nose-up
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

  /**
   * Full frame: depth-sort places + vehicles
   */
  drawScene(game, camera) {
    this.clear(camera);
    this.drawWorldGround(game.worldW, game.worldH);

    for (const road of game.roads) {
      this.drawRoad(road.points, { width: 12 + (road.lanes || 1) * 2 });
    }
    if (game.strokePreview?.length) this.drawPreview(game.strokePreview);

    const drawables = [];
    for (const p of game.places) {
      drawables.push({ z: depthKey(p.x, p.y), kind: 'place', p });
    }
    for (const v of game.vehicles) {
      drawables.push({ z: depthKey(v.x, v.y), kind: 'veh', v });
    }
    drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) {
      if (d.kind === 'place') this.drawPlace(d.p);
      else this.drawVehicle(d.v);
    }

    // Job markers (small dots on from places with active jobs)
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
