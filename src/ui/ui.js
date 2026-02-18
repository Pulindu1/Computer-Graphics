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
  streetLamps,
  streetDistrict,
  streetDistrict2,
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
    
    // Street Lamps
    lampsEnabled: true,
    maxLitLamps: 12,
    shadowRadius: 25.0,
    shadowsEnabled: true,
    debugLampAOI: false,
    
    // Street Districts
    districtEnabled: true,
    streetPedestriansCount: 25,
    firefliesCount: 100,
    
    // Street District 2 (separate controls)
    district2Enabled: true,
    streetPedestriansCount2: 25,
    firefliesCount2: 100,
    district2PedestrianAvoidance: 0.6,
    district2PedestrianGroupCohesion: 0.4,
    
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

  // --- Folder: Street Lamps ---
  const fLamps = gui.addFolder("Street Lamps");
  
  fLamps
    .add(params, "lampsEnabled")
    .name("Enabled")
    .onChange((v) => {
      if (streetLamps && streetLamps.poleMesh) {
        streetLamps.poleMesh.visible = v;
        streetLamps.orbMesh.visible = v;
      }
    });
  
  fLamps
    .add(params, "maxLitLamps", 4, 32, 1)
    .name("Max Active Lights")
    .onChange((v) => {
      if (streetLamps) streetLamps.maxLitLamps = v;
    });
  
  fLamps
    .add(params, "shadowRadius", 10, 60, 1)
    .name("Shadow Radius")
    .onChange((v) => {
      if (streetLamps) streetLamps.shadowRadius = v;
    });
  
  fLamps
    .add(params, "shadowsEnabled")
    .name("Shadows")
    .onChange((v) => {
      if (streetLamps) {
        streetLamps.shadowsEnabled = v;
      }
    });
  
  fLamps
    .add(params, "debugLampAOI")
    .name("Debug AOI")
    .onChange((v) => {
      if (streetLamps) {
        if (v) streetLamps.debugDrawAOI();
        else if (streetLamps._debugGroup) {
          streetLamps.scene.remove(streetLamps._debugGroup);
          streetLamps._debugGroup = null;
        }
      }
    });
  
  // Lamp stats display (add to bottom of HUD)
  const lampStatsDisplay = document.createElement("div");
  lampStatsDisplay.id = "lamp-stats";
  lampStatsDisplay.style.cssText = "position:fixed; bottom:10px; right:10px; background:rgba(0,0,0,0.7); color:#ff0; font-family:monospace; padding:10px; font-size:12px; z-index:999;";
  document.body.appendChild(lampStatsDisplay);

  window.updateLampStats = () => {
    if (streetLamps) {
      const stats = streetLamps.getStats();
      lampStatsDisplay.innerHTML = `
        <b>Street Lamps</b><br>
        Total: ${stats.lampCount}<br>
        Active Lights: ${stats.litLampCount}<br>
        Shadow Lights: ${stats.shadowLampCount}
      `;
    }
  };

  // --- Folder: Street District (Hill 1) ---
  const fDistrict = gui.addFolder("Street District 1");
  
  fDistrict
    .add(params, "districtEnabled")
    .name("Enabled")
    .onChange((v) => {
      if (streetDistrict) {
        streetDistrict.setEnabled(v);
      }
    });
  
  fDistrict
    .add(params, "streetPedestriansCount", 0, 100, 1)
    .name("Pedestrians")
    .onChange((v) => {
      if (streetDistrict) {
        streetDistrict.setStreetPedestriansPopulation(Math.floor(v));
      }
      // Also apply to District 2 (same population count for both)
      if (streetDistrict2) {
        streetDistrict2.setStreetPedestriansPopulation(Math.floor(v));
      }
    });
  
  fDistrict
    .add(params, "firefliesCount", 0, 400, 1)
    .name("Fireflies")
    .onChange((v) => {
      if (streetDistrict) {
        streetDistrict.setFirefliesPopulation(Math.floor(v));
      }
      // Also apply to District 2 (same firefly count for both)
      if (streetDistrict2) {
        streetDistrict2.setFirefliesPopulation(Math.floor(v));
      }
    });

  // --- Folder: Street District (Hill 2) - Independent Behavior Controls ---
  const fDistrict2 = gui.addFolder("Street District 2");
  
  fDistrict2
    .add(params, "district2Enabled")
    .name("Enabled")
    .onChange((v) => {
      if (streetDistrict2) {
        streetDistrict2.setEnabled(v);
      }
    });
  
  // Note: Population is controlled by District 1 slider above
  fDistrict2
    .add(params, "district2PedestrianAvoidance", 0, 2.0, 0.1)
    .name("Pedestrian Avoidance")
    .onChange((v) => {
      if (streetDistrict2 && streetDistrict2.streetPedestrians) {
        streetDistrict2.streetPedestrians.params.avoidPedestrians = v;
      }
    });
  
  fDistrict2
    .add(params, "district2PedestrianGroupCohesion", 0, 1.0, 0.05)
    .name("Group Cohesion")
    .onChange((v) => {
      if (streetDistrict2 && streetDistrict2.streetPedestrians) {
        streetDistrict2.streetPedestrians.params.groupCohesion = v;
      }
    });

  // --- Folder: Post-Processing (Topic 5: Signal Processing + Aliasing) ---
  const fPost = gui.addFolder("Post-Processing");
  
  // STEP 7: Add post-processing parameters to params object
  // Note: Initial values pulled from bloomConfig in main.js
  params.enablePost = true;
  params.enableBloom = true;
  params.enableFXAA = true;
  params.bloomStrength = 0.8;      // Start with tuned "Light Festival" value
  params.bloomThreshold = 0.3;     // Only bright pixels bloom
  params.bloomRadius = 0.4;        // Moderate blur spread
  params.showComparison = false;   // A/B toggle for post vs raw

  fPost
    .add(params, "enablePost")
    .name("Enable All Post-Processing")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setEnablePost(v);
      }
    });
  
  // STEP 7: Bloom on/off toggle
  fPost
    .add(params, "enableBloom")
    .name("Bloom (Optics Glow)")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setEnableBloom(v);
      }
    });
  
  // STEP 6: Bloom strength slider (tuned to prevent "washing out")
  fPost
    .add(params, "bloomStrength", 0.1, 2.0, 0.1)
    .name("  └ Strength")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setBloomStrength(v);
      }
    });
  
  // STEP 6: Bloom threshold slider (isolates which regions bloom)
  fPost
    .add(params, "bloomThreshold", 0.0, 1.0, 0.05)
    .name("  └ Threshold")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setBloomThreshold(v);
      }
    });
  
  // STEP 6: Bloom radius slider (blur spread)
  fPost
    .add(params, "bloomRadius", 0.1, 1.5, 0.1)
    .name("  └ Radius")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setBloomRadius(v);
      }
    });
  
  // STEP 7: FXAA anti-aliasing toggle
  fPost
    .add(params, "enableFXAA")
    .name("FXAA Anti-Aliasing")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setEnableFXAA(v);
      }
    });

  // STEP 7: Performance comparison note
  const postInfoDiv = document.createElement("div");
  postInfoDiv.id = "post-info";
  postInfoDiv.style.cssText = "margin:8px 0; padding:8px; background:rgba(0,100,200,0.2); border-left:3px solid #0099ff; font-size:11px; line-height:1.4;";
  postInfoDiv.innerHTML = `
    <b>Signal Processing Pipeline</b><br>
    • Bloom: Gaussian blur on bright pixels<br>
    • FXAA: Edge-aware reconstruction filter<br>
    <em>Trade-off: Quality vs Performance</em>
  `;
  // Append to gui controller element (if possible, or just log)
  
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
