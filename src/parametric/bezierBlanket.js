/**
 * Parametric Bézier Surface Canopy (Tensor-Product Cubic)
 * 
 * A 4×4 control lattice defines a cubic Bézier surface that animates
 * via control point motion (wave-driven). The surface is evaluated explicitly
 * using Bernstein basis functions.
 * 
 * Theory:
 *  - Domain: u,v ∈ [0,1] (parameter space)
 *  - Surface: S(u,v) = ∑∑ B_i(u) B_j(v) P_ij
 *  - Bernstein: B_0=(1-t)³, B_1=3(1-t)²t, B_2=3(1-t)t², B_3=t³
 */

import * as THREE from "three";

export class BezierBlanket {
  constructor({
    scene,
    center = new THREE.Vector3(0, 0, 0),
    tangent = new THREE.Vector3(0, 0, 1),
    normal = new THREE.Vector3(1, 0, 0),
    width = 100,
    length = 600,
    height = 15,
    segU = 40,
    segV = 120,
    materialOpts = {}
  } = {}) {
    this.scene = scene;
    this.center = center.clone();
    this.tangent = tangent.normalize();
    this.normal = normal.normalize();
    this.width = width;
    this.length = length;
    this.height = height;
    this.segU = segU;
    this.segV = segV;

    // Animation state
    this.time = 0;
    this.enabled = true;
    this.params = {
      waveAmp: 12.0,     // MASSIVE waves
      waveSpeed: 2.5,    // Very fast movement
      waveLen: 6.0,      // Dense ripples
      drapeAmp: 8.0,     // Maximum sag
      emissiveIntensity: 3.5,  // Very bright glow
      opacity: 0.85,
    };

    // Control lattice: 4×4 grid of Vector3
    this.controlPoints = [];
    this.controlPointsBase = [];  // Undeformed base positions

    // UV parameters for each vertex (never changes)
    this.uvParams = [];

    // Build geometry and mesh
    this._buildGeometry();
    this._initializeControlLattice();
    this._buildMesh(materialOpts);

    // Add to scene
    this.root = new THREE.Group();
    this.root.name = "BezierBlanket";
    this.root.add(this.mesh);
    scene.add(this.root);
  }

  // ─────────────────────── Bernstein Basis ───────────────────────
  // Cubic Bernstein polynomials
  bernstein(i, t) {
    const s = 1 - t;
    switch (i) {
      case 0: return s * s * s;
      case 1: return 3 * s * s * t;
      case 2: return 3 * s * t * t;
      case 3: return t * t * t;
      default: return 0;
    }
  }

  // ─────────────────────── Surface Evaluation ───────────────────────
  /**
   * Evaluate Bézier surface at parameter (u,v)
   * S(u,v) = ∑∑ B_i(u) B_j(v) P_ij
   */
  evaluateSurface(u, v) {
    const pos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const bi = this.bernstein(i, u);
        const bj = this.bernstein(j, v);
        const weight = bi * bj;
        pos.addScaledVector(this.controlPoints[i * 4 + j], weight);
      }
    }

    return pos;
  }

  // ─────────────────────── Mesh Construction ───────────────────────
  _buildGeometry() {
    this.geometry = new THREE.BufferGeometry();

    // Vertex positions (will be updated each frame)
    const positions = new Float32Array((this.segU + 1) * (this.segV + 1) * 3);

    // UVs for material (not animation-driven)
    const uvs = new Float32Array((this.segU + 1) * (this.segV + 1) * 2);

    // Store (u,v) parameters for each vertex
    this.uvParams = [];

    let posIdx = 0;
    let uvIdx = 0;

    for (let iv = 0; iv <= this.segV; iv++) {
      for (let iu = 0; iu <= this.segU; iu++) {
        const u = this.segU > 0 ? iu / this.segU : 0;
        const v = this.segV > 0 ? iv / this.segV : 0;

        // Store parameter for later re-evaluation
        this.uvParams.push({ u, v });

        // Initial position (will update in animate)
        positions[posIdx++] = 0;
        positions[posIdx++] = 0;
        positions[posIdx++] = 0;

        // Texture UVs
        uvs[uvIdx++] = u;
        uvs[uvIdx++] = v;
      }
    }

    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    // Indices (triangle strip)
    const indices = [];
    for (let iv = 0; iv < this.segV; iv++) {
      for (let iu = 0; iu < this.segU; iu++) {
        const a = iv * (this.segU + 1) + iu;
        const b = a + 1;
        const c = a + (this.segU + 1);
        const d = c + 1;

        // Two triangles per quad
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    this.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    this.geometry.computeVertexNormals();
  }

  _buildMesh(materialOpts) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x11aaff,
      emissive: 0x0066ff,
      emissiveIntensity: this.params.emissiveIntensity,
      metalness: 0.1,
      roughness: 0.4,
      transparent: true,
      opacity: this.params.opacity,
      side: THREE.DoubleSide,
      ...materialOpts,
    });

    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  // ─────────────────────── Control Lattice Setup ───────────────────────
  _initializeControlLattice() {
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const u = i / 3;  // 0, 0.333, 0.667, 1
        const v = j / 3;  // 0, 0.333, 0.667, 1

        // Base position: offset from center in local XZ frame, raise by height
        const pos = this.center.clone()
          .addScaledVector(this.normal, (u - 0.5) * this.width)
          .addScaledVector(this.tangent, (v - 0.5) * this.length)
          .addScaledVector(up, this.height);

        // Add drape (fabric sag at edges)
        const drape = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * this.params.drapeAmp;
        pos.addScaledVector(up, drape);

        this.controlPoints.push(pos.clone());
        this.controlPointsBase.push(pos.clone());
      }
    }
  }

  // ─────────────────────── Animation ───────────────────────
  /**
   * Update control points to animate the surface
   * Wave travels along length (v direction)
   */
  _updateControlPoints(dt) {
    this.time += dt;
    const t = this.time;
    const { waveAmp, waveSpeed, waveLen, drapeAmp } = this.params;

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const u = i / 3;
        const v = j / 3;

        // Base position
        const base = this.controlPointsBase[i * 4 + j];
        const pos = base.clone();

        // Traveling wave along v (length) direction
        const freq = (2 * Math.PI) / waveLen;
        const phase = v * freq + t * waveSpeed;

        // Primary wave
        const waveY = waveAmp * Math.sin(phase);

        // Cross variation (width direction)
        const crossWave = 0.5 * waveAmp * Math.sin(Math.PI * u) * Math.cos(phase);

        // Secondary ripple (different frequency)
        const ripplePhase = phase * 0.7 + Math.PI * u;
        const rippleY = 0.4 * waveAmp * Math.sin(ripplePhase);

        // Combine waves
        const totalWaveY = waveY + crossWave + rippleY;
        pos.addScaledVector(up, totalWaveY);

        this.controlPoints[i * 4 + j] = pos;
      }
    }
  }

  /**
   * Recompute mesh vertex positions from parametric evaluation
   */
  _updateMeshVertices() {
    const positions = this.geometry.attributes.position.array;

    for (let i = 0; i < this.uvParams.length; i++) {
      const { u, v } = this.uvParams[i];
      const surfacePos = this.evaluateSurface(u, v);

      positions[i * 3 + 0] = surfacePos.x;
      positions[i * 3 + 1] = surfacePos.y;
      positions[i * 3 + 2] = surfacePos.z;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  /**
   * Main update loop - Phase 5 & 6: Surface animation + Light Show
   */
  update(dt = 0.016) {
    if (!this.enabled) return;

    this._updateControlPoints(dt);
    this._updateMeshVertices();

    // Phase 6: Light show - emissive modulation
    // Pulse intensity with multiple frequencies for dynamic effect
    const pulse1 = Math.sin(this.time * 1.5) * 0.4;
    const pulse2 = Math.sin(this.time * 0.7) * 0.3;
    const pulseIntensity = this.params.emissiveIntensity * (0.5 + pulse1 + pulse2);
    this.mesh.material.emissiveIntensity = pulseIntensity;

    // Animate emissive color (subtle shift through blue spectrum)
    const hue = 0.5 + 0.2 * Math.sin(this.time * 0.6);  // Shift between cyan and deep blue
    const sat = 1.0;
    const lightness = 0.4 + 0.1 * Math.sin(this.time * 0.8);
    const emissiveColor = new THREE.Color().setHSL(hue, sat, lightness);
    this.mesh.material.emissive.copy(emissiveColor);
  }

  // ─────────────────────── Public API ───────────────────────
  setVisible(visible) {
    this.mesh.visible = visible;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setParams(newParams) {
    Object.assign(this.params, newParams);
    
    // Update material if opacity changed
    if (newParams.opacity !== undefined) {
      this.mesh.material.opacity = newParams.opacity;
    }
    if (newParams.emissiveIntensity !== undefined) {
      this.mesh.material.emissiveIntensity = newParams.emissiveIntensity;
    }

    // Re-initialize control lattice if drape changed
    if (newParams.drapeAmp !== undefined) {
      this.controlPoints = [];
      this.controlPointsBase = [];
      this._initializeControlLattice();
    }
  }

  /**
   * Draw control points for visualization (debug)
   */
  drawControlLattice() {
    if (this._debugGroup) {
      this.root.remove(this._debugGroup);
    }

    this._debugGroup = new THREE.Group();

    // Draw control points as spheres
    const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const pos = this.controlPointsBase[i * 4 + j];
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(pos);
        sphere.scale.setScalar(2);
        this._debugGroup.add(sphere);
      }
    }

    // Draw control net edges
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });

    // Edges along u direction
    for (let j = 0; j < 4; j++) {
      const geo = new THREE.BufferGeometry();
      const positions = [];
      for (let i = 0; i < 4; i++) {
        const pos = this.controlPointsBase[i * 4 + j];
        positions.push(pos.x, pos.y, pos.z);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      const line = new THREE.Line(geo, lineMat);
      this._debugGroup.add(line);
    }

    // Edges along v direction
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry();
      const positions = [];
      for (let j = 0; j < 4; j++) {
        const pos = this.controlPointsBase[i * 4 + j];
        positions.push(pos.x, pos.y, pos.z);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      const line = new THREE.Line(geo, lineMat);
      this._debugGroup.add(line);
    }

    this.root.add(this._debugGroup);
  }

  hideControlLattice() {
    if (this._debugGroup) {
      this.root.remove(this._debugGroup);
      this._debugGroup = null;
    }
  }
}
