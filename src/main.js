import * as THREE from "three";
import { initThree } from "./core/initThree.js";
import { installResizeHandler } from "./core/resize.js";
import { createTerrain } from "./environment/terrain.js";
import { UniformGrid } from "./spacial/uniformGrid.js";
import { DebugGridRenderer } from "./spacial/debugGridRenderer.js";
import { HeatmapRenderer } from "./spacial/heatmapRenderer.js";
import { QueryCellOverlay } from "./spacial/queryCellOverlay.js";
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
import { createUI } from "./ui/ui.js";
import { Stats } from "./stats.js";
import { Perf } from "./perf.js";


const { scene, camera, renderer, controls } = initThree();
installResizeHandler(camera, renderer);

// --- Day/Night Cycle ---
const dayNightCycle = new DayNightCycle(scene, renderer);

// --- Scene dressing (light/fog/background) ---
// Note: Background and some lights are now controlled by dayNightCycle
// scene.background = new THREE.Color(0x1b2133);

// Fog (starts disabled, controlled via hotbar)
scene.fog = null;

// Note: Hemisphere and directional lights are now managed by DayNightCycle
// const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x2a3b1f, 0.65);
// scene.add(hemi);

// const sun = new THREE.DirectionalLight(0xffffff, 0.9);
// sun.position.set(120, 180, 80);
// sun.castShadow = false;
// scene.add(sun);

const WATER_LEVEL = -6;

// --- Procedural grass hill terrain ---
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

rebuildTerrain(); // Initial build

// --- Water surface (UV scrolling) ---
const water = createWater({
  width: 800,
  length: 2000,  // Match terrain length
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

// --- River corridor + Orb swarm ---
const river = makeRiverCorridor({
  width: 800,
  length: 2000,
  waterLevel: -6,
  riverHalfWidth: 56,  // Fixed: was 400, should be 56 to match terrain/water
  riverMeanderAmp: 55,
  riverMeanderWavelength: 140,
  seedishOffset: 13.37
});

// --- River walkways ---
const walkways = createRiverWalkways({
  riverCorridor: river,
  offsetDistance: 5,   // Closer to river edge
  width: 20,           // Platform width
  segments: 200,
  height: 5,        // Raised to where rail tops currently are
  railHeight: 1.2,     // Railing height
  color: 0x333333,     // Solid dark grey for visibility
  railColor: 0x111111, // Even darker rail color
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
  corridorWidth: 8,  // Narrow path - only 2-3 people can pass
  laneOffsets: [-2, 0, 2], // Three tight lanes
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

// Spawn initial crowd
leftWalkway.spawn(20);
rightWalkway.spawn(20);

// --- Street Lamp System ---
const streetLamps = new StreetLampSystem({
  scene: scene,
  walkwayA: walkwayCurves.leftCurve,
  walkwayB: walkwayCurves.rightCurve,
  terrainHeightAt: terrain.heightAt,
  riverCenterX: river.centerX,
  riverHalfWidth: river.halfWidth,
  platformHeight: 5.0, // Match the walkway platform height
});

// --- Street District: procedural hilltop street with houses ---
const streetDistrict = new StreetDistrict({
  scene: scene,
  terrain: terrain,
  params: {
    centerX: 350,    // Further out on hilltop plateau (towards world edge for true peak)
    centerZ: 200,    // Hilltop center Z (along walkway direction)
    streetWidth: 50,  // Much larger platform
    streetLength: 300,  // Half the hill length
    shoulderWidth: 40,
    enabled: true,
  },
});
streetDistrict.generate();

// Enable shadows for lighting to work
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Walkway platforms should receive shadows
walkways.leftMesh.receiveShadow = true;
walkways.rightMesh.receiveShadow = true;

let swarm = null;
let spatial = null;
let orbLOD = null;
let heatmap = null;
let queryCellOverlay = null;

// keep track of brightness so rebuild preserves it
let orbBrightness = 1.0;

function disposeInstancedMesh(m) {
  if (!m) return;
  if (m.geometry) m.geometry.dispose();
  if (m.material) m.material.dispose();
}

function rebuildOrbs(agentCount) {
  // remove old
  if (orbLOD) {
    scene.remove(orbLOD.nearMesh);
    scene.remove(orbLOD.farMesh);
    disposeInstancedMesh(orbLOD.nearMesh);
    disposeInstancedMesh(orbLOD.farMesh);
  }

  // (re)create simulation + spatial + renderer
  swarm = createOrbSwarm(river, { count: agentCount });
  // Match cell size to neighbor radius for optimal bucketing
  const cellSize = ORB_DEFAULTS.separationRadius * 1.25; // slightly larger
  spatial = new SpatialHash(cellSize);
  
  // Update visualizations to match spatial hash cell size (if they exist)
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

  // apply current brightness setting
  orbLOD.setBrightness(orbBrightness);

  scene.add(orbLOD.nearMesh);
  scene.add(orbLOD.farMesh);
}

rebuildOrbs(300); // initial count

// --- Spatial grid (for later agents/obstacles) ---
const grid = new UniformGrid(20); // cellSize in world units
// Debug overlay to visualise discretisation
const debugGrid = new DebugGridRenderer({
  worldSize: 2000, // Match longest dimension
  cellSize: grid.cellSize,
  y: 0.06,
});
scene.add(debugGrid.object3d);

// Heatmap occupancy visualization
heatmap = new HeatmapRenderer({
  cellSize: 20,
  worldSize: 2000,
  y: 0.08, // Slightly above debug grid
});
scene.add(heatmap.mesh);

// Query cell overlay (shows which cells are being queried)
queryCellOverlay = new QueryCellOverlay({
  cellSize: 20,
  y: 0.09, // Above heatmap
});
scene.add(queryCellOverlay.mesh);

// create lil-gui UI for all controls
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
  
  // Crowd controls
  crowdManager,
  leftWalkway,
  rightWalkway,
  getPeopleCount: () => crowdManager.getAgentCount(),
  onSetPeopleCount: (n) => {
    const current = crowdManager.getAgentCount();
    const diff = n - current;
    if (diff > 0) {
      // Spawn evenly on both walkways
      leftWalkway.spawn(Math.ceil(diff / 2));
      rightWalkway.spawn(Math.floor(diff / 2));
    } else if (diff < 0) {
      // Remove evenly from both walkways
      leftWalkway.remove(Math.ceil(-diff / 2));
      rightWalkway.remove(Math.floor(-diff / 2));
    }
  },
  
  // Street lamps
  streetLamps,
  
  // Street district
  streetDistrict,
});

// Quick sanity inserts (dummy points)
grid.clear();
grid.insert(0, 0, 0);
grid.insert(1, 50, 50);
grid.insert(2, -120, 80);
console.log("Occupied cells:", grid.getOccupiedCells());

// (optional test) log height at origin
console.log("Height at (0,0):", terrain.heightAt(0, 0));

// --- Debug sphere to test terrain height sampling ---
// const debugSphereGeo = new THREE.SphereGeometry(4, 16, 16);
// const debugSphereMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
// const debugSphere = new THREE.Mesh(debugSphereGeo, debugSphereMat);
// scene.add(debugSphere);
// let angle = 0;
// const radius = 150;

// --- A subtle “horizon” reference (optional) ---
// Note: GridHelper uses size (not width/length), so using max dimension
const gridHelper = new THREE.GridHelper(2000, 100, 0x2c3350, 0x2c3350);
gridHelper.position.y = 0.02;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.15;
scene.add(gridHelper);

// --- Stats Display ---
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
  
  // Update every 500ms
  if (elapsed >= 500) {
    Stats.fps = Math.round((frameCount * 1000) / elapsed);
    
    statsElement.innerHTML = `FPS: ${Stats.fps} | Frame: ${Stats.frameMs.toFixed(1)}ms<br>` +
                            `Checks: ${Stats.candidateChecks} | Pairs: ${Stats.neighborPairs} | Cells: ${Stats.queriedCells}<br>` +
                            `Swarm: ${swarmMs.toFixed(2)}ms | LOD: ${lodMs.toFixed(2)}ms | Heatmap: ${heatmapMs.toFixed(2)}ms`;
    
    frameCount = 0;
    lastTime = currentTime;
  }
}

// --- Animation loop ---
const clock = new THREE.Clock();

function animate() {
  //this is where it should actually be for example.
  requestAnimationFrame(animate);

  // Reset stats at start of frame
  Stats.resetPerFrame();

  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;
  
  // Reset query tracking for spatial hash
  if (spatial) {
    spatial.resetQueryTracking();
  }

  // Controls damping requires update each frame
  controls.update();
  water.update(dt);
  
  // Update crowd simulation
  crowdManager.update(dt, t);
  
  // Update street district (LOD updates)
  streetDistrict.update(camera);
  
  // Update street lamps (light pool + shadow LOD)
  streetLamps.update(camera);
  
  // update swarm (movement + separation)
  // Pass spatial hash only if mode is "hash", otherwise pass null for naive O(n²) mode
  const spatialToUse = params.neighborMode === "hash" ? spatial : null;
  if (swarm) {
    Perf.begin("swarm");
    swarm.update(dt, t, spatialToUse);
    swarmMs = Perf.end("swarm");
  }
  
  // Update heatmap visualization
  heatmap.mesh.visible = params.showOccupancy;
  if (params.showOccupancy && spatial) {
    Perf.begin("heatmap");
    heatmap.update(spatial.getOccupiedCells(), spatial);
    heatmapMs = Perf.end("heatmap");
  } else {
    heatmapMs = 0;
  }
  
  // Update query cell overlay (shows ALL cells accessed during this frame)
  queryCellOverlay.mesh.visible = params.showQueryCells && params.neighborMode === "hash";
  
  if (params.showQueryCells && params.neighborMode === "hash" && spatial) {
    const keysSize = spatial.allQueryKeys.size;
    if (keysSize > 0) {
      const keys = Array.from(spatial.allQueryKeys);
      queryCellOverlay.updateFromKeys(keys, spatial);
    }
  } else {
    // Clear overlay when not in use
    if (queryCellOverlay.mesh.count > 0) {
      queryCellOverlay.mesh.count = 0;
    }
  }
  
  // update instance transforms with LOD switching
  if (orbLOD) {
    Perf.begin("lod");
    orbLOD.updateInstances(swarm, camera);
    lodMs = Perf.end("lod");
  }

  // Move debug sphere in a circle and sample terrain height
  //   angle += dt * 0.5;
  //   const x = Math.cos(angle) * radius;
  //   const z = Math.sin(angle) * radius;
  //   const y = terrain.heightAt(x, z);
  //   debugSphere.position.set(x, y + 4, z); // +4 so the sphere sits on top of ground (its radius)

  // If later you want “wind” motion, you can re-displace terrain here.
  // Keep it static for now (cheaper + stable base).

  renderer.render(scene, camera);  
  
  // Update stats displays
  updateStatsDisplay();
  if (window.updateCrowdStats) window.updateCrowdStats();
  if (window.updateLampStats) window.updateLampStats();
}

animate();
