/**
 * Vehicles follow a fixed route on the graph.
 * States: park | to_pickup | loading | to_dropoff | unload
 */

import { VEHICLE_CLASSES } from './fleet.js';
import { pointOnPoly } from './graph.js';

let _vid = 1;

export class Vehicle {
  constructor({ x, y, classId = 'car', homePlace = null, owner = 'player' }) {
    this.id = `v${_vid++}`;
    this.classId = classId;
    const cls = VEHICLE_CLASSES[classId] || VEHICLE_CLASSES.car;
    this.kind = cls.kind;
    this.speed = cls.speed;
    this.capacity = cls.capacity;
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
    this.t = 0; // 0→1 along current edge (in travel direction)
    this.loadTimer = 0;
    this.color = cls.kind === 'truck' ? '#b45309' : '#3b82f6';
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
   * @param {{ edges: {edgeId:string, reverse:boolean}[] }} path
   */
  setRoute(path) {
    this.route = path?.edges ? [...path.edges] : [];
    this.routeIndex = 0;
    this.t = 0.02;
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
   * @param {number} dt
   */
  update(ctx, dt) {
    if (this.state === 'park') return;
    if (this.state === 'loading') {
      this.loadTimer -= dt;
      if (this.loadTimer <= 0) {
        this.cargo = Math.min(this.capacity, this.job?.amount - (this.job?.delivered || 0) || this.capacity);
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
        // More to deliver on same job?
        if (this.job && this.job.delivered < this.job.amount) {
          // Go back for another load if path exists
          if (this._pathPickup && this._pathDropoff) {
            this.state = 'to_pickup';
            this.setRoute(this._pathPickup);
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
      this.clearRoute();
      this.state = 'park';
      this.job = null;
      return;
    }

    const pts = step.reverse ? [...road.points].reverse() : road.points;
    const len = edge.length || 1;
    const dist = this.speed * dt;
    this.t += dist / len;

    if (this.t >= 0.99) {
      this.t = 0.99;
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

  _arriveNode(ctx) {
    if (this.state === 'to_pickup') {
      this.state = 'loading';
      this.loadTimer = 0.45;
      // Snap to from place
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
