// 📄 src/spatial/Quadtree.js
/**
 * Point quadtree for 2D pedestrian neighbour queries.
 *
 * Design goals (crowd simulation context):
 *  - Rebuild-per-frame: call clear(), insert all agents, then queryCircle per agent.
 *  - Allocation-free hot path: uses a flat node pool (typed arrays) + a reusable
 *    object-pool for nodes so no GC pressure per frame.
 *  - Output buffer reuse: queryInto(x,z,r,out) appends to caller-supplied array.
 *  - Instrumented: tracks nodesVisited, maxDepth, nodeCount for the debug overlay.
 *
 * Tunable parameters:
 *   capacity    MAX_POINTS_PER_NODE  (8–32) – leaf bucket size before splitting
 *   maxDepth    MAX_DEPTH            (8–12) – prevents infinite split on coincident pts
 *   bounds      {minX,minZ,maxX,maxZ}       – world extents (can be generous)
 *
 * Algorithm:
 *   Insert: walk to correct leaf, push point; if |points| > capacity && depth < maxDepth → subdivide.
 *   Query:  AABB prune at each node; collect all points in intersecting nodes; caller distance-filters.
 */

// ── Node pool ─────────────────────────────────────────────────────────────────
// We pre-allocate an array of node objects and reuse them each frame.
// Each node has:
//   minX,minZ,maxX,maxZ  – bounding box
//   depth                – depth in tree
//   points               – agent references (reused array, length reset on clear)
//   children             – [nw, ne, sw, se] indices into pool, or null
// Pool avoids "new Node()" on every insert, keeping GC quiet.

const POOL_SIZE = 4096; // enough for thousands of agents at depth 10

function makeNode() {
  return {
    minX: 0, minZ: 0, maxX: 0, maxZ: 0,
    depth: 0,
    points: [],   // agent objects
    px: [],       // agent.pos.x copies for fast iteration
    pz: [],       // agent.pos.z copies for fast iteration
    nw: null, ne: null, sw: null, se: null, // child nodes (from pool)
  };
}

export class Quadtree {
  /**
   * @param {object} bounds  {minX, minZ, maxX, maxZ} – world extents
   * @param {object} options
   * @param {number} options.capacity  points per leaf before split (default 8)
   * @param {number} options.maxDepth  maximum tree depth (default 10)
   */
  constructor(bounds, { capacity = 8, maxDepth = 10 } = {}) {
    this.rootBounds = bounds;
    this.capacity = capacity;
    this.maxDepth = maxDepth;

    // Pre-allocate node pool
    this._pool = [];
    this._poolNext = 0;
    for (let i = 0; i < POOL_SIZE; i++) this._pool.push(makeNode());

    this._root = null;

    // Diagnostic counters (reset each frame)
    this.stats = {
      nodeCount: 0,
      maxDepthReached: 0,
      lastQueryNodesVisited: 0,   // per-query; aggregated externally
    };
  }

  // ── Pool helpers ─────────────────────────────────────────────────────────────

  _acquireNode(minX, minZ, maxX, maxZ, depth) {
    if (this._poolNext >= this._pool.length) {
      // Pool exhausted – grow it (rare, happens on first deep tree)
      this._pool.push(makeNode());
    }
    const n = this._pool[this._poolNext++];
    n.minX = minX; n.minZ = minZ; n.maxX = maxX; n.maxZ = maxZ;
    n.depth = depth;
    n.points.length = 0;
    n.px.length = 0;
    n.pz.length = 0;
    n.nw = null; n.ne = null; n.sw = null; n.se = null;
    this.stats.nodeCount++;
    if (depth > this.stats.maxDepthReached) this.stats.maxDepthReached = depth;
    return n;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Reset tree – O(poolNext), reuses node objects.
   * Must be called at the start of each frame before inserts.
   */
  clear() {
    // Just reset pool pointer; nodes will be overwritten on next acquire
    this._poolNext = 0;
    this.stats.nodeCount = 0;
    this.stats.maxDepthReached = 0;
    const b = this.rootBounds;
    this._root = this._acquireNode(b.minX, b.minZ, b.maxX, b.maxZ, 0);
  }

  /**
   * Insert an agent as a point at (agent.pos.x, agent.pos.z).
   * Must call clear() before inserting agents each frame.
   */
  insert(agent) {
    const x = agent.pos.x;
    const z = agent.pos.z;
    // Ignore points outside root bounds (can happen at world edges)
    if (x < this._root.minX || x > this._root.maxX ||
        z < this._root.minZ || z > this._root.maxZ) return;
    this._insertInto(this._root, agent, x, z);
  }

  /**
   * Query all agents within radius `r` of point (x,z).
   * Appends matching agents to `out` (does NOT clear it).
   * Caller MUST distance-filter results.
   *
   * @param {number} x
   * @param {number} z
   * @param {number} r  search radius
   * @param {Array}  out  output array (appended to)
   * @returns {number} nodes visited (for instrumentation)
   */
  queryInto(x, z, r, out) {
    this.stats.lastQueryNodesVisited = 0;
    out.length = 0;
    if (!this._root) return 0;
    this._queryNode(this._root, x - r, z - r, x + r, z + r, out);
    return this.stats.lastQueryNodesVisited;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  _insertInto(node, agent, x, z) {
    // If internal node (has children), descend
    if (node.nw !== null) {
      this._insertInto(this._childFor(node, x, z), agent, x, z);
      return;
    }

    // Leaf: append point
    node.points.push(agent);
    node.px.push(x);
    node.pz.push(z);

    // Split if over capacity and not at max depth
    if (node.points.length > this.capacity && node.depth < this.maxDepth) {
      this._subdivide(node);
    }
  }

  _childFor(node, x, z) {
    const midX = (node.minX + node.maxX) * 0.5;
    const midZ = (node.minZ + node.maxZ) * 0.5;
    if (x <= midX) {
      return z <= midZ ? node.nw : node.sw;
    } else {
      return z <= midZ ? node.ne : node.se;
    }
  }

  _subdivide(node) {
    const midX = (node.minX + node.maxX) * 0.5;
    const midZ = (node.minZ + node.maxZ) * 0.5;
    const d = node.depth + 1;

    node.nw = this._acquireNode(node.minX, node.minZ, midX,      midZ,      d);
    node.ne = this._acquireNode(midX,      node.minZ, node.maxX, midZ,      d);
    node.sw = this._acquireNode(node.minX, midZ,      midX,      node.maxZ, d);
    node.se = this._acquireNode(midX,      midZ,      node.maxX, node.maxZ, d);

    // Re-insert existing points into children
    for (let i = 0; i < node.points.length; i++) {
      this._insertInto(
        this._childFor(node, node.px[i], node.pz[i]),
        node.points[i], node.px[i], node.pz[i]
      );
    }

    // This node is now internal – clear its point list
    node.points.length = 0;
    node.px.length = 0;
    node.pz.length = 0;
  }

  _queryNode(node, minX, minZ, maxX, maxZ, out) {
    this.stats.lastQueryNodesVisited++;

    // AABB vs node AABB prune
    if (node.maxX < minX || node.minX > maxX ||
        node.maxZ < minZ || node.minZ > maxZ) return;

    if (node.nw !== null) {
      // Internal: recurse into children
      this._queryNode(node.nw, minX, minZ, maxX, maxZ, out);
      this._queryNode(node.ne, minX, minZ, maxX, maxZ, out);
      this._queryNode(node.sw, minX, minZ, maxX, maxZ, out);
      this._queryNode(node.se, minX, minZ, maxX, maxZ, out);
    } else {
      // Leaf: collect all points in AABB (caller does exact circle filter)
      for (let i = 0; i < node.px.length; i++) {
        if (node.px[i] >= minX && node.px[i] <= maxX &&
            node.pz[i] >= minZ && node.pz[i] <= maxZ) {
          out.push(node.points[i]);
        }
      }
    }
  }
}
