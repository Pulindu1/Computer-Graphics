

import * as THREE from "three";

export class LightCubes {
  constructor({
    scene,
    centerX = 0,
    centerZ = 0,
    streetWidth = 100,
    streetLength = 600,
    streetHeight = 200,
    spacing = 40,
    color = 0x00ff88,
    emissiveIntensity = 3.0,
    size = 3,
    enabled = true,
  } = {}) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerZ = centerZ;
    this.streetWidth = streetWidth;
    this.streetLength = streetLength;
    this.streetHeight = streetHeight;
    this.spacing = spacing;
    this.color = color;
    this.emissiveIntensity = emissiveIntensity;
    this.size = size;
    this.enabled = enabled;

    this.root = new THREE.Group();
    this.root.name = "LightCubes";
    scene.add(this.root);

    this.cubes = [];
    this.collisionRadius = size * 0.8;
    this._spawn();
  }

  _spawn() {
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: this.emissiveIntensity,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });

    const haloBrightMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: this.emissiveIntensity * 0.6,
      metalness: 0,
      roughness: 1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
    const haloGeometry = new THREE.SphereGeometry(this.size * 2.5, 16, 16); 
    const numCubes = Math.floor(this.streetLength / this.spacing);

    for (let i = 0; i < numCubes; i++) {
      const z = this.centerZ - this.streetLength * 0.5 + i * this.spacing;
      const x = this.centerX;
      const y = this.streetHeight + this.size * 0.5 + 1;


      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.position.set(x, y, z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;


      mesh.rotation.set(
        Math.random() * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * 0.3
      );

      this.root.add(mesh);

      const haloBrightMesh = new THREE.Mesh(haloGeometry, haloBrightMaterial.clone());
      haloBrightMesh.position.copy(mesh.position);
      haloBrightMesh.castShadow = false;
      haloBrightMesh.receiveShadow = false;
      haloBrightMesh.renderOrder = 1;
      this.root.add(haloBrightMesh);

      this.cubes.push({
        mesh,
        haloBrightMesh,
        position: new THREE.Vector3(x, y, z),
        baseY: y,
      });
    }

    console.log(`[LightCubes] Spawned ${this.cubes.length} light cubes with glow halos`);
  }


  getObstacles() {
    return this.cubes.map(cube => ({
      position: cube.position,
      radius: this.collisionRadius,
    }));
  }


  update(t) {
    if (!this.enabled) return;

    for (const cube of this.cubes) {
      const bobAmount = 0.5 + 0.3 * Math.sin(t * 0.8 + cube.mesh.uuid.charCodeAt(0));
      cube.mesh.position.y = cube.baseY + bobAmount;
      cube.haloBrightMesh.position.y = cube.baseY + bobAmount;

      cube.mesh.rotation.y += 0.003;

      cube.haloBrightMesh.rotation.y -= 0.001;
      cube.haloBrightMesh.rotation.x += 0.0005;

      const pulse = 0.7 + 0.3 * Math.sin(t * 1.2 + cube.mesh.uuid.charCodeAt(1));
      cube.mesh.material.emissiveIntensity = this.emissiveIntensity * pulse;

      const haloPulse = 0.5 + 0.5 * Math.sin(t * 1.2 + cube.mesh.uuid.charCodeAt(1) + Math.PI);
      cube.haloBrightMesh.material.emissiveIntensity = (this.emissiveIntensity * 0.6) * haloPulse;
    }
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.root.visible = enabled;
  }
}
