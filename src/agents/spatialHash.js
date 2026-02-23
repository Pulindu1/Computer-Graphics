import { Stats } from "../stats.js";

export class SpatialHash {
  constructor(cellSize = 20) {
    this.cellSize = cellSize;
    this.map = new Map();     
    this.lastQueryKeys = [];
    this.allQueryKeys = new Set(); 
    
    // Packing constants for integer keys
    this.OFF = 1 << 15;
    this.MASK = (1 << 16) - 1;
  }

  clear() {
    this.map.clear();
  }
  

  resetQueryTracking() {
    this.allQueryKeys.clear();
  }


  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }


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

  queryInto(x, z, r, out) {
    const cx = this._cellCoord(x);
    const cz = this._cellCoord(z);

    const rCells = Math.ceil(r / this.cellSize);
    const keys = [];

    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const key = this._packKey(cx + dx, cz + dz);
        keys.push(key);
        this.allQueryKeys.add(key); 

        const bucket = this.map.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }

    this.lastQueryKeys = keys;
    Stats.queriedCells += keys.length;

    return out;
  }
  

  queryRadius(x, z, r) {
    const out = [];
    return this.queryInto(x, z, r, out);
  }


  getOccupiedCells() {

    const cells = [];
    for (const [key, bucket] of this.map.entries()) {
      cells.push({ key, count: bucket.length });
    }
    return cells;
  }
}
