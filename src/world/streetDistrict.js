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

    this.params = {
      centerX: 0,
      centerZ: 200,
      heading: new THREE.Vector3(0, 0, 1),

      streetWidth: 8,
      streetLength: 120,
      streetHeight: 200.0,
      shoulderWidth: 40,

      streetMeshHeight: 22.03,

      house: { ...HOUSE_CONFIG_DEFAULT },

      // Rendering
      enabled: true,

      mirrorHouses: false,
      flipHouseSide: false,
      skipPyramid: false,
      skipLightCubes: false,

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


  generate() {
    if (this.isGenerated) return;
    this.isGenerated = true;

    const p = this.params;

    console.log("[StreetDistrict] Starting generate()...");


    const plateauHeight = this.terrain.heightAt(p.centerX, p.centerZ);
    p.streetHeight = plateauHeight;
    p.streetMeshHeight = plateauHeight + 2;

    console.log("[StreetDistrict] Plateau height:", plateauHeight, "Street mesh height:", p.streetMeshHeight);

 
    this._flattenTerrainForStreet();
    this._createStreetMesh();
    this._createSidewalks();
    this._generateHouses();
    this._createLightFestival();

    if (!p.skipPyramid) {
      this._createAttractionPyramid();
    }

    this._createStreetPedestrians();
    this._createFireflies();

    if (!p.skipLightCubes) {
      this._createLightCubes();
    }

    console.log(
      `[StreetDistrict] Generated street @ (${p.centerX}, ${p.streetHeight}, ${p.centerZ}) ` +
      `with ${this.houseLODs.length} houses`
    );
  }

  _flattenTerrainForStreet() {
    const p = this.params;

    const streetConfig = {
      centerX: p.centerX,
      centerZ: p.centerZ,
      halfWidth: p.streetWidth,
      halfLength: p.streetLength,
      shoulderWidth: p.shoulderWidth,
      streetHeight: p.streetHeight,
    };

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

  _createStreetMesh() {
    const p = this.params;
    const streetGeo = new THREE.PlaneGeometry(p.streetWidth * 2, p.streetLength * 2);
    
    const colors = new Float32Array((streetGeo.attributes.position.count) * 3);
    const darkGrey = new THREE.Color(0x222222);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = darkGrey.r;
      colors[i + 1] = darkGrey.g;
      colors[i + 2] = darkGrey.b;
    }
    streetGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const streetMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const streetMesh = new THREE.Mesh(streetGeo, streetMat);
    streetMesh.rotation.x = -Math.PI * 0.5;
    streetMesh.position.set(p.centerX, p.streetMeshHeight, p.centerZ);
    streetMesh.receiveShadow = false;
    streetMesh.castShadow = false;

    this.root.add(streetMesh);
    this.streetMesh = streetMesh;

    console.log(`[StreetDistrict] Street mesh created: ${p.streetWidth * 2}x${p.streetLength * 2} @ height ${p.streetMeshHeight}`);
  }

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

  // Generate houses
  _generateHouses() {
    const p = this.params;

    const streetConfig = {
      centerX: p.centerX,
      centerZ: p.centerZ,
      halfWidth: p.streetWidth,
      halfLength: p.streetLength,
    };

    const plots = computePlots(streetConfig, p.house);

    for (const plot of plots) {
      plot.pos.y = p.streetMeshHeight;

      if (p.flipHouseSide) {
        const offsetFromCenter = plot.pos.x - p.centerX;
        plot.pos.x = p.centerX - offsetFromCenter;
      }


      const houseLOD = createHouseLOD(plot.seed, p.house);
      houseLOD.position.copy(plot.pos);
      
      let rotY = plot.rotY + Math.PI * 0.5;
      if (p.mirrorHouses) {
        houseLOD.scale.x = -1;
        rotY = plot.rotY + Math.PI * 0.5 + Math.PI;
      }
      
      houseLOD.rotation.y = rotY;

      this.root.add(houseLOD);
      this.houseLODs.push(houseLOD);
      this.housesByPlot.set(plot, houseLOD);
    }

    console.log(`[StreetDistrict] ${plots.length} houses generated`);
  }

  _createLightFestival() {
    const p = this.params;

    const forward = new THREE.Vector3(0, 0, 1);

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
        lightIntensity: 1.5,
        lightRange: 1000,
        sideOffset: -20,
        enabled: true,
      },
    });

    console.log("[StreetDistrict] Attraction pyramid created");
  }

  _createStreetPedestrians() {
    const p = this.params;

    console.log("[StreetDistrict] Creating street pedestrians...");

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


    this._houseRects = houseRects;
    console.log("[StreetDistrict] Street pedestrians created");
  }


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
        population: 0,
        enabled: true,
      },
    });
  }


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


  setFirefliesPopulation(count) {
    console.log("[StreetDistrict] setFirefliesPopulation called with:", count);
    if (this.fireflies) {
      this.fireflies.setPopulation(count);
      console.log("[StreetDistrict] Fireflies population set to:", count);
    } else {
      console.warn("[StreetDistrict] Fireflies not initialized");
    }
  }


  setStreetPedestriansPopulation(count) {
    console.log("[StreetDistrict] setStreetPedestriansPopulation called with:", count);
    if (this.streetPedestrians) {
      this.streetPedestrians.setPopulation(count);
      console.log("[StreetDistrict] Pedestrians population set to:", count);
    } else {
      console.warn("[StreetDistrict] Street pedestrians not initialized");
    }
  }

  setCamera(camera) {
    if (this.streetPedestrians) {
      this.streetPedestrians.setCamera(camera);
    }
  }

  setAnimationLODEnabled(enabled) {
    if (this.streetPedestrians) {
      this.streetPedestrians.setAnimationLODEnabled(enabled);
    }
  }

  setAnimationLODParams(params) {
    if (this.streetPedestrians) {
      this.streetPedestrians.setAnimationLODParams(params);
    }
  }


  setSpatialIndexMode(mode) {
    if (this.streetPedestrians) {
      this.streetPedestrians.setSpatialIndexMode(mode);
    }
  }

  get spatialStats() {
    return this.streetPedestrians ? this.streetPedestrians.spatialStats : null;
  }

  update(camera, timeSec = 0) {
    if (!this.isGenerated || !this.params.enabled) return;

    for (const houseLOD of this.houseLODs) {
      houseLOD.update(camera);
    }

    if (this.lightFestival) {
      this.lightFestival.update(timeSec);
    }


    if (this.attractionPyramid) {
      this.attractionPyramid.update(timeSec);
    }

    if (this.streetPedestrians) {
      const pyramidPos = this.attractionPyramid?.mesh?.position || new THREE.Vector3();
      const lightCubeObstacles = this.lightCubes?.getObstacles?.() || [];
      this.streetPedestrians.update(0.016, pyramidPos, this._houseRects, lightCubeObstacles);  // Assume 60fps = 0.016s
    }

    if (this.fireflies) {
      this.fireflies.update(0.016);
    }

    if (this.lightCubes) {
      this.lightCubes.update(timeSec);
    }
  }

  getStats() {
    return {
      houseCount: this.houseLODs.length,
      streetEnabled: this.params.enabled,
    };
  }

  setEnabled(enabled) {
    this.params.enabled = enabled;
    this.root.visible = enabled;
  }

  setStreetPedestriansPopulation(count) {
    if (this.streetPedestrians) {
      this.streetPedestrians.params.population = count;
      this.streetPedestrians._respawnAgents();
    }
  }


  setFirefliesPopulation(count) {
    if (this.fireflies) {
      this.fireflies.setPopulation(count);
    }
  }
}
