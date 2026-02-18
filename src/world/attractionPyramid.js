// Attraction Pyramid: Focal point for crowd gathering
// Single glowing pink pyramid with efficient global PointLight (no shadows)
// Inspired by reactor core pattern from SSAO+HDR masterclass

import * as THREE from "three";

export class AttractionPyramid {
  constructor({ scene, centerX, centerZ, streetHeight, params = {} }) {
    this.scene = scene;
    this.params = {
      centerX: centerX ?? 0,
      centerZ: centerZ ?? 0,
      streetHeight: streetHeight ?? 0,
      size: params.size ?? 12,
      height: params.height ?? 25,
      color: params.color ?? 0xff1493,
      emissiveIntensity: params.emissiveIntensity ?? 6.0,
      lightIntensity: params.lightIntensity ?? 2.0,  // Reduced: was 4.0 - subtle ambient only
      lightRange: params.lightRange ?? 1000,  // Only 1000 units for light effect
      sideOffset: params.sideOffset ?? -45,  // Offset towards river side (negative = towards -X)
      enabled: params.enabled ?? true,
    };

    this.root = new THREE.Group();
    this.root.name = "AttractionPyramid";
    scene.add(this.root);

    this.mesh = null;
    this.light = null;

    this._build();
  }

  _build() {
    const p = this.params;

    // Create pyramid geometry (tetrahedron is simple, use cone for more traditional pyramid)
    // Using ConeGeometry: radius, height, segments
    const pyramidGeo = new THREE.ConeGeometry(p.size, p.height, 4);

    // Emissive pink material (inspired by reactor core in SSAO demo)
    const pyramidMat = new THREE.MeshStandardMaterial({
      color: p.color,
      emissive: p.color,
      emissiveIntensity: p.emissiveIntensity,
      roughness: 0.2,
      metalness: 0.3,
    });

    this.mesh = new THREE.Mesh(pyramidGeo, pyramidMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Position: offset towards river side (negative X direction)
    this.mesh.position.set(p.centerX + p.sideOffset, p.streetHeight + p.height * 0.5, p.centerZ);

    this.root.add(this.mesh);

    // Add a single global PointLight (no shadow casting for efficiency)
    // This light illuminates the surrounding area without expensive shadow maps
    this.light = new THREE.PointLight(p.color, p.lightIntensity, p.lightRange);
    this.light.castShadow = false;  // No shadows = huge performance gain
    this.light.position.copy(this.mesh.position);
    this.light.position.y += p.height * 0.3;  // Slightly above peak
    this.scene.add(this.light);
  }

  update(timeSec) {
    if (!this.params.enabled || !this.mesh) return;

    // Subtle rotation for visual interest
    this.mesh.rotation.y += 0.001;

    // Gentle bobbing animation
    const bobAmount = 0.5;
    this.mesh.position.y = this.params.streetHeight + this.params.height * 0.5 + 
                           Math.sin(timeSec * 0.5) * bobAmount;

    // Update light position to match mesh (if bobbing)
    if (this.light) {
      this.light.position.copy(this.mesh.position);
      this.light.position.y += this.params.height * 0.3;
    }
  }

  setEnabled(enabled) {
    this.params.enabled = enabled;
    this.mesh.visible = enabled;
    if (this.light) this.light.visible = enabled;
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.light);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
