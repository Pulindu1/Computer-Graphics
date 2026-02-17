// 📄 src/crowd/SpatialHashGrid.js

/**
 * Spatial hash grid for efficient neighbor queries
 * O(1) insert, O(k) query where k = agents in nearby cells
 */
export class SpatialHashGrid {
  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
    this.grid = new Map(); // key: "cx,cz" -> array of agents
  }
  
  clear() {
    this.grid.clear();
  }
  
  /**
   * Insert agent into grid based on position
   */
  insert(agent) {
    const cx = Math.floor(agent.pos.x / this.cellSize);
    const cz = Math.floor(agent.pos.z / this.cellSize);
    const key = `${cx},${cz}`;
    
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(agent);
  }
  
  /**
   * Query agents in neighboring cells (3x3 grid)
   */
  query(agent) {
    const cx = Math.floor(agent.pos.x / this.cellSize);
    const cz = Math.floor(agent.pos.z / this.cellSize);
    
    const neighbors = [];
    
    // Check 3x3 neighborhood
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const cell = this.grid.get(key);
        if (cell) {
          neighbors.push(...cell);
        }
      }
    }
    
    return neighbors;
  }
}
