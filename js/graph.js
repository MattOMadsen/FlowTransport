/**
 * Deterministic road graph + A* pathfinding.
 * Vehicles never "guess" segments frame-by-frame.
 */

let _nid = 1;
let _eid = 1;

export function resetGraphIds() {
  _nid = 1;
  _eid = 1;
}

export class RoadGraph {
  constructor() {
    /** @type {Map<string, {id:string,x:number,y:number,placeId:string|null}>} */
    this.nodes = new Map();
    /** @type {Map<string, {id:string,a:string,b:string,roadId:string,length:number,oneWay:number}>} */
    this.edges = new Map();
    /** @type {Map<string, string[]>} nodeId → edgeIds */
    this.adj = new Map();
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.adj.clear();
  }

  addNode(x, y, placeId = null) {
    const id = `n${_nid++}`;
    const node = { id, x, y, placeId };
    this.nodes.set(id, node);
    this.adj.set(id, []);
    return node;
  }

  /** Find node near point, or null */
  findNodeNear(x, y, radius = 28) {
    let best = null;
    let bestD = radius;
    for (const n of this.nodes.values()) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  getOrCreateNode(x, y, placeId = null, radius = 28) {
    const existing = this.findNodeNear(x, y, radius);
    if (existing) {
      if (placeId && !existing.placeId) existing.placeId = placeId;
      // Snap slightly toward place hub if place
      if (placeId) {
        existing.x = x;
        existing.y = y;
      }
      return existing;
    }
    return this.addNode(x, y, placeId);
  }

  nodeForPlace(placeId) {
    for (const n of this.nodes.values()) {
      if (n.placeId === placeId) return n;
    }
    return null;
  }

  addEdge(aId, bId, roadId, length, oneWay = 0) {
    if (aId === bId) return null;
    const id = `e${_eid++}`;
    const edge = { id, a: aId, b: bId, roadId, length: Math.max(1, length), oneWay };
    this.edges.set(id, edge);
    this.adj.get(aId)?.push(id);
    this.adj.get(bId)?.push(id);
    return edge;
  }

  removeRoad(roadId) {
    const toRemove = [];
    for (const e of this.edges.values()) {
      if (e.roadId === roadId) toRemove.push(e.id);
    }
    for (const eid of toRemove) {
      const e = this.edges.get(eid);
      if (!e) continue;
      this.edges.delete(eid);
      for (const nid of [e.a, e.b]) {
        const list = this.adj.get(nid);
        if (list) this.adj.set(nid, list.filter((id) => id !== eid));
      }
    }
    // Drop orphan nodes without place
    for (const n of [...this.nodes.values()]) {
      if (n.placeId) continue;
      const list = this.adj.get(n.id) || [];
      if (list.length === 0) {
        this.nodes.delete(n.id);
        this.adj.delete(n.id);
      }
    }
  }

  neighbors(nodeId) {
    const out = [];
    const list = this.adj.get(nodeId) || [];
    for (const eid of list) {
      const e = this.edges.get(eid);
      if (!e) continue;
      if (e.a === nodeId && e.oneWay !== -1) {
        out.push({ edge: e, next: e.b, reverse: false });
      } else if (e.b === nodeId && e.oneWay !== 1) {
        out.push({ edge: e, next: e.a, reverse: true });
      } else if (!e.oneWay) {
        if (e.a === nodeId) out.push({ edge: e, next: e.b, reverse: false });
        else out.push({ edge: e, next: e.a, reverse: true });
      }
    }
    return out;
  }

  /**
   * A* from node A to node B.
   * @returns {{ edges: {edgeId:string, reverse:boolean}[], length:number } | null}
   */
  findPath(fromId, toId) {
    if (!fromId || !toId) return null;
    if (fromId === toId) return { edges: [], length: 0 };
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;

    const goal = this.nodes.get(toId);
    const h = (id) => {
      const n = this.nodes.get(id);
      return Math.hypot(n.x - goal.x, n.y - goal.y);
    };

    const open = new Set([fromId]);
    const came = new Map(); // node → { prev, edgeId, reverse }
    const gScore = new Map([[fromId, 0]]);
    const fScore = new Map([[fromId, h(fromId)]]);

    while (open.size) {
      let current = null;
      let bestF = Infinity;
      for (const id of open) {
        const f = fScore.get(id) ?? Infinity;
        if (f < bestF) {
          bestF = f;
          current = id;
        }
      }
      if (current === toId) {
        return this._reconstruct(came, current);
      }
      open.delete(current);
      const gCur = gScore.get(current) ?? Infinity;

      for (const { edge, next, reverse } of this.neighbors(current)) {
        const tent = gCur + edge.length;
        if (tent < (gScore.get(next) ?? Infinity)) {
          came.set(next, { prev: current, edgeId: edge.id, reverse });
          gScore.set(next, tent);
          fScore.set(next, tent + h(next));
          open.add(next);
        }
      }
    }
    return null;
  }

  _reconstruct(came, current) {
    const steps = [];
    let len = 0;
    while (came.has(current)) {
      const { prev, edgeId, reverse } = came.get(current);
      const e = this.edges.get(edgeId);
      if (e) len += e.length;
      steps.push({ edgeId, reverse });
      current = prev;
    }
    steps.reverse();
    return { edges: steps, length: len };
  }
}

/** Polyline length */
export function polyLength(points) {
  let L = 0;
  for (let i = 1; i < points.length; i++) {
    L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return L;
}

/** Point along polyline at t∈[0,1] */
export function pointOnPoly(points, t) {
  if (!points?.length) return { x: 0, y: 0, dx: 1, dy: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y, dx: 1, dy: 0 };
  const total = polyLength(points);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= seg || i === points.length - 1) {
      const u = seg > 0 ? target / seg : 0;
      const x = a.x + (b.x - a.x) * u;
      const y = a.y + (b.y - a.y) * u;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return { x, y, dx, dy };
    }
    target -= seg;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return { x: last.x, y: last.y, dx: last.x - prev.x, dy: last.y - prev.y };
}

/** Closest point on polyline → {x,y,t,dist} */
export function closestOnPoly(points, x, y) {
  let best = { x: points[0].x, y: points[0].y, t: 0, dist: Infinity };
  const total = polyLength(points) || 1;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let u = ((x - a.x) * abx + (y - a.y) * aby) / len2;
    u = Math.max(0, Math.min(1, u));
    const px = a.x + abx * u;
    const py = a.y + aby * u;
    const d = Math.hypot(x - px, y - py);
    const segLen = Math.sqrt(len2);
    const t = (acc + u * segLen) / total;
    if (d < best.dist) best = { x: px, y: py, t, dist: d };
    acc += segLen;
  }
  return best;
}

/**
 * Split polyline at parameter t ∈ (0,1).
 * @returns {{ before: {x,y}[], after: {x,y}[], mid: {x,y} } | null}
 */
export function splitPolyAtT(points, t) {
  if (!points || points.length < 2) return null;
  t = Math.max(0.02, Math.min(0.98, t));
  const mid = pointOnPoly(points, t);
  const total = polyLength(points) || 1;
  const target = t * total;
  let acc = 0;
  let splitIdx = 1;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target || i === points.length - 1) {
      splitIdx = i;
      break;
    }
    acc += seg;
  }
  const before = [...points.slice(0, splitIdx), { x: mid.x, y: mid.y }];
  const after = [{ x: mid.x, y: mid.y }, ...points.slice(splitIdx)];
  // Drop degenerate
  if (polyLength(before) < 12 || polyLength(after) < 12) return null;
  return { before, after, mid: { x: mid.x, y: mid.y } };
}

/** Nearest graph node to world point (any radius) */
export function nearestNode(graph, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const n of graph.nodes.values()) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best ? { node: best, dist: bestD } : null;
}
