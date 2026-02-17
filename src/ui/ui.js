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
  heatmap,
  queryCellOverlay,
  scene,
  dayNightCycle,
  getAgentCount,
  onSetAgentCount,
  getBrightness,
  onSetBrightness,
  crowdManager,
  leftWalkway,
  rightWalkway,
  getPeopleCount,
  onSetPeopleCount,
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
    
    // People (Crowd)
    peopleCount: typeof getPeopleCount === "function" ? getPeopleCount() : 40,
    
    // --- Phase 1: Flow-field & Advanced Crowd ---
    enableFlowField: true,
    enableLanes: true,
    enablePriority: true,
    flowWeight: 1.5,
    laneWeight: 1.0,
    crowdSeparation: true,
    separationWeight: 1.5,
    crowdAlignment: false,
    alignmentWeight: 0.3,
    crowdCohesion: false,
    cohesionWeight: 0.2,
    crowdQueue: true,
    queueWeight: 0.5,
    wanderWeight: 0.3,
    
    // Stress test modes
    stressTest: 40,
    
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
    .name("Heatmap occupancy");
  
  fDebug
    .add(params, "showQueryCells")
    .name("Show query cells");

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

  // --- Folder: People (Crowd) ---
  const fPeople = gui.addFolder("People");
  
  fPeople
    .add(params, "peopleCount", 0, 200, 1)
    .name("People count")
    .onFinishChange((v) => {
      if (typeof onSetPeopleCount === "function") onSetPeopleCount(Math.floor(v));
    });
  
  // Behavior toggles
  fPeople
    .add(params, "crowdSeparation")
    .name("Separation")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.sep = v ? params.separationWeight : 0;
      if (rightWalkway) rightWalkway.weights.sep = v ? params.separationWeight : 0;
    });
  
  fPeople
    .add(params, "separationWeight", 0, 3, 0.1)
    .name("  └ Weight")
    .onChange((v) => {
      if (params.crowdSeparation) {
        if (leftWalkway) leftWalkway.weights.sep = v;
        if (rightWalkway) rightWalkway.weights.sep = v;
      }
    });
  
  fPeople
    .add(params, "crowdAlignment")
    .name("Alignment")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.ali = v ? params.alignmentWeight : 0;
      if (rightWalkway) rightWalkway.weights.ali = v ? params.alignmentWeight : 0;
    });
  
  fPeople
    .add(params, "alignmentWeight", 0, 3, 0.1)
    .name("  └ Weight")
    .onChange((v) => {
      if (params.crowdAlignment) {
        if (leftWalkway) leftWalkway.weights.ali = v;
        if (rightWalkway) rightWalkway.weights.ali = v;
      }
    });
  
  fPeople
    .add(params, "crowdCohesion")
    .name("Cohesion")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.coh = v ? params.cohesionWeight : 0;
      if (rightWalkway) rightWalkway.weights.coh = v ? params.cohesionWeight : 0;
    });
  
  fPeople
    .add(params, "cohesionWeight", 0, 3, 0.1)
    .name("  └ Weight")
    .onChange((v) => {
      if (params.crowdCohesion) {
        if (leftWalkway) leftWalkway.weights.coh = v;
        if (rightWalkway) rightWalkway.weights.coh = v;
      }
    });
  
  fPeople
    .add(params, "crowdQueue")
    .name("Queueing")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.queue = v ? params.queueWeight : 0;
      if (rightWalkway) rightWalkway.weights.queue = v ? params.queueWeight : 0;
    });
  
  fPeople
    .add(params, "queueWeight", 0, 3, 0.1)
    .name("  └ Weight")
    .onChange((v) => {
      if (params.crowdQueue) {
        if (leftWalkway) leftWalkway.weights.queue = v;
        if (rightWalkway) rightWalkway.weights.queue = v;
      }
    });

  // ─────────────────────── Phase 1: Advanced Crowd Controls ──────────────────────
  const fCrowdAdv = gui.addFolder("Crowd (Phase 1)");

  // Feature toggles
  fCrowdAdv
    .add(params, "enableFlowField")
    .name("Flow-Field")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.enableFlowField = v;
      if (rightWalkway) rightWalkway.enableFlowField = v;
    });

  fCrowdAdv
    .add(params, "enableLanes")
    .name("Two-Lane Rules")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.enableLanes = v;
      if (rightWalkway) rightWalkway.enableLanes = v;
    });

  fCrowdAdv
    .add(params, "enablePriority")
    .name("Prioritized Dithering")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.enablePriority = v;
      if (rightWalkway) rightWalkway.enablePriority = v;
    });

  // Weight sliders for Phase 1
  fCrowdAdv
    .add(params, "flowWeight", 0, 3, 0.1)
    .name("Flow Weight")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.flow = v;
      if (rightWalkway) rightWalkway.weights.flow = v;
    });

  fCrowdAdv
    .add(params, "laneWeight", 0, 3, 0.1)
    .name("Lane Weight")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.lane = v;
      if (rightWalkway) rightWalkway.weights.lane = v;
    });

  fCrowdAdv
    .add(params, "wanderWeight", 0, 1, 0.05)
    .name("Wander Weight")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.weights.wander = v;
      if (rightWalkway) rightWalkway.weights.wander = v;
    });

  // Stress test buttons
  fCrowdAdv.add({
    spawn100: () => {
      if (crowdManager) {
        crowdManager.spawnInZone(0, 50);
        crowdManager.spawnInZone(1, 50);
      }
    }
  }, "spawn100").name("Spawn 100 (50/zone)");

  fCrowdAdv.add({
    spawn500: () => {
      if (crowdManager) {
        crowdManager.spawnInZone(0, 250);
        crowdManager.spawnInZone(1, 250);
      }
    }
  }, "spawn500").name("Spawn 500 (250/zone)");

  fCrowdAdv.add({
    spawn1000: () => {
      if (crowdManager) {
        crowdManager.spawnInZone(0, 500);
        crowdManager.spawnInZone(1, 500);
      }
    }
  }, "spawn1000").name("Spawn 1000 (500/zone)");

  fCrowdAdv.add({
    spawn2000: () => {
      if (crowdManager) {
        crowdManager.spawnInZone(0, 1000);
        crowdManager.spawnInZone(1, 1000);
      }
    }
  }, "spawn2000").name("Spawn 2000 (1000/zone)");

  // Leader spawning
  fCrowdAdv.add({
    spawnLeaders: () => {
      if (crowdManager) {
        crowdManager.spawnLeaders(0, 2);
        crowdManager.spawnLeaders(1, 2);
      }
    }
  }, "spawnLeaders").name("Add Leaders (2/zone)");

  // Clear all
  fCrowdAdv.add({
    clearAll: () => {
      if (crowdManager) {
        for (let i = 0; i < crowdManager.zones.length; i++) {
          crowdManager.removeFromZone(i, 10000);
        }
      }
    }
  }, "clearAll").name("🗑️ Clear All");

  // Debug stats display
  const statsDisplay = document.createElement("div");
  statsDisplay.id = "crowd-stats";
  statsDisplay.style.cssText = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.7); color:#0f0; font-family:monospace; padding:10px; font-size:12px; z-index:999;";
  document.body.appendChild(statsDisplay);

  // Update stats every frame (will be called from main loop)
  window.updateCrowdStats = () => {
    if (crowdManager) {
      const stats = crowdManager.stats;
      statsDisplay.innerHTML = `
        <b>Crowd Stats</b><br>
        Agents: ${stats.totalAgents}<br>
        Queries: ${stats.totalQueries}<br>
        Avg Neighbors: ${stats.avgNeighborsPerQuery.toFixed(1)}
      `;
    }
  };

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
  fPeople.open();
  fEnv.open();

  return { gui, params };
}
