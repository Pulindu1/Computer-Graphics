// 📄 src/agents/spatialHash.js
import { Stats } from "../stats.js";

export class SpatialHash {
  constructor(cellSize = 20) {
    this.cellSize = cellSize;
    this.map = new Map();          // packed int key -> array of agent IDs
    this.lastQueryKeys = [];       // used for debug highlight
    this.allQueryKeys = new Set(); // accumulate all queries in frame
    
    // Packing constants for integer keys
    this.OFF = 1 << 15; // 32768 offset for negative indices
    this.MASK = (1 << 16) - 1;
  }

  clear() {
    this.map.clear();
  }
  
  // Reset query tracking for new frame
  resetQueryTracking() {
    this.allQueryKeys.clear();
  }

  // World -> integer cell coords
  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }

  // Pack cell coords into single integer key (allocation-free)
  _packKey(cx, cz) {
    const x = (cx + this.OFF) & this.MASK;
    const z = (cz + this.OFF) & this.MASK;
    return (x << 16) | z;
  }
  
  // Unpack key back to coords (for debug rendering)
  _unpackKey(key) {
    const x = (key >>> 16) - this.OFF;
    const z = (key & this.MASK) - this.OFF;
    return { cx: x, cz: z };
  }

  // World -> key
  getCellKey(x, z) {
    return this._packKey(this._cellCoord(x), this._cellCoord(z));
  }

  insert(id, x, z) {
    const cx = this._cellCoord(x);
    const cz = this._cellCoord(z);
    const key = this._packKey(cx, cz);
    let bucket = this.map.get(key);
    if (!bucket) {
      bucket = [];
      this.map.set(key, bucket);
    }
    bucket.push(id);
  }

  // Allocation-free query: fills provided array instead of allocating new one
  queryInto(x, z, r, out) {
    const cx = this._cellCoord(x);
    const cz = this._cellCoord(z);

    const rCells = Math.ceil(r / this.cellSize);
    const keys = [];

    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const key = this._packKey(cx + dx, cz + dz);
        keys.push(key);
        this.allQueryKeys.add(key); // Track all queries in frame

        const bucket = this.map.get(key);
        if (bucket) {
          // append to provided array (no allocation)
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }

    this.lastQueryKeys = keys;
    Stats.queriedCells += keys.length;

    return out;
  }
  
  // Legacy method for backward compatibility (allocates)
  queryRadius(x, z, r) {
    const out = [];
    return this.queryInto(x, z, r, out);
  }

  // For heatmap rendering
  getOccupiedCells() {
    // returns array of { key, count }
    const cells = [];
    for (const [key, bucket] of this.map.entries()) {
      cells.push({ key, count: bucket.length });
    }
    return cells;
  }
}
