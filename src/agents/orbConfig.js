// 📄 src/agents/orbConfig.js

export const ORB_DEFAULTS = {
  count: 250,              // start smaller; later push to 1000+
  radius: 0.6,

  // forward motion
  speedMin: 10,
  speedMax: 18,

  // lateral swerve within river
  swerveAmp: 10,           // max dx target magnitude
  swerveFreq: 0.020,       // affects how quickly target changes along z
  steerK: 3.5,             // how strongly dx follows dxTarget
  damping: 0.92,           // dxVel damping (0.85–0.98)

  // vertical motion (3D confinement)
  hoverBase: 0.6,
  hoverAmp: 0.8,
  hoverMin: 0.2,
  hoverMax: 2.2,
  bobFreq: 2.2,

  // bounds / behaviour
  edgeMargin: 2.0,         // keep away from river edge
  despawnPad: 6.0,         // extra distance beyond zMax before respawn

  // spawning
  spawnOffsetMin: 6,       // minimum abs(dx) from centre at spawn
  spawnOffsetMax: 18,      // maximum abs(dx) from centre at spawn
};
