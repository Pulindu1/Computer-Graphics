// 📄 src/ui/ui.js
import { GUI } from "lil-gui";
import * as THREE from "three";

/**
 * Scalable GUI (lil-gui) like the provided exercise:
 * - folders
 * - sliders / toggles
 * - easy to add more later
 *
 * Includes:
 * - Debug: spatial grid toggle
 * - Orbs: agentCount slider, brightness slider
 * - Environment: fog intensity, time of day
 */

export function createUI({
  debugGrid,
  scene,
  dayNightCycle,
  getAgentCount,
  onSetAgentCount,
  getBrightness,
  onSetBrightness,
} = {}) {
  const gui = new GUI({ title: "Swarm Controls" });

  // Central state object lil-gui binds to
  const params = {
    // Debug
    neighborMode: "hash", // "hash" | "naive"
    showSpatialGrid: true,
    showOccupancy: false,
    showQueryCells: false,
    selectedAgentId: -1,
    agentNeighborRadius: 10,
    cellSize: 20,
    
    // Orbs
    agentCount: typeof getAgentCount === "function" ? getAgentCount() : 300,
    orbBrightness: typeof getBrightness === "function" ? getBrightness() : 2.0,
    
    // Environment
    fogIntensity: 0,
    timeOfDay: 0.5, // 0 = midnight, 0.5 = noon, 1 = midnight
  };

  // --- Folder: Debug ---
  const fDebug = gui.addFolder("Debug");
  
  fDebug
    .add(params, "neighborMode", ["hash", "naive"])
    .name("Neighbour mode")
    .onChange((v) => {
      console.log(`Switched to ${v} neighbor search`);
    });
  
  fDebug
    .add(params, "showSpatialGrid")
    .name("Show grid")
    .onChange((v) => {
      if (debugGrid) debugGrid.setVisible(v);
    });
  
  fDebug
    .add(params, "showOccupancy")
    .name("Heatmap occupancy")
    .onChange((v) => {
      console.log(`Occupancy heatmap: ${v}`);
      // TODO: Implement heatmap visualization
    });
  
  fDebug
    .add(params, "showQueryCells")
    .name("Show query cells")
    .onChange((v) => {
      console.log(`Query cells highlight: ${v}`);
      // TODO: Implement query cell highlighting
    });

  // --- Folder: Orbs ---
  const fOrbs = gui.addFolder("Orbs");
  fOrbs
    .add(params, "agentCount", 0, 10000, 50)
    .name("Agent count")
    .onFinishChange((v) => {
      // rebuild only when user releases slider (prevents constant rebuild)
      if (typeof onSetAgentCount === "function") onSetAgentCount(Math.floor(v));
    });

  fOrbs
    .add(params, "orbBrightness", 0, 10, 0.1)
    .name("Brightness")
    .onChange((v) => {
      if (typeof onSetBrightness === "function") onSetBrightness(v);
    });

  // --- Folder: Environment ---
  const fEnv = gui.addFolder("Environment");
  
  // Fog intensity
  const maxFar = 900;
  const maxNear = 200;
  
  fEnv
    .add(params, "fogIntensity", 0, 100, 1)
    .name("Fog intensity")
    .onChange((intensity) => {
      if (!scene) return;
      
      const normalizedIntensity = intensity / 100;
      
      if (normalizedIntensity === 0) {
        scene.fog = null;
      } else {
        const fogFar = maxFar - (maxFar - 200) * normalizedIntensity;
        const fogNear = maxNear - (maxNear - 50) * normalizedIntensity;
        
        if (!scene.fog) {
          scene.fog = new THREE.Fog(0x1b2133, fogNear, fogFar);
        } else {
          scene.fog.near = fogNear;
          scene.fog.far = fogFar;
        }
      }
    });

  // Time of day
  fEnv
    .add(params, "timeOfDay", 0, 1, 0.01)
    .name("Time of day")
    .onChange((timeOfDay) => {
      if (dayNightCycle) {
        dayNightCycle.setTime(timeOfDay);
      }
    });

  // Time presets as buttons (using lil-gui button API)
  const presetNight = { preset: () => {
    params.timeOfDay = 0.0;
    if (dayNightCycle) dayNightCycle.setTime(0.0);
    gui.controllersRecursive().forEach(c => c.updateDisplay());
  }};
  fEnv.add(presetNight, "preset").name("🌙 Night");

  const presetDawn = { preset: () => {
    params.timeOfDay = 0.25;
    if (dayNightCycle) dayNightCycle.setTime(0.25);
    gui.controllersRecursive().forEach(c => c.updateDisplay());
  }};
  fEnv.add(presetDawn, "preset").name("🌅 Dawn");

  const presetNoon = { preset: () => {
    params.timeOfDay = 0.5;
    if (dayNightCycle) dayNightCycle.setTime(0.5);
    gui.controllersRecursive().forEach(c => c.updateDisplay());
  }};
  fEnv.add(presetNoon, "preset").name("☀️ Noon");

  const presetDusk = { preset: () => {
    params.timeOfDay = 0.75;
    if (dayNightCycle) dayNightCycle.setTime(0.75);
    gui.controllersRecursive().forEach(c => c.updateDisplay());
  }};
  fEnv.add(presetDusk, "preset").name("🌆 Dusk");

  // Optional: keep folders open initially
  fDebug.open();
  fOrbs.open();
  fEnv.open();

  return { gui, params };
}
