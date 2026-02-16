// 📄 src/spacial/heatmapRenderer.js
import * as THREE from "three";

/**
 * Visualizes spatial hash occupancy with colored grid cells
 */
export class HeatmapRenderer {
  constructor({ cellSize = 20, worldSize = 2000, y = 0.1 } = {}) {
    this.cellSize = cellSize;
    this.worldSize = worldSize;
    this.y = y;

    // Create instanced mesh for cell visualization
    const geometry = new THREE.PlaneGeometry(cellSize * 0.9, cellSize * 0.9);
    geometry.rotateX(-Math.PI / 2); // Lay flat on ground

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevent z-fighting
    });

    // Max cells we might need (conservative estimate)
    const maxCells = 500;
    this.mesh = new THREE.InstancedMesh(geometry, material, maxCells);
    this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Color array for per-instance colors
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(maxCells * 3),
      3
    );

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }

  /**
   * Update visualization from spatial hash occupancy data
   * @param {Array<{key: string, count: number}>} cells
   */
  update(cells) {
    if (!cells || cells.length === 0) {
      this.mesh.count = 0;
      return;
    }

    const maxCount = Math.max(...cells.map((c) => c.count));
    let instanceIndex = 0;

    for (const { key, count } of cells) {
      // Parse key "cx,cz"
      const [cx, cz] = key.split(",").map(Number);

      // World position (center of cell)
      const x = (cx + 0.5) * this.cellSize;
      const z = (cz + 0.5) * this.cellSize;

      // Set transform
      this.dummy.position.set(x, this.y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(instanceIndex, this.dummy.matrix);

      // Color based on occupancy
      const t = count / Math.max(maxCount, 10); // normalize
      this.getHeatColor(t, this.color);
      this.mesh.setColorAt(instanceIndex, this.color);

      instanceIndex++;
    }

    this.mesh.count = instanceIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Get heat color: blue (cold) -> yellow -> red (hot)
   * @param {number} t - normalized value 0-1
   * @param {THREE.Color} outColor
   */
  getHeatColor(t, outColor) {
    // Clamp
    t = Math.max(0, Math.min(1, t));

    if (t < 0.5) {
      // Blue -> Yellow
      const s = t * 2;
      outColor.setRGB(s, s, 1 - s);
    } else {
      // Yellow -> Red
      const s = (t - 0.5) * 2;
      outColor.setRGB(1, 1 - s, 0);
    }

    return outColor;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
