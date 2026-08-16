// main.js

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { initThree } from "./core/initThree.js";
import { installResizeHandler } from "./core/resize.js";
import { KeyboardCameraController } from "./core/keyboardCamera.js";
import { createTerrain } from "./environment/terrain.js";
import { UniformGrid } from "./spatial/uniformGrid.js";
import { DebugGridRenderer } from "./spatial/debugGridRenderer.js";
import { HeatmapRenderer } from "./spatial/heatmapRenderer.js";
import { QueryCellOverlay } from "./spatial/queryCellOverlay.js";
import { createWater } from "./environment/water.js";
import { DayNightCycle } from "./ui/dayNightCycle.js";
import { makeRiverCorridor } from "./environment/riverCorridor.js";
import { createRiverWalkways } from "./environment/riverWalkways.js";
import { createWalkwayCurves } from "./environment/walkwayCurves.js";
import { createOrbSwarm } from "./agents/orbSwarm.js";
import { ORB_DEFAULTS } from "./agents/orbConfig.js";
import { SpatialHash } from "./agents/spatialHash.js";
import { createOrbLodRenderer } from "./agents/orbLodRenderer.js";
import { CrowdManager } from "./crowd/CrowdManager.js";
import { WalkwayZone } from "./crowd/CrowdZoneWalkway.js";
import { StreetLampSystem } from "./environment/StreetLampSystem.js";
import { StreetDistrict } from "./world/streetDistrict.js";
import { BezierBlanket } from "./parametric/bezierBlanket.js";
import { TreeSystem } from "./environment/trees/TreeSystem.js";
import { VegetationSystem } from "./environment/vegetation/VegetationSystem.js";
import { createUI } from "./ui/ui.js";
import { Stats } from "./stats.js";
import { Perf } from "./perf.js";


const { scene, camera, renderer, controls } = initThree();
installResizeHandler(camera, renderer);

// Post-Processing Pipeline
let composer, renderPass, bloomPass, fxaaPass;
let enablePost = false;  // Temporarily disabled to debug white screen
let enableBloom = true;
let enableFXAA = true;
let useMSAA = false;


const bloomConfig = {
  strength: 0.8,
  radius: 0.4,
  threshold: 0.3
};

function createComposer(scene, camera) {
  try {
    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderPass = new RenderPass(scene, camera);
    renderPass.clearColor = new THREE.Color(0x1a1a2e);
    composer.addPass(renderPass);


    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomConfig.strength,
      bloomConfig.radius,
      bloomConfig.threshold
    );
    bloomPass.enabled = enableBloom;
    composer.addPass(bloomPass);


    fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.enabled = enableFXAA;
    composer.addPass(fxaaPass);

    updateFXAAResolution();
    applyPostToggles();
    
    console.log("[Post-Processing] Composer initialized with Bloom + FXAA");
  } catch (e) {
    console.error("[Post-Processing] Failed to initialize composer:", e);
    enablePost = false;
  }
}

function updateFXAAResolution() {
  if (!fxaaPass || !fxaaPass.material) return;
  const pixelRatio = renderer.getPixelRatio();
  const resX = 1 / (window.innerWidth * pixelRatio);
  const resY = 1 / (window.innerHeight * pixelRatio);
  
  if (fxaaPass.material.uniforms && fxaaPass.material.uniforms["resolution"]) {
    fxaaPass.material.uniforms["resolution"].value.set(resX, resY);
  }
}

function applyPostToggles() {
  if (!bloomPass || !fxaaPass) return;
  bloomPass.enabled = enableBloom;
  fxaaPass.enabled = enableFXAA;
}


window.postProcessingAPI = {
  setEnablePost: (v) => { enablePost = v; },
  setEnableBloom: (v) => { enableBloom = v; applyPostToggles(); },
  setEnableFXAA: (v) => { enableFXAA = v; applyPostToggles(); },
  setBloomStrength: (v) => { 
    bloomConfig.strength = v;
    if (bloomPass) bloomPass.strength = v; 
  },
  setBloomThreshold: (v) => { 
    bloomConfig.threshold = v;
    if (bloomPass) bloomPass.threshold = v; 
  },
  setBloomRadius: (v) => { 
    bloomConfig.radius = v;
    if (bloomPass) bloomPass.radius = v; 
  }
};


window.updateComposerSize = () => {
  if (!composer) return;
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  

  composer.setSize(width, height);
  composer.setPixelRatio(pixelRatio);
  

  updateFXAAResolution();
  
  console.log(`[Post-Processing] Resized to ${width}x${height} @ ${pixelRatio}px`);
};


// Keyboard Camera Controller
const keyboardCamera = new KeyboardCameraController(camera, 500);


const dayNightCycle = new DayNightCycle(scene, renderer);
scene.fog = null;
const WATER_LEVEL = -6;

// Procedural grass hill
let terrain = null;
const terrainConfig = {
  width: 800,
  length: 2000,
  segmentsWidth: 200,
  segmentsLength: 50,
  samplerParams: {
    waterLevel: WATER_LEVEL,
    amplitude: 18,
    wavelength: 140,
    seedishOffset: 13.37,
  }
};

function rebuildTerrain() {
  if (terrain) {
    scene.remove(terrain.mesh);
    terrain.mesh.geometry.dispose();
    terrain.mesh.material.dispose();
  }
  terrain = createTerrain(terrainConfig);
  scene.add(terrain.mesh);
}

rebuildTerrain();

// water surface
const water = createWater({
  width: 800,
  length: 2000,
  samplerParams: {
    riverHalfWidth: 56,
    riverMeanderAmp: 55,
    riverMeanderWavelength: 140,
    seedishOffset: 13.37
  },
  waterLevel: WATER_LEVEL,
  yOffset: 0.35,
  flowSpeed: 0.06
});
scene.add(water.mesh);


const river = makeRiverCorridor({
  width: 800,
  length: 2000,
  waterLevel: -6,
  riverHalfWidth: 56,
  riverMeanderAmp: 55,
  riverMeanderWavelength: 140,
  seedishOffset: 13.37
});

// River walkways 
const walkways = createRiverWalkways({
  riverCorridor: river,
  offsetDistance: 5,
  width: 20,
  segments: 200,
  height: 5,
  railHeight: 1.2,
  color: 0x333333,
  railColor: 0x111111,
});
scene.add(walkways.leftMesh);
scene.add(walkways.rightMesh);

// --- Crowd simulation ---
const walkwayCurves = createWalkwayCurves({
  riverCorridor: river,
  offsetDistance: 5,
  width: 20,
  samples: 100,
});

const crowdManager = new CrowdManager();

// Left walkway zone
const leftWalkway = new WalkwayZone({
  scene: scene,
  curve: walkwayCurves.leftCurve,
  corridorWidth: 8,
  laneOffsets: [-2, 0, 2], 
  yOffset: 0.15,
  lookAheadT: 0.01,
  neighborRadius: 3.0,
  brakeRadius: 2.0,
  platformHeight: 5,
});

// Right walkway zone
const rightWalkway = new WalkwayZone({
  scene: scene,
  curve: walkwayCurves.rightCurve,
  corridorWidth: 8,
  laneOffsets: [-2, 0, 2],
  yOffset: 0.15,
  lookAheadT: 0.01,
  neighborRadius: 3.0,
  brakeRadius: 2.0,
  platformHeight: 5,
});

crowdManager.addZone(leftWalkway);
crowdManager.addZone(rightWalkway);

// initial crowd
leftWalkway.spawn(20);
rightWalkway.spawn(20);

// Lamps
const streetLamps = new StreetLampSystem({
  scene: scene,
  walkwayA: walkwayCurves.leftCurve,
  walkwayB: walkwayCurves.rightCurve,
  terrainHeightAt: terrain.heightAt,
  riverCenterX: river.centerX,
  riverHalfWidth: river.halfWidth,
  platformHeight: 5.0,
});

// Durham street
const streetDistrict = new StreetDistrict({
  scene: scene,
  terrain: terrain,
  params: {
    centerX: 350,
    centerZ: 200,
    streetWidth: 50,
    streetLength: 300,
    shoulderWidth: 40,
    enabled: true,
    skipLightCubes: true,
  },
});
streetDistrict.generate();

// Durham street 2
const streetDistrict2 = new StreetDistrict({
  scene: scene,
  terrain: terrain,
  params: {
    centerX: -350,
    centerZ: 200,
    streetWidth: 50,
    streetLength: 300,
    shoulderWidth: 40,
    enabled: true,
    mirrorHouses: true,
    flipHouseSide: true,
    skipPyramid: true,
  },
});
streetDistrict2.generate();


const STREET_CONFIGS = [
  { centerX:  350, centerZ: 200, halfWidth: 50, halfLength: 300 },
  { centerX: -350, centerZ: 200, halfWidth: 50, halfLength: 300 },
];

const treeSystem = new TreeSystem({
  scene,
  terrain,
  river,
  streets: STREET_CONFIGS,
});
treeSystem.build();

// Billboarded Rocks & Stumps
const vegetationSystem = new VegetationSystem({
  scene,
  terrain,
  river,
  streets: STREET_CONFIGS,
});
vegetationSystem.build();

// --- Bézier Blanket Canopy (above Street 2) ---
// Street 2 reference frame:
// center: (-350, streetHeight, 200)
// tangent: (0, 0, 1) - along street Z direction
// normal: (-1, 0, 0) - perpendicular, pointing toward river
const street2Center = new THREE.Vector3(-350, streetDistrict2.params.streetMeshHeight, 200);
const street2Tangent = new THREE.Vector3(0, 0, 1);
const street2Normal = new THREE.Vector3(-1, 0, 0);

const bezierBlanket = new BezierBlanket({
  scene: scene,
  center: street2Center,
  tangent: street2Tangent,
  normal: street2Normal,
  width: 100,
  length: 600,
  height: 60,
  segU: 40,
  segV: 120,
});


bezierBlanket.setParams({
  waveAmp: 12.0,
  waveSpeed: 2.5,
  waveLen: 6.0,
  drapeAmp: 8.0,
  emissiveIntensity: 3.5,
});


renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = true;


walkways.leftMesh.receiveShadow = true;
walkways.rightMesh.receiveShadow = true;

let swarm = null;
let spatial = null;
let orbLOD = null;
let heatmap = null;
let queryCellOverlay = null;

let focusAgentMarker = null;

let orbBrightness = 1.0;

function disposeInstancedMesh(m) {
  if (!m) return;
  if (m.geometry) m.geometry.dispose();
  if (m.material) m.material.dispose();
}

function rebuildOrbs(agentCount) {
  if (orbLOD) {
    scene.remove(orbLOD.nearMesh);
    scene.remove(orbLOD.farMesh);
    disposeInstancedMesh(orbLOD.nearMesh);
    disposeInstancedMesh(orbLOD.farMesh);
  }

  swarm = createOrbSwarm(river, { count: agentCount });
  const cellSize = ORB_DEFAULTS.separationRadius * 1.25;
  spatial = new SpatialHash(cellSize);
  
  if (heatmap) {
    heatmap.cellSize = cellSize;
    heatmap.updateGeometry();
  }
  if (queryCellOverlay) {
    queryCellOverlay.cellSize = cellSize;
    queryCellOverlay.updateGeometry();
  }

  orbLOD = createOrbLodRenderer({
    count: swarm.count,
    lodDistance: 70,
    hysteresis: 10,
  });

  orbLOD.setBrightness(orbBrightness);

  scene.add(orbLOD.nearMesh);
  scene.add(orbLOD.farMesh);
}

rebuildOrbs(300);


createComposer(scene, camera);

// Spatial grid
const grid = new UniformGrid(20); 
const debugGrid = new DebugGridRenderer({
  worldSize: 2000,
  cellSize: grid.cellSize,
  y: 0.06,
});
scene.add(debugGrid.object3d);

heatmap = new HeatmapRenderer({
  cellSize: 20,
  worldSize: 2000,
  y: 0.08,
});
scene.add(heatmap.mesh);


queryCellOverlay = new QueryCellOverlay({
  cellSize: 20,
  y: 0.09,
});
scene.add(queryCellOverlay.mesh);


const { gui, params } = createUI({
  debugGrid,
  heatmap,
  queryCellOverlay,
  scene,
  dayNightCycle,
  getAgentCount: () => (swarm ? swarm.count : 0),
  onSetAgentCount: (n) => rebuildOrbs(n),

  getBrightness: () => orbBrightness,
  onSetBrightness: (v) => {
    orbBrightness = v;
    if (orbLOD) orbLOD.setBrightness(orbBrightness);
  },
  

  crowdManager,
  leftWalkway,
  rightWalkway,
  getPeopleCount: () => crowdManager.getAgentCount(),
  onSetPeopleCount: (n) => {
    const current = crowdManager.getAgentCount();
    const diff = n - current;
    if (diff > 0) {

      leftWalkway.spawn(Math.ceil(diff / 2));
      rightWalkway.spawn(Math.floor(diff / 2));
    } else if (diff < 0) {

      leftWalkway.remove(Math.ceil(-diff / 2));
      rightWalkway.remove(Math.floor(-diff / 2));
    }
  },
  

  streetLamps,
  
  streetDistrict,
  streetDistrict2,
  
  bezierBlanket,

  treeSystem,
  
  vegetationSystem,
});


leftWalkway.setCamera(camera);
rightWalkway.setCamera(camera);
streetDistrict.setCamera(camera);
streetDistrict2.setCamera(camera);


grid.clear();
grid.insert(0, 0, 0);
grid.insert(1, 50, 50);
grid.insert(2, -120, 80);
console.log("Occupied cells:", grid.getOccupiedCells());


console.log("Height at (0,0):", terrain.heightAt(0, 0));






const gridHelper = new THREE.GridHelper(2000, 100, 0x2c3350, 0x2c3350);
gridHelper.position.y = 0.02;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.15;
scene.add(gridHelper);

// Stats 
const statsElement = document.getElementById('stats');
let frameCount = 0;
let lastTime = performance.now();
let lastFrameTime = performance.now();

// Performance timings
let swarmMs = 0;
let lodMs = 0;
let heatmapMs = 0;

function updateStatsDisplay() {
  frameCount++;
  const currentTime = performance.now();
  const frameDelta = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  Stats.frameMs = frameDelta;
  
  const elapsed = currentTime - lastTime;
  
  if (elapsed >= 500) {
    Stats.fps = Math.round((frameCount * 1000) / elapsed);
    
    statsElement.innerHTML = `FPS: ${Stats.fps} | Frame: ${Stats.frameMs.toFixed(1)}ms<br>` +
                            `Checks: ${Stats.candidateChecks} | Pairs: ${Stats.neighborPairs} | Cells: ${Stats.queriedCells}<br>` +
                            `Swarm: ${swarmMs.toFixed(2)}ms | LOD: ${lodMs.toFixed(2)}ms | Heatmap: ${heatmapMs.toFixed(2)}ms`;
    
    frameCount = 0;
    lastTime = currentTime;
  }
}

// Animation loop 
const clock = new THREE.Clock();

function animate() {

  requestAnimationFrame(animate);


  Stats.resetPerFrame();

  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;
  

  if (spatial) {
    spatial.resetQueryTracking();
  }


  controls.update();
  keyboardCamera.update(dt);
  water.update(dt);
  

  crowdManager.update(dt, t);
  

  streetDistrict.update(camera, t);
  streetDistrict2.update(camera, t);
  

  bezierBlanket.update(dt);
  

  streetLamps.update(camera);


  treeSystem.update(camera, dt);
  

  vegetationSystem.update(camera);
  
  const spatialToUse = params.neighborMode === "hash" ? spatial : null;
  if (swarm) {
    Perf.begin("swarm");
    swarm.update(dt, t, spatialToUse);
    swarmMs = Perf.end("swarm");
  }
  

  heatmap.mesh.visible = params.showOccupancy;
  if (params.showOccupancy && spatial) {
    Perf.begin("heatmap");
    heatmap.update(spatial.getOccupiedCells(), spatial);
    heatmapMs = Perf.end("heatmap");
  } else {
    heatmapMs = 0;
  }
  

  if (params.showQueryCells && params.neighborMode === "hash") {
    queryCellOverlay.mesh.visible = true;
    if (focusAgentMarker) focusAgentMarker.visible = false;
    if (spatial && spatial.allQueryKeys.size > 0) {
      const keys = Array.from(spatial.allQueryKeys);
      queryCellOverlay.updateFromKeys(keys, spatial);
    }

  } else if (params.showQueryProof && params.neighborMode === "hash" && swarm && spatial && river && typeof river.centerX === "function" && swarm.z && swarm.dx && typeof swarm.z.length === "number" && typeof swarm.dx.length === "number") {
    queryCellOverlay.mesh.visible = true;

    const MAX_CHECK = Math.min(swarm.count || 0, 1000);
    let focusIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < MAX_CHECK; ++i) {
      const zi = swarm.z[i];
      const dxi = swarm.dx[i];
      if (typeof zi !== "number" || typeof dxi !== "number") continue;
      const x = river.centerX(zi) + dxi;
      const z = zi;
      const dist = Math.abs(x - river.centerX(z));
      if (dist < minDist) {
        minDist = dist;
        focusIdx = i;
      }
    }
    if (focusIdx === -1) {
      queryCellOverlay.mesh.count = 0;
      if (focusAgentMarker) focusAgentMarker.visible = false;
      return;
    }
    const x = river.centerX(swarm.z[focusIdx]) + swarm.dx[focusIdx];
    const z = swarm.z[focusIdx];
    const cx = Math.floor(x / spatial.cellSize);
    const cz = Math.floor(z / spatial.cellSize);
    const keys = [];
    for (let dx = -1; dx <= 1; ++dx) {
      for (let dz = -1; dz <= 1; ++dz) {
        keys.push(spatial._packKey(cx + dx, cz + dz));
      }
    }
    queryCellOverlay.updateFromKeys(keys, spatial);


    if (!focusAgentMarker) {
      const sphereGeo = new THREE.SphereGeometry(2.2, 20, 20);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, emissive: 0xff00ff, transparent: true, opacity: 0.85 });
      focusAgentMarker = new THREE.Mesh(sphereGeo, sphereMat);
      focusAgentMarker.renderOrder = 9999;
      focusAgentMarker.visible = true;
      scene.add(focusAgentMarker);
    }
    focusAgentMarker.position.set(x, river.waterLevel + 2.5, z);
    focusAgentMarker.visible = true;
  } else {
    queryCellOverlay.mesh.visible = false;
    if (queryCellOverlay.mesh.count > 0) {
      queryCellOverlay.mesh.count = 0;
    }
    if (focusAgentMarker) focusAgentMarker.visible = false;
  }
  

  if (orbLOD) {
    Perf.begin("lod");
    orbLOD.updateInstances(swarm, camera);
    lodMs = Perf.end("lod");
  }


  if (enablePost && composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  

  updateStatsDisplay();
  if (window.updateCrowdStats) window.updateCrowdStats();
  if (window.updateLampStats) window.updateLampStats();
}

animate();
