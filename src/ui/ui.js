
import { GUI } from "lil-gui";
import * as THREE from "three";
import { addTreesFolder } from "./treesFolder.js";


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
  bezierBlanket,
  treeSystem,
  vegetationSystem,
} = {}) {
  const gui = new GUI({ title: "Swarm Controls" });

  const params = {

    neighborMode: "hash",
    showSpatialGrid: true,
    showOccupancy: false,
    showQueryCells: false,
    showQueryProof: false,
    selectedAgentId: -1,
    agentNeighborRadius: 10,
    cellSize: 20,
    
    // Orbs
    agentCount: typeof getAgentCount === "function" ? getAgentCount() : 300,
    orbBrightness: typeof getBrightness === "function" ? getBrightness() : 2.0,
    
    // People (Crowd)
    peopleCount: typeof getPeopleCount === "function" ? getPeopleCount() : 40,
    
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
    
 
    stressTest: 40,
    

    lampsEnabled: true,
    maxLitLamps: 12,
    shadowRadius: 25.0,
    shadowsEnabled: true,
    debugLampAOI: false,
    
    districtEnabled: true,
    streetPedestriansCount: 250,
    firefliesCount: 100,
    lightCubesEnabled: true,
    
    rocksVisible: true,
    blanketVisible: true,
    lightCubesIntensity: 2.5,
    
    district2Enabled: true,
    streetPedestriansCount2: 250,
    firefliesCount2: 100,
    district2PedestrianAvoidance: 0.6,
    district2PedestrianGroupCohesion: 0.4,
    
    canopyEnabled: true,
    canopyWaveAmp: 12.0,
    canopyWaveSpeed: 2.5,
    canopyWaveLen: 6.0,
    canopyDrapeAmp: 8.0,
    canopyEmissiveIntensity: 3.5,
    canopyOpacity: 0.85,
    canopyShowLattice: false,
    
    fogIntensity: 0,
    timeOfDay: 0.5,
  };


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

  fDebug
    .add(params, "showQueryProof")
    .name("3x3 Query Proof");

  const fOrbs = gui.addFolder("Orbs");
  fOrbs
    .add(params, "agentCount", 0, 10000, 50)
    .name("Agent count")
    .onFinishChange((v) => {
      if (typeof onSetAgentCount === "function") onSetAgentCount(Math.floor(v));
    });

  fOrbs
    .add(params, "orbBrightness", 0, 10, 0.1)
    .name("Brightness")
    .onChange((v) => {
      if (typeof onSetBrightness === "function") onSetBrightness(v);
    });

  const fPeople = gui.addFolder("People");
  
  fPeople
    .add(params, "peopleCount", 0, 1100, 1)
    .name("People count")
    .onFinishChange((v) => {
      if (typeof onSetPeopleCount === "function") onSetPeopleCount(Math.floor(v));
    });
  
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


  const fCrowdAdv = gui.addFolder("Crowd (Phase 1)");


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


  fCrowdAdv.add({
    spawnLeaders: () => {
      if (crowdManager) {
        crowdManager.spawnLeaders(0, 2);
        crowdManager.spawnLeaders(1, 2);
      }
    }
  }, "spawnLeaders").name("Add Leaders (2/zone)");


  fCrowdAdv.add({
    clearAll: () => {
      if (crowdManager) {
        for (let i = 0; i < crowdManager.zones.length; i++) {
          crowdManager.removeFromZone(i, 10000);
        }
      }
    }
  }, "clearAll").name("🗑️ Clear All");


  const fAnimLOD = gui.addFolder("Animation LOD");

 
  params.animationLODEnabled = true;
  params.animationMidRate = 4;
  params.animationNearDist = 50;
  params.animationMidDist = 150;


  const initialLodParams = {
    NEAR_IN_SQ: params.animationNearDist * params.animationNearDist,
    NEAR_OUT_SQ: (params.animationNearDist + 20) * (params.animationNearDist + 20),
    MID_IN_SQ: (params.animationNearDist + 20) * (params.animationNearDist + 20),
    MID_OUT_SQ: params.animationMidDist * params.animationMidDist,
    MID_RATE: params.animationMidRate,
  };
  
  if (leftWalkway) leftWalkway.setAnimationLODParams(initialLodParams);
  if (rightWalkway) rightWalkway.setAnimationLODParams(initialLodParams);
  if (streetDistrict) streetDistrict.setAnimationLODParams(initialLodParams);
  if (streetDistrict2) streetDistrict2.setAnimationLODParams(initialLodParams);

  fAnimLOD
    .add(params, "animationLODEnabled")
    .name("Enabled")
    .onChange((v) => {
      if (leftWalkway) leftWalkway.setAnimationLODEnabled(v);
      if (rightWalkway) rightWalkway.setAnimationLODEnabled(v);
      if (streetDistrict) streetDistrict.setAnimationLODEnabled(v);
      if (streetDistrict2) streetDistrict2.setAnimationLODEnabled(v);
    });

  fAnimLOD
    .add(params, "animationMidRate", 2, 8, 1)
    .name("MID Rate (frames)")
    .onChange((v) => {
      const lodParams = { MID_RATE: v };
      if (leftWalkway) leftWalkway.setAnimationLODParams(lodParams);
      if (rightWalkway) rightWalkway.setAnimationLODParams(lodParams);
      if (streetDistrict) streetDistrict.setAnimationLODParams(lodParams);
      if (streetDistrict2) streetDistrict2.setAnimationLODParams(lodParams);
    });

  fAnimLOD
    .add(params, "animationNearDist", 5, 30, 1)
    .name("NEAR Distance (m)")
    .onChange((v) => {
      const lodParams = {
        NEAR_IN_SQ: v * v,
        NEAR_OUT_SQ: (v + 10) * (v + 10),
        MID_IN_SQ: (v + 10) * (v + 10),
      };
      if (leftWalkway) leftWalkway.setAnimationLODParams(lodParams);
      if (rightWalkway) rightWalkway.setAnimationLODParams(lodParams);
      if (streetDistrict) streetDistrict.setAnimationLODParams(lodParams);
      if (streetDistrict2) streetDistrict2.setAnimationLODParams(lodParams);
    });

  fAnimLOD
    .add(params, "animationMidDist", 20, 100, 5)
    .name("MID Distance (m)")
    .onChange((v) => {
      const lodParams = { MID_OUT_SQ: v * v };
      if (leftWalkway) leftWalkway.setAnimationLODParams(lodParams);
      if (rightWalkway) rightWalkway.setAnimationLODParams(lodParams);
      if (streetDistrict) streetDistrict.setAnimationLODParams(lodParams);
      if (streetDistrict2) streetDistrict2.setAnimationLODParams(lodParams);
    });

  const fSpatial = gui.addFolder("Spatial Index");
  params.spatialIndexMode = "hash"; // "hash" | "quadtree"

  fSpatial
    .add(params, "spatialIndexMode", ["hash", "quadtree"])
    .name("Mode")
    .onChange((v) => {
      if (leftWalkway)    leftWalkway.setSpatialIndexMode(v);
      if (rightWalkway)   rightWalkway.setSpatialIndexMode(v);
      if (streetDistrict)  streetDistrict.setSpatialIndexMode(v);
      if (streetDistrict2) streetDistrict2.setSpatialIndexMode(v);
    });


  const statsDisplay = document.createElement("div");
  statsDisplay.id = "crowd-stats";
  statsDisplay.style.cssText = [
    "position:fixed", "top:10px", "right:10px",
    "background:rgba(0,0,0,0.75)", "color:#0f0",
    "font-family:monospace", "padding:10px 14px",
    "font-size:11px", "z-index:999", "line-height:1.6",
    "min-width:220px", "border:1px solid #0a0",
  ].join(";");
  document.body.appendChild(statsDisplay);


  window.updateCrowdStats = () => {

    const walkL  = leftWalkway  ? leftWalkway.agents.length  : 0;
    const walkR  = rightWalkway ? rightWalkway.agents.length : 0;
    const totalPed = walkL + walkR;


    const sources = [
      leftWalkway  ? leftWalkway.grid.stats    : null,
      rightWalkway ? rightWalkway.grid.stats   : null,
      streetDistrict  ? streetDistrict.spatialStats  : null,
      streetDistrict2 ? streetDistrict2.spatialStats : null,
    ].filter(Boolean);

    const mode = params.spatialIndexMode;

    let buildMs = 0, queryMs = 0, candidatesAvg = 0, nodesAvg = 0;
    let nodeCount = 0, maxDepth = 0;
    let n = 0;
    for (const s of sources) {
      buildMs      += s.buildMs     ?? 0;
      queryMs      += s.queryMs     ?? 0;
      candidatesAvg += s.candidatesAvg ?? 0;
      n++;
      if (mode === "quadtree") {
        nodesAvg  += isNaN(s.nodesVisitedAvg) ? 0 : s.nodesVisitedAvg;
        nodeCount += isNaN(s.nodeCount)        ? 0 : s.nodeCount;
        maxDepth   = Math.max(maxDepth, isNaN(s.maxDepthReached) ? 0 : s.maxDepthReached);
      }
    }
    if (n > 0) candidatesAvg /= n;
    if (n > 0) nodesAvg      /= n;

    const qtRows = mode === "quadtree" ? `
      Nodes visited/q: ${nodesAvg.toFixed(1)}<br>
      Tree nodes:      ${nodeCount}<br>
      Max depth:       ${maxDepth}` : "";

    statsDisplay.innerHTML = `
      <b>Spatial Index</b> [${mode}]<br>
      ─────────────────<br>
      Walkway agents:  ${walkL} + ${walkR}<br>
      Build time:      ${buildMs.toFixed(2)} ms<br>
      Query time:      ${queryMs.toFixed(2)} ms<br>
      Candidates/q:    ${candidatesAvg.toFixed(1)}${qtRows}
    `;
  };

 
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

      if (streetDistrict2) {
        streetDistrict2.setFirefliesPopulation(Math.floor(v));
      }
    });

  fDistrict
    .add(params, "lightCubesEnabled")
    .name("Light Cubes")
    .onChange((v) => {
      if (streetDistrict?.lightCubes) {
        streetDistrict.lightCubes.setEnabled(v);
      }
      if (streetDistrict2?.lightCubes) {
        streetDistrict2.lightCubes.setEnabled(v);
      }
    });

  fDistrict
    .add(params, "lightCubesIntensity", 0.5, 5, 0.1)
    .name("Light Intensity")
    .onChange((v) => {
      if (streetDistrict?.lightCubes) {
        for (const cube of streetDistrict.lightCubes.cubes) {
          cube.mesh.material.emissiveIntensity = v;
          cube.haloBrightMesh.material.emissiveIntensity = v * 0.6;
        }
      }
      if (streetDistrict2?.lightCubes) {
        for (const cube of streetDistrict2.lightCubes.cubes) {
          cube.mesh.material.emissiveIntensity = v;
          cube.haloBrightMesh.material.emissiveIntensity = v * 0.6;
        }
      }
    });


  const fDistrict2 = gui.addFolder("Street District 2");
  
  fDistrict2
    .add(params, "district2Enabled")
    .name("Enabled")
    .onChange((v) => {
      if (streetDistrict2) {
        streetDistrict2.setEnabled(v);
      }
    });
  

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

  const fCanopy = gui.addFolder("Street 2 Canopy");
  
  fCanopy
    .add(params, "canopyEnabled")
    .name("Enabled")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setEnabled(v);
    });
  
  fCanopy
    .add(params, "canopyWaveAmp", 1.0, 12.0, 0.2)
    .name("Wave Amplitude")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setParams({ waveAmp: v });
    });
  
  fCanopy
    .add(params, "canopyWaveSpeed", 0.2, 4.0, 0.1)
    .name("Wave Speed")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setParams({ waveSpeed: v });
    });
  
  fCanopy
    .add(params, "canopyWaveLen", 2.0, 32.0, 0.5)
    .name("Wave Length")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setParams({ waveLen: v });
    });
  
  fCanopy
    .add(params, "canopyDrapeAmp", 0.0, 12.0, 0.2)
    .name("Drape Amount")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setParams({ drapeAmp: v });
    });
  
  fCanopy
    .add(params, "canopyEmissiveIntensity", 0.0, 8.0, 0.2)
    .name("Emissive Intensity")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setParams({ emissiveIntensity: v });
    });
  
  fCanopy
    .add(params, "canopyOpacity", 0.3, 1.0, 0.05)
    .name("Opacity")
    .onChange((v) => {
      if (bezierBlanket) bezierBlanket.setParams({ opacity: v });
    });
  
  fCanopy
    .add(params, "canopyShowLattice")
    .name("Show Control Lattice")
    .onChange((v) => {
      if (bezierBlanket) {
        if (v) bezierBlanket.drawControlLattice();
        else bezierBlanket.hideControlLattice();
      }
    });

  const fPost = gui.addFolder("Post-Processing");
  

  params.enablePost = true;
  params.enableBloom = true;
  params.enableFXAA = true;
  params.bloomStrength = 0.8;
  params.bloomThreshold = 0.3;
  params.bloomRadius = 0.4;
  params.showComparison = false; 

  fPost
    .add(params, "enablePost")
    .name("Enable All Post-Processing")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setEnablePost(v);
      }
    });
  

  fPost
    .add(params, "enableBloom")
    .name("Bloom (Optics Glow)")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setEnableBloom(v);
      }
    });
  

  fPost
    .add(params, "bloomStrength", 0.1, 2.0, 0.1)
    .name("  └ Strength")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setBloomStrength(v);
      }
    });
  
  fPost
    .add(params, "bloomThreshold", 0.0, 1.0, 0.05)
    .name("  └ Threshold")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setBloomThreshold(v);
      }
    });
  

  fPost
    .add(params, "bloomRadius", 0.1, 1.5, 0.1)
    .name("  └ Radius")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setBloomRadius(v);
      }
    });
  
  fPost
    .add(params, "enableFXAA")
    .name("FXAA Anti-Aliasing")
    .onChange((v) => {
      if (window.postProcessingAPI) {
        window.postProcessingAPI.setEnableFXAA(v);
      }
    });


  const postInfoDiv = document.createElement("div");
  postInfoDiv.id = "post-info";
  postInfoDiv.style.cssText = "margin:8px 0; padding:8px; background:rgba(0,100,200,0.2); border-left:3px solid #0099ff; font-size:11px; line-height:1.4;";
  postInfoDiv.innerHTML = `
    <b>Signal Processing Pipeline</b><br>
    • Bloom: Gaussian blur on bright pixels<br>
    • FXAA: Edge-aware reconstruction filter<br>
    <em>Trade-off: Quality vs Performance</em>
  `;

  const fEnv = gui.addFolder("Environment");
  

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


  fEnv
    .add(params, "timeOfDay", 0, 1, 0.01)
    .name("Time of day")
    .onChange((timeOfDay) => {
      if (dayNightCycle) {
        dayNightCycle.setTime(timeOfDay);
      }
    });


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


  fDebug.open();
  fOrbs.open();
  fPeople.open();
  fEnv.open();


  if (treeSystem) {
    addTreesFolder(gui, treeSystem, params);
  }


  const envFolder = gui.addFolder("Environment Visibility");
  

  if (vegetationSystem) {
    envFolder.add(params, "rocksVisible")
      .name("Rocks")
      .onChange((visible) => {
        vegetationSystem.setVisible(visible);
      });
  }
  
  if (bezierBlanket) {
    envFolder.add(params, "blanketVisible")
      .name("Glowing Blanket")
      .onChange((visible) => {
        bezierBlanket.mesh.visible = visible;
      });
  }

  return { gui, params };
}
