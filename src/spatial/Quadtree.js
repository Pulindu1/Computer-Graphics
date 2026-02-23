

const POOL_SIZE = 4096;

function makeNode() {
  return {
    minX: 0, minZ: 0, maxX: 0, maxZ: 0,
    depth: 0,
    points: [],
    px: [],
    pz: [],
    nw: null, ne: null, sw: null, se: null,
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

    this._pool = [];
    this._poolNext = 0;
    for (let i = 0; i < POOL_SIZE; i++) this._pool.push(makeNode());

    this._root = null;


    this.stats = {
      nodeCount: 0,
      maxDepthReached: 0,
      lastQueryNodesVisited: 0,
    };
  }

  

  _acquireNode(minX, minZ, maxX, maxZ, depth) {
    if (this._poolNext >= this._pool.length) {
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


  clear() {
    this._poolNext = 0;
    this.stats.nodeCount = 0;
    this.stats.maxDepthReached = 0;
    const b = this.rootBounds;
    this._root = this._acquireNode(b.minX, b.minZ, b.maxX, b.maxZ, 0);
  }


  insert(agent) {
    const x = agent.pos.x;
    const z = agent.pos.z;

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



  _insertInto(node, agent, x, z) {

    if (node.nw !== null) {
      this._insertInto(this._childFor(node, x, z), agent, x, z);
      return;
    }


    node.points.push(agent);
    node.px.push(x);
    node.pz.push(z);


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


    for (let i = 0; i < node.points.length; i++) {
      this._insertInto(
        this._childFor(node, node.px[i], node.pz[i]),
        node.points[i], node.px[i], node.pz[i]
      );
    }


    node.points.length = 0;
    node.px.length = 0;
    node.pz.length = 0;
  }

  _queryNode(node, minX, minZ, maxX, maxZ, out) {
    this.stats.lastQueryNodesVisited++;


    if (node.maxX < minX || node.minX > maxX ||
        node.maxZ < minZ || node.minZ > maxZ) return;

    if (node.nw !== null) {

      this._queryNode(node.nw, minX, minZ, maxX, maxZ, out);
      this._queryNode(node.ne, minX, minZ, maxX, maxZ, out);
      this._queryNode(node.sw, minX, minZ, maxX, maxZ, out);
      this._queryNode(node.se, minX, minZ, maxX, maxZ, out);
    } else {

      for (let i = 0; i < node.px.length; i++) {
        if (node.px[i] >= minX && node.px[i] <= maxX &&
            node.pz[i] >= minZ && node.pz[i] <= maxZ) {
          out.push(node.points[i]);
        }
      }
    }
  }
}
