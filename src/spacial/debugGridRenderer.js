import * as THREE from "three";



export class DebugGridRenderer {
  constructor({ worldSize = 800, cellSize = 10, y = 0.05 } = {}) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.y = y;

    this.object3d = this._buildLines();
    this.visible = true;
  }

  _buildLines() {
    const half = this.worldSize / 2;
    const step = this.cellSize;

    const positions = [];


    for (let x = -half; x <= half; x += step) {
      positions.push(x, this.y, -half);
      positions.push(x, this.y, half);
    }


    for (let z = -half; z <= half; z += step) {
      positions.push(-half, this.y, z);
      positions.push(half, this.y, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
    });

    const lines = new THREE.LineSegments(geo, mat);
    lines.name = "DebugGridLines";
    return lines;
  }

  setVisible(v) {
    this.visible = v;
    this.object3d.visible = v;
  }

  toggle() {
    this.setVisible(!this.visible);
  }
}
