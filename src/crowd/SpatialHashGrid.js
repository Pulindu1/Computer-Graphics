import { cellCoord, packKey, unpackKey } from "../spatial/hashKey.js";


export class SpatialHashGrid {
  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
    this.map = new Map();
  }
  

  clear() {
    for (const bucket of this.map.values()) {
      bucket.length = 0;
    }
  }
  

  insert(agent) {
    const cx = cellCoord(agent.pos.x, this.cellSize);
    const cz = cellCoord(agent.pos.z, this.cellSize);
    const key = packKey(cx, cz);
    
    if (!this.map.has(key)) {
      this.map.set(key, []);
    }
    this.map.get(key).push(agent);
  }
  
  /**
   * Query agents in neighboring cells (3x3 grid) into a preallocated array.
   * No allocation; caller provides output array.
   * 
   * @param {number} x - World x coordinate
   * @param {number} z - World z coordinate
   * @param {Array} out - Output array (will be filled, length reset to 0)
   * @returns {Array} The output array (same reference)
   */
  queryInto(x, z, out) {
    out.length = 0;
    
    const cx = cellCoord(x, this.cellSize);
    const cz = cellCoord(z, this.cellSize);
    

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = packKey(cx + dx, cz + dz);
        const bucket = this.map.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            out.push(bucket[i]);
          }
        }
      }
    }
    
    return out;
  }
  

  query(agent) {
    const tmp = [];
    return this.queryInto(agent.pos.x, agent.pos.z, tmp);
  }
}
