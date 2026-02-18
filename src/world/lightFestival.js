// Light Festival: instanced ribbon of animating glowing spheres
// Hundreds/thousands of lights with minimal draw calls via InstancedMesh
// Each sphere animates up/down with sine wave (emissive only, no cast shadows)

import * as THREE from "three";

export class LightFestival {
  constructor({ scene, street, params = {} }) {
    this.scene = scene;
    this.street = street; // { center, forward, width, length, yStreet }
    this.params = {
      nRows: params.nRows ?? 3,
      nPerRow: params.nPerRow ?? 16,  // ~5x fewer lights for efficiency
      radius: params.radius ?? 1.8,  // 10x bigger
      yOffset: params.yOffset ?? 26.0,
      amplitude: params.amplitude ?? 35.0,
      speed: params.speed ?? 1.2,
      emissiveIntensity: params.emissiveIntensity ?? 5.0,  // Bright emissive glow only
      palette: params.palette ?? [0x0088ff, 0xff1493],
      enabled: params.enabled ?? true,
    };

    // Reusable transform components (no per-frame allocations)
    this._tmpM = new THREE.Matrix4();
    this._tmpP = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._tmpS = new THREE.Vector3(1, 1, 1);

    this.base = [];
    this.phase = new Float32Array(params.nRows * params.nPerRow || 240);
    this.amp = new Float32Array(params.nRows * params.nPerRow || 240);
    this.spd = new Float32Array(params.nRows * params.nPerRow || 240);

    this._build();
  }

  _build() {
    const p = this.params;
    // Ultra-low-poly sphere: 4 segments (works well for big emissive orbs)
    const geo = new THREE.SphereGeometry(p.radius, 4, 4);

    // Emissive material for glow effect
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: 0x0088ff,
      emissiveIntensity: p.emissiveIntensity,
      roughness: 0.3,  // Slightly less rough for shinier orbs
      metalness: 0.1,  // Slight metalness for more reflectivity
    });

    const count = p.nRows * p.nPerRow;
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance colors
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

    // Street coordinate frame
    const up = new THREE.Vector3(0, 1, 0);
    const forward = this.street.forward.clone().normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();

    const rowSpan = this.street.width * 0.9;
    const rowStep = (p.nRows === 1) ? 0 : rowSpan / (p.nRows - 1);
    const alongStep = this.street.length / (p.nPerRow - 1);

    let idx = 0;
    for (let r = 0; r < p.nRows; r++) {
      const rowOffset = -rowSpan * 0.5 + r * rowStep;

      for (let i = 0; i < p.nPerRow; i++) {
        const along = -this.street.length * 0.5 + i * alongStep;

        // World position (XZ fixed, Y animates)
        const pos = this.street.center.clone()
          .addScaledVector(right, rowOffset)
          .addScaledVector(forward, along);

        const yBase = this.street.yStreet + p.yOffset;
        pos.y = yBase;

        this.base[idx] = pos;

        // Animation parameters
        this.phase[idx] = (i * 0.35) + (r * 1.2);  // Wave coherence
        this.amp[idx] = p.amplitude * (0.85 + 0.3 * Math.random());
        this.spd[idx] = p.speed * (0.9 + 0.2 * Math.random());

        // Per-instance color (palette cycling)
        const colorIdx = (idx + r) % p.palette.length;
        const c = new THREE.Color(p.palette[colorIdx]);
        this.mesh.setColorAt(idx, c);

        // Initial matrix
        this._tmpP.copy(pos);
        this._tmpM.compose(this._tmpP, this._tmpQ, this._tmpS);
        this.mesh.setMatrixAt(idx, this._tmpM);

        idx++;
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;

    // Glowy lights don't need shadows on mesh itself
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    this.scene.add(this.mesh);
  }

  update(timeSec) {
    if (!this.params.enabled) return;

    const count = this.params.nRows * this.params.nPerRow;
    const p = this.params;

    // Update all instance positions
    for (let i = 0; i < count; i++) {
      const base = this.base[i];

      // Animate Y with sine wave
      this._tmpP.copy(base);
      this._tmpP.y = base.y + Math.sin(timeSec * this.spd[i] + this.phase[i]) * this.amp[i];

      this._tmpM.compose(this._tmpP, this._tmpQ, this._tmpS);
      this.mesh.setMatrixAt(i, this._tmpM);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setEnabled(enabled) {
    this.params.enabled = enabled;
    this.mesh.visible = enabled;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
