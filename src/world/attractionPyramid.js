
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
      lightIntensity: params.lightIntensity ?? 2.0,
      lightRange: params.lightRange ?? 1000,
      sideOffset: params.sideOffset ?? -45,
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

    const pyramidGeo = new THREE.ConeGeometry(p.size, p.height, 4);

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


    this.mesh.position.set(p.centerX + p.sideOffset, p.streetHeight + p.height * 0.5, p.centerZ);

    this.root.add(this.mesh);


    this.light = new THREE.PointLight(p.color, p.lightIntensity, p.lightRange);
    this.light.castShadow = true;
    

    this.light.shadow.mapSize.width = 1024;
    this.light.shadow.mapSize.height = 1024;
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = p.lightRange;
    this.light.shadow.bias = -0.001;
    
    this.light.position.copy(this.mesh.position);
    this.light.position.y += p.height * 0.3;
    this.scene.add(this.light);
  }

  update(timeSec) {
    if (!this.params.enabled || !this.mesh) return;


    this.mesh.rotation.y += 0.001;

    const bobAmount = 0.5;
    this.mesh.position.y = this.params.streetHeight + this.params.height * 0.5 + 
                           Math.sin(timeSec * 0.5) * bobAmount;


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
