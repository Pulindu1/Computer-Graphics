// 📄 src/agents/spatialHash.js
import { Stats } from "../stats.js";

export class SpatialHash {
  constructor(cellSize = 20) {
    this.cellSize = cellSize;
    this.map = new Map();          // key -> array of agent IDs
    this.lastQueryKeys = [];       // used for debug highlight
  }

  clear() {
    this.map.clear();
  }

  // World -> integer cell coords
  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }

  // Cell coords -> key
  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  // World -> key
  getCellKey(x, z) {
    return this._key(this._cellCoord(x), this._cellCoord(z));
  }

  insert(id, x, z) {
    const cx = this._cellCoord(x);
    const cz = this._cellCoord(z);
    const key = this._key(cx, cz);
    let bucket = this.map.get(key);
    if (!bucket) {
      bucket = [];
      this.map.set(key, bucket);
    }
    bucket.push(id);
  }

  // Query candidates in r radius (returns IDs; you still do exact distance test after)
  queryRadius(x, z, r) {
    const cx = this._cellCoord(x);
    const cz = this._cellCoord(z);

    const rCells = Math.ceil(r / this.cellSize);
    const out = [];
    const keys = [];

    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const key = this._key(cx + dx, cz + dz);
        keys.push(key);

        const bucket = this.map.get(key);
        if (bucket) {
          // append
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }

    this.lastQueryKeys = keys;
    Stats.queriedCells += keys.length;

    return out;
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
