# Large-Scale Crowd Simulation & Parametric Rendering

A real-time WebGL simulation of a stylised riverside light festival, built from scratch in
**Three.js** with no build step, no engine, and no imported 3D models. Everything you see — the
terrain, the river, the houses, the trees, the crowds — is generated procedurally at load time.

The scene sustains **60 FPS with ~3,400 active agents** (2,500 light orbs, 500 articulated
pedestrians, 400 fireflies) alongside ~1,200 environmental assets, and has been benchmarked to
**10,000 orbs at ~40 FPS**.

![The simulation running: riverside orb swarm, articulated pedestrians and the glowing pyramid, with the live HUD and spatial-index statistics](docs/demo.gif)

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

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for a map of the source tree.

---

## Technical detail

The derivations, constants and measurements behind the summary above.

### Geometry and spatial architecture

**Procedural terrain.** The topography is an analytic height field — a base surface minus a river
carve, sampled by every other system in the scene:

$$y(x, z) = h_{\text{base}}(x, z) - h_{\text{river}}(d)$$

The river's centre-line $c_x$ is a dual-frequency meander ($A_m = 55$, $\lambda_m = 140$), which
gives a channel that reads as organic rather than sinusoidal:

$$c_x(z) = A_m \sin\left(\frac{z + s}{\lambda_m}\right) + 0.35\,A_m \sin\left(\frac{z - s}{0.55\,\lambda_m}\right)$$

Vertical displacement at the banks is blended with cubic Hermite interpolation (smoothstep) rather
than a linear ramp, which keeps the surface $C^1$ continuous. Continuous first derivatives mean
continuous surface normals, which is what eliminates the specular seams a linear blend leaves along
the bank boundary.

**Reactive Bézier canopy.** The "glowing blanket" over the second street is a tensor-product cubic
Bézier surface evaluated from Bernstein basis polynomials:

$$S(u, v) = \sum_{i=0}^{3} \sum_{j=0}^{3} B_i^3(u)\, B_j^3(v)\, P_{i,j}(t)$$

Animation moves the 16 control points, $P_{i,j}.y = A \sin(\omega t + \phi_{i,j})$, rather than the
~5,000 evaluated vertices. The deformation therefore costs $O(1)$ state updates per frame and needs
no skeletal rig.

**Spatial discretisation.** Naive agent interaction is $O(N^2)$. Two acceleration structures were
implemented behind a common `ISpatialIndex` interface and compared directly: a uniform spatial hash
with cell size $s = 10\,\text{m}$, mapping $(i, j) = (\lfloor x/s \rfloor, \lfloor z/s \rfloor)$ to
32-bit packed integer keys with zero-allocation `queryInto` queries, and a point quadtree backed by
a pre-allocated 4096-node pool.

The hash reduces complexity to $O(N \cdot k)$, but the quadtree was selected for the shipped
configuration: its adaptive subdivision suits the scene's very non-uniform crowd density, and the
node pool avoids the memory-fragmentation anti-pattern — no per-frame heap allocation, so no GC
spikes. At $N = 1000$ (≈50 FPS) it gave better cache coherency and lower frame-time variance during
rapid camera shifts. Both remain switchable at runtime from the GUI, with live build/query timings.

### Crowd simulation

Three behavioural systems, each trading emergent complexity against real-time scalability
differently.

**Orb swarm — stochastic flow.** The river corridor carries up to 6,300 light agents at 60 FPS in a
structure-of-arrays layout. Forward motion along $Z$ is coupled to a lateral parametric swerve with
target offset

$$T_i(z) = A_s \sin(z_i f_s + \phi_i)$$

Steering resolves through a spring-damper rather than snapping to the target, which is what keeps
transitions smooth instead of jittery:

$$\dot{v}_{x,i} = (T_i - dx_i) \cdot K_s \cdot dt$$

where $K_s$ is stiffness. The result is force-driven movement rather than a rigid kinematic path.

**Walkway pedestrians — FSM and prioritised dithering.** Riverbank pedestrians run a finite state
machine (`CRUISE` / `QUEUE` / `AVOID` / `LEADER`), transitioning on local density and proximity to
ghost targets. Steering forces accumulate in priority order (P1 separation before P3 flow-field);
once the accumulated force exceeds $0.8 \cdot F_{\max}$, lower-priority terms are truncated. This
prevents force cancellation — safety-critical avoidance can never be overridden by a flow-field
term that happens to point the other way.

**Street crowd — context-aware intelligence.** The hilltop streets model attraction against
avoidance. Agents are stochastically drawn to the glowing pyramid via a horizontal-only pull:

$$\vec{F}_{\text{attr}} = 0.08 \cdot w_a \cdot \hat{d}_{\text{pyramid}}$$

balanced against three distinct avoidance geometries: a high-priority radial repulsion zone of 25
units around the pyramid; dynamic avoidance of the atmospheric light cubes, which reads as
pedestrians navigating a crowded festival; and rectangular AABB collision against procedural house
footprints, keeping agents on the carved streets. Agents wander randomly but stay strictly
constrained by the procedural environment.

### Procedural kinematics

**Orientation.** Facing is resolved with quaternions and spherical linear interpolation toward the
velocity vector $\vec{v}$:

$$q_{\text{mesh}} = \text{Slerp}(q_{\text{current}}, q_{\text{target}}, \alpha) = \frac{\sin(t\Omega)}{\sin \Omega} q_{\text{target}}$$

where $\Omega$ is the angle between quaternions. Slerp guarantees constant angular velocity and
unit magnitude, avoiding the shrinking artefacts of linear interpolation and giving $C^1$
continuous turning.

**Gait.** The walk cycle is generated, not keyframed. Walk frequency scales linearly with speed:

$$f_{\text{walk}} = f_{\text{base}} + k|\vec{v}|, \qquad f_{\text{base}} = 2\,\text{Hz}$$

and each limb's angular displacement is

$$\theta(t) = A_{\max} \cdot \sin(2\pi f_{\text{walk}} t + \phi)$$

Legs and arms are phased $\pi$ radians apart to hold the centre of mass, and a vertical torso bob
with speed-coupled amplitude reproduces the arc of suspension — which is what visually separates a
stroll from a brisk walk.

### Rendering optimisation

**Hardware instancing.** Drawing 1,000+ agents individually costs $O(n)$ draw calls. A
`THREE.InstancedMesh` pipeline consolidates the swarm into a single call by sharing one vertex
buffer and material; each agent's state is a $4 \times 4$ transform passed as an instanced
attribute:

$$V_{\text{world}} = M_i \times V_{\text{local}}$$

This moves the work off the CPU's command processor and onto the GPU's fixed-function instancing
hardware.

**Data-oriented state.** Agent state is a structure of arrays rather than an array of objects —
contiguous `Float32Array`s (`pos_z[N]`, `offset_x[N]`, `vel_x[N]`, `phase[N]`) — for cache
coherency during the per-frame matrix loop. Matrices are written straight into `instanceMatrix`,
with buffer usage set to `THREE.DynamicDrawUsage` so the driver picks a memory-mapping strategy
suited to frequent updates, minimising PCIe bus traffic.

**Spatial chunking.** Agents are grouped into chunks of ≤512, each its own `InstancedMesh` with
`frustumCulled = true`. Matrix construction and GPU upload are skipped entirely for off-screen
chunks, dropping per-frame bandwidth from $O(N)$ to $O(N_{\text{visible}})$.

### Adaptive LOD and visual signals

Sustaining 6,700+ entities at 60 FPS needs four LOD tiers working together:

- **Discrete environment LOD** — LOD0 (full, shadowed), LOD1 (simplified), LOD2 (box silhouette, no
  shadows), cutting vertex pressure by >70% on background geometry.
- **Instanced agent LOD with hysteresis** — orbs swap to 8×8 billboard sparks at distance, with a
  hysteresis band of $H = 10$ units so agents near the boundary don't flip state every frame
  (temporal aliasing).
- **Animation LOD** — pedestrians are the CPU bottleneck, so kinematics are decimated by distance:
  near agents get full-rate $C^1$ walk cycles, mid agents update every $N$ frames, far agents hold
  a cached neutral pose. Roughly 60% off animation overhead.
- **Light and shadow pooling** — only the 12 nearest lamps hold active `SpotLight` objects, and PCF
  shadows are culled beyond 25 units, bounding fragment-shader cost and VRAM bandwidth.

**Anti-aliasing.** High-frequency geometry (railings, rooftops) is handled in two passes: hardware
MSAA for geometric sub-sampling, plus a post-process FXAA pass detecting luma discontinuities to
smooth the shader-based and alpha-tested edges (the rocks) that the rasteriser misses.

**Bloom.** Optical scattering is simulated in three stages — a bright-pass isolating emissive
signals above $l_{\text{in}} > 0.3$, Gaussian convolution modelling light spread ($r = 0.4$), then
additive blending *before* tone mapping so HDR intensities up to 6.0 survive. Combined with
time-reactive HSL shifts in the Bézier canopy, this is what holds the festival aesthetic together
across the day/night cycle.

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
docs/                 Architecture notes and the demo capture
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

## Licence

[MIT](LICENSE) — © Pulindu Fonseka.
