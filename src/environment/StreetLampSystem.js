import * as THREE from "three";

/**
 * StreetLampSystem: Procedurally placed lamps along walkways with intelligent lighting.
 * 
 * Features:
 * - Periodic placement along spline curves
 * - Instanced poles and orbs (2 draw calls)
 * - Light pool with LOD (only N nearest lamps create spotlights)
 * - Shadow LOD (only very close lamps cast shadows)
 * - Performance-aware: AOI pooling prevents lighting cost scaling
 */
export class StreetLampSystem {
  constructor({
    scene,
    walkwayA,
    walkwayB,
    terrainHeightAt,
    riverCenterX,
    riverHalfWidth,
    platformHeight = 5.0,
  }) {
    this.scene = scene;
    this.walkwayA = walkwayA;
    this.walkwayB = walkwayB;
    this.terrainHeightAt = terrainHeightAt;
    this.riverCenterX = riverCenterX;
    this.riverHalfWidth = riverHalfWidth;
    this.platformHeight = platformHeight;

    // Lamp configuration
    this.lampSpacing = 120.0; // 10x less frequent
    this.lampEdgeOffset = 1.5; // Distance from walkway edge to lamp base
    this.poleRadius = 0.35;
    this.poleHeight = 16.0; // Much taller
    this.orbRadius = 0.8;
    this.orbColor = 0xffd966;
    this.orbGlowIntensity = 2.0;

    // Lighting pool config
    this.maxLitLamps = 12;
    this.shadowRadius = 25.0;
    this.shadowMapSize = 512;
    this.shadowsEnabled = true;

    // Data
    this.lamps = []; // Array of { pos, normal, side (A/B) }
    this.poleMesh = null;
    this.orbMesh = null;
    this.spotLightPool = [];
    this.activeLampIndices = []; // Current pool assignment

    // Stats
    this.stats = {
      lampCount: 0,
      litLampCount: 0,
      shadowLampCount: 0,
    };

    this.init();
  }

  init() {
    this._buildLampPositions();
    this._createInstancedMeshes();
    this._initLightPool();
  }

  /**
   * Step 2: Generate lamp positions procedurally along both walkways
   */
  _buildLampPositions() {
    const lampA = this._generateLampsForCurve(this.walkwayA, "A");
    const lampB = this._generateLampsForCurve(this.walkwayB, "B");
    this.lamps = [...lampA, ...lampB];
    this.stats.lampCount = this.lamps.length;
  }

  _generateLampsForCurve(curve, side) {
    const lamps = [];
    const curveLength = curve.getLength();
    const lampCount = Math.floor(curveLength / this.lampSpacing);

    for (let i = 0; i < lampCount; i++) {
      const t = i / lampCount;
      const pos = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();

      // Compute hill-side normal (away from river)
      const normal = this._computeHillSideNormal(pos, tangent, side);

      // Place lamp at edge of walkway on hill side
      const lampBasePos = new THREE.Vector3()
        .copy(pos)
        .addScaledVector(normal, this.poleRadius + this.lampEdgeOffset);

      // Sample terrain height at lamp position
      const terrainY = this.terrainHeightAt(lampBasePos.x, lampBasePos.z);
      
      // Place lamp base on the walkway platform (or higher if terrain is higher)
      // Lamp base is at the platform level, pole extends upward from there
      lampBasePos.y = Math.max(terrainY, this.platformHeight);

      lamps.push({
        pos: lampBasePos,
        normal: normal,
        tangent: tangent,
        side: side,
      });
    }

    return lamps;
  }

  /**
   * Compute normal pointing away from river (toward hill)
   */
  _computeHillSideNormal(pos, tangent, side) {
    // Left/right normal in XZ plane
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Determine if normal points toward or away from river
    // River is at riverCenterX, hill is outside
    const riverCenter = this.riverCenterX(pos.z);
    const towardRiver = riverCenter - pos.x;

    // If normal points toward river (same sign), flip it
    if (normal.x * towardRiver > 0) {
      normal.multiplyScalar(-1);
    }

    return normal;
  }

  /**
   * Step 3: Create instanced meshes for poles and orbs
   */
  _createInstancedMeshes() {
    const poleGeo = new THREE.CylinderGeometry(
      this.poleRadius,
      this.poleRadius,
      this.poleHeight,
      12
    );
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.1,
    });

    this.poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, this.lamps.length);
    this.scene.add(this.poleMesh);

    // Poles cast shadows when lit
    this.poleMesh.castShadow = false; // Will be enabled per-instance via light LOD
    this.poleMesh.receiveShadow = true;

    // Set pole instance matrices
    const poleMatrix = new THREE.Matrix4();
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i];
      // Pole center is at base height + half pole height
      const poleCenterY = lamp.pos.y + this.poleHeight / 2;
      poleMatrix.makeTranslation(lamp.pos.x, poleCenterY, lamp.pos.z);
      this.poleMesh.setMatrixAt(i, poleMatrix);
    }
    this.poleMesh.instanceMatrix.needsUpdate = true;

    // Orb geometry + material
    const orbGeo = new THREE.SphereGeometry(this.orbRadius, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: this.orbColor,
      emissiveIntensity: this.orbGlowIntensity,
      roughness: 0.3,
      metalness: 0.4,
    });

    this.orbMesh = new THREE.InstancedMesh(orbGeo, orbMat, this.lamps.length);
    this.scene.add(this.orbMesh);
    this.orbMesh.castShadow = true;
    this.orbMesh.receiveShadow = true;

    // Set orb instance matrices
    const orbMatrix = new THREE.Matrix4();
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i];
      // Orb is at top of pole
      const orbY = lamp.pos.y + this.poleHeight + this.orbRadius;
      orbMatrix.makeTranslation(lamp.pos.x, orbY, lamp.pos.z);
      this.orbMesh.setMatrixAt(i, orbMatrix);
    }
    this.orbMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Step 4: Create a pool of reusable spotlights
   */
  _initLightPool() {
    for (let i = 0; i < this.maxLitLamps; i++) {
      // Wider angle (45°), higher intensity (120), longer range (50) to illuminate larger area
      const spot = new THREE.SpotLight(this.orbColor, 120, 50, Math.PI / 4, 0.6, 2);
      spot.visible = false;
      spot.castShadow = false;
      
      spot.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
      spot.shadow.camera.near = 0.1;
      spot.shadow.camera.far = 50;
      spot.shadow.bias = -0.0005;

      this.scene.add(spot);
      this.spotLightPool.push(spot);
    }
  }

  /**
   * Step 5: Update each frame
   * Assign nearest lamps to light pool, manage shadow LOD
   */
  update(camera) {
    if (this.lamps.length === 0) return;

    // Find nearest lamps to camera
    const distances = this.lamps.map((lamp, idx) => ({
      idx,
      dist: camera.position.distanceTo(lamp.pos),
    }));
    distances.sort((a, b) => a.dist - b.dist);

    // Lighting LOD: only lamps within this distance get real spotlights
    // Beyond this, orbs just emit glow (visible but no spotlight)
    const lightingLODDistance = 250;
    this.activeLampIndices = distances
      .filter(d => d.dist < lightingLODDistance)
      .slice(0, this.maxLitLamps)
      .map((d) => d.idx);

    // Update spotlight pool
    for (let i = 0; i < this.spotLightPool.length; i++) {
      if (i < this.activeLampIndices.length) {
        const lampIdx = this.activeLampIndices[i];
        const lamp = this.lamps[lampIdx];

        const spot = this.spotLightPool[i];
        // Spotlight positioned at orb location
        const orbY = lamp.pos.y + this.poleHeight + this.orbRadius;
        spot.position.set(lamp.pos.x, orbY, lamp.pos.z);
        
        // Point toward platform center (opposite of outward normal) with downward bias
        const downVector = new THREE.Vector3(0, -1, 0);
        const towardCenter = lamp.normal.clone().multiplyScalar(-1); // Point inward toward platform
        const targetDir = towardCenter.add(downVector).normalize();
        spot.target.position.copy(spot.position).addScaledVector(targetDir, 40);
        spot.visible = true;

        // Shadow LOD: only nearest lamps cast shadows
        const lampDist = distances.find(d => d.idx === lampIdx)?.dist || Infinity;
        const isShadowClose = lampDist < this.shadowRadius;
        spot.castShadow = isShadowClose && this.shadowsEnabled;
      } else {
        this.spotLightPool[i].visible = false;
      }
    }

    this.stats.litLampCount = this.activeLampIndices.length;
    this.stats.shadowLampCount = this.spotLightPool.filter(
      (s) => s.visible && s.castShadow
    ).length;
  }

  /**
   * Get stats for UI display
   */
  getStats() {
    return this.stats;
  }

  /**
   * Debug: Draw visible AOI spheres at active lamp positions
   */
  debugDrawAOI() {
    if (!this._debugGroup) {
      this._debugGroup = new THREE.Group();
      this.scene.add(this._debugGroup);
    }

    // Clear previous
    while (this._debugGroup.children.length > 0) {
      this._debugGroup.remove(this._debugGroup.children[0]);
    }

    // Draw active lamps
    const activeMat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      wireframe: true,
      emissive: 0x00ff00,
    });

    for (const idx of this.activeLampIndices) {
      const lamp = this.lamps[idx];
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(this.shadowRadius, 8, 8),
        activeMat
      );
      sphere.position.copy(lamp.pos);
      sphere.scale.set(0.1, 0.1, 0.1); // Small marker
      this._debugGroup.add(sphere);
    }
  }
}
