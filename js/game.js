/**
 * FlowTransport game orchestrator – slim, graph-based.
 */

import {
  RoadGraph,
  polyLength,
  closestOnPoly,
  splitPolyAtT,
  nearestNode,
  resetGraphIds
} from './graph.js';
import { Vehicle } from './vehicle.js';
import { buildPlaces } from './places.js';
import { generateJob, jobComplete, jobLabel } from './jobs.js';
import {
  VEHICLE_CLASSES,
  vehicleCanDoJob,
  buyPrice,
  upgradePrice,
  canUpgrade,
  sellPriceForClass
} from './fleet.js';
import { getScenario, evaluateStars, goalLabel } from './scenarios.js';
import { loadMeta, saveMeta, addXp, setScenarioStars, XP_REWARDS } from './meta.js';
import { Camera } from './camera.js';
import { InputHandler } from './input.js';
import { Renderer } from './render.js';
import { worldToIso, isoToWorld } from './iso.js';
import { loadGameAssets } from './assets.js';
import { buildScenery, strokeCrossesWater } from './worldgen.js';
import { playRoad, playDeliver, playBuy, playError, playJobDone, isMuted, toggleMute } from './audio.js';

const ROAD_COST_PER_PX = 0.42;
const ROAD_BASE_COST = 18;
const BRIDGE_MULT = 1.85;
const SNAP_R = 40;

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.graph = new RoadGraph();
    this.roads = [];
    this.roadsById = new Map();
    this.places = [];
    this.scenery = { lakes: [], trees: [], forests: [], hills: [] };
    this.vehicles = [];
    this.jobs = [];
    this.money = 1600;
    this.tool = 'draw';
    this.strokePreview = [];
    this.strokePoints = [];
    /** Live snap feedback while drawing: { start, end, tip } */
    this.strokeSnap = null;
    this.undoStack = [];
    this.scenario = null;
    this.stats = { delivered: 0, jobsDone: 0 };
    this.meta = loadMeta();
    this.jobTimer = 0;
    this.toastTimer = 0;
    this.toastText = '';
    /** @type {number|null} job id highlighted from task list */
    this.selectedJobId = null;
    this.selectedJobTimer = 0;
    this.running = false;
    this.paused = false;
    this.hasActiveSession = false;
    this._last = 0;
    this._loopGen = 0;

    this.input = new InputHandler(canvas, {
      getTool: () => this.tool,
      getZoom: () => this.camera.zoom,
      onDrawStart: (x, y) => {
        if (this.paused) return;
        if (this.tool === 'draw') this.beginStroke(x, y);
      },
      onDrawMove: (x, y) => {
        if (this.paused) return;
        if (this.tool === 'draw') this.moveStroke(x, y);
      },
      onDrawEnd: () => {
        if (this.tool === 'draw') this.endStroke();
      },
      onCancelDraw: () => {
        this.strokePoints = [];
        this.strokePreview = [];
        this.strokeSnap = null;
      },
      onPanStart: () => {},
      onPanMove: (dx, dy) => this.camera.pan(dx, dy),
      onPanEnd: () => {},
      onPinchStart: () => {},
      onPinch: (mx, my, z) => this.camera.setZoom(z, mx, my),
      onPinchEnd: () => {},
      onWheel: (cx, cy, dy) => {
        const r = canvas.getBoundingClientRect();
        const factor = dy > 0 ? 0.9 : 1.1;
        this.camera.setZoom(this.camera.zoom * factor, cx - r.left, cy - r.top);
      },
      onTap: (x, y) => {
        if (this.paused) return;
        this.handleTap(x, y);
      }
    });
  }

  async init() {
    await loadGameAssets();
    this.renderer.resize();
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.fitCamera();
    });
  }

  screenToWorld(sx, sy) {
    const view = this.camera.screenToView(sx, sy);
    return isoToWorld(view.x, view.y);
  }

  /** Full new game on a scenario (from menu). */
  startScenario(id) {
    resetGraphIds();
    this.scenario = getScenario(id);
    this.worldW = this.scenario.worldW;
    this.worldH = this.scenario.worldH;
    this.money = this.scenario.startMoney;
    this.roads = [];
    this.roadsById.clear();
    this.graph.clear();
    this.vehicles = [];
    this.jobs = [];
    this.stats = { delivered: 0, jobsDone: 0 };
    this.selectedJobId = null;
    this.selectedJobTimer = 0;
    this.undoStack = [];
    this.strokePoints = [];
    this.strokePreview = [];
    this.strokeSnap = null;
    this.paused = false;
    this.tool = 'draw';
    this.meta = loadMeta();

    this.places = buildPlaces(this.worldW, this.worldH, this.scenario.layout, this.scenario.seed);
    this.scenery = buildScenery(this.worldW, this.worldH, this.places, this.scenario.seed);
    for (const p of this.places) {
      const node = this.graph.addNode(p.x, p.y, p.id);
      p.nodeId = node.id;
    }

    // Gratis startbil i hovedby: man kan køre første job med det samme efter vej.
    // (Ikke tvunget – bare onboarding; flåden udvides via by-shop.)
    const home = this.places.find((p) => p.type === 'capital') || this.places[0];
    this.vehicles.push(new Vehicle({ x: home.x, y: home.y, classId: 'car', homePlace: home }));

    this.seedJobs(4);
    this.renderer.resize();
    this.fitCamera();
    this.hasActiveSession = true;
    this.running = true;
    this._loopGen += 1;
    const gen = this._loopGen;
    this._last = performance.now();
    this.loop(this._last, gen);
    this.syncUI();
    this.toast('Nyt spil – tegn veje mellem byerne 🛣️');
  }

  /** Leave to menu without destroying world (optional continue). */
  goToMenu() {
    this.running = false;
    this.paused = true;
  }

  /** Resume current session from menu. */
  resumeSession() {
    if (!this.hasActiveSession || !this.scenario) return false;
    this.paused = false;
    this.running = true;
    this._loopGen += 1;
    const gen = this._loopGen;
    this._last = performance.now();
    this.loop(this._last, gen);
    this.syncUI();
    this.toast('Fortsætter spil');
    return true;
  }

  togglePause() {
    if (!this.hasActiveSession) return;
    this.paused = !this.paused;
    this.toast(this.paused ? 'Pause' : 'Fortsæt');
    this.syncUI();
  }

  toggleMute() {
    const m = toggleMute();
    this.toast(m ? 'Lyd slået fra' : 'Lyd slået til');
    this.syncUI();
    return m;
  }

  fitCamera() {
    if (!this.worldW || !this.worldH) return;
    const w = this.renderer.cssW || window.innerWidth;
    const h = this.renderer.cssH || window.innerHeight;
    if (!w || !h) return;

    const samples = [
      worldToIso(0, 0),
      worldToIso(this.worldW, 0),
      worldToIso(this.worldW, this.worldH),
      worldToIso(0, this.worldH)
    ];
    // Include places so Fit frames gameplay, not empty corners alone
    for (const p of this.places || []) {
      samples.push(worldToIso(p.x, p.y));
      samples.push(worldToIso(p.x + p.r, p.y + p.r));
      samples.push(worldToIso(p.x - p.r, p.y - p.r));
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of samples) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
    // Padding in iso-space so labels/sprites aren’t clipped
    const padIso = 80;
    this.camera.fitIsoBounds(
      minX - padIso,
      minY - padIso,
      maxX + padIso,
      maxY + padIso,
      w,
      h,
      40
    );
  }

  seedJobs(n) {
    for (let i = 0; i < n; i++) {
      const j = generateJob(this.places);
      if (j) this.jobs.push(j);
    }
  }

  setTool(tool) {
    this.tool = tool;
    this.syncUI();
  }

  toast(msg) {
    this.toastText = msg;
    this.toastTimer = 2.8;
    if (this.ui.toast) {
      this.ui.toast.textContent = msg;
      this.ui.toast.classList.add('show');
    }
  }

  beginStroke(sx, sy) {
    if (this.tool !== 'draw' || this.paused) return;
    const w = this.screenToWorld(sx, sy);
    const snap = this.snapPoint(w.x, w.y);
    this.strokePoints = [{ x: snap.x, y: snap.y }];
    this.strokePreview = [...this.strokePoints];
    this.strokeSnap = { start: snap, end: snap, tip: { x: w.x, y: w.y } };
  }

  moveStroke(sx, sy) {
    if (!this.strokePoints.length) return;
    const w = this.screenToWorld(sx, sy);
    const last = this.strokePoints[this.strokePoints.length - 1];
    // Altid opdatér snap-magnet (også mellem sample-punkter)
    const snap = this.snapPoint(w.x, w.y);
    const start =
      this.strokeSnap?.start || this.snapPoint(this.strokePoints[0].x, this.strokePoints[0].y);
    this.strokeSnap = { start, end: snap, tip: { x: w.x, y: w.y } };
    this.strokePreview = [...this.strokePoints.slice(0, -1), { x: snap.x, y: snap.y }];

    if (Math.hypot(w.x - last.x, w.y - last.y) < 10) return;
    this.strokePoints.push({ x: w.x, y: w.y });
  }

  endStroke() {
    if (this.strokePoints.length < 2) {
      this.strokePoints = [];
      this.strokePreview = [];
      this.strokeSnap = null;
      return;
    }
    // Snap ends
    const first = this.snapPoint(this.strokePoints[0].x, this.strokePoints[0].y);
    const lastRaw = this.strokePoints[this.strokePoints.length - 1];
    const last = this.snapPoint(lastRaw.x, lastRaw.y);
    const points = [{ x: first.x, y: first.y }, ...this.strokePoints.slice(1, -1), { x: last.x, y: last.y }];
    // Simplify very dense points
    const simplified = simplify(points, 8);
    const len = polyLength(simplified);
    if (len < 40) {
      this.toast('Vejen er for kort');
      this.strokePoints = [];
      this.strokePreview = [];
      this.strokeSnap = null;
      return;
    }
    const overWater = strokeCrossesWater(simplified, this.scenery?.lakes);
    let cost = Math.round(ROAD_BASE_COST + len * ROAD_COST_PER_PX);
    if (overWater) cost = Math.round(cost * BRIDGE_MULT);
    if (this.money < cost) {
      playError();
      this.toast(`Ikke nok penge (mangler ${cost - this.money} kr)`);
      this.strokePoints = [];
      this.strokePreview = [];
      this.strokeSnap = null;
      return;
    }
    this.money -= cost;
    const road = {
      id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      points: simplified,
      lanes: 1,
      paidCost: cost,
      isBridge: overWater
    };
    this.roads.push(road);
    this.roadsById.set(road.id, road);
    this._registerRoad(road);
    this.undoStack.push({ type: 'road', roadId: road.id, cost });
    addXp(this.meta, XP_REWARDS.road);
    playRoad();

    const connected = this._snapIsConnected(first) && this._snapIsConnected(last);
    if (!connected) {
      this.toast(
        overWater
          ? `Bro bygget (−${cost} kr) – men ende snappede ikke ⚠️`
          : `Vej bygget (−${cost} kr) – træk tættere på by/vej for at forbinde 🔗`
      );
    } else {
      this.toast(overWater ? `Bro bygget (−${cost} kr) 🌉` : `Vej bygget (−${cost} kr)`);
    }

    this.strokePoints = [];
    this.strokePreview = [];
    this.strokeSnap = null;
    this.tryAssignJobs();
    this.syncUI();
  }

  /** place / road / node = graf-forbindelse; free = ny løs ende */
  _snapIsConnected(snap) {
    return snap && snap.kind && snap.kind !== 'free';
  }

  /** Remove nearest road under world point (erase tool). */
  eraseAt(wx, wy) {
    let best = null;
    let bestD = 36;
    for (const road of this.roads) {
      const c = closestOnPoly(road.points, wx, wy);
      if (c.dist < bestD) {
        bestD = c.dist;
        best = road;
      }
    }
    if (!best) {
      playError();
      this.toast('Ingen vej tæt på');
      return;
    }
    this.removeRoad(best.id, true);
  }

  removeRoad(roadId, fromErase = false) {
    const idx = this.roads.findIndex((r) => r.id === roadId);
    if (idx < 0) return;
    const road = this.roads[idx];
    this.roads.splice(idx, 1);
    this.roadsById.delete(roadId);
    this.graph.removeRoad(roadId);
    const refund = Math.round((road.paidCost || 0) * 0.85);
    this.money += refund;
    this._invalidateRoutes();
    playRoad();
    this.toast(fromErase ? `Vej slettet (+${refund} kr)` : `Fortryd (+${refund} kr)`);
    this.syncUI();
  }

  _registerRoad(road) {
    const a = road.points[0];
    const b = road.points[road.points.length - 1];
    const nodeA = this._resolveEndpoint(a.x, a.y, road.id);
    const nodeB = this._resolveEndpoint(b.x, b.y, road.id);
    if (!nodeA || !nodeB || nodeA.id === nodeB.id) return;
    road.points[0] = { x: nodeA.x, y: nodeA.y };
    road.points[road.points.length - 1] = { x: nodeB.x, y: nodeB.y };
    const len = polyLength(road.points);
    this.graph.addEdge(nodeA.id, nodeB.id, road.id, len, 0);
  }

  /**
   * Endpoint → node. Splits existing road if snap is mid-edge (T-junction).
   * @param {string} [ignoreRoadId]
   */
  _resolveEndpoint(x, y, ignoreRoadId = null) {
    const placeNode = this._placeNodeNear(x, y);
    if (placeNode) return placeNode;
    const near = this.graph.findNodeNear(x, y, SNAP_R);
    if (near) return near;

    // Snap mid-road → split into junction
    let bestRoad = null;
    let best = null;
    for (const road of this.roads) {
      if (road.id === ignoreRoadId) continue;
      const c = closestOnPoly(road.points, x, y);
      if (c.dist < SNAP_R && (!best || c.dist < best.dist)) {
        best = c;
        bestRoad = road;
      }
    }
    if (bestRoad && best && best.t > 0.04 && best.t < 0.96) {
      const junc = this._splitRoadAt(bestRoad, best.t);
      if (junc) return junc;
    }
    return this.graph.getOrCreateNode(x, y, null, SNAP_R);
  }

  /** Split road geometry + graph into two segments at t */
  _splitRoadAt(road, t) {
    const split = splitPolyAtT(road.points, t);
    if (!split) return null;
    this.graph.removeRoad(road.id);

    const junc = this.graph.getOrCreateNode(split.mid.x, split.mid.y, null, 12);
    junc.x = split.mid.x;
    junc.y = split.mid.y;

    // Keep original id on first half
    road.points = split.before;
    const lenA = polyLength(road.points);
    const endA = road.points[0];
    const nodeA =
      this._placeNodeNear(endA.x, endA.y) ||
      this.graph.findNodeNear(endA.x, endA.y, SNAP_R) ||
      this.graph.getOrCreateNode(endA.x, endA.y, null, SNAP_R);
    road.points[0] = { x: nodeA.x, y: nodeA.y };
    road.points[road.points.length - 1] = { x: junc.x, y: junc.y };
    this.graph.addEdge(nodeA.id, junc.id, road.id, polyLength(road.points) || lenA, 0);

    // Second half as new road
    const roadB = {
      id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      points: split.after,
      lanes: road.lanes || 1,
      paidCost: 0
    };
    const endB = roadB.points[roadB.points.length - 1];
    const nodeB =
      this._placeNodeNear(endB.x, endB.y) ||
      this.graph.findNodeNear(endB.x, endB.y, SNAP_R) ||
      this.graph.getOrCreateNode(endB.x, endB.y, null, SNAP_R);
    roadB.points[0] = { x: junc.x, y: junc.y };
    roadB.points[roadB.points.length - 1] = { x: nodeB.x, y: nodeB.y };
    this.roads.push(roadB);
    this.roadsById.set(roadB.id, roadB);
    this.graph.addEdge(junc.id, nodeB.id, roadB.id, polyLength(roadB.points), 0);

    this._invalidateRoutes();
    return junc;
  }

  _placeNodeNear(x, y) {
    for (const p of this.places) {
      if (Math.hypot(p.x - x, p.y - y) < p.r * 1.4) {
        return this.graph.nodes.get(p.nodeId);
      }
    }
    return null;
  }

  snapPoint(x, y) {
    // Places first
    for (const p of this.places) {
      const dist = Math.hypot(p.x - x, p.y - y);
      const r = p.r * 1.5;
      if (dist < r) {
        return {
          x: p.x,
          y: p.y,
          kind: 'place',
          label: p.name,
          dist,
          strength: 1 - dist / r
        };
      }
    }
    // Existing road (T-kryds / forlængelse)
    let best = null;
    for (const road of this.roads) {
      const c = closestOnPoly(road.points, x, y);
      if (c.dist < SNAP_R && (!best || c.dist < best.dist)) {
        best = {
          x: c.x,
          y: c.y,
          kind: 'road',
          label: 'Vej',
          dist: c.dist,
          strength: 1 - c.dist / SNAP_R
        };
      }
    }
    if (best) return best;
    const n = this.graph.findNodeNear(x, y, SNAP_R);
    if (n) {
      const dist = Math.hypot(n.x - x, n.y - y);
      // Node med sted-id tæller som by
      if (n.placeId) {
        const place = this.places.find((p) => p.id === n.placeId);
        return {
          x: n.x,
          y: n.y,
          kind: 'place',
          label: place?.name || 'By',
          dist,
          strength: 1 - dist / SNAP_R
        };
      }
      return {
        x: n.x,
        y: n.y,
        kind: 'node',
        label: 'Kryds',
        dist,
        strength: 1 - dist / SNAP_R
      };
    }
    return { x, y, kind: 'free', label: null, dist: 0, strength: 0 };
  }

  undo() {
    const act = this.undoStack.pop();
    if (!act || act.type !== 'road') {
      playError();
      this.toast('Intet at fortryde');
      return;
    }
    if (this.roadsById.has(act.roadId)) {
      this.removeRoad(act.roadId, false);
    } else {
      this.toast('Vejen er allerede væk');
    }
  }

  _invalidateRoutes() {
    for (const v of this.vehicles) {
      if (v.state === 'park') continue;
      // Re-path if possible
      if (v.job) {
        const ok = this._repathVehicle(v);
        if (!ok) {
          v.job.claimedBy = null;
          v.job = null;
          v.cargo = 0;
          v.state = 'park';
          v.clearRoute();
          if (v.homePlace) {
            v.x = v.homePlace.x;
            v.y = v.homePlace.y;
          }
        }
      }
    }
  }

  _repathVehicle(v) {
    if (!v.job) return false;
    const fromNode = this.graph.nodeForPlace(v.job.from.id);
    const toNode = this.graph.nodeForPlace(v.job.to.id);
    if (!fromNode || !toNode) return false;
    const near = nearestNode(this.graph, v.x, v.y);
    const curId = near?.node?.id;
    if (!curId) return false;

    const drop = this.graph.findPath(fromNode.id, toNode.id);
    if (!drop) return false;
    v._pathDropoff = drop;

    if (v.state === 'to_pickup') {
      const p1 = this.graph.findPath(curId, fromNode.id);
      if (!p1) return false;
      v._pathPickup = p1;
      v.setRoute(p1);
      return true;
    }
    if (v.state === 'loading') {
      v._pathPickup = { edges: [], length: 0 };
      return true;
    }
    if (v.state === 'to_dropoff') {
      const p2 = this.graph.findPath(curId, toNode.id);
      if (!p2) return false;
      v.setRoute(p2);
      return true;
    }
    if (v.state === 'unload') return true;
    return false;
  }

  handleTap(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    if (this.tool === 'erase') {
      this.eraseAt(w.x, w.y);
      return;
    }
    for (const p of this.places) {
      if (Math.hypot(p.x - w.x, p.y - w.y) < p.r * 1.3) {
        this.openShop(p);
        return;
      }
    }
  }

  openShop(place) {
    const panel = this.ui.shop;
    if (!panel) return;
    panel.dataset.placeId = place.id;
    panel.querySelector('.shop-title').textContent = place.name;
    panel.classList.add('open');
    this._shopPlace = place;
    this.renderShopFleet();
  }

  closeShop() {
    this.ui.shop?.classList.remove('open');
    this._shopPlace = null;
  }

  /** Vehicles stationed at the open shop city (homePlace). */
  vehiclesAtShop() {
    const place = this._shopPlace;
    if (!place) return [];
    return this.vehicles.filter((v) => v.homePlace?.id === place.id);
  }

  renderShopFleet() {
    const list = this.ui.shop?.querySelector('#shop-fleet');
    if (!list) return;
    const at = this.vehiclesAtShop();
    if (!at.length) {
      list.innerHTML = '<p class="muted shop-fleet-empty">Ingen biler i denne by endnu.</p>';
      return;
    }
    list.innerHTML = at
      .map((v) => {
        const cls = VEHICLE_CLASSES[v.classId] || VEHICLE_CLASSES.car;
        const rank = v.upgradeRank | 0;
        const busy = !v.idle;
        const upOk = canUpgrade(rank);
        const upP = upgradePrice(rank, v.classId);
        const sellP = sellPriceForClass(v.classId, rank);
        const icon = cls.kind === 'truck' ? '🚚' : '🚗';
        const status = busy ? 'På job…' : 'Ledig';
        const rankLabel = rank > 0 ? ` · ★${rank}` : '';
        return `
          <div class="fleet-row" data-vid="${v.id}">
            <div class="fleet-info">
              <strong>${icon} ${cls.label}${rankLabel}</strong>
              <small>Cap ${v.capacity} · ${status}</small>
            </div>
            <div class="fleet-actions">
              <button type="button" class="fleet-btn fleet-up"
                data-upgrade-id="${v.id}"
                ${busy || !upOk ? 'disabled' : ''}
                title="${upOk ? `Opgrader last (+1, −${upP} kr)` : 'Max opgraderet'}">
                ${upOk ? `⬆ ${upP}` : 'Max'}
              </button>
              <button type="button" class="fleet-btn fleet-sell"
                data-sell-id="${v.id}"
                ${busy ? 'disabled' : ''}
                title="Sælg bil (+${sellP} kr)">
                Sælg ${sellP}
              </button>
            </div>
          </div>`;
      })
      .join('');
  }

  buyVehicle(classId) {
    const place = this._shopPlace || this.places[0];
    const price = buyPrice(classId);
    if (this.money < price) {
      this.toast('Ikke nok penge');
      return;
    }
    if (!VEHICLE_CLASSES[classId]) return;
    this.money -= price;
    this.vehicles.push(
      new Vehicle({ x: place.x, y: place.y, classId, homePlace: place })
    );
    playBuy();
    this.toast(`${VEHICLE_CLASSES[classId].label} købt (−${price} kr)`);
    this.renderShopFleet();
    this.tryAssignJobs();
    this.syncUI();
  }

  upgradeVehicle(vehicleId) {
    const v = this.vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    if (!v.idle) {
      this.toast('Kan ikke opgradere midt i et job');
      playError();
      return;
    }
    if (!canUpgrade(v.upgradeRank)) {
      this.toast('Allerede max opgraderet');
      return;
    }
    const price = upgradePrice(v.upgradeRank, v.classId);
    if (this.money < price) {
      this.toast('Ikke nok penge');
      playError();
      return;
    }
    this.money -= price;
    v.upgradeRank += 1;
    v.applyStats();
    playBuy();
    this.toast(`Opgraderet til ★${v.upgradeRank} (cap ${v.capacity})`);
    this.renderShopFleet();
    this.syncUI();
  }

  sellVehicle(vehicleId) {
    const v = this.vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    if (!v.idle) {
      this.toast('Kan ikke sælge bil midt i et job');
      playError();
      return;
    }
    if (this.vehicles.length <= 1) {
      this.toast('Du skal have mindst én bil');
      playError();
      return;
    }
    const refund = sellPriceForClass(v.classId, v.upgradeRank);
    this.money += refund;
    this.vehicles = this.vehicles.filter((x) => x.id !== vehicleId);
    playBuy();
    this.toast(`Solgt (+${refund} kr)`);
    this.renderShopFleet();
    this.syncUI();
  }

  tryAssignJobs() {
    const free = this.vehicles.filter((v) => v.idle);
    for (const job of this.jobs) {
      if (!job.active || job.claimedBy) continue;
      const fromNode = this.graph.nodeForPlace(job.from.id);
      const toNode = this.graph.nodeForPlace(job.to.id);
      if (!fromNode || !toNode) continue;
      const dropPath = this.graph.findPath(fromNode.id, toNode.id);
      if (!dropPath) continue;

      const candidate = free.find((v) => vehicleCanDoJob(v.classId, job));
      if (!candidate) continue;

      const home = candidate.homePlace || job.from;
      const homeNode = this.graph.nodeForPlace(home.id) || fromNode;
      let pickPath = this.graph.findPath(homeNode.id, fromNode.id);
      if (!pickPath) {
        // Already at from?
        if (homeNode.id === fromNode.id) pickPath = { edges: [], length: 0 };
        else continue;
      }

      job.claimedBy = candidate.id;
      candidate.assignJob(job, pickPath, dropPath);
      free.splice(free.indexOf(candidate), 1);
    }
  }

  /** Tap opgave i listen → fremhæv A→B på kortet */
  selectJob(jobId) {
    const id = Number(jobId);
    if (!Number.isFinite(id)) return;
    const job = this.jobs.find((j) => j.id === id && j.active);
    if (!job) return;
    if (this.selectedJobId === id) {
      this.selectedJobId = null;
      this.selectedJobTimer = 0;
      this.toast('Rute skjult');
      this.syncUI();
      return;
    }
    this.selectedJobId = id;
    this.selectedJobTimer = 14;
    this.toast(`${job.from.name} → ${job.to.name}`);
    this.syncUI();
  }

  getSelectedJob() {
    if (this.selectedJobId == null) return null;
    return this.jobs.find((j) => j.id === this.selectedJobId && j.active) || null;
  }

  allPlacesConnected() {
    if (this.places.length < 2) return true;
    const start = this.places[0].nodeId;
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const id = q.shift();
      for (const { next } of this.graph.neighbors(id)) {
        if (!seen.has(next)) {
          seen.add(next);
          q.push(next);
        }
      }
    }
    return this.places.every((p) => seen.has(p.nodeId));
  }

  loop(now, gen) {
    if (!this.running || gen !== this._loopGen) return;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (!this.paused) this.update(dt);
    this.renderer.drawScene(this, this.camera);
    requestAnimationFrame((t) => this.loop(t, gen));
  }

  update(dt) {
    // Jobs spawn
    this.jobTimer += dt;
    if (this.jobTimer > 7 && this.jobs.filter((j) => j.active).length < 6) {
      this.jobTimer = 0;
      const j = generateJob(this.places);
      if (j) {
        this.jobs.push(j);
        this.tryAssignJobs();
      }
    }

    const ctx = {
      graph: this.graph,
      roadsById: this.roadsById,
      findPath: (a, b) => this.graph.findPath(a, b),
      nodeForPlace: (placeId) => this.graph.nodeForPlace(placeId)?.id ?? null,
      onNeedAssign: () => this.tryAssignJobs(),
      onDeliver: (v, amount) => {
        if (!v.job) return;
        const share = Math.round((v.job.reward * amount) / Math.max(1, v.job.amount));
        this.money += share;
        this.stats.delivered += amount;
        addXp(this.meta, XP_REWARDS.deliver);
        this.meta.totalDelivered = (this.meta.totalDelivered || 0) + amount;
        saveMeta(this.meta);
        playDeliver();
      },
      onJobDone: (v, job) => {
        if (job) {
          job.active = false;
          job.claimedBy = null;
          this.stats.jobsDone += 1;
          playJobDone();
          this.toast(`Leveret: ${job.from.name} → ${job.to.name} ✓`);
          if (this.selectedJobId === job.id) {
            this.selectedJobId = null;
            this.selectedJobTimer = 0;
          }
        }
        this.tryAssignJobs();
        this.checkStars();
        this.syncUI();
      }
    };

    for (const v of this.vehicles) v.update(ctx, dt);

    // Drop inactive jobs
    this.jobs = this.jobs.filter((j) => j.active);
    if (this.selectedJobId != null && !this.jobs.some((j) => j.id === this.selectedJobId)) {
      this.selectedJobId = null;
      this.selectedJobTimer = 0;
    }

    if (this.selectedJobTimer > 0) {
      this.selectedJobTimer -= dt;
      if (this.selectedJobTimer <= 0) this.selectedJobId = null;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.ui.toast?.classList.remove('show');
    }

    // Periodic UI
    this._uiAcc = (this._uiAcc || 0) + dt;
    if (this._uiAcc > 0.35) {
      this._uiAcc = 0;
      this.syncUI();
      this.tryAssignJobs();
    }
  }

  checkStars() {
    if (!this.scenario) return;
    const stars = evaluateStars(this.scenario, {
      delivered: this.stats.delivered,
      money: this.money,
      allConnected: this.allPlacesConnected()
    });
    const prev = this.meta.stars[this.scenario.id] || 0;
    if (stars > prev) {
      setScenarioStars(this.meta, this.scenario.id, stars);
      addXp(this.meta, XP_REWARDS.star * (stars - prev));
      this.toast(`${'⭐'.repeat(stars)} Nye stjerner!`);
    }
  }

  syncUI() {
    if (!this.ui) return;
    if (this.ui.money) this.ui.money.textContent = `${this.money} kr`;
    if (this.ui.level) this.ui.level.textContent = `Lvl ${this.meta.level}`;
    if (this.ui.delivered) this.ui.delivered.textContent = `${this.stats.delivered}`;
    if (this.ui.fleet) this.ui.fleet.textContent = `${this.vehicles.length}`;
    if (this.ui.jobs) {
      const active = this.jobs.filter((j) => j.active).slice(0, 8);
      this.ui.jobs.innerHTML = active.length
        ? active
            .map((j) => {
              const sel = j.id === this.selectedJobId ? ' selected' : '';
              const left = Math.max(0, j.amount - j.delivered);
              return `<li class="job-item${sel}" data-job-id="${j.id}" role="button" tabindex="0" title="Vis rute på kortet">
                ${jobLabel(j)}${j.claimedBy ? ' 🚗' : ''}
                <span class="job-meta">${left}/${j.amount}</span>
              </li>`;
            })
            .join('')
        : '<li class="muted">Ingen opgaver endnu</li>';
    }
    if (this.ui.goals && this.scenario) {
      const stars = evaluateStars(this.scenario, {
        delivered: this.stats.delivered,
        money: this.money,
        allConnected: this.allPlacesConnected()
      });
      this.ui.goals.innerHTML = this.scenario.goals
        .map((g) => {
          const done = g.stars <= stars;
          return `<li class="${done ? 'done' : ''}">${'⭐'.repeat(g.stars)} ${goalLabel(g)}</li>`;
        })
        .join('');
    }
    document.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === this.tool);
    });
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.textContent = this.paused ? '▶️' : '⏸️';
  }
}

function simplify(points, minDist) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= minDist) {
      out.push(points[i]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
