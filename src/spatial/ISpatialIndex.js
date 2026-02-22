// 📄 src/spatial/ISpatialIndex.js
/**
 * Conceptual interface for swappable spatial indices.
 * Both SpatialHashIndex and QuadtreeIndex implement this contract.
 *
 * Methods:
 *   clear()                               – reset all stored points
 *   insert(agent)                         – add agent at (agent.pos.x, agent.pos.z)
 *   queryInto(x, z, radius, out)          – fill `out` array with nearby agents
 *
 * Per-frame diagnostic stats (updated during insert/query):
 *   stats.buildMs       – time to clear+insert all agents (ms)
 *   stats.queryMs       – total query time this frame (ms)
 *   stats.candidatesAvg – average candidates returned per query
 *   stats.queriesThisFrame
 *
 * Extra stats (quadtree only, NaN for hash):
 *   stats.nodesVisitedAvg
 *   stats.nodeCount
 *   stats.maxDepthReached
 */
export class ISpatialIndex {
  constructor() {
    this.stats = {
      buildMs: 0,
      queryMs: 0,
      candidatesAvg: 0,
      queriesThisFrame: 0,
      nodesVisitedAvg: NaN,
      nodeCount: NaN,
      maxDepthReached: NaN,
    };
  }

  clear() { throw new Error("ISpatialIndex.clear() not implemented"); }
  insert(_agent) { throw new Error("ISpatialIndex.insert() not implemented"); }
  queryInto(_x, _z, _radius, _out) { throw new Error("ISpatialIndex.queryInto() not implemented"); }
}
