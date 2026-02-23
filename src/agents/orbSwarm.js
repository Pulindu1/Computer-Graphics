import { ORB_DEFAULTS } from "./orbConfig.js";
import { Stats } from "../stats.js";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createOrbSwarm(river, config = {}) {
  const cfg = { ...ORB_DEFAULTS, ...config };
  const N = cfg.count;

  const z = new Float32Array(N);
  const dx = new Float32Array(N);
  const dxVel = new Float32Array(N);
  const yOff = new Float32Array(N);
  const speed = new Float32Array(N);
  const phase = new Float32Array(N);
  const side = new Int8Array(N); // +1 or -1
  
  // Reusable array for neighbor queries (allocation-free)
  const tmpNeighbors = [];

  // init
  for (let i = 0; i < N; i++) {
    phase[i] = rand(0, Math.PI * 2);
    speed[i] = rand(cfg.speedMin, cfg.speedMax);

    // spread along the river initially
    z[i] = rand(river.zMin, river.zMax);

    // spawn side alternating
    side[i] = i % 2 === 0 ? 1 : -1;

    const spawnAbs = rand(cfg.spawnOffsetMin, cfg.spawnOffsetMax);
    dx[i] = side[i] * spawnAbs;
    dx[i] = river.clampDx(dx[i], cfg.edgeMargin);

    dxVel[i] = 0;

    // vertical band above water
    yOff[i] = clamp(
      cfg.hoverBase + Math.sin(phase[i]) * cfg.hoverAmp,
      cfg.hoverMin,
      cfg.hoverMax
    );
  }

  function respawn(i) {
    // flip which side it spawns from each time
    side[i] *= -1;

    // place at start (opposite end)
    z[i] = river.zMin - cfg.despawnPad;

    // choose lateral offset from that side
    const spawnAbs = rand(cfg.spawnOffsetMin, cfg.spawnOffsetMax);
    dx[i] = side[i] * spawnAbs;
    dx[i] = river.clampDx(dx[i], cfg.edgeMargin);

    dxVel[i] = 0;
    speed[i] = rand(cfg.speedMin, cfg.speedMax);

    // reset vertical band
    yOff[i] = clamp(
      cfg.hoverBase + Math.sin(phase[i]) * cfg.hoverAmp,
      cfg.hoverMin,
      cfg.hoverMax
    );
  }

  function getWorldPosition(i, out) {
    const zz = z[i];
    const cx = river.centerX(zz);

    out.x = cx + dx[i];
    out.y = river.waterLevel + yOff[i];
    out.z = zz;
    return out;
  }

  function update(dt, timeSeconds, spatial) {
    const margin = cfg.edgeMargin;
    const r2 = cfg.separationRadius * cfg.separationRadius;


    if (spatial) {
      spatial.clear();
      const tmp = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < N; i++) {
        const zz = z[i];
        const xx = river.centerX(zz) + dx[i];
        spatial.insert(i, xx, zz);
      }
    }

    for (let i = 0; i < N; i++) {

      z[i] += speed[i] * dt;

      // despawn/respawn at the far end
      if (z[i] > river.zMax + cfg.despawnPad) {
        respawn(i);
        continue;
      }

      // lateral swerve target based on z (stable, smooth)
      const target =
        Math.sin(z[i] * cfg.swerveFreq + phase[i]) * cfg.swerveAmp;

      // steering toward target
      dxVel[i] += (target - dx[i]) * cfg.steerK * dt;

      // damping to avoid jitter
      dxVel[i] *= cfg.damping;

      dx[i] += dxVel[i] * dt;

      const cx = river.centerX(z[i]);
      const xw = cx + dx[i];
      const zw = z[i];
      let push = 0;

      if (spatial) {
        // O(n×m) spatial hash mode
        tmpNeighbors.length = 0;
        spatial.queryInto(xw, zw, cfg.separationRadius, tmpNeighbors);
        const MAX_NEIGHBORS = 24;
        let found = 0;

        for (let n = 0; n < tmpNeighbors.length; n++) {
          const j = tmpNeighbors[n];
          if (j === i) continue;

          Stats.candidateChecks++;

          const cxj = river.centerX(z[j]);
          const xj = cxj + dx[j];
          const zj = z[j];

          const ddx = xw - xj;
          const ddz = zw - zj;
          const dist2 = ddx * ddx + ddz * ddz;

          if (dist2 > 0.0001 && dist2 < r2) {
            Stats.neighborPairs++;
            const dist = Math.sqrt(dist2);
            const w = (cfg.separationRadius - dist) / cfg.separationRadius;
            push += (ddx / dist) * w;
            
            found++;
            if (found >= MAX_NEIGHBORS) break;
          }
        }
      } else {
        for (let j = 0; j < N; j++) {
          if (j === i) continue;

          Stats.candidateChecks++;

          const cxj = river.centerX(z[j]);
          const xj = cxj + dx[j];
          const zj = z[j];

          const ddx = xw - xj;
          const ddz = zw - zj;
          const dist2 = ddx * ddx + ddz * ddz;

          if (dist2 > 0.0001 && dist2 < r2) {
            Stats.neighborPairs++;
            const dist = Math.sqrt(dist2);
            const w = (cfg.separationRadius - dist) / cfg.separationRadius;
            push += (ddx / dist) * w;
          }
        }
      }

      dxVel[i] += push * cfg.separationStrength * dt;

      const dxClamped = river.clampDx(dx[i], margin);
      if (dxClamped !== dx[i]) {
        dx[i] = dxClamped;

        dxVel[i] *= -0.35;
      }


      const bob =
        cfg.hoverBase +
        Math.sin(timeSeconds * cfg.bobFreq + phase[i]) * cfg.hoverAmp;

      yOff[i] = clamp(bob, cfg.hoverMin, cfg.hoverMax);
    }
  }

  return {
    cfg,
    count: N,
    update,
    getWorldPosition,
  };
}
