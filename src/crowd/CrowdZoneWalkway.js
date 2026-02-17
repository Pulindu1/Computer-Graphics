// 📄 src/crowd/CrowdZoneWalkway.js
// Phase 1: Flow-field walking, two-lane rules, prioritized dithering, state-based behavior
import * as THREE from "three";
import { createMiniPersonMesh, animateHumanoid } from "./MiniPersonFactory.js";
import { SpatialHashGrid } from "./SpatialHashGrid.js";

// ── Behavior states (context-aware crowd logic) ──
const STATE_CRUISE = 0;
const STATE_QUEUE = 1;
const STATE_AVOID = 2;
const STATE_IDLE = 3;
const STATE_LEADER = 4;

const STATE_NAMES = ["cruise", "queue", "avoid", "idle", "leader"];

// ── Speed modes ──────────────────────────────────────────────
const MODE_IDLE = 0;
const MODE_WALK = 1;
const MODE_FAST = 2;

const MODE_SPEEDS = [0, 0.01, 0.05];
const MODE_LABELS = ["idle", "walk", "fast"];

/**
 * State-based weight configuration
 * Maps behavior state → steering weights
 */
const STATE_WEIGHTS = {
  [STATE_CRUISE]: { flow: 1.5, lane: 1.0, sep: 1.5, ali: 0.3, coh: 0.2, queue: 0.5, wander: 0.3 },
  [STATE_QUEUE]:  { flow: 0.8, lane: 0.8, sep: 2.0, ali: 0.5, coh: 0.3, queue: 2.5, wander: 0.1 },
  [STATE_AVOID]:  { flow: 0.5, lane: 0.5, sep: 3.0, ali: 0.2, coh: 0.1, queue: 1.0, wander: 0.1 },
  [STATE_IDLE]:   { flow: 0.1, lane: 0.1, sep: 1.0, ali: 0.0, coh: 0.0, queue: 0.0, wander: 0.05 },
  [STATE_LEADER]: { flow: 1.2, lane: 0.8, sep: 1.2, ali: 0.2, coh: 0.1, queue: 0.3, wander: 0.5 },
};

/**
 * Manages a crowd of agents on a walkway with:
 *  - Flow-field walking (agents follow path tangent)
 *  - Two-lane rules (reduces head-on collisions)
 *  - Prioritized dithering (avoidance can't be cancelled)
 *  - State-based behavior (cruise/queue/avoid/idle)
 *  - Leader-following for advanced group dynamics
 */
export class WalkwayZone {
  constructor({
    scene,
    curve,
    corridorWidth = 6.0,
    laneOffsets = [-2, 0, 2],
    yOffset = 0.12,
    neighborRadius = 5.0,
    brakeRadius = 3.0,
    platformHeight = -0.8,
    enableFlowField = true,
    enableLanes = true,
    enablePriority = true,
  } = {}) {
    this.scene = scene;
    this.curve = curve;
    this.corridorWidth = corridorWidth;
    this.laneOffsets = laneOffsets;
    this.yOffset = yOffset;
    this.neighborRadius = neighborRadius;
    this.brakeRadius = brakeRadius;
    this.platformHeight = platformHeight;

    // Feature toggles
    this.enableFlowField = enableFlowField;
    this.enableLanes = enableLanes;
    this.enablePriority = enablePriority;

    this.bodyRadius = 1.4;
    this.agents = [];
    this.leaders = []; // Leader agents
    this.grid = new SpatialHashGrid(neighborRadius);

    // Global tunable weights (UI can override state weights)
    this.weights = {
      flow: 1.5,
      lane: 1.0,
      sep: 1.5,
      ali: 0.3,
      coh: 0.2,
      queue: 0.5,
      wander: 0.3,
    };

    // Performance tracking
    this.stats = {
      agentCount: 0,
      queriesThisFrame: 0,
      avgNeighborsFound: 0,
      timings: { steering: 0, collisions: 0, physics: 0 },
    };
  }

  // ──────────────────────────── Path Guidance ──────────────────────────
  closestParamT(pos, startT = 0.5) {
    const samples = 16;
    let bestT = startT;
    let bestDist = Infinity;
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const pt = this.curve.getPointAt(t);
      const d = pos.distanceTo(pt);
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    return bestT;
  }

  pathPoint(t) {
    t = THREE.MathUtils.clamp(t, 0, 1);
    const pt = this.curve.getPointAt(t);
    pt.y = this.platformHeight + this.yOffset;
    return pt;
  }

  pathTangent(t) {
    t = THREE.MathUtils.clamp(t, 0, 1);
    return this.curve.getTangentAt(t).normalize();
  }

  pathNormal(t) {
    const tangent = this.pathTangent(t);
    return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  }

  // ─────────────────────────── spawn / remove ──────────────────────────
  spawn(count, isLeader = false) {
    const palette = [0x3388ff, 0xff8833, 0x33aa55, 0xcc4444, 0x8855cc, 0xddaa33];

    for (let i = 0; i < count; i++) {
      const color = isLeader ? 0xffff00 : palette[Math.floor(Math.random() * palette.length)];
      const { mesh, parts, bodyMat, skinMat } = createMiniPersonMesh(color);

      const t = Math.random();
      const laneOffset = (Math.random() - 0.5) * (this.corridorWidth - 2);
      const pos = this.pathPoint(t).clone().add(this.pathNormal(t).multiplyScalar(laneOffset));

      const mode = Math.random() < 0.15 ? MODE_IDLE : Math.random() < 0.70 ? MODE_WALK : MODE_FAST;
      const lane = Math.random() < 0.5 ? -1 : 1;

      const agent = {
        pos: pos.clone(), vel: new THREE.Vector3(), acc: new THREE.Vector3(),
        t, dir: Math.random() < 0.5 ? 1 : -1, lane,
        state: STATE_CRUISE, stateTimer: 0,
        mode, desiredSpeed: MODE_SPEEDS[mode], maxSpeed: 1.0, maxForce: 0.08, modeTimer: 200 + Math.random() * 400,
        wanderAngle: Math.random() * Math.PI * 2, lastSeparationForce: 0, isLeader,
        mesh, parts, bodyMat, skinMat,
      };

      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.agents.push(agent);
      if (isLeader) this.leaders.push(agent);
    }
  }

  remove(count) {
    for (let i = 0; i < count && this.agents.length > 0; i++) {
      const agent = this.agents.pop();
      if (this.leaders.includes(agent)) this.leaders.splice(this.leaders.indexOf(agent), 1);
      this.scene.remove(agent.mesh);
      agent.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
  }

  // ─────────────────────────── update loop ──────────────────────────
  update(dt, time) {
    this.stats.agentCount = this.agents.length;
    this.stats.queriesThisFrame = 0;
    this.stats.avgNeighborsFound = 0;

    this.grid.clear();
    for (const a of this.agents) this.grid.insert(a);

    for (const a of this.agents) this.stepAgent(a, dt, time);

    if (this.agents.length > 0) this.stats.avgNeighborsFound /= this.agents.length;
  }

  stepAgent(agent, dt, time) {
    this.updateBehaviorState(agent);
    this.updateMode(agent);

    const neighbors = this.grid.query(agent);
    this.stats.queriesThisFrame++;
    this.stats.avgNeighborsFound += neighbors.length;

    const steer = this.computeSteering(agent, neighbors, time);
    agent.acc.add(steer);

    this.integrate(agent, dt);
    this.resolveCollisions(agent, neighbors);
    this.clampToPath(agent);
    this.syncSplineProgress(agent);

    animateHumanoid(agent, time);
  }

  // ──────────────────── Behavior State Machine ──────────────
  updateBehaviorState(agent) {
    agent.stateTimer--;
    const newState = this.decideBehaviorState(agent);
    if (newState !== agent.state) {
      agent.state = newState;
      agent.stateTimer = 60 + Math.random() * 120;
    }
  }

  decideBehaviorState(agent) {
    if (agent.mode === MODE_IDLE) return STATE_IDLE;
    if (agent.isLeader) return STATE_LEADER;
    if (agent.state !== STATE_QUEUE && Math.random() < 0.05) return STATE_QUEUE;
    if (agent.lastSeparationForce > 1.5) return STATE_AVOID;
    return STATE_CRUISE;
  }

  // ────────────────── Speed Mode Update ──────────────────
  updateMode(agent) {
    agent.modeTimer--;
    if (agent.modeTimer > 0) return;

    const roll = Math.random();
    if (roll < 0.15) {
      agent.mode = MODE_IDLE;
      agent.modeTimer = 120 + Math.random() * 300;
    } else if (roll < 0.75) {
      agent.mode = MODE_WALK;
      agent.modeTimer = 200 + Math.random() * 500;
    } else {
      agent.mode = MODE_FAST;
      agent.modeTimer = 100 + Math.random() * 200;
    }
    agent.desiredSpeed = MODE_SPEEDS[agent.mode];
    if (Math.random() < 0.1) agent.dir *= -1;
  }

  // ──────────────── Prioritized Dithering Accumulator ──────────────────
  computeSteering(agent, neighbors, time) {
    const acc = new THREE.Vector3();
    const maxForce = agent.maxForce;

    const stateWeights = { ...STATE_WEIGHTS[agent.state] };
    Object.keys(this.weights).forEach(k => {
      stateWeights[k] = this.weights[k];
    });

    // Priority 1: HARD AVOIDANCE
    if (!this.enablePriority) {
      const sep = this.separationForce(agent, neighbors);
      this.addForceToAccumulator(acc, sep, stateWeights.sep, maxForce);
    } else {
      const sep = this.separationForce(agent, neighbors);
      agent.lastSeparationForce = sep.length();
      this.addForceToAccumulator(acc, sep, stateWeights.sep, maxForce);
      if (acc.length() > maxForce * 0.8) return this.clampForce(acc, maxForce);
    }

    // Priority 2: QUEUE BRAKING
    const pathInfo = this.getPathInfo(agent);
    if (stateWeights.queue > 0 && agent.mode !== MODE_IDLE) {
      const queue = this.queueingForce(agent, neighbors, pathInfo.tangent);
      this.addForceToAccumulator(acc, queue, stateWeights.queue, maxForce);
      if (acc.length() > maxForce * 0.8) return this.clampForce(acc, maxForce);
    }

    // Priority 3: FLOW FIELD & LANE FOLLOWING
    if (this.enableFlowField && stateWeights.flow > 0 && agent.mode !== MODE_IDLE) {
      const flow = this.flowForce(agent, pathInfo);
      this.addForceToAccumulator(acc, flow, stateWeights.flow, maxForce);
    }

    if (this.enableLanes && stateWeights.lane > 0) {
      const lane = this.laneForce(agent, pathInfo, neighbors);
      this.addForceToAccumulator(acc, lane, stateWeights.lane, maxForce);
    }

    // Priority 4: ALIGNMENT & COHESION
    if (stateWeights.ali > 0) {
      const ali = this.alignmentForce(agent, neighbors);
      this.addForceToAccumulator(acc, ali, stateWeights.ali, maxForce);
    }

    if (stateWeights.coh > 0) {
      const coh = this.cohesionForce(agent, neighbors);
      this.addForceToAccumulator(acc, coh, stateWeights.coh, maxForce);
    }

    // Priority 5: WANDER
    if (stateWeights.wander > 0 && agent.mode !== MODE_IDLE) {
      const wan = this.wanderForce(agent, pathInfo);
      this.addForceToAccumulator(acc, wan, stateWeights.wander, maxForce);
    }

    // Priority 6: LEADER FOLLOWING
    if (this.leaders.length > 0 && !agent.isLeader && stateWeights.flow > 0) {
      const leaderForce = this.leaderFollowingForce(agent);
      this.addForceToAccumulator(acc, leaderForce, 0.5, maxForce);
    }

    return this.clampForce(acc, maxForce);
  }

  addForceToAccumulator(acc, force, weight, maxForce) {
    force.multiplyScalar(weight);
    const newLen = acc.clone().add(force).length();

    if (newLen > maxForce) {
      const remaining = maxForce - acc.length();
      if (remaining > 0) {
        const dir = force.normalize();
        acc.add(dir.multiplyScalar(remaining));
      }
    } else {
      acc.add(force);
    }
  }

  // ──────────────── Path Guidance ──────────────────
  getPathInfo(agent) {
    const t = agent.t;
    const tangent = this.pathTangent(t);
    const normal = this.pathNormal(t);
    const center = this.pathPoint(t);

    return { t, tangent, normal, center };
  }

  // ──────────────── Flow-Field Force ──────────────────
  flowForce(agent, pathInfo) {
    const { tangent } = pathInfo;
    const flowDir = tangent.clone().multiplyScalar(agent.dir);
    const desired = flowDir.multiplyScalar(agent.desiredSpeed);
    return desired.sub(agent.vel);
  }

  // ──────────────── Lane-Following Force ──────────────────
  laneForce(agent, pathInfo, neighbors) {
    const { center, normal } = pathInfo;
    const laneWidth = this.corridorWidth / 3;
    const laneTarget = center.clone().add(normal.clone().multiplyScalar(agent.lane * laneWidth));

    const toTarget = laneTarget.clone().sub(agent.pos);
    toTarget.y = 0;

    const tangent = pathInfo.tangent;
    const alongPath = toTarget.dot(tangent);
    toTarget.sub(tangent.clone().multiplyScalar(alongPath));

    if (toTarget.length() > 0.01) {
      return toTarget.normalize().multiplyScalar(agent.desiredSpeed * 0.3).sub(agent.vel);
    }

    return new THREE.Vector3();
  }

  // ──────────────── Wander Force ──────────────────
  wanderForce(agent, pathInfo) {
    const { tangent, normal } = pathInfo;

    agent.wanderAngle += (Math.random() - 0.5) * 0.8;

    const forwardBias = agent.dir * (0.5 + Math.random() * 0.5);
    const forward = tangent.clone().multiplyScalar(forwardBias);

    const lateral = normal.clone().multiplyScalar(Math.sin(agent.wanderAngle) * 0.8);

    const desired = forward.add(lateral).normalize().multiplyScalar(agent.desiredSpeed);
    return desired.sub(agent.vel);
  }

  // ──────────────── Leader Following (Advanced Group Behavior) ──────────────────
  leaderFollowingForce(agent) {
    if (this.leaders.length === 0) return new THREE.Vector3();

    let closestLeader = this.leaders[0];
    let closestDist = agent.pos.distanceTo(closestLeader.pos);

    for (let i = 1; i < this.leaders.length; i++) {
      const dist = agent.pos.distanceTo(this.leaders[i].pos);
      if (dist < closestDist) {
        closestDist = dist;
        closestLeader = this.leaders[i];
      }
    }

    const leaderDir = closestLeader.vel.length() > 0.01
      ? closestLeader.vel.clone().normalize()
      : this.pathTangent(closestLeader.t).multiplyScalar(closestLeader.dir);

    const ghostOffset = 3.0;
    const ghostTarget = closestLeader.pos.clone().sub(leaderDir.multiplyScalar(ghostOffset));

    const toGhost = ghostTarget.clone().sub(agent.pos);
    const dist = toGhost.length();

    if (dist > 0.01) {
      toGhost.normalize();
      const speed = Math.min(agent.desiredSpeed, dist * 0.5);
      toGhost.multiplyScalar(speed);
      return toGhost.sub(agent.vel);
    }

    return new THREE.Vector3();
  }

  // ────────────────── separation ──────────────────
  separationForce(agent, neighbors) {
    const force = new THREE.Vector3();
    const minDist = this.bodyRadius * 2;
    let count = 0;

    for (const other of neighbors) {
      if (other === agent) continue;

      const diff = agent.pos.clone().sub(other.pos);
      diff.y = 0;
      const dist = diff.length();
      if (dist < 0.01 || dist >= this.neighborRadius) continue;

      // Much stronger push when bodies overlap
      const strength = dist < minDist
        ? ((minDist - dist) / minDist) * 4.0   // overlap → big push
        : 1.0 / (dist * dist);                  // further → gentle

      diff.normalize().multiplyScalar(strength);
      force.add(diff);
      count++;
    }

    if (count > 0) force.divideScalar(count);
    return force;
  }

  // ────────────────── alignment ──────────────────
  alignmentForce(agent, neighbors) {
    const avg = new THREE.Vector3();
    let count = 0;

    for (const other of neighbors) {
      if (other === agent) continue;
      const d = agent.pos.distanceTo(other.pos);
      if (d > 0 && d < this.neighborRadius) { avg.add(other.vel); count++; }
    }

    if (count > 0) {
      avg.divideScalar(count);
      if (avg.length() > 0.01) {
        avg.normalize().multiplyScalar(agent.desiredSpeed);
        return avg.sub(agent.vel);
      }
    }
    return new THREE.Vector3();
  }

  // ────────────────── cohesion ──────────────────
  cohesionForce(agent, neighbors) {
    const com = new THREE.Vector3();
    let count = 0;

    for (const other of neighbors) {
      if (other === agent) continue;
      const d = agent.pos.distanceTo(other.pos);
      if (d > 0 && d < this.neighborRadius) { com.add(other.pos); count++; }
    }

    if (count > 0) {
      com.divideScalar(count).sub(agent.pos);
      if (com.length() > 0.01) {
        com.normalize().multiplyScalar(agent.desiredSpeed);
        return com.sub(agent.vel);
      }
    }
    return new THREE.Vector3();
  }

  // ────────────────── queueing ──────────────────
  queueingForce(agent, neighbors, tangent) {
    const brake = new THREE.Vector3();
    const moveDir = tangent.clone().multiplyScalar(agent.dir);

    for (const other of neighbors) {
      if (other === agent) continue;
      const toO = other.pos.clone().sub(agent.pos);
      toO.y = 0;
      const dist = toO.length();
      if (dist < 0.01 || dist >= this.brakeRadius) continue;

      toO.normalize();
      if (toO.dot(moveDir) > 0.3) {
        const mag = (this.brakeRadius - dist) / this.brakeRadius;
        brake.add(agent.vel.clone().multiplyScalar(-mag * 0.6));
      }
    }
    return brake;
  }

  // ────────────────── hard collision resolution ──────────────────
  resolveCollisions(agent, neighbors) {
    const minDist = this.bodyRadius * 2;

    for (const other of neighbors) {
      if (other === agent) continue;
      const diff = agent.pos.clone().sub(other.pos);
      diff.y = 0;
      const dist = diff.length();

      if (dist > 0.01 && dist < minDist) {
        const overlap = minDist - dist;
        const push = diff.normalize().multiplyScalar(overlap * 0.5);
        agent.pos.add(push);
      }
    }
  }

  // ──────────────── Path Containment ──────────────────
  clampToPath(agent) {
    const pathInfo = this.getPathInfo(agent);
    const { center, normal, tangent } = pathInfo;

    const toAgent = agent.pos.clone().sub(center);
    toAgent.y = 0;
    const lateral = toAgent.dot(normal);

    const maxLat = this.corridorWidth / 2 - 0.2;

    // Soft edge repulsion (before hard clamp)
    const softThreshold = maxLat * 0.8;
    if (Math.abs(lateral) > softThreshold) {
      const repulsion = Math.sign(lateral) * -1;
      const strength = (Math.abs(lateral) - softThreshold) / (maxLat - softThreshold);
      agent.acc.add(normal.clone().multiplyScalar(repulsion * strength * 0.5));
    }

    // Hard clamp (safety)
    const clamped = THREE.MathUtils.clamp(lateral, -maxLat, maxLat);

    agent.pos.copy(center);
    agent.pos.add(normal.clone().multiplyScalar(clamped));
    agent.pos.y = this.platformHeight + this.yOffset;

    if (Math.abs(lateral) > maxLat) {
      const along = agent.vel.dot(tangent);
      agent.vel.copy(tangent).multiplyScalar(along * 0.7);
    }
  }

  // ────────────────── physics ──────────────────
  clampForce(v, max) {
    if (v.length() > max) v.normalize().multiplyScalar(max);
    return v;
  }

  integrate(agent, dt) {
    agent.vel.add(agent.acc.clone().multiplyScalar(dt));

    if (agent.mode === MODE_IDLE) {
      agent.vel.set(0, 0, 0);
    } else {
      const speed = agent.vel.length();
      if (speed > agent.maxSpeed) agent.vel.normalize().multiplyScalar(agent.maxSpeed);
      agent.pos.add(agent.vel.clone().multiplyScalar(dt));
    }
    agent.acc.set(0, 0, 0);
  }

  // ──────────────── Spline Sync ──────────────────
  syncSplineProgress(agent) {
    const { tangent } = this.getPathInfo(agent);
    const along = agent.vel.dot(tangent);

    const tScale = 0.003;
    agent.t += along * tScale;

    if (agent.t > 0.98) {
      agent.t = 0.98;
      agent.dir = -1;
    } else if (agent.t < 0.02) {
      agent.t = 0.02;
      agent.dir = 1;
    }
  }
}
