/**
 * Vehicles follow a fixed route on the graph.
 * States: park | to_pickup | loading | to_dropoff | unload
 */

import { VEHICLE_CLASSES, cargoCapacity, speedForClass } from './fleet.js';
import { pointOnPoly } from './graph.js';

let _vid = 1;

export class Vehicle {
  constructor({
    x,
    y,
    classId = 'car',
    homePlace = null,
    owner = 'player',
    upgradeRank = 0
  }) {
    this.id = `v${_vid++}`;
    this.classId = classId;
    this.upgradeRank = Math.max(0, upgradeRank | 0);
    const cls = VEHICLE_CLASSES[classId] || VEHICLE_CLASSES.car;
    this.kind = cls.kind;
    this.sprite = cls.sprite;
    this.owner = owner;
    this.homePlace = homePlace;
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.cargo = 0;
    this.state = 'park';
    this.job = null;
    /** @type {{ edgeId: string, reverse: boolean }[]} */
    this.route = [];
    this.routeIndex = 0;
    this.t = 0;
    this.loadTimer = 0;
    this.color = cls.kind === 'truck' ? '#b45309' : '#3b82f6';
    this.applyStats();
  }

  /** Recompute speed/capacity from class + upgrade rank. */
  applyStats() {
    this.capacity = cargoCapacity(this.classId, this.upgradeRank);
    this.speed = speedForClass(this.classId, this.upgradeRank);
  }

  get idle() {
    return this.state === 'park' && !this.job;
  }

  clearRoute() {
    this.route = [];
    this.routeIndex = 0;
    this.t = 0;
  }

  /**
   * @param {{ edges: {edgeId:string, reverse:boolean}[] } | null} path
   */
  setRoute(path) {
    this.route = path?.edges ? [...path.edges] : [];
    this.routeIndex = 0;
    this.t = this.route.length ? 0.02 : 0;
  }

  assignJob(job, pathToPickup, pathToDropoff) {
    this.job = job;
    this.cargo = 0;
    this._pathPickup = pathToPickup;
    this._pathDropoff = pathToDropoff;
    this.state = 'to_pickup';
    this.setRoute(pathToPickup);
  }

  /**
   * @param {object} ctx
   * @param {import('./graph.js').RoadGraph} ctx.graph
   * @param {Map<string, object>} ctx.roadsById
   * @param {(fromId:string,toId:string)=>object|null} [ctx.findPath]
   * @param {(placeId:string)=>string|null} [ctx.nodeForPlace]
   * @param {number} dt
   */
  update(ctx, dt) {
    if (this.state === 'park') return;

    if (this.state === 'loading') {
      this.loadTimer -= dt;
      if (this.loadTimer <= 0) {
        const remaining = Math.max(0, (this.job?.amount || 0) - (this.job?.delivered || 0));
        this.cargo = Math.min(this.capacity, remaining || 0);
        if (this.cargo <= 0) {
          this._finishJob(ctx);
          return;
        }
        this.state = 'to_dropoff';
        this.setRoute(this._pathDropoff);
      }
      return;
    }

    if (this.state === 'unload') {
      this.loadTimer -= dt;
      if (this.loadTimer <= 0) {
        const delivered = this.cargo;
        this.cargo = 0;
        if (this.job) {
          this.job.delivered += delivered;
          ctx.onDeliver?.(this, delivered);
        }
        if (this.job && this.job.delivered < this.job.amount) {
          // Multi-trip: path from dropoff (to) back to pickup (from)
          const fromId = ctx.nodeForPlace?.(this.job.from.id);
          const toId = ctx.nodeForPlace?.(this.job.to.id);
          const back = fromId && toId ? ctx.findPath?.(toId, fromId) : null;
          const forth = fromId && toId ? ctx.findPath?.(fromId, toId) : null;
          if (back && forth) {
            this._pathPickup = back;
            this._pathDropoff = forth;
            this.state = 'to_pickup';
            this.setRoute(back);
          } else {
            this._finishJob(ctx);
          }
        } else {
          this._finishJob(ctx);
        }
      }
      return;
    }

    // Moving along route
    if (!this.route.length) {
      this._arriveNode(ctx);
      return;
    }

    const step = this.route[this.routeIndex];
    if (!step) {
      this._arriveNode(ctx);
      return;
    }
    const edge = ctx.graph.edges.get(step.edgeId);
    const road = edge ? ctx.roadsById.get(edge.roadId) : null;
    if (!edge || !road) {
      this._abortJob(ctx);
      return;
    }

    const pts = step.reverse ? [...road.points].reverse() : road.points;
    const len = edge.length || 1;
    this.t += (this.speed * dt) / len;

    if (this.t >= 0.99) {
      const pos = pointOnPoly(pts, 1);
      this.x = pos.x;
      this.y = pos.y;
      if (pos.dx || pos.dy) this.angle = Math.atan2(pos.dy, pos.dx);

      this.routeIndex += 1;
      if (this.routeIndex >= this.route.length) {
        this.clearRoute();
        this._arriveNode(ctx);
      } else {
        this.t = 0.02;
      }
      return;
    }

    const pos = pointOnPoly(pts, this.t);
    this.x = pos.x;
    this.y = pos.y;
    if (pos.dx || pos.dy) this.angle = Math.atan2(pos.dy, pos.dx);
  }

  _abortJob(ctx) {
    if (this.job) {
      this.job.claimedBy = null;
    }
    this.job = null;
    this.cargo = 0;
    this.state = 'park';
    this.clearRoute();
    ctx.onNeedAssign?.();
  }

  _arriveNode(ctx) {
    if (this.state === 'to_pickup') {
      this.state = 'loading';
      this.loadTimer = 0.45;
      if (this.job?.from) {
        this.x = this.job.from.x;
        this.y = this.job.from.y;
      }
      return;
    }
    if (this.state === 'to_dropoff') {
      this.state = 'unload';
      this.loadTimer = 0.4;
      if (this.job?.to) {
        this.x = this.job.to.x;
        this.y = this.job.to.y;
      }
      return;
    }
    this.state = 'park';
  }

  _finishJob(ctx) {
    const job = this.job;
    if (job) {
      job.active = false;
      job.claimedBy = null;
    }
    this.job = null;
    this.cargo = 0;
    this.state = 'park';
    this.clearRoute();
    if (this.homePlace) {
      this.x = this.homePlace.x;
      this.y = this.homePlace.y;
    }
    ctx.onJobDone?.(this, job);
  }
}
