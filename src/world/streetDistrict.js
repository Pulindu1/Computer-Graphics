// Street District: procedural hilltop street with procedural houses
// Stages 1-4: street placement, terrain flattening, street mesh, house generation
// 
// Clean separation: generate() is one-time, update() is per-frame (LOD + shadows)

import * as THREE from "three";
import { applyStreetFlattenToTerrain, computePlots } from "./streetMask.js";
import { createHouseLOD, HOUSE_CONFIG_DEFAULT } from "./houseFactory.js";
import { PALETTE } from "./palette.js";
import { LightFestival } from "./lightFestival.js";
import { AttractionPyramid } from "./attractionPyramid.js";
import { StreetPedestrians } from "./streetPedestrians.js";
import { Fireflies } from "./fireflies.js";
import { LightCubes } from "./lightCubes.js";

export class StreetDistrict {
  constructor({ scene, terrain, params = {} }) {
    this.scene = scene;
    this.terrain = terrain;

    // Config: can be tweaked via UI
    this.params = {
      // Stage 1: street placement
      centerX: 0,      // Hilltop center X (along river valley)
      centerZ: 200,    // Hilltop center Z (along walkway)
      heading: new THREE.Vector3(0, 0, 1), // Direction along street

      // Stage 2: terrain flattening
      streetWidth: 8,        // Half-width for each side (total ~16)
      streetLength: 120,     // Half-length (total ~240)
      streetHeight: 200.0,    // Flattened terrain height at street level
      shoulderWidth: 40,     // Blend distance at edges

      // Stage 3: street mesh
      streetMeshHeight: 22.03, // Slightly above terrain to avoid z-fight

      // Stage 4: house generation
      house: { ...HOUSE_CONFIG_DEFAULT },

      // Rendering
      enabled: true,
      
      // District variants
      mirrorHouses: false,  // Flip houses to opposite side
      flipHouseSide: false, // Place houses on opposite side of the road
      skipPyramid: false,   // Skip pyramid creation for this district
      skipLightCubes: false, // Skip light cubes for this district

      ...params,
    };

    this.root = new THREE.Group();
    this.root.name = "StreetDistrict";
    scene.add(this.root);

    this.streetMesh = null;
    this.sidewalkMeshes = [];
    this.houseLODs = [];
    this.housesByPlot = new Map();
    this.lightFestival = null;
    this.attractionPyramid = null;
    this.streetPedestrians = null;
    this.lightCubes = null;

    this.isGenerated = false;
  }

  // One-time generation: terrain flatten, meshes, houses
  generate() {
    if (this.isGenerated) return;
    this.isGenerated = true;

    const p = this.params;

    console.log("[StreetDistrict] Starting generate()...");

    // Stage 1: ensure street position is at plateau height
    const plateauHeight = this.terrain.heightAt(p.centerX, p.centerZ);
    p.streetHeight = plateauHeight;
    p.streetMeshHeight = plateauHeight + 2;  // Raise platform significantly above terrain

    console.log("[StreetDistrict] Plateau height:", plateauHeight, "Street mesh height:", p.streetMeshHeight);

    // Stage 2: flatten terrain under street footprint
    this._flattenTerrainForStreet();

    // Stage 3: create street mesh
    this._createStreetMesh();

    // Stage 3b: create sidewalks
    this._createSidewalks();

    // Stage 4: procedurally generate houses
    this._generateHouses();

    // Stage 5: create light festival (animated instanced lights)
    this._createLightFestival();

    // Stage 6: create attraction pyramid (optional - skip for street 2)
    if (!p.skipPyramid) {
      this._createAttractionPyramid();
    }

    // Stage 7: create street pedestrians (group-based crowd)
    this._createStreetPedestrians();

    // Stage 8: create fireflies (floating glowing orbs)
    this._createFireflies();

    // Stage 9: create light cubes (if enabled)
    if (!p.skipLightCubes) {
      this._createLightCubes();
    }

    console.log(
      `[StreetDistrict] Generated street @ (${p.centerX}, ${p.streetHeight}, ${p.centerZ}) ` +
      `with ${this.houseLODs.length} houses`
    );
  }

  // Stage 2: Flatten terrain
  _flattenTerrainForStreet() {
    const p = this.params;

    // Apply street mask to terrain geometry
    const streetConfig = {
      centerX: p.centerX,
      centerZ: p.centerZ,
      halfWidth: p.streetWidth,
      halfLength: p.streetLength,
      shoulderWidth: p.shoulderWidth,
      streetHeight: p.streetHeight,
    };

    // Pass terrain data to street mask helper
    applyStreetFlattenToTerrain(
      this.terrain.geometry,
      {
        heights: this.terrain.heights,
        vertsWidth: this.terrain.vertsWidth,
        vertsLength: this.terrain.vertsLength,
        width: 800,
        length: 2000,
        segmentsWidth: 200,
        segmentsLength: 50,
      },
      streetConfig
    );

    console.log("[StreetDistrict] Terrain flattened for street footprint");
  }

  // Stage 3: Create grey street platform mesh
  _createStreetMesh() {
    const p = this.params;

    // Use simple PlaneGeometry like riverwalk for solid appearance
    const streetGeo = new THREE.PlaneGeometry(p.streetWidth * 2, p.streetLength * 2);
    
    // Add vertex colors for stable appearance at distance (like riverwalk)
    const colors = new Float32Array((streetGeo.attributes.position.count) * 3);
    const darkGrey = new THREE.Color(0x222222);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = darkGrey.r;
      colors[i + 1] = darkGrey.g;
      colors[i + 2] = darkGrey.b;
    }
    streetGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const streetMat = new THREE.MeshStandardMaterial({
      vertexColors: true,  // Use vertex colors for stable appearance
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,  // Visible from both sides
    });

    const streetMesh = new THREE.Mesh(streetGeo, streetMat);
    streetMesh.rotation.x = -Math.PI * 0.5; // Lay flat (rotate to XZ plane)
    streetMesh.position.set(p.centerX, p.streetMeshHeight, p.centerZ);
    streetMesh.receiveShadow = false;
    streetMesh.castShadow = false;

    this.root.add(streetMesh);
    this.streetMesh = streetMesh;

    console.log(`[StreetDistrict] Street mesh created: ${p.streetWidth * 2}x${p.streetLength * 2} @ height ${p.streetMeshHeight}`);
  }

  // Stage 3b: Create sidewalk strips
  _createSidewalks() {
    const p = this.params;
    const sidewalkWidth = 1.5;
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.sidewalk.tan,
      roughness: 0.85,
      metalness: 0.0,
    });

    // Left sidewalk
    const leftGeo = new THREE.PlaneGeometry(sidewalkWidth, p.streetLength * 2);
    const leftSidewalk = new THREE.Mesh(leftGeo, sidewalkMat);
    leftSidewalk.rotation.x = -Math.PI * 0.5;
    leftSidewalk.position.set(
      p.centerX - p.streetWidth - sidewalkWidth * 0.5,
      p.streetMeshHeight + 0.01,
      p.centerZ
    );
    leftSidewalk.receiveShadow = true;
    this.root.add(leftSidewalk);
    this.sidewalkMeshes.push(leftSidewalk);

    // Right sidewalk
    const rightGeo = new THREE.PlaneGeometry(sidewalkWidth, p.streetLength * 2);
    const rightSidewalk = new THREE.Mesh(rightGeo, sidewalkMat);
    rightSidewalk.rotation.x = -Math.PI * 0.5;
    rightSidewalk.position.set(
      p.centerX + p.streetWidth + sidewalkWidth * 0.5,
      p.streetMeshHeight + 0.01,
      p.centerZ
    );
    rightSidewalk.receiveShadow = true;
    this.root.add(rightSidewalk);
    this.sidewalkMeshes.push(rightSidewalk);

    console.log("[StreetDistrict] Sidewalk strips created");
  }

  // Stage 4: Generate procedural houses
  _generateHouses() {
    const p = this.params;

    // Compute plot positions
    const streetConfig = {
      centerX: p.centerX,
      centerZ: p.centerZ,
      halfWidth: p.streetWidth,
      halfLength: p.streetLength,
    };

    const plots = computePlots(streetConfig, p.house);

    // For each plot, create a house LOD
    for (const plot of plots) {
      // Set house Y position on the platform surface
      plot.pos.y = p.streetMeshHeight;  // On the platform surface

      // Flip house side by negating offset from center (for street 2)
      if (p.flipHouseSide) {
        const offsetFromCenter = plot.pos.x - p.centerX;
        plot.pos.x = p.centerX - offsetFromCenter;  // Reverse the offset
      }

      // Create LOD house
      const houseLOD = createHouseLOD(plot.seed, p.house);
      houseLOD.position.copy(plot.pos);
      
      let rotY = plot.rotY + Math.PI * 0.5;  // Rotate 90 degrees + original rotation
      
      // Mirror houses on street 2 (flip across street axis)
      if (p.mirrorHouses) {
        houseLOD.scale.x = -1;  // Flip X axis to mirror (reverses left/right)
        rotY = plot.rotY + Math.PI * 0.5 + Math.PI;  // Also rotate 180 degrees
      }
      
      houseLOD.rotation.y = rotY;

      this.root.add(houseLOD);
      this.houseLODs.push(houseLOD);
      this.housesByPlot.set(plot, houseLOD);
    }

    console.log(`[StreetDistrict] ${plots.length} houses generated`);
  }

  // Stage 5: Create light festival (instanced animated lights)
  _createLightFestival() {
    const p = this.params;

    // Compute street heading (along Z axis by default)
    const forward = new THREE.Vector3(0, 0, 1);  // Along +Z (street length direction)

    this.lightFestival = new LightFestival({
      scene: this.root,
      street: {
        center: new THREE.Vector3(p.centerX, p.streetMeshHeight, p.centerZ),
        forward: forward,
        width: p.streetWidth * 2,
        length: p.streetLength * 2,
        yStreet: p.streetMeshHeight,
      },
      params: {
        nRows: 3,
        nPerRow: 80,
        radius: 0.18,
        yOffset: 6.0,
        amplitude: 0.8,
        speed: 1.2,
        emissiveIntensity: 2.5,
        enabled: true,
      },
    });

    console.log("[StreetDistrict] Light festival created");
  }

  _createAttractionPyramid() {
    const p = this.params;

    this.attractionPyramid = new AttractionPyramid({
      scene: this.root,
      centerX: p.centerX,
      centerZ: p.centerZ,
      streetHeight: p.streetMeshHeight,
      params: {
        size: 15,
        height: 30,
        color: 0xff1493,
        emissiveIntensity: 6.0,
        lightIntensity: 1.5,  // Subtle light (no glow from distance)
        lightRange: 1000,  // Only close range gets light effect
        sideOffset: -20,  // Slightly towards river side, mostly on road
        enabled: true,
      },
    });

    console.log("[StreetDistrict] Attraction pyramid created");
  }

  _createStreetPedestrians() {
    const p = this.params;

    console.log("[StreetDistrict] Creating street pedestrians...");

    // Build house rectangles for avoidance
    const houseRects = this.houseLODs.map(houseLOD => {
      const pos = houseLOD.position;
      return {
        minX: pos.x - 15,
        maxX: pos.x + 15,
        minZ: pos.z - 15,
        maxZ: pos.z + 15,
      };
    });

    this.streetPedestrians = new StreetPedestrians({
      scene: this.root,
      street: {
        centerX: p.centerX,
        centerZ: p.centerZ,
        width: p.streetWidth * 2,
        length: p.streetLength * 2,
        height: p.streetMeshHeight,
      },
      pyramid: this.attractionPyramid,
      params: {
        population: 25,
        groupCohesion: 0.4,
        avoidPedestrians: 0.6,
        avoidHouses: 0.5,
        pyramidAttraction: 0.2,
        pyramidAvoidance: 0.4,
        enabled: true,
      },
    });

    // Store house rects for update
    this._houseRects = houseRects;
    console.log("[StreetDistrict] Street pedestrians created");
  }

  // Stage 8: Create fireflies (floating glowing orbs)
  _createFireflies() {
    const p = this.params;
    this.fireflies = new Fireflies({
      scene: this.root,
      street: {
        centerX: p.centerX,
        centerZ: p.centerZ,
        width: p.streetWidth * 2,
        length: p.streetLength * 2,
        height: p.streetMeshHeight,
      },
      params: {
        population: 0,  // Start with 0, user can enable via UI
        enabled: true,
      },
    });
  }

  // Stage 9: Create light cubes (atmospheric lighting + collision obstacles)
  _createLightCubes() {
    const p = this.params;
    this.lightCubes = new LightCubes({
      scene: this.root,
      centerX: p.centerX,
      centerZ: p.centerZ,
      streetWidth: p.streetWidth * 2,
      streetLength: p.streetLength * 2,
      streetHeight: p.streetMeshHeight,
      spacing: 40,
      color: 0x00ff88,
      emissiveIntensity: 2.5,
      size: 3,
      enabled: true,
    });
  }

  // Expose fireflies for UI control
  setFirefliesPopulation(count) {
    console.log("[StreetDistrict] setFirefliesPopulation called with:", count);
    if (this.fireflies) {
      this.fireflies.setPopulation(count);
      console.log("[StreetDistrict] Fireflies population set to:", count);
    } else {
      console.warn("[StreetDistrict] Fireflies not initialized");
    }
  }

  // Expose pedestrians for UI control
  setStreetPedestriansPopulation(count) {
    console.log("[StreetDistrict] setStreetPedestriansPopulation called with:", count);
    if (this.streetPedestrians) {
      this.streetPedestrians.setPopulation(count);
      console.log("[StreetDistrict] Pedestrians population set to:", count);
    } else {
      console.warn("[StreetDistrict] Street pedestrians not initialized");
    }
    this._houseRects = houseRects;

    console.log("[StreetDistrict] Street pedestrians created");
  }

  // Per-frame update: LOD and shadow management
  update(camera, timeSec = 0) {
    if (!this.isGenerated || !this.params.enabled) return;

    // Update LOD distances for each house
    for (const houseLOD of this.houseLODs) {
      houseLOD.update(camera);
    }

    // Update light festival animation
    if (this.lightFestival) {
      this.lightFestival.update(timeSec);
    }

    // Update attraction pyramid animation
    if (this.attractionPyramid) {
      this.attractionPyramid.update(timeSec);
    }

    // Update street pedestrians (crowd simulation)
    if (this.streetPedestrians) {
      const pyramidPos = this.attractionPyramid?.mesh?.position || new THREE.Vector3();
      const lightCubeObstacles = this.lightCubes?.getObstacles?.() || [];
      this.streetPedestrians.update(0.016, pyramidPos, this._houseRects, lightCubeObstacles);  // Assume 60fps = 0.016s
    }

    // Update fireflies
    if (this.fireflies) {
      this.fireflies.update(0.016);  // Assume 60fps = 0.016s
    }

    // Update light cubes
    if (this.lightCubes) {
      this.lightCubes.update(timeSec);
    }
  }

  // Stats for HUD
  getStats() {
    return {
      houseCount: this.houseLODs.length,
      streetEnabled: this.params.enabled,
    };
  }

  // Debug: enable/disable entire district
  setEnabled(enabled) {
    this.params.enabled = enabled;
    this.root.visible = enabled;
  }

  // Set street pedestrians population (respawn with new count)
  setStreetPedestriansPopulation(count) {
    if (this.streetPedestrians) {
      this.streetPedestrians.params.population = count;
      this.streetPedestrians._respawnAgents();
    }
  }

  // Set fireflies population (respawn with new count)
  setFirefliesPopulation(count) {
    if (this.fireflies) {
      this.fireflies.setPopulation(count);
    }
  }
}
