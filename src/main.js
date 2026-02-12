import * as THREE from "three";
import { initThree } from "./core/initThree.js";
import { installResizeHandler } from "./core/resize.js";
import { createTerrain } from "./environment/terrain.js";
import { UniformGrid } from "./spacial/uniformGrid.js";
import { DebugGridRenderer } from "./spacial/debugGridRenderer.js";
import { createHotbar } from "./ui/hotbar.js";
import { createWater } from "./environment/water.js";

const { scene, camera, renderer, controls } = initThree();
installResizeHandler(camera, renderer);

// --- Scene dressing (light/fog/background) ---
scene.background = new THREE.Color(0x1b2133);

// Fog (starts disabled, controlled via hotbar)
scene.fog = null;

const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x2a3b1f, 0.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(120, 180, 80);
sun.castShadow = false;
scene.add(sun);

const WATER_LEVEL = -6;

// --- Procedural grass hill terrain ---
const terrain = createTerrain({
  width: 800,
  length: 2000, // Divided by 1.5
  segmentsWidth: 200,
  segmentsLength: 50, // Reduced proportionally
  samplerParams: {
    waterLevel: WATER_LEVEL,
    amplitude: 18,
    wavelength: 140,
    seedishOffset: 13.37,
  },
});

scene.add(terrain.mesh);

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

// --- Spatial grid (for later agents/obstacles) ---
const grid = new UniformGrid(20); // cellSize in world units
// Debug overlay to visualise discretisation
const debugGrid = new DebugGridRenderer({
  worldSize: 2000, // Match longest dimension
  cellSize: grid.cellSize,
  y: 0.06,
});
scene.add(debugGrid.object3d);

// add hotbar UI
createHotbar({ debugGrid, scene });

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

// --- Animation loop ---
const clock = new THREE.Clock();

function animate() {
  //this is where it should actually be for example.
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  // Controls damping requires update each frame
  controls.update();
  water.update(dt);

  // Move debug sphere in a circle and sample terrain height
  //   angle += dt * 0.5;
  //   const x = Math.cos(angle) * radius;
  //   const z = Math.sin(angle) * radius;
  //   const y = terrain.heightAt(x, z);
  //   debugSphere.position.set(x, y + 4, z); // +4 so the sphere sits on top of ground (its radius)

  // If later you want “wind” motion, you can re-displace terrain here.
  // Keep it static for now (cheaper + stable base).

  renderer.render(scene, camera);
}

animate();
