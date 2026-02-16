// 📄 src/spacial/queryCellOverlay.js
import * as THREE from "three";

/**
 * Highlights which grid cells are being queried for neighbor search
 * Shows the spatial hash query pattern visually
 */
export class QueryCellOverlay {
  constructor({ cellSize = 20, maxInstances = 2000, y = 0.09 } = {}) {
    this.cellSize = cellSize;
    this.y = y;
    this.maxInstances = maxInstances; // Store it ourselves!

    // Create instanced mesh for highlighted cells
    const geometry = new THREE.PlaneGeometry(cellSize * 0.95, cellSize * 0.95);
    geometry.rotateX(-Math.PI / 2); // Lay flat on ground

    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Yellow highlight
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevent z-fighting
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.mesh.visible = true; // Start visible for debugging
    this.mesh.count = 0; // Start with no instances
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // Prevent culling issues

    this.dummy = new THREE.Object3D();
  }

  /**
   * Update visualization from query cell keys
   * @param {Array<string>} keys - Array of "cx,cz" cell keys
   */
  updateFromKeys(keys) {
    if (!keys || keys.length === 0) {
      this.mesh.count = 0;
      return;
    }

    const n = Math.min(keys.length, this.maxInstances); // Use stored maxInstances!

    for (let i = 0; i < n; i++) {
      const [cx, cz] = keys[i].split(",").map(Number);

      // World position (center of cell)
      const x = (cx + 0.5) * this.cellSize;
      const z = (cz + 0.5) * this.cellSize;

      this.dummy.position.set(x, this.y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
