// Fireflies: Floating glowing orbs with wandering behavior
// Similar to StreetPedestrians but much simpler (just sphere meshes)

import * as THREE from "three";

class Firefly {
  constructor(x, z, height) {
    this.pos = new THREE.Vector3(x, height, z);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.acc = new THREE.Vector3(0, 0, 0);
    this.mesh = null;
    this.maxSpeed = 0.8;  // Significantly faster
    this.maxForce = 0.4;  // Stronger forces
    this.wander = Math.random() * Math.PI * 2;
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update(dt, bounds) {
    // Apply wander behavior (faster movement)
    this.wander += (Math.random() - 0.5) * 0.6;
    const wanderForce = new THREE.Vector3(
      Math.cos(this.wander) * 0.4,
      0,
      Math.sin(this.wander) * 0.4
    );
    this.applyForce(wanderForce);

    // Gentle upward/downward bobbing
    this.wobblePhase += dt * 3.5;
    const bobForce = new THREE.Vector3(
      0,
      Math.sin(this.wobblePhase) * 0.12,
      0
    );
    this.applyForce(bobForce);

    // Boundary avoidance (soft repulsion)
    const margin = 5;
    if (this.pos.x < bounds.minX + margin) {
      this.applyForce(new THREE.Vector3(0.3, 0, 0));
    }
    if (this.pos.x > bounds.maxX - margin) {
      this.applyForce(new THREE.Vector3(-0.3, 0, 0));
    }
    if (this.pos.z < bounds.minZ + margin) {
      this.applyForce(new THREE.Vector3(0, 0, 0.3));
    }
    if (this.pos.z > bounds.maxZ - margin) {
      this.applyForce(new THREE.Vector3(0, 0, -0.3));
    }

    // Keep altitude HIGH to avoid colliding with people
    if (this.pos.y < bounds.baseHeight + 8) {  // Fly significantly higher
      this.applyForce(new THREE.Vector3(0, 0.15, 0));
    }
    if (this.pos.y > bounds.baseHeight + 20) {  // Don't go too high
      this.applyForce(new THREE.Vector3(0, -0.08, 0));
    }

    // Limit acceleration
    this.acc.clampLength(0, this.maxForce);

    // Update velocity
    this.vel.addScaledVector(this.acc, dt);
    this.vel.clampLength(0, this.maxSpeed);

    // Update position
    this.pos.addScaledVector(this.vel, dt);

    // Update mesh
    if (this.mesh) {
      this.mesh.position.copy(this.pos);
    }

    // Reset acceleration
    this.acc.multiplyScalar(0);
  }
}

export class Fireflies {
  constructor({ scene, street, params = {} }) {
    this.scene = scene;
    this.street = street;

    this.params = {
      population: params.population ?? 0,
      enabled: params.enabled ?? true,
    };

    this.fireflies = [];
    this.root = new THREE.Group();
    this.root.name = "Fireflies";
    scene.add(this.root);

    // Create reusable geometry and material
    this.geo = new THREE.SphereGeometry(0.3, 8, 8);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xff8800,  // Orange
      emissive: 0xff8800,
      emissiveIntensity: 3.5,
      roughness: 0.5,
      metalness: 0.3,
    });

    this._build();
  }

  _build() {
    this._respawn();
  }

  _respawn() {
    // Clear old fireflies
    for (const ff of this.fireflies) {
      if (ff.mesh) {
        this.root.remove(ff.mesh);
        if (ff.mesh.geometry) ff.mesh.geometry.dispose();
        if (ff.mesh.material) ff.mesh.material.dispose();
      }
    }
    this.fireflies = [];

    // Spawn new fireflies
    for (let i = 0; i < this.params.population; i++) {
      const x = this.street.centerX + (Math.random() - 0.5) * this.street.width * 0.9;
      const z = this.street.centerZ + (Math.random() - 0.5) * this.street.length * 0.9;
      const y = this.street.height + 0.5 + Math.random() * 3;  // Varied height

      const ff = new Firefly(x, z, y);
      
      // Create fresh geometry and material for each firefly
      const geo = new THREE.SphereGeometry(0.3, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff8800,  // Orange
        emissive: 0xff8800,
        emissiveIntensity: 3.5,
        roughness: 0.5,
        metalness: 0.3,
      });
      
      ff.mesh = new THREE.Mesh(geo, mat);
      ff.mesh.castShadow = true;
      ff.mesh.receiveShadow = true;
      ff.geo = geo;  // Store for disposal
      ff.mat = mat;  // Store for disposal
      this.root.add(ff.mesh);

      this.fireflies.push(ff);
    }
    
    console.log("[Fireflies] Spawned", this.fireflies.length, "fireflies");
  }

  update(dt) {
    if (!this.params.enabled || this.fireflies.length === 0) return;

    const bounds = {
      minX: this.street.centerX - this.street.width * 0.5,
      maxX: this.street.centerX + this.street.width * 0.5,
      minZ: this.street.centerZ - this.street.length * 0.5,
      maxZ: this.street.centerZ + this.street.length * 0.5,
      baseHeight: this.street.height,
    };

    for (const ff of this.fireflies) {
      ff.update(dt, bounds);
    }
  }

  setPopulation(count) {
    console.log("[Fireflies] setPopulation called with:", count);
    this.params.population = Math.max(0, Math.min(100, count));
    console.log("[Fireflies] Respawning with population:", this.params.population);
    this._respawn();
    console.log("[Fireflies] Current firefly count:", this.fireflies.length);
  }

  setEnabled(enabled) {
    this.params.enabled = enabled;
    this.root.visible = enabled;
  }

  dispose() {
    this.scene.remove(this.root);
    for (const ff of this.fireflies) {
      if (ff.mesh) {
        this.root.remove(ff.mesh);
        if (ff.geo) ff.geo.dispose();
        if (ff.mat) ff.mat.dispose();
      }
    }
    if (this.geo) this.geo.dispose();
    if (this.mat) this.mat.dispose();
  }
}
