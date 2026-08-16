# Large-Scale Crowd Simulation & Parametric Rendering

A real-time WebGL simulation of a stylised Durham riverside light festival, built from scratch in
**Three.js** with no build step, no engine, and no imported 3D models. Everything you see — the
terrain, the river, the houses, the trees, the crowds — is generated procedurally at load time.

The scene sustains **60 FPS with ~3,400 active agents** (2,500 light orbs, 500 articulated
pedestrians, 400 fireflies) alongside ~1,200 environmental assets, and has been benchmarked to
**10,000 orbs at ~40 FPS**.

> Submitted for **COMP4097 Advanced Computer Graphics and Visualisation** (Durham University,
> 2025–26). **Awarded 85%.**

---

## Running it

The project is pure client-side ES modules — no install, no bundler, no `npm`. It only needs to be
served over HTTP (ES module imports won't load from `file://`).

```sh
git clone https://github.com/Pulindu1/Computer-Graphics.git
cd Computer-Graphics
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Tested on Chrome. A discrete GPU is recommended — the default scene is deliberately heavy.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrow keys | Fly the camera horizontally |
| `Space` / `Shift` | Ascend / descend |
| Left-click + drag | Look around (also orbit, via OrbitControls) |
| Middle-drag / scroll | Zoom |
| Right-drag | Pan |

The **lil-gui** panel on the right exposes essentially every tunable in the simulation: agent
counts, flocking weights, LOD distances, the spatial-index mode, bloom parameters, time of day, and
the debug overlays. The compact HUD at the top-left reports FPS, frame time, and per-frame spatial
query statistics (candidate checks, neighbour pairs, cells touched).

Useful things to try from the panel:

- **Debug → Neighbour mode** — switch the orb swarm between the spatial hash and a brute-force
  `O(N²)` baseline, and watch the frame time and check-count diverge.
- **Debug → Show grid / Heatmap occupancy / 3×3 Query Proof** — visualise the partitioning
  structure, the per-cell agent density, and the exact 3×3 cell neighbourhood queried for one
  highlighted agent.
- **Spatial Index → Mode** — swap the pedestrian crowd between a point quadtree and a uniform
  spatial hash at runtime, with live build/query timings.
- **People → Spawn 1000 / 2000** — scale the articulated crowd and watch the animation LOD tiers
  engage.

## What's implemented

**Procedural geometry.** The terrain is an analytic height field: a base surface minus a river
carve whose centre-line is a dual-frequency meander, with cubic Hermite (smoothstep) blending at the
banks to keep the surface `C¹` continuous and free of specular seams. Houses, streets, walkways,
lamps, trees and rocks are all placed and generated from that same height function.

**Parametric surfaces.** A "glowing blanket" canopy over the second street is a tensor-product
cubic Bézier surface evaluated from Bernstein basis polynomials. Animation is driven by moving the
16 control points rather than the ~5,000 evaluated vertices, so the deformation costs `O(1)` state
updates per frame.

**Spatial partitioning.** Two interchangeable acceleration structures behind a common
`ISpatialIndex` interface: a uniform spatial hash (32-bit packed integer keys, zero-allocation
`queryInto` queries) and a point quadtree backed by a pre-allocated 4096-node pool to avoid
per-frame heap churn and GC spikes. The quadtree was chosen for the shipped configuration — at
N ≈ 1000 its adaptive subdivision handled the scene's very non-uniform crowd density with better
cache coherency and lower frame-time variance than the flat hash.

**Crowd intelligence.** Three distinct behavioural systems: a stochastic flow model for the river
orb swarm (spring-damper lateral steering over a sinusoidal target offset); a finite state machine
for the walkway pedestrians (`CRUISE`/`QUEUE`/`AVOID`/`LEADER`) with a *prioritised dithering*
accumulator that truncates low-priority steering forces once the budget is spent, so
safety-critical avoidance is never cancelled out; and a context-aware street crowd that is
attracted to the pyramid landmark while avoiding light cubes and AABB house footprints.

**Procedural kinematics.** Pedestrian gait is generated, not animated — sinusoidal limb
oscillation with walk frequency scaling linearly with velocity magnitude, limbs phase-offset by π,
and a vertical torso bob coupled to speed. Facing direction is resolved with quaternion Slerp for
`C¹`-continuous turning without the shrinking artefacts of linear interpolation.

**Rendering pipeline.** The swarm is drawn with hardware instancing (`THREE.InstancedMesh`),
collapsing thousands of draw calls into one. Agent state lives in a structure-of-arrays layout of
contiguous `Float32Array`s (`pos_z[N]`, `offset_x[N]`, `vel_x[N]`, `phase[N]`) for cache coherency
during the per-frame matrix update, written straight into the instance matrix buffer with
`DynamicDrawUsage`. Agents are grouped into spatial chunks of ≤512 with per-chunk frustum culling,
so off-screen work drops from `O(N)` to `O(N_visible)`.

**Adaptive LOD.** Three-tier discrete LOD for environment assets (full/simplified/box silhouette,
>70% vertex reduction on background geometry); instanced orbs swap to 8×8 billboard sparks at
distance with a 10-unit hysteresis band to prevent temporal aliasing at the boundary; animation
LOD decimates pedestrian kinematics by distance (full-rate / every-N-frames / cached neutral pose),
cutting animation overhead by roughly 60%; and a light pool keeps only the 12 nearest lamps as
active `SpotLight`s with PCF shadows culled beyond 25 units.

**Signal processing.** Aliasing in high-frequency geometry (railings, rooftops) is handled with a
dual approach — hardware MSAA for geometric sub-sampling plus a post-process FXAA pass that catches
the shader-based and alpha-tested edges the rasteriser misses. A bloom pipeline (bright-pass at
threshold 0.3 → Gaussian convolution → additive blend before tone mapping) unifies the light-festival
aesthetic while preserving HDR intensities.

The full technical write-up, with the derivations and equations, is in
**[docs/REPORT.pdf](docs/REPORT.pdf)**. See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for a
map of the source tree.

## Project layout

```
index.html            Entry point; import map pinning Three.js + lil-gui from CDN
src/
  main.js             Scene assembly, post-processing setup, animation loop
  core/               Renderer/camera bootstrap, resize handling, fly camera
  environment/        Terrain, water, river corridor, walkways, lamps, trees, vegetation
  world/              Street districts, houses, pyramid, light cubes, fireflies, palette
  agents/             Light-orb swarm: SoA state, spatial hash, instanced LOD renderers
  crowd/              Articulated pedestrians: FSM zones, factory, manager, animation LOD
  spatial/            Uniform hash + quadtree behind ISpatialIndex, plus debug visualisers
  parametric/         Bézier blanket canopy
  ui/                 lil-gui panel, hotbar, day/night cycle
  textures/           The single bitmap texture in the project (see references.md)
docs/                 Report and architecture notes
dev/                  Standalone diagnostic pages (not part of the simulation)
```

## Dependencies

Loaded at runtime from CDN via an [import map](index.html) — nothing is vendored or installed.

- **[Three.js 0.126.1](https://threejs.org/)** — rendering and scene graph, plus the
  `examples/jsm` modules for `OrbitControls`, `EffectComposer`, `RenderPass`,
  `UnrealBloomPass`, `ShaderPass` and `FXAAShader`.
- **[lil-gui 0.17](https://lil-gui.georgealways.com/)** — the runtime control panel.

All geometry is procedural. The only bitmap asset is `src/textures/rock.png`; its attribution is in
[src/textures/references.md](src/textures/references.md).

## A note on academic integrity

This repository is published as a portfolio piece. If you are taking COMP4097 or a similar module,
please read it for ideas and don't submit any part of it as your own — Durham's plagiarism rules
apply to published sources, and this one is now very much published.

The assignment specification and the submitted demo video are deliberately excluded from version
control (see [.gitignore](.gitignore)); the specification is Durham University's material, not mine
to redistribute.

## Licence

[MIT](LICENSE) — © Pulindu Fonseka.
