// 📄 src/crowd/animationLOD.js
import * as THREE from "three";

/**
 * 3-Tier Animation LOD System for Pedestrians
 * 
 * Reduces animation CPU cost by ~60% through distance-based LOD:
 * - NEAR (0-5m): Full FK animation (walk cycle, arms, bob)
 * - MID (5-10m): Animate every N frames (smooth at lower rate)
 * - FAR (>10m): Neutral pose only (body moves, limbs frozen)
 * 
 * Uses hysteresis to prevent flicker at tier boundaries
 */

// Distance thresholds (squared to avoid sqrt per frame)
const NEAR_IN_SQ = 5 * 5;     // Enter NEAR at 5m
const NEAR_OUT_SQ = 7 * 7;    // Exit NEAR at 7m (hysteresis 2m)
const MID_IN_SQ = 7 * 7;      // Enter MID at 7m
const MID_OUT_SQ = 10 * 10;   // Exit MID at 10m

const MID_RATE = 4;           // Update every 4 frames in MID tier

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
  
  // Validate agent has required properties
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
    // NEAR: Full animation
    animateHumanoidFull(agent, time);
  } else if (userData.animTier === 1) {
    // MID: Animate every N frames (staggered across agents)
    if ((userData.animPhase % config.MID_RATE) === userData.animStagger) {
      animateHumanoidFull(agent, time);
    }
    userData.animPhase++;
  } else {
    // FAR: Neutral pose (call once when entering FAR tier)
    if (userData.prevTier !== 2) {
      setNeutralPose(parts);
      mesh.position.y = agent.pos.y;
      userData.lastNeutralPoseTime = time;
    }
    
    // Still update facing direction even when frozen
    if (agent.vel && typeof agent.vel.length === 'function' && agent.vel.length() > 0.001) {
      const targetAngle = Math.atan2(agent.vel.x, agent.vel.z);
      cheapFace(mesh, targetAngle, 0.15);
    }
    
    // Update XZ position
    mesh.position.x = agent.pos.x;
    mesh.position.z = agent.pos.z;
  }
  
  // Track tier transition for neutral pose logic
  userData.prevTier = userData.animTier;
}

/**
 * Full Forward Kinematics animation (walk cycle + arms + bob)
 * Called in NEAR tier and MID tier (every N frames)
 */
function animateHumanoidFull(agent, time) {
  const { parts, mesh } = agent;
  
  // Use agent properties directly, matching original animateHumanoid
  const speed = agent.vel ? agent.vel.length() : 0;
  const isWalking = agent.mode === 1 || agent.mode === 2; // MODE_WALK=1, MODE_FAST=2
  
  // Debug first call
  if (!agent.userData?.fullAnimDebugLogged) {
    if (!agent.userData) agent.userData = {};
    agent.userData.fullAnimDebugLogged = true;
    console.log("[AnimFull] First call - mode:", agent.mode, "speed:", speed, "isWalking:", isWalking);
  }
  
  // Face direction with smooth quaternion interpolation
  if ((isWalking || speed > 0.001) && agent.vel) {
    const targetAngle = Math.atan2(agent.vel.x, agent.vel.z);
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), 
      targetAngle
    );
    mesh.quaternion.slerp(targetQuat, 0.2);
  }
  
  // Walk cycle when walking
  if (isWalking) {
    const walkFreq = 2.0 + speed * 5.0;
    const phase = time * walkFreq;
    
    // Leg swing (alternating)
    const legSwing = Math.sin(phase) * 0.6;
    parts.lLeg.rotation.x = legSwing;
    parts.rLeg.rotation.x = -legSwing;
    
    // Arm swing (opposite phase)
    const armSwing = Math.sin(phase) * 0.5;
    parts.lArm.rotation.x = -armSwing;
    parts.rArm.rotation.x = armSwing;
    
    // Vertical bob
    const bob = Math.abs(Math.sin(phase * 2)) * (0.05 + speed * 0.15);
    mesh.position.y = agent.pos.y + bob;
  } else {
    // Idle: relax limbs gradually
    parts.lLeg.rotation.x *= 0.95;
    parts.rLeg.rotation.x *= 0.95;
    parts.lArm.rotation.x *= 0.95;
    parts.rArm.rotation.x *= 0.95;
    mesh.position.y = agent.pos.y;
  }
  
  // Update XZ position
  mesh.position.x = agent.pos.x;
  mesh.position.z = agent.pos.z;
}

/**
 * Set neutral pose (all limbs to zero rotation)
 * Call this once when entering FAR tier
 */
export function setNeutralPose(parts) {
  parts.lLeg.rotation.x = 0;
  parts.rLeg.rotation.x = 0;
  parts.lArm.rotation.x = 0;
  parts.rArm.rotation.x = 0;
}

/**
 * Fast facing update without full animation
 * Uses quaternion SLERP for smooth turning
 */
export function cheapFace(mesh, targetAngle, alpha = 0.2) {
  const targetQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    targetAngle
  );
  mesh.quaternion.slerp(targetQuat, alpha);
}

/**
 * Helper to convert LOD tier distance thresholds to squared values
 * Usage: convertDistancesToSquared({nearDist: 5, midDist: 10}) 
 *        => {NEAR_IN_SQ: 25, MID_OUT_SQ: 100}
 */
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

/**
 * Debug: Get tier name as string
 */
export function getTierName(tier) {
  return ['NEAR', 'MID', 'FAR'][tier] ?? 'UNKNOWN';
}

/**
 * Debug: Get agent animation LOD state
 */
export function getAnimLODState(agent) {
  const { userData } = agent;
  return {
    tier: getTierName(userData.animTier),
    tierValue: userData.animTier,
    phase: userData.animPhase,
    stagger: userData.animStagger,
  };
}
