
import * as THREE from "three";



// Distance thresholds (squared to avoid sqrt per frame)
const NEAR_IN_SQ = 5 * 5;     // Enter NEAR at 5m
const NEAR_OUT_SQ = 7 * 7;    // Exit NEAR at 7m (hysteresis 2m)
const MID_IN_SQ = 7 * 7;      // Enter MID at 7m
const MID_OUT_SQ = 10 * 10;   // Exit MID at 10m

const MID_RATE = 4; 

/**
 * Main animation LOD function - call once per agent per frame
 * @param {Object} agent - Agent with mesh, parts, userData properties
 * @param {number} time - Current time in seconds
 * @param {THREE.Vector3} cameraPos - Camera position for distance calc
 * @param {Object} params - Override parameters {NEAR_IN_SQ, NEAR_OUT_SQ, MID_RATE, ...}
 * @param {boolean} enabled - Whether to use LOD (if false, always use full animation)
 */
export function animateHumanoidLOD(agent, time, cameraPos, params = {}, enabled = true) {
  const { parts, mesh } = agent;
  

  if (!agent || !parts || !mesh) {
    console.warn("[animationLOD] Invalid agent structure:", { hasAgent: !!agent, hasParts: !!parts, hasMesh: !!mesh });
    return;
  }
  
  // Ensure userData object exists
  if (!agent.userData) {
    agent.userData = {};
  }
  const userData = agent.userData;
  
  // Merge with defaults
  const config = {
    NEAR_IN_SQ: params.NEAR_IN_SQ ?? NEAR_IN_SQ,
    NEAR_OUT_SQ: params.NEAR_OUT_SQ ?? NEAR_OUT_SQ,
    MID_IN_SQ: params.MID_IN_SQ ?? MID_IN_SQ,
    MID_OUT_SQ: params.MID_OUT_SQ ?? MID_OUT_SQ,
    MID_RATE: params.MID_RATE ?? MID_RATE,
  };
  
  // Initialize per-agent LOD state on first call
  if (userData.animTier === undefined) {
    userData.animTier = 0;
    userData.animPhase = 0;
    userData.animStagger = Math.random() * config.MID_RATE | 0;
    userData.prevTier = -1;
    userData.lastNeutralPoseTime = -999;
    userData.initDebugLogged = true;
    console.log("[AnimLOD] Agent initialized. enabled:", enabled, "hasCamera:", !!cameraPos, "mode:", agent.mode, "vel:", agent.vel?.length?.() ?? 'no vel');
  }
  
  // If LOD disabled or no camera available, always use full animation
  if (!enabled || !cameraPos) {
    if (userData.debugNoCamera === undefined) {
      userData.debugNoCamera = true;
      console.log("[AnimLOD] Using full animation fallback. enabled:", enabled, "cameraPos:", cameraPos);
    }
    animateHumanoidFull(agent, time);
    userData.animTier = 0;
    return;
  }
  
  // Compute squared distance from mesh to camera
  const dx = mesh.position.x - cameraPos.x;
  const dz = mesh.position.z - cameraPos.z;
  const d2 = dx * dx + dz * dz;
  
  // Update tier based on hysteresis thresholds
  if (d2 < config.NEAR_IN_SQ) {
    // Clearly close - use NEAR
    userData.animTier = 0;
  } else if (d2 > config.NEAR_OUT_SQ) {
    // Clearly far - check if MID or FAR
    userData.animTier = (d2 >= config.MID_OUT_SQ) ? 2 : 1;
  }
  // Otherwise keep current tier (hysteresis prevents oscillation)
  
  // Apply animation based on tier
  if (userData.animTier === 0) {

    animateHumanoidFull(agent, time);
  } else if (userData.animTier === 1) {

    if ((userData.animPhase % config.MID_RATE) === userData.animStagger) {
      animateHumanoidFull(agent, time);
    }
    userData.animPhase++;
  } else {

    if (userData.prevTier !== 2) {
      setNeutralPose(parts);
      mesh.position.y = agent.pos.y;
      userData.lastNeutralPoseTime = time;
    }
    

    if (agent.vel && typeof agent.vel.length === 'function' && agent.vel.length() > 0.001) {
      const targetAngle = Math.atan2(agent.vel.x, agent.vel.z);
      cheapFace(mesh, targetAngle, 0.15);
    }

    mesh.position.x = agent.pos.x;
    mesh.position.z = agent.pos.z;
  }
  

  userData.prevTier = userData.animTier;
}


function animateHumanoidFull(agent, time) {
  const { parts, mesh } = agent;
  

  const speed = agent.vel ? agent.vel.length() : 0;
  const isWalking = agent.mode === 1 || agent.mode === 2;
  

  if (!agent.userData?.fullAnimDebugLogged) {
    if (!agent.userData) agent.userData = {};
    agent.userData.fullAnimDebugLogged = true;
    console.log("[AnimFull] First call - mode:", agent.mode, "speed:", speed, "isWalking:", isWalking);
  }

  if ((isWalking || speed > 0.001) && agent.vel) {
    const targetAngle = Math.atan2(agent.vel.x, agent.vel.z);
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), 
      targetAngle
    );
    mesh.quaternion.slerp(targetQuat, 0.2);
  }
  

  if (isWalking) {
    const walkFreq = 2.0 + speed * 5.0;
    const phase = time * walkFreq;
    

    const legSwing = Math.sin(phase) * 0.6;
    parts.lLeg.rotation.x = legSwing;
    parts.rLeg.rotation.x = -legSwing;
    

    const armSwing = Math.sin(phase) * 0.5;
    parts.lArm.rotation.x = -armSwing;
    parts.rArm.rotation.x = armSwing;
    

    const bob = Math.abs(Math.sin(phase * 2)) * (0.05 + speed * 0.15);
    mesh.position.y = agent.pos.y + bob;
  } else {
    parts.lLeg.rotation.x *= 0.95;
    parts.rLeg.rotation.x *= 0.95;
    parts.lArm.rotation.x *= 0.95;
    parts.rArm.rotation.x *= 0.95;
    mesh.position.y = agent.pos.y;
  }
  

  mesh.position.x = agent.pos.x;
  mesh.position.z = agent.pos.z;
}


export function setNeutralPose(parts) {
  parts.lLeg.rotation.x = 0;
  parts.rLeg.rotation.x = 0;
  parts.lArm.rotation.x = 0;
  parts.rArm.rotation.x = 0;
}


export function cheapFace(mesh, targetAngle, alpha = 0.2) {
  const targetQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    targetAngle
  );
  mesh.quaternion.slerp(targetQuat, alpha);
}


export function convertDistancesToSquared(distances = {}) {
  const {
    nearInDist = 5,
    nearOutDist = 7,
    midOutDist = 10,
  } = distances;
  
  return {
    NEAR_IN_SQ: nearInDist * nearInDist,
    NEAR_OUT_SQ: nearOutDist * nearOutDist,
    MID_IN_SQ: nearOutDist * nearOutDist,
    MID_OUT_SQ: midOutDist * midOutDist,
  };
}


export function getTierName(tier) {
  return ['NEAR', 'MID', 'FAR'][tier] ?? 'UNKNOWN';
}


export function getAnimLODState(agent) {
  const { userData } = agent;
  return {
    tier: getTierName(userData.animTier),
    tierValue: userData.animTier,
    phase: userData.animPhase,
    stagger: userData.animStagger,
  };
}
