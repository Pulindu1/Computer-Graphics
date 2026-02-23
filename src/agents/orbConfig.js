

export const ORB_DEFAULTS = {
  count: 250,
  radius: 0.6,

  // forward motion
  speedMin: 10,
  speedMax: 18,

  // lateral swerve within river
  swerveAmp: 10,
  swerveFreq: 0.020,
  steerK: 3.5,
  damping: 0.92,

  // vertical motion (3D confinement)
  hoverBase: 0.6,
  hoverAmp: 0.8,
  hoverMin: 0.2,
  hoverMax: 2.2,
  bobFreq: 2.2,

  // bounds / behaviour
  edgeMargin: 2.0,
  despawnPad: 6.0,

  // spawning
  spawnOffsetMin: 6,
  spawnOffsetMax: 18,

  // separation
  separationRadius: 4.0,
  separationStrength: 18.0,
};
