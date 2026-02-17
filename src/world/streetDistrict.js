// Street District: procedural hilltop street with procedural houses
// Stages 1-4: street placement, terrain flattening, street mesh, house generation
// 
// Clean separation: generate() is one-time, update() is per-frame (LOD + shadows)

import * as THREE from "three";
import { applyStreetFlattenToTerrain, computePlots } from "./streetMask.js";
import { createHouseLOD, HOUSE_CONFIG_DEFAULT } from "./houseFactory.js";
import { PALETTE } from "./palette.js";

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

      ...params,
    };

    this.root = new THREE.Group();
    this.root.name = "StreetDistrict";
    scene.add(this.root);

    this.streetMesh = null;
    this.sidewalkMeshes = [];
    this.houseLODs = [];
    this.housesByPlot = new Map();

    this.isGenerated = false;
  }

  // One-time generation: terrain flatten, meshes, houses
  generate() {
    if (this.isGenerated) return;
    this.isGenerated = true;

    const p = this.params;

    // Stage 1: ensure street position is at plateau height
    const plateauHeight = this.terrain.heightAt(p.centerX, p.centerZ);
    p.streetHeight = plateauHeight;
    p.streetMeshHeight = plateauHeight + 2;  // Raise platform significantly above terrain

    // Stage 2: flatten terrain under street footprint
    this._flattenTerrainForStreet();

    // Stage 3: create street mesh
    this._createStreetMesh();

    // Stage 3b: create sidewalks
    this._createSidewalks();

    // Stage 4: procedurally generate houses
    this._generateHouses();

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

      // Create LOD house
      const houseLOD = createHouseLOD(plot.seed, p.house);
      houseLOD.position.copy(plot.pos);
      houseLOD.rotation.y = plot.rotY + Math.PI * 0.5;  // Rotate 90 degrees + original rotation

      this.root.add(houseLOD);
      this.houseLODs.push(houseLOD);
      this.housesByPlot.set(plot, houseLOD);
    }

    console.log(`[StreetDistrict] ${plots.length} houses generated`);
  }

  // Per-frame update: LOD and shadow management (stages 5-6, implemented later)
  update(camera) {
    if (!this.isGenerated || !this.params.enabled) return;

    // Update LOD distances for each house
    for (const houseLOD of this.houseLODs) {
      houseLOD.update(camera);
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
}
