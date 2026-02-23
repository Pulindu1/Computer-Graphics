
import * as THREE from "three";


export class QueryCellOverlay {
  constructor({ cellSize = 20, maxInstances = 2000, y = 0.09 } = {}) {
    this.cellSize = cellSize;
    this.y = y;
    this.maxInstances = maxInstances;

    const geometry = new THREE.PlaneGeometry(cellSize * 0.95, cellSize * 0.95);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Yellow highlight
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevent z-fighting
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.mesh.visible = true;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.dummy = new THREE.Object3D();
  }

  /**
   * Update visualization from query cell keys
   * @param {Array<number>} keys - Array of packed integer cell keys
   * @param {SpatialHash} spatial - Spatial hash instance for unpacking keys
   */
  updateFromKeys(keys, spatial) {
    if (!keys || keys.length === 0) {
      this.mesh.count = 0;
      return;
    }

    const n = Math.min(keys.length, this.maxInstances);

    for (let i = 0; i < n; i++) {
      const { cx, cz } = spatial._unpackKey(keys[i]);

      const x = (cx + 0.5) * this.cellSize;
      const z = (cz + 0.5) * this.cellSize;

      this.dummy.position.set(x, this.y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  
  updateGeometry() {
    const oldGeometry = this.mesh.geometry;
    const newGeometry = new THREE.PlaneGeometry(this.cellSize * 0.95, this.cellSize * 0.95);
    newGeometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = newGeometry;
    oldGeometry.dispose();
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
