# Architecture

A map of the source tree, for anyone reading the code rather than running it. For the technical
rationale behind these choices — the maths, the complexity analysis, the structures that were
rejected — see the **Technical detail** section of the [README](../README.md).

## Boot sequence

`index.html` declares an [import map](../index.html) pinning `three@0.126.1` and `lil-gui@0.17` to
CDN URLs, then loads `src/main.js` as an ES module. There is no bundler and no install step; the
browser resolves every import itself.

`src/main.js` is the composition root. It runs top-to-bottom:

1. `initThree()` — renderer, camera, `OrbitControls`.
2. `createComposer()` — `EffectComposer` with `RenderPass` → `UnrealBloomPass` → FXAA `ShaderPass`.
3. Terrain, then water and the river corridor derived from the same height sampler.
4. Walkways and their centre-line curves, then the crowd zones that walk along those curves.
5. Street lamps, the two street districts, trees, vegetation, the Bézier canopy.
6. The orb swarm and its spatial hash, via `rebuildOrbs(n)`.
7. `createUI()` — wires every subsystem into the lil-gui panel.
8. `animate()` — the single `requestAnimationFrame` loop.

Because everything derives from one terrain height function, subsystems stay consistent without
sharing state: `terrain.heightAt(x, z)` is the ground truth that lamps, trees, houses and
pedestrians all sample independently.

## The frame loop

`animate()` in `main.js` runs a fixed order each frame, with `dt` clamped to 33 ms to keep the
integrators stable across frame spikes:

```
Stats.resetPerFrame()          per-frame counters (checks, pairs, cells)
controls / keyboardCamera      camera
water                          scrolling normal/UV animation
crowdManager                   pedestrian FSM + steering + kinematics
streetDistrict × 2             street crowds, fireflies, light cubes
bezierBlanket                  control-point animation + surface re-evaluation
streetLamps                    light-pool selection by camera proximity
treeSystem / vegetationSystem  LOD bucket reassignment
swarm.update(dt, t, spatial)   orb steering; `spatial` is null in brute-force mode
heatmap / queryCellOverlay     debug overlays (only when visible)
orbLOD.updateInstances         instance matrix write + LOD/hysteresis swap
composer.render() | renderer.render()
updateStatsDisplay()           HUD
```

`Perf.begin/end` brackets the swarm, LOD and heatmap stages so their individual costs surface in
the HUD — the swarm and the instance-matrix write are the two hot paths worth watching.

## Modules

### `core/`

| Module | Role |
| --- | --- |
| `initThree.js` | Renderer, perspective camera, `OrbitControls`; returns the scene bundle |
| `resize.js` | Window resize → camera aspect, renderer size, composer size |
| `keyboardCamera.js` | WASD/arrow fly camera with `Space`/`Shift` vertical and quaternion-based mouse look |

### `environment/`

Everything derived from the height field.

| Module | Role |
| --- | --- |
| `terrainHeight.js` | `createTerrainSampler(params)` — the analytic height function: base surface, dual-frequency river meander, smoothstep bank blending |
| `terrainField.js` | Wraps a sampler into a queryable field for placement systems |
| `terrain.js` | Builds the terrain mesh and exposes `heightAt(x, z)` |
| `water.js` | Animated water plane at the water level |
| `riverCorridor.js` | `centerX(z)` / `halfWidth` — the river's parametric centre-line, used for orb spawning and containment |
| `riverWalkways.js` | Elevated walkway platforms and railings offset from the corridor |
| `walkwayCurves.js` | The left/right `Curve` objects pedestrians actually follow |
| `StreetLampSystem.js` | Lamp placement plus the light pool: only the N nearest lamps hold real `SpotLight`s |
| `trees/` | `TreeSystem` orchestrates `treePlacement` (poisson-ish scatter avoiding river and streets), `treeMeshes` (instanced trunk/canopy pairs, wind shader) and `treeLodBuckets` (per-frame LOD reassignment) |
| `vegetation/` | Same shape as `trees/`, for billboarded rocks and stumps |

### `agents/` — the light-orb swarm

The performance-critical path. State is a **structure of arrays**, not objects.

| Module | Role |
| --- | --- |
| `orbConfig.js` | `ORB_DEFAULTS` — speeds, swerve amplitude/frequency, steering stiffness, damping, separation radius |
| `orbSwarm.js` | `createOrbSwarm(river, cfg)` — parallel `Float32Array`s for position, offset, velocity and phase; the spring-damper steering integrator; optional spatial-hash separation |
| `spatialHash.js` | The swarm's own uniform hash: 32-bit packed integer keys, allocation-free `queryInto`, per-frame query tracking for the debug overlays |
| `orbLodRenderer.js` | Two `InstancedMesh`es (near sphere / far billboard spark) with a hysteresis band on the swap distance |
| `orbLodRendererChunked.js` / `chunkedInstancing.js` | The scaled variant: agents grouped into ≤512-instance chunks, each its own `InstancedMesh` with `frustumCulled = true`, so off-screen chunks skip matrix construction and GPU upload entirely |

Passing `null` instead of the spatial index to `swarm.update()` is the brute-force `O(N²)` baseline
the GUI toggles between.

### `crowd/` — articulated pedestrians

| Module | Role |
| --- | --- |
| `MiniPersonFactory.js` | Builds the humanoid mesh hierarchy and the base sinusoidal gait |
| `animationLOD.js` | Kinematic decimation by camera distance: NEAR full-rate, MID every-N-frames, FAR cached neutral pose |
| `CrowdZoneWalkway.js` | A zone bound to a walkway curve — the FSM (`CRUISE`/`QUEUE`/`AVOID`/`LEADER`), lane assignment, flow field, and the prioritised dithering accumulator |
| `CrowdManager.js` | Owns the zones, aggregates counts, drives per-zone updates |
| `SpatialHashGrid.js` | Neighbour lookup for crowd separation |

### `spatial/` — partitioning and its visualisation

| Module | Role |
| --- | --- |
| `ISpatialIndex.js` | The interface both structures implement: `clear` / `insert` / `queryInto`, plus a shared `stats` block (build ms, query ms, average candidates, nodes visited) |
| `SpatialHashIndex.js` | Uniform hash implementation |
| `Quadtree.js` / `QuadtreeIndex.js` | Point quadtree over a pre-allocated 4096-node pool — no per-frame allocation, no GC spikes |
| `hashKey.js` | `cellCoord` / `packKey` / `unpackKey` — the 32-bit integer key scheme shared across systems |
| `uniformGrid.js` | Simple grid used by the debug overlay |
| `debugGridRenderer.js` | Wireframe of the cell structure |
| `heatmapRenderer.js` | Per-cell occupancy as a colour ramp |
| `queryCellOverlay.js` | Highlights the exact cells touched this frame, and the 3×3 neighbourhood of one focused agent |

Because both structures satisfy `ISpatialIndex`, the GUI swaps them at runtime and the stats block
gives a like-for-like comparison under identical load.

### `world/` — the street districts

| Module | Role |
| --- | --- |
| `streetDistrict.js` | Composes one district: street mesh, houses, pyramid, light cubes, pedestrians, fireflies |
| `streetMask.js` | Rectangle distance field + blend weight used to flatten terrain under a street |
| `houseFactory.js` | Seeded procedural houses with three discrete LOD levels |
| `attractionPyramid.js` | The landmark street crowds are attracted toward |
| `lightCubes.js`, `lightFestival.js`, `fireflies.js` | Emissive installations and ambient particles |
| `streetPedestrians.js` | Street-crowd agents; picks its spatial index (`SpatialHashIndex` or `QuadtreeIndex`) at runtime |
| `palette.js` | Shared colours and the material library |

### `parametric/`

`bezierBlanket.js` — the tensor-product cubic Bézier canopy. Holds a 4×4 control lattice, animates
the control points, and re-evaluates the surface from Bernstein basis polynomials each frame. The
control lattice can be visualised from the GUI.

### `ui/`

`ui.js` builds the lil-gui panel (Debug, Orbs, People, Crowd, Animation LOD, Spatial Index, Street
Lamps, Street Districts, Canopy, Post-Processing, Environment) and is the single place where
subsystems are exposed for tuning. `treesFolder.js` factors out the tree controls, `hotbar.js` is a
lighter standalone overlay, and `dayNightCycle.js` drives sun position, sky and light colour from a
normalised time-of-day value.

### Instrumentation

`stats.js` holds the per-frame counters the spatial structures increment (`candidateChecks`,
`neighborPairs`, `queriedCells`), reset at the top of every frame. `perf.js` is a small
`begin`/`end` timer used to attribute frame cost to individual stages. Both feed the HUD.

## `dev/`

Standalone diagnostic pages kept from development, not part of the simulation:

- `three-smoke-test.html` — a spinning cube; confirms Three.js resolves from the CDN.
- `module-load-check.html` — imports each core module in sequence and reports which one throws.
  Useful when a blank canvas is a module resolution failure rather than a rendering bug.

## Known rough edges

- `enablePost` in `main.js` defaults to `false`; bloom and FXAA are enabled from the
  Post-Processing folder in the GUI rather than at startup.
- `agents/orbRenderer.js` is the pre-LOD renderer, superseded by `orbLodRenderer.js`, and
  `orbLodRendererChunked.js` is the scaled variant used for the 10k benchmark rather than the
  default scene.
- `crowd/SpatialHashGrid.js` and `agents/spatialHash.js` and `spatial/SpatialHashIndex.js` are
  three hashes serving three subsystems with different state layouts; only the last one implements
  `ISpatialIndex`.
