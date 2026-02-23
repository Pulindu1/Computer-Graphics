
import { ISpatialIndex } from "./ISpatialIndex.js";
import { Quadtree } from "./Quadtree.js";

export class QuadtreeIndex extends ISpatialIndex {
  /**
   * @param {object} bounds    {minX, minZ, maxX, maxZ}
   * @param {object} options
   * @param {number} options.capacity  max points per leaf (default 8)
   * @param {number} options.maxDepth  max tree depth (default 10)
   */
  constructor(bounds, { capacity = 8, maxDepth = 10 } = {}) {
    super();
    this._qt = new Quadtree(bounds, { capacity, maxDepth });
    this._totalCandidates = 0;
    this._totalNodesVisited = 0;
  }

  // ISpatialIndex 

  clear() {
    const t0 = performance.now();
    this._qt.clear();
    this.stats.buildMs = performance.now() - t0; // just clear cost
    this.stats.queriesThisFrame = 0;
    this.stats.queryMs = 0;
    this._totalCandidates = 0;
    this._totalNodesVisited = 0;
  }

  insert(agent) {
    const t0 = performance.now();
    this._qt.insert(agent);
    this.stats.buildMs += performance.now() - t0;


    this.stats.nodeCount = this._qt.stats.nodeCount;
    this.stats.maxDepthReached = this._qt.stats.maxDepthReached;
  }

  queryInto(x, z, radius, out) {
    const t0 = performance.now();
    const nodesVisited = this._qt.queryInto(x, z, radius, out);
    this.stats.queryMs += performance.now() - t0;
    this.stats.queriesThisFrame++;
    this._totalCandidates += out.length;
    this._totalNodesVisited += nodesVisited;
    this.stats.candidatesAvg = this._totalCandidates / this.stats.queriesThisFrame;
    this.stats.nodesVisitedAvg = this._totalNodesVisited / this.stats.queriesThisFrame;
    return out;
  }

  // Convenience 
  setBounds(bounds) {
    this._qt.rootBounds = bounds;
  }
}
