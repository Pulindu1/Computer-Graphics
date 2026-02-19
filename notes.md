# Comprehensive Implementation Notes — ACG Coursework

> Detailed technical breakdown mapped to each question/section of the specification. Use these notes for the 2-page report and 1-minute video.

---

## Question 1: Graphics Application Design (16 Marks)

### 1a) Video Walkthrough (6 Marks)

**Key talking points for the video:**

1. **Scene overview**: A stylised interpretation of Durham Riverbanks transformed for a light festival. Two hilltop streets with procedural houses face each other across a meandering river. A Bézier surface canopy glows above Street 2, and hundreds of light agents swarm along the river corridor.
2. **Performance architecture**: Demonstrate toggling between O(N²) brute-force and O(N) spatial hash neighbour search — show FPS counter staying at 60 FPS with 1000+ orbs. Toggle the HUD stats overlay to show candidate checks dropping from N² to a fraction.
3. **Crowd simulation**: Show walkway pedestrians with flow-field navigation, lane-following, separation/alignment/cohesion, queueing, and leader-following. Show street pedestrians with group-based wander + pyramid avoidance + light cube obstacle avoidance.
4. **Parametric canopy**: Show the Bézier blanket animating with traveling waves. Toggle the control lattice debug view to reveal the 4×4 control point grid. Adjust UI sliders for wave amplitude, speed, wavelength in real-time.
5. **Post-processing**: Toggle bloom on/off to show how it unifies the light festival aesthetic. Show FXAA reducing spatial aliasing on high-frequency geometry edges.
6. **LOD systems**: Zoom in/out on houses to show 3-level LOD switching. Show orb LOD (near = larger, more detailed sphere; far = smaller, brighter spark). Show street lamp light-pool LOD (only N nearest lamps cast real spotlights).
7. **Debug views**: Toggle spatial grid overlay, heatmap (occupancy colouring), and query cell overlay to show exactly which cells are searched.

### 1b) Two-Page Report (10 Marks)

See sections below for content to include under each pillar.

---

## Question 2: Parametric Environments & Spatial Awareness (24 Marks)

### 2a) Parametric Modelling (12 Marks)

#### 2a-i. Procedural Terrain Generation

**File**: `src/environment/terrainHeight.js`

The terrain is generated entirely procedurally using a composite height function — no external 3D assets are loaded.

**Height function** (evaluated at every vertex of a 201×51 grid = 10,251 vertices):

$$y(x,z) = \text{base}(x,z) + \text{valley}(d)$$

where $d = |x - c_x(z)|$ is the distance from the river centreline.

**Base undulation** uses superimposed sinusoidal waves (low-frequency noise approximation):

$$\text{base}(x,z) = A_1 \sin\!\left(\frac{x + s}{\lambda_1}\right) + 0.55\,A_1 \cos\!\left(\frac{z - s}{0.95\,\lambda_1}\right) + A_2 \sin\!\left(\frac{x+z}{\lambda_2}\right)$$

Parameters: $A_1 = 12$, $\lambda_1 = 220$, $A_2 = 4$, $\lambda_2 = 110$, $s = 13.37$.

**River centreline meander** (same equation used in `terrain.js`, `water.js`, `riverCorridor.js`):

$$c_x(z) = A_m \sin\!\left(\frac{z + s}{\lambda_m}\right) + 0.35\,A_m \sin\!\left(\frac{z - s}{0.55\,\lambda_m}\right)$$

with $A_m = 55$, $\lambda_m = 140$. This dual-frequency sinusoidal creates a natural-looking, non-repetitive meander.

**Valley profile** uses a bounded ramp function to create steep valley walls rising to hilltop plateaux:

$$\text{valley}(d) = \left[\text{smoothstep}\!\left(0,\; W_r,\; \max(0,\, d - W_f)\right)\right]^{p} \times H_{\max}$$

where $W_f = 30$ (floodplain width), $W_r = 240$ (ramp width), $p = 2.6$ (steepness exponent), $H_{\max} = 180$ (maximum hill height).

**Smoothstep** is the standard Hermite interpolation:

$$\text{smoothstep}(e_0, e_1, x) = t^2(3 - 2t), \quad t = \text{clamp}\!\left(\frac{x - e_0}{e_1 - e_0},\; 0,\; 1\right)$$

This provides $C^1$ continuity at transitions (no visible seams between flat and sloped regions).

**River carving**: The river surface is forced flat at $y_w = -6$ using a smooth mask:

$$\text{riverMask}(d) = 1 - \text{smoothstep}(R_{\text{inner}}, R_{\text{outer}}, d)$$

$$y_{\text{final}} = y \cdot (1 - \text{riverMask}) + y_w \cdot \text{riverMask}$$

with $R_{\text{inner}} = 56$, $R_{\text{outer}} = 72$. This blends the terrain seamlessly into the flat river surface.

**Walkway ring**: A similar mask creates a flat walkway zone on either side of the river.

**Terrain field API** (`src/environment/terrainField.js`): Provides continuous gradient and slope evaluation via central finite differences:

$$\nabla h(x,z) = \left(\frac{h(x+\varepsilon,z) - h(x-\varepsilon,z)}{2\varepsilon},\; \frac{h(x,z+\varepsilon) - h(x,z-\varepsilon)}{2\varepsilon}\right), \quad \varepsilon = 0.5$$

$$\text{slope}(x,z) = \|\nabla h\| = \sqrt{\left(\frac{\partial h}{\partial x}\right)^2 + \left(\frac{\partial h}{\partial z}\right)^2}$$

**Height interpolation** (`terrain.js`, `heightAt` function): Uses bilinear interpolation for sub-grid queries:

$$h(x,z) = (1-t_x)(1-t_z)\,h_{00} + t_x(1-t_z)\,h_{10} + (1-t_x)t_z\,h_{01} + t_x t_z\,h_{11}$$

where $(t_x, t_z)$ are fractional coordinates within the grid cell.

**Post-height smoothing**: A box-blur kernel (5 iterations, strength 0.55) is applied to the height grid, with a protection mask that preserves river and walkway sharpness.

**Vertex colouring**: Grass colour varies with a sine pattern; walkway and river colours are blended in using the mask values, giving smooth colour transitions without texture maps.

#### 2a-ii. Procedural River & Water Surface

**File**: `src/environment/water.js`

A ribbon mesh (260×6 segments) follows the river centreline. Each vertex is offset by the meander function $c_x(z)$. Material uses `MeshPhysicalMaterial` with clearcoat for a glass-like water appearance. The water surface is rendered at a constant $y = y_w + 0.35$ (avoids z-fighting with terrain).

#### 2a-iii. Procedural Walkways & Railings

**File**: `src/environment/riverWalkways.js`

Walkway platforms are constructed as triangle strips between two parallel edge curves computed from the river centreline ± offset. Tangent and normal vectors are computed from finite differences of the meander function. Railings are built as a separate triangle strip extruded vertically from each edge.

**File**: `src/environment/walkwayCurves.js`

Catmull-Rom spline curves (`THREE.CatmullRomCurve3`) are fitted through 101 sample points along each walkway centre. These splines serve as the flow-field path for crowd navigation.

#### 2a-iv. Procedural Houses with LOD

**File**: `src/world/houseFactory.js`

Houses are generated procedurally using a seeded pseudo-random number generator (`SeededRandom` class using linear congruential generator: $\text{seed}_{n+1} = (9301 \cdot \text{seed}_n + 49297) \bmod 233280$). This ensures **deterministic** output — the same seed always produces the same house.

Each house is composed from primitives:
- **Body**: `BoxGeometry` with randomly selected wall colour from palette
- **Roof**: Randomly selected gable (`ConeGeometry` with 4 segments) or flat (`BoxGeometry`)
- **Windows**: Emissive `PlaneGeometry` planes on front face
- **Door**: `BoxGeometry` on front face

**THREE.LOD** object with 3 detail levels:
| Level | Distance | Content | Shadows |
|-------|----------|---------|---------|
| LOD0 | 0–700 | Full detail (body + roof + windows + door) | Cast + Receive |
| LOD1 | 700–2000 | Simplified (body + flat roof only) | Receive only |
| LOD2 | 2000+ | Single box silhouette | None |

Material caching (`materialCache` Map) avoids redundant material allocations across all houses.

#### 2a-v. Terrain Flattening for Streets

**File**: `src/world/streetMask.js`

Streets are carved into the terrain by modifying the height grid in-place. For each terrain vertex, the signed distance to the rectangular street footprint is computed:

$$d_{\text{rect}} = \sqrt{\max(0,\, |x - c_x| - w)^2 + \max(0,\, |z - c_z| - l)^2}$$

A blend weight determines how much the terrain is flattened:

$$w_b = \text{smoothstep}(0,\; W_s,\; d_{\text{rect}})$$

$$h_{\text{final}} = h_{\text{street}} \cdot (1 - w_b) + h_{\text{original}} \cdot w_b$$

where $W_s = 40$ (shoulder blending width). This gives a smooth terrain-to-street transition with no visible hard edge.

#### 2a-vi. Bézier Surface Canopy (Parametric Surface)

**File**: `src/parametric/bezierBlanket.js`

A **tensor-product cubic Bézier surface** defined over a 4×4 control lattice:

$$\mathbf{S}(u,v) = \sum_{i=0}^{3}\sum_{j=0}^{3} B_i(u)\, B_j(v)\, \mathbf{P}_{ij}, \quad u,v \in [0,1]$$

**Bernstein basis polynomials** (cubic, degree $n=3$):

$$B_0(t) = (1-t)^3, \quad B_1(t) = 3(1-t)^2 t, \quad B_2(t) = 3(1-t)t^2, \quad B_3(t) = t^3$$

These satisfy the partition of unity: $\sum_{i=0}^{3} B_i(t) = 1$ for all $t \in [0,1]$, guaranteeing the surface lies within the convex hull of its control points.

**Mesh topology**: Static index buffer with $(40+1) \times (120+1) = 4961$ vertices and $40 \times 120 \times 2 = 9600$ triangles. Only vertex positions are recomputed each frame; topology, UVs, and index buffer are allocated once.

**Control lattice initialisation**: 16 control points placed in world space using the street reference frame (centre, tangent, normal). Initial drape (fabric sag) applied as:

$$\Delta y = A_d \cdot \sin(\pi u) \cdot \sin(\pi v)$$

where $A_d = 8$ is the drape amplitude. This creates a natural fabric-like rest shape.

**Animation** (control-point-driven): Each frame, control points are displaced vertically by a composite wave function:

$$y_{\text{wave}} = A_w \sin\!\left(\frac{2\pi v}{\lambda_w} + t \cdot s_w\right) + 0.5\,A_w \sin(\pi u)\cos(\phi) + 0.4\,A_w \sin(0.7\phi + \pi u)$$

where $\phi = \frac{2\pi v}{\lambda_w} + t \cdot s_w$, $A_w = 12$ (wave amplitude), $s_w = 2.5$ (wave speed), $\lambda_w = 6$ (wavelength).

The first term creates a **traveling wave** along the length. The second term adds **cross-direction variation** modulated by $\sin(\pi u)$ (maximum at centre, zero at edges). The third term adds a **secondary ripple** at a different frequency for organic complexity.

**Light show** (emissive modulation):

$$I_{\text{emissive}}(t) = I_0 \cdot \left(0.5 + 0.4\sin(1.5t) + 0.3\sin(0.7t)\right)$$

Colour animation shifts through the blue spectrum using HSL space:

$$h(t) = 0.5 + 0.2\sin(0.6t), \quad l(t) = 0.4 + 0.1\sin(0.8t)$$

#### 2a-vii. Attraction Pyramid

**File**: `src/world/attractionPyramid.js`

A `ConeGeometry(12, 25, 4)` with bright pink emissive material ($I_e = 6.0$) serving as the crowd attraction focal point. A `PointLight` with shadow mapping (1024² shadow map, PCF) illuminates the surrounding street. Gentle bobbing animation: $\Delta y = 0.5 \sin(0.5t)$.

#### 2a-viii. Light Festival Installation

**File**: `src/world/lightFestival.js`

Instanced spheres (3 rows × 16 per row = 48 lights) positioned along the street coordinate frame. Each light animates independently with:

$$y_i(t) = y_{\text{base}} + A_i \sin(s_i \cdot t + \phi_i)$$

where $A_i \in [0.85A, 1.15A]$, $s_i \in [0.9s, 1.1s]$, $\phi_i$ provides wave coherence across rows. Per-instance colours cycle through a palette (blue/pink). Uses `InstancedMesh` with `DynamicDrawUsage` — single draw call for all lights.

#### 2a-ix. Atmospheric Light Cubes

**File**: `src/world/lightCubes.js`

Small emissive cubes (3×3×3 units) with glow halos (transparent spheres, radius 7.5). Cubes are placed along Street 2 at 40-unit intervals. Each cube pulses emissive intensity and bobs vertically. The halo spheres pulse out of phase (π offset) creating a "breathing" visual effect. Serve dual purpose: atmospheric lighting + pedestrian collision obstacles (radius 2.4 units).

### 2b) Spatial Discretisation (12 Marks)

#### 2b-i. Uniform Grid

**File**: `src/spacial/uniformGrid.js`

A 2D uniform grid on the XZ plane. Cell coordinates computed as:

$$c_x = \lfloor x / w_c \rfloor, \quad c_z = \lfloor z / w_c \rfloor$$

where $w_c$ is the cell size (default 10 units). Buckets are stored in a `Map` keyed by `"cx,cz"` string. Supports insert, getBucket, and `getNeighbourBuckets(x, z, radius)` which returns all buckets in a $(2r+1)^2$ neighbourhood.

#### 2b-ii. Spatial Hash (Orb Swarm)

**File**: `src/agents/spatialHash.js`

**Optimised integer-key spatial hash** for the orb swarm. Instead of string keys, uses bit-packed integer keys for allocation-free hashing:

$$\text{key} = ((c_x + 2^{15}) \mathbin{\&} \text{0xFFFF}) \ll 16 \;\mid\; ((c_z + 2^{15}) \mathbin{\&} \text{0xFFFF})$$

This avoids string allocations entirely (critical for 1000+ agents per frame).

**Query**: `queryInto(x, z, r, out)` fills a pre-allocated array (no per-query allocation). Searches a $(2 \lceil r/w_c \rceil + 1)^2$ neighbourhood of cells.

**Cell size tuning**: Set to $w_c = 1.25 \times R_s$ where $R_s = 4.0$ is the separation radius. This ensures each query checks at most a 3×3 grid of cells.

**Complexity analysis**:
- **Brute-force**: $O(N^2)$ distance checks per frame (every agent vs every other)
- **Spatial hash**: $O(N \cdot k)$ where $k \ll N$ is the average number of agents in neighbouring cells
- For uniformly distributed agents: $k \approx N \cdot \frac{A_{\text{query}}}{A_{\text{total}}}$
- With 1000 agents, the query area is typically $\sim 3 \times 3$ cells out of hundreds → $k \approx 5\text{–}20$

The HUD displays `candidateChecks` and `neighborPairs` per frame, demonstrating the efficiency difference directly.

#### 2b-iii. Spatial Hash (Crowd Pedestrians)

**File**: `src/crowd/SpatialHashGrid.js`

Separate spatial hash for the walkway crowd simulation. Uses string keys `"cx,cz"` with cell size matching the neighbour radius. 3×3 neighbourhood query.

**File**: `src/world/streetPedestrians.js` (inner `SpatialHash` class)

Street pedestrian crowds use their own spatial hash (cell size = 6 units). Supports `getNear(x, z, radius)` for variable-radius queries.

#### 2b-iv. Debug Visualisations

**File**: `src/spacial/debugGridRenderer.js`

Renders the uniform grid as a world-space line grid on the XZ plane using `LineSegments`. Toggled via UI.

**File**: `src/spacial/heatmapRenderer.js`

Occupancy heatmap: `InstancedMesh` of flat planes coloured by agent density per cell. Colour mapping: blue (cold, few agents) → yellow → red (hot, many agents). Updates per frame from `spatial.getOccupiedCells()`.

**File**: `src/spacial/queryCellOverlay.js`

Query cell overlay: Highlights all grid cells accessed during neighbour queries in yellow. Demonstrates exactly which cells are searched per frame — visual proof that the spatial hash limits the search to a small neighbourhood.

#### 2b-v. Procedural Vegetation: Trees & Rocks

**Files**: 
- `src/environment/trees/TreeSystem.js` — Tree orchestrator
- `src/environment/trees/treePlacement.js` — Placement algorithm
- `src/environment/trees/treeMeshes.js` — Geometry & GPU wind shader
- `src/environment/trees/treeLodBuckets.js` — 3-tier LOD management
- `src/environment/vegetation/VegetationSystem.js` — Rock billboarding system
- `src/environment/vegetation/vegetationPlacement.js` — Vegetation placement
- `src/environment/vegetation/vegetationMeshes.js` — Billboard geometry

**Tree Placement Algorithm**:

Procedural placement uses candidate sampling with rejection testing. Budget: O(count × 30) ≈ 24,000 iterations for 800 trees.

**Rejection criteria** (cheapest to most expensive):
1. **River corridor**: Reject if inside $d < R_{\text{river}} + m_r$ where $R_{\text{river}} = 56$, $m_r = 12$
2. **Street exclusion**: Reject if inside any street rectangle (halfWidth = 50, halfLength = 300) plus margin $m_s = 55$
3. **Slope gate**: Reject if $\|\nabla h\|^2 > \text{maxSlope}^2 = 3.0$ (allows steep hill placement)
4. **Height gate**: Reject if $y < -3$ (avoids riverbed)
5. **Spacing grid**: O(k) occupancy grid (cell size = minSpacing = 18) ensures no two trees closer than 18 units — avoids O(N²) brute-force

**Distribution**:
- 60% large trees (7-seg trunk + 8-seg cone, scale 8.0–15.0)
- 40% small trees (4-seg trunk + 5-seg cone, 0.66× scale)
- Total: ~800 trees across accessible terrain

**GPU Wind Animation**:

Wind is entirely GPU-driven. Shader patches the material's vertex shader via `onBeforeCompile`:

$$\text{worldPos} = \text{instanceMatrix} \times \text{origin}$$
$$\text{phase} = \text{worldPos}.x + 0.5 \times \text{worldPos}.z \quad \text{(spatial coherence)}$$
$$\text{sway} = \sin(\text{phase} + u_{\text{windTime}} \times u_{\text{windSpeed}}) \times \text{strength}$$
$$\text{displaceZ} = \text{sway} \times (y / \text{trunkHeight})$$

This gives each tree a unique wind phase based on position, creating natural spatial variation without per-tree CPU updates. Single uniform update per frame (one float): $\Delta u_{\text{windTime}} = \Delta t$.

**Tree LOD System** (`treeLodBuckets.js`):

3-tier LOD with distance-based redistribution every 0.25 seconds (not per-frame):

| Tier | Range | Trunk | Leaves | Wind | Comment |
|------|-------|-------|--------|------|---------|
| NEAR | 0–80m | 7 seg | 8 seg | ✓ | Full detail, wind animation |
| MID | 80–180m | 5 seg | 6 seg | ✗ | Medium fidelity, no wind |
| FAR | >180m | 4 seg | 4 seg | ✗ | Minimal, fast rendering |

**Hysteresis**:
- Enter NEAR at 80m, exit at 95m (15m gap prevents pop-in)
- Enter FAR at 185m, exit at 170m (15m gap prevents oscillation)

Total GPU cost: ~2 draw calls (trunk + leaves) per LOD tier × 3 tiers + wind shader = negligible overhead vs. individual trees.

**Rock Vegetation** (Billboarded Quads):

~400 rocks scattered on grass (same placement rules as trees, but minSpacing = 8).

**Billboard technique**:
- Geometry: Simple 1×1 quad (2 triangles, 4 vertices)
- Material: Transparent `MeshStandardMaterial` with `alphaTest = 0.1` (discard black background pixels)
- Per-frame rotation: Each quad rotates to face camera via `lookAt(camera.position)`
- Instancing: Single `InstancedMesh` call (1 draw call for all rocks)
- Scale: 3.0× to match landscape size

Cost per frame: 1 matrix update per rock (camera-facing rotation) in `vegetationSystem.update(camera)`, plus 1 instanced draw call. Total: O(N) CPU, 1 GPU call.

---

## Question 3: High-Density Crowd Simulation & Kinematics (40 Marks)

### 3a) Crowd Intelligence (15 Marks)

#### 3a-i. Orb Swarm (River Light Agents)

**File**: `src/agents/orbSwarm.js`

300–1000+ autonomous "Light Agents" (orbs) flowing along the river corridor. State stored in **Structure-of-Arrays** (SoA) layout for cache efficiency:

```
z[N], dx[N], dxVel[N], yOff[N], speed[N], phase[N], side[N]
```

**Behaviours**:

1. **Forward motion**: Agents advance along Z at speed $s_i \in [10, 18]$ units/sec
2. **Lateral swerve**: Each agent tracks a smoothly varying target offset from the river centre:
   $$\text{target}_i = A_s \sin(z_i \cdot f_s + \phi_i)$$
   with $A_s = 10$, $f_s = 0.02$. Steering uses a spring-damper model:
   $$\dot{v}_{x,i} = (\text{target}_i - dx_i) \cdot K_s \cdot dt, \quad v_{x,i} \leftarrow v_{x,i} \cdot \gamma$$
   where $K_s = 3.5$ (stiffness), $\gamma = 0.92$ (damping)
3. **Separation** (collision avoidance): For each neighbour $j$ within radius $R_s = 4.0$:
   $$\text{push}_i += \frac{(dx_i - dx_j)}{d_{ij}} \cdot w_{ij}, \quad w_{ij} = \frac{R_s - d_{ij}}{R_s}$$
   Capped at 24 neighbours per agent for predictable cost. Applied as: $v_{x,i} += \text{push} \cdot S_s \cdot dt$ where $S_s = 18$.
4. **Boundary confinement**: River-edge clamping with elastic bounce ($v_{x} \times -0.35$)
5. **Vertical bobbing**: $y_i = y_w + h_b + A_h \sin(t \cdot f_h + \phi_i)$ confined to $[0.2, 2.2]$
6. **Respawn**: Agents wrapping past $z_{\max}$ respawn at $z_{\min}$ on alternating sides

**Dual search modes** (togglable via UI):
- **Hash mode**: Uses `SpatialHash.queryInto()` — O(N·k) per frame
- **Naive mode**: Brute-force O(N²) — for comparison/demo purposes

#### 3a-ii. Walkway Crowd (River Walkway Pedestrians)

**File**: `src/crowd/CrowdZoneWalkway.js`

Full state-based crowd simulation with **Prioritised Dithering Accumulator** for steering force resolution.

**Behaviour States** (finite state machine):
| State | Description | Key Weights |
|-------|-------------|-------------|
| CRUISE | Normal walking | High flow + lane |
| QUEUE | Behind another agent | High queue + separation |
| AVOID | Collision imminent | High separation (3.0) |
| IDLE | Standing still | Minimal forces |
| LEADER | Exploring + guiding | High wander |

**Speed Modes**: IDLE (0), WALK (0.01), FAST (0.05) — stochastically selected with timers.

**Steering forces** (applied in priority order):

1. **Separation** ($P_1$ — highest priority, cannot be overridden):
   $$\mathbf{F}_{\text{sep}} = \frac{1}{k} \sum_{\text{neighbours}} \frac{\hat{\mathbf{d}}_{ij}}{d_{ij}^2} \quad (\text{if } d > d_{\min}: \text{gentle})$$
   $$\mathbf{F}_{\text{sep}} = \frac{4(d_{\min} - d)}{d_{\min}} \hat{\mathbf{d}}_{ij} \quad (\text{if } d < d_{\min}: \text{strong push})$$

2. **Queueing** ($P_2$): Braking force when agent ahead in movement direction:
   $$\mathbf{F}_{\text{queue}} = -0.6 \cdot \frac{R_b - d}{R_b} \cdot \mathbf{v}_i \quad (\text{if } \hat{\mathbf{d}}_{ij} \cdot \hat{\mathbf{v}}_i > 0.3)$$

3. **Flow-field** ($P_3$): Follow path tangent: $\mathbf{F}_{\text{flow}} = s_d \cdot \hat{\mathbf{T}}(t) \cdot \text{dir} - \mathbf{v}_i$

4. **Lane-following** ($P_3$): Lateral force toward assigned lane: $\mathbf{F}_{\text{lane}} = 0.3 s_d \cdot \hat{\mathbf{n}}_{\perp}$

5. **Alignment** ($P_4$): Match average neighbour velocity: $\mathbf{F}_{\text{ali}} = \frac{1}{k}\sum \mathbf{v}_j - \mathbf{v}_i$

6. **Cohesion** ($P_4$): Move toward centre of mass: $\mathbf{F}_{\text{coh}} = \hat{\mathbf{d}}_{\text{COM}} \cdot s_d - \mathbf{v}_i$

7. **Wander** ($P_5$): Random perturbation: $\mathbf{F}_{\text{wander}} = s_d \cdot (\alpha\hat{\mathbf{T}} + \sin(\theta_w)\hat{\mathbf{N}})$ where $\theta_w$ drifts randomly

8. **Leader-following** ($P_6$): Agents follow closest leader's "ghost point" (offset behind leader):
   $$\mathbf{p}_{\text{ghost}} = \mathbf{p}_{\text{leader}} - \delta \cdot \hat{\mathbf{v}}_{\text{leader}}, \quad \delta = 3.0$$

**Prioritised Dithering**: Forces are accumulated in priority order. If the accumulated force exceeds $0.8 \cdot F_{\max}$ after a priority tier, lower priorities are skipped. This prevents low-priority forces from overriding safety-critical avoidance.

**Hard collision resolution**: After integration, overlapping agents are pushed apart:
$$\mathbf{p}_i \mathrel{+}= 0.5 \cdot (d_{\min} - d) \cdot \hat{\mathbf{d}}_{ij}$$

**Path containment**: Soft edge repulsion at 80% of corridor width, hard clamp at boundary. Velocity projected onto tangent at boundaries to prevent agents "sticking" to walls.

#### 3a-iii. Street Pedestrians (Hill Street Crowds)

**File**: `src/world/streetPedestrians.js`

Group-based crowd with leader/follower dynamics on the hilltop streets.

**Behaviours**:
- **Leader wander**: 15% of agents are leaders who explore randomly
- **Follower cohesion**: Non-leaders track their group leader
- **Pedestrian avoidance**: Spatial hash + distance-based repulsion
- **House avoidance**: Rectangular obstacle avoidance for procedural houses
- **Pyramid avoidance**: Strong repulsion zone (25 units) around the attraction pyramid
- **Pyramid attraction**: Gentle horizontal-only pull ($F = 0.08 \cdot w_a$) to prevent climbing
- **Light cube avoidance**: Obstacle avoidance around atmospheric light installations
- **Boundary wrapping**: Agents wrap around street boundaries for continuous population
- **Group rebalancing**: Groups periodically dissolve and reform (10–30 second lifespan)

**Ground constraint**: Y-position locked to street height every frame; Y-velocity zeroed. This prevents agents from floating or climbing.

### 3b) Procedural Kinematics (10 Marks)

**File**: `src/crowd/MiniPersonFactory.js`

**Articulated humanoid mesh** built from primitive geometries (no pre-baked animations):
- Head: `SphereGeometry` (skin material)
- Torso: `CylinderGeometry` (body colour material)
- Arms × 2: `BoxGeometry` (body colour)
- Legs × 2: `BoxGeometry` (body colour)

All parts are children of a `THREE.Group` with stored references for animation.

**`animateHumanoid()` function — Forward Kinematics**:

1. **Facing direction**: Smooth quaternion SLERP toward velocity direction:
   $$\theta_{\text{target}} = \text{atan2}(v_x, v_z)$$
   $$\mathbf{q}_{\text{mesh}} \leftarrow \text{slerp}(\mathbf{q}_{\text{mesh}},\; \mathbf{q}_{\text{target}},\; 0.2)$$

2. **Walk cycle** (sinusoidal FK):
   - Walk frequency: $f = 2 + 5 \cdot |\mathbf{v}|$ Hz (scales with speed)
   - Leg swing (alternating): $\theta_{\text{L}} = 0.6\sin(f \cdot t)$, $\theta_{\text{R}} = -\theta_{\text{L}}$
   - Arm swing (counter-phase): $\theta_{\text{LA}} = -0.5\sin(f \cdot t)$, $\theta_{\text{RA}} = 0.5\sin(f \cdot t)$
   - Vertical bob: $\Delta y = |\sin(2ft)| \cdot (0.05 + 0.15|\mathbf{v}|)$

3. **Idle pose**: Limb rotations decay toward rest: $\theta \leftarrow 0.95\theta$ (exponential return to zero)

4. **Velocity-reactive**: Walk frequency and bob amplitude increase with speed, creating a natural transition from slow stroll to brisk walk.

This is **procedural Forward Kinematics** — joint rotations are computed each frame from agent velocity/state without pre-baked animation clips.

### 3c) Rendering Optimisation Pipeline (15 Marks)

#### 3c-i. Hardware Instancing

**Orb Swarm** (`src/agents/orbRenderer.js`, `orbLodRenderer.js`):

`THREE.InstancedMesh` renders all orbs in **2 draw calls** (near LOD + far LOD). Instance matrices are updated per frame:

```javascript
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
// Per frame: compute world position, set matrix, mark needsUpdate
```

`DynamicDrawUsage` hint tells the GPU driver to expect frequent updates, enabling optimal buffer strategy (e.g., double-buffering or unsynchronised mapping).

**Data flow (CPU → GPU)**:
1. CPU computes world positions from SoA arrays ($O(N)$)
2. CPU writes 4×4 matrices into instance buffer ($16N$ floats = $64N$ bytes)
3. `instanceMatrix.needsUpdate = true` triggers GPU upload
4. GPU renders all instances in 1 draw call per LOD tier

**Bandwidth**: For 1000 agents, only $2 \times 64 \times 1000 = 128\text{KB}$ per frame — well within PCIe throughput limits.

**Light Festival** (`src/world/lightFestival.js`): 48 animated spheres in 1 `InstancedMesh` with per-instance colours (`InstancedBufferAttribute`).

**Street Lamps** (`src/environment/StreetLampSystem.js`): All poles in 1 `InstancedMesh`, all orbs in 1 `InstancedMesh` — 2 draw calls for all lamps.

**Heatmap** (`src/spacial/heatmapRenderer.js`): Occupancy visualisation uses `InstancedMesh` with per-instance colours.

**Query Cell Overlay** (`src/spacial/queryCellOverlay.js`): Debug overlay uses `InstancedMesh`.

#### 3c-ii. Chunked Instancing with Frustum Culling

**File**: `src/agents/chunkedInstancing.js`, `orbLodRendererChunked.js`

Advanced optimisation: Agents are spatially partitioned into **chunks** (groups of up to 512 agents per spatial region). Each chunk gets its own `InstancedMesh` with `frustumCulled = true`. Chunks off-screen are automatically culled by Three.js's frustum test — no CPU work needed for invisible agents.

- Chunks rebuilt every 60 frames (≈1 second)
- Camera stationarity optimisation: If camera moved < 0.5 units and frame ≢ 0 (mod 4), skip LOD update entirely
- LOD distance thresholds pre-squared to avoid `sqrt()` per agent: $d_{\text{near}}^2 = (L_d - H)^2$, $d_{\text{far}}^2 = (L_d + H)^2$

#### 3c-iii. LOD Distance Switching with Hysteresis

**Orb LOD** (`src/agents/orbLodRenderer.js`):

Two sphere tiers: near (radius 0.65, 10×10 segments) and far (radius 0.35, 8×8 segments).

**Hysteresis** prevents LOD popping/flickering:
- Enter near: $d < L_d - H$ (must be clearly close)
- Exit near: $d > L_d + H$ (must be clearly far)

where $L_d = 70$ (switching distance), $H = 10$ (hysteresis buffer).

Without hysteresis, an agent at exactly $d = L_d$ would flicker between LOD0 and LOD1 every frame.

**Hidden instance optimisation**: Instead of removing instances (expensive count change), hidden agents are moved to $y = -99999$ with scale $10^{-4}$. This maintains stable instance count and avoids buffer reallocation.

#### 3c-iv. Performance Instrumentation

**File**: `src/perf.js` — Lightweight `performance.now()` timing wrapper.

**File**: `src/stats.js` — Per-frame counters:
- `candidateChecks`: Total distance checks attempted
- `neighborPairs`: Actual neighbours within radius
- `queriedCells`: Grid cells touched

HUD displays real-time: FPS, frame time, swarm update time, LOD update time, heatmap update time.

---

## Question 4: Adaptive Rendering & Visual Signal Processing (20 Marks)

### 4a) Adaptive Level of Detail (10 Marks)

#### 4a-i. House LOD (Discrete LOD)

**File**: `src/world/houseFactory.js`

Uses `THREE.LOD` built-in system with 3 discrete levels (see table in §2a-iv). Switching distances are generous (700 and 2000 units) to avoid visible popping. LOD1 removes small detail (windows, door, gable roof → flat box). LOD2 reduces to a single box silhouette with no shadow interaction.

The `update(camera)` call in `streetDistrict.js` triggers Three.js's built-in LOD distance test per frame.

#### 4a-ii. Orb Agent LOD (Instanced LOD)

**File**: `src/agents/orbLodRenderer.js`

Near/far sphere geometry + material distinction:
- **Near**: Larger radius (0.65), warmer emissive (0x9bd7ff, intensity 2.2), 10×10 segments
- **Far**: Smaller radius (0.35), brighter emissive (0xffffff, intensity 1.4), 8×8 segments → appears as a tight spark

Hysteresis-based switching prevents popping (see §3c-iii).

#### 4a-iii. Street Lamp Lighting LOD

**File**: `src/environment/StreetLampSystem.js`

**Light pool** with 12 reusable `SpotLight` objects. Per frame:
1. Sort all lamps by distance to camera
2. Assign the 12 nearest (within 250 units) to the spotlight pool
3. Shadow LOD: Only lamps within 25 units cast shadows (shadow map 512²)
4. All other lamps: emissive orb glow only (no real light contribution) — visually identical at distance

This bounds the lighting cost to a constant maximum regardless of lamp count.

#### 4a-iii. Tree LOD & Vegetation Billboard Rendering

**Tree LOD System** (`src/environment/trees/treeLodBuckets.js`):

Implements **discrete 3-tier LOD** with hysteresis-based transitions (see §2b-v):

- **NEAR tier** (0–80m): Full geometric detail (7-seg trunk, 8-seg cone) + GPU wind animation
  - Redistribution: Every 0.25 seconds (not per-frame) to amortise cost
  - Hysteresis: Enter at 80m, exit at 95m (15m buffer prevents pop-in oscillation)
  
- **MID tier** (80–180m): Reduced segments (5-seg trunk, 6-seg cone), no wind
  - Shader simplification reduces per-vertex computation
  - Still rendered via InstancedMesh for efficiency
  
- **FAR tier** (>180m): Minimal geometry (4-seg trunk, 4-seg cone)
  - Culled from view at distances >250m entirely

**Billboard Rendering** (vegetation rocks):

Uses **screen-space oriented quads** (1×1 geometry, 2 triangles) with camera-facing rotation per frame. No distance-based LOD (rocks are sparse enough that 1 mesh suffices for all distances). Transparency and `alphaTest` provide natural silhouette edges without explicit depth sorting.

### 4b) Signal Processing & Light Transport (10 Marks)

#### 4b-i. Post-Processing Pipeline

**File**: `src/main.js` (lines 36–97)

**EffectComposer** with 3 passes:

1. **RenderPass**: Base scene rendering to offscreen framebuffer
2. **UnrealBloomPass**: Bright-pass extraction + Gaussian blur for optical bloom simulation
   - Threshold: 0.3 (only pixels brighter than 30% bloom)
   - Strength: 0.8 (bloom contribution)
   - Radius: 0.4 (Gaussian blur kernel spread)
   
   This simulates the real optical phenomenon where bright light sources scatter in camera lenses. Applied to: pyramid emissive, orb emissive, light festival spheres, Bézier blanket emissive, light cube emissive — unifying the "Light Festival" aesthetic.

3. **FXAA (Fast Approximate Anti-Aliasing)**: Screen-space edge detection + blending
   - Addresses **spatial aliasing** on high-frequency geometry edges (house rooflines, walkway railings, terrain silhouettes)
   - Resolution uniforms updated on window resize: $\text{resolution} = (1/w, 1/h)$
   - FXAA operates in screen space at sub-pixel level, detecting luminance discontinuities and blending across them

#### 4b-ii. Anti-Aliasing Strategy

**Hardware MSAA**: Renderer configured with `antialias: true` in `initThree.js`, providing multi-sample anti-aliasing at the rasterisation stage.

**FXAA post-process**: Additional screen-space AA pass catches remaining aliasing artifacts that MSAA misses (e.g., shader-generated edges, alpha-tested geometry).

**Pixel ratio capping**: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` prevents excessive supersampling on high-DPI displays while maintaining quality.

#### 4b-iii. Emissive Material Strategy (Bloom-Friendly Rendering)

All "light" objects use `MeshStandardMaterial` with high `emissiveIntensity` values:
| Object | Emissive Colour | Intensity | Purpose |
|--------|----------------|-----------|---------|
| Orbs (near) | 0x9bd7ff | 2.2 | River light agents |
| Orbs (far) | 0xffffff | 1.4 | Far agents (brighter to compensate size) |
| Pyramid | 0xff1493 | 6.0 | Focal attraction point |
| Light festival | 0x0088ff | 5.0 | Street decoration |
| Lamp orbs | 0xffd966 | 2.0 | Walkway illumination |
| Bézier blanket | Animated HSL | 3.5 (pulsing) | Canopy glow |
| Light cubes | 0x00ff88 | 2.5 (pulsing) | Street 2 atmosphere |
| Fireflies | 0x00ff00 | 4.0 | Ambient particles |
| House windows | 0xffff88 | 0.3 | Lit window glow |

The bloom threshold (0.3) is tuned so that only these emissive objects bloom, while standard geometry (grass, houses, walkways) remains unaffected. This creates a unified "light festival" look where glowing elements have visible halos.

#### 4b-iv. Bézier Surface Emissive Animation

The canopy surface cycles through colour and intensity over time:
- **Dual-frequency intensity pulsing**: Creates organic, non-repetitive rhythm
- **HSL colour animation**: Hue shifts between cyan (0.3) and deep blue (0.7), simulating programmed lighting effects
- Combined with bloom, this creates a dramatic, large-scale light installation visible across the scene

#### 4b-v. Day/Night Cycle

**File**: `src/ui/dayNightCycle.js`

Full lighting transition system:
- **Sun** (DirectionalLight): Position orbits based on time, intensity $= 1.5 \cdot f_d$
- **Moon** (SpotLight): Opposite sun position, intensity $= 0.4(1 - f_d)$
- **Ambient**: Intensity and colour interpolated between night (0x1a1a2e) and day (0x404040)
- **Hemisphere light**: Sky/ground colours lerped for natural gradient
- **Background**: Scene background colour tracks sky colour
- **Day factor**: $f_d = \text{clamp}\!\left(\frac{\sin(\theta_{\text{sun}}) + 0.2}{1.2},\; 0,\; 1\right)$

Shadow maps: Sun uses 2048², Moon uses 1024², both with optimised near/far planes.

---

## Performance & Scalability Summary (for Report Pillar 1)

### Brute-Force vs. Spatial Hash

| Metric | Brute-Force O(N²) | Spatial Hash O(N·k) |
|--------|-------------------|---------------------|
| 300 agents | 89,700 checks | ~4,500 checks |
| 1000 agents | 999,000 checks | ~15,000 checks |
| 3000 agents | 8,997,000 checks | ~45,000 checks |

The spatial hash reduces candidate checks by **~98%** for typical agent distributions.

### Integration Logic (for Report Pillar 3)

**CPU → GPU data flow per frame:**

1. **Swarm update** (CPU): O(N) position updates using SoA Float32Arrays
2. **Spatial hash rebuild** (CPU): O(N) inserts into integer-keyed hash map
3. **Neighbour queries** (CPU): O(N·k) using allocation-free `queryInto()`
4. **Instance matrix upload** (CPU → GPU): Write N×16 floats to `instanceMatrix.array`, set `needsUpdate = true`
5. **GPU draw**: Single `drawElementsInstanced()` call per LOD tier

**Bandwidth minimisation strategies:**
- `DynamicDrawUsage` hint → GPU uses optimal buffer strategy
- LOD: Only 2 instanced meshes (near + far), hidden instances stay in buffer (no reallocation)
- Chunked instancing: Frustum-culled chunks skip matrix upload entirely
- Camera stationarity check: Skip LOD updates when camera hasn't moved
- Fixed topology: Bézier surface updates only position buffer (not indices/UVs)

---

## Architecture Summary (for Report Pillar 3)

```
main.js (orchestrator)
├── initThree.js (renderer, camera, controls)
├── Post-Processing Pipeline
│   ├── RenderPass
│   ├── UnrealBloomPass (threshold 0.3, strength 0.8)
│   └── FXAAShader (screen-space AA)
├── Environment
│   ├── terrainHeight.js (parametric height function)
│   ├── terrain.js (mesh generation + smoothing + vertex colours)
│   ├── terrainField.js (gradient/slope API)
│   ├── water.js (ribbon mesh + MeshPhysicalMaterial)
│   ├── riverCorridor.js (meander API)
│   ├── riverWalkways.js (procedural platforms + railings)
│   ├── walkwayCurves.js (CatmullRom splines for crowd paths)
│   └── StreetLampSystem.js (instanced poles/orbs + light pool LOD)
├── Agents (Orb Swarm)
│   ├── orbSwarm.js (SoA simulation: swerve + separation + bob)
│   ├── spatialHash.js (integer-key, allocation-free)
│   ├── orbLodRenderer.js (2-tier instanced LOD + hysteresis)
│   ├── orbLodRendererChunked.js (chunk-based frustum culling)
│   └── chunkedInstancing.js (spatial chunks for InstancedMesh)
├── Crowd (Walkway Pedestrians)
│   ├── CrowdManager.js (multi-zone orchestrator)
│   ├── CrowdZoneWalkway.js (state machine + prioritised steering)
│   ├── MiniPersonFactory.js (FK humanoid + walk cycle)
│   └── SpatialHashGrid.js (crowd-specific spatial hash)
├── World (Street Districts)
│   ├── streetDistrict.js (9-stage generation pipeline)
│   ├── streetMask.js (terrain flattening + plot computation)
│   ├── houseFactory.js (seeded procedural houses + 3-level LOD)
│   ├── lightFestival.js (instanced animated lights)
│   ├── attractionPyramid.js (focal point + PointLight)
│   ├── streetPedestrians.js (group-based crowd + obstacle avoidance)
│   ├── fireflies.js (wandering glow particles)
│   ├── lightCubes.js (atmospheric lights + collision obstacles)
│   └── palette.js (shared colour constants)
├── Parametric
│   └── bezierBlanket.js (cubic Bézier surface + control-point animation)
├── Spatial Visualisation
│   ├── uniformGrid.js (2D grid data structure)
│   ├── debugGridRenderer.js (grid line overlay)
│   ├── heatmapRenderer.js (instanced occupancy heatmap)
│   └── queryCellOverlay.js (query cell highlight)
└── UI
    ├── ui.js (lil-gui control panel)
    ├── dayNightCycle.js (lighting transitions)
    └── hotbar.js (keyboard shortcuts)
```

---

## Key Marks Maximisation Checklist

### Q2a (12 marks) — Parametric Modelling ✅
- [x] No external 3D assets loaded — all geometry procedural
- [x] Terrain: composite noise function (sinusoidal) with smoothstep blending
- [x] River: parametric meander (dual-frequency sinusoidal)
- [x] Bézier surface: explicit Bernstein basis, tensor-product evaluation
- [x] Houses: seeded procedural generation from primitives
- [x] Water: ribbon mesh following parametric centreline
- [x] Walkways: edge curves from parametric river + normal computation

### Q2b (12 marks) — Spatial Discretisation ✅
- [x] Spatial hash with integer-key packing (allocation-free)
- [x] Debug grid overlay (toggleable)
- [x] Occupancy heatmap visualisation (instanced, colour-coded)
- [x] Query cell overlay (shows searched cells)
- [x] Multiple spatial hash implementations (orb, crowd, street pedestrians)

### Q3a (15 marks) — Crowd Intelligence ✅
- [x] 1000+ orbs with autonomous navigation
- [x] Group behaviours: flocking (separation/alignment/cohesion)
- [x] Flow-field following (spline tangent)
- [x] Lane-following (2-lane walkway rules)
- [x] Queueing behaviour (brake behind others)
- [x] Leader-following (ghost point tracking)
- [x] State machine (cruise/queue/avoid/idle/leader)
- [x] Obstacle avoidance (houses, pyramid, light cubes)

### Q3b (10 marks) — Procedural Kinematics ✅
- [x] Articulated humanoid (head, torso, arms, legs)
- [x] Forward Kinematics walk cycle (sin-driven joint rotations)
- [x] Velocity-reactive animation (frequency scales with speed)
- [x] Smooth facing via quaternion SLERP
- [x] Idle pose decay (exponential return to rest)
- [x] Vertical bob (walk bounce)

### Q3c (15 marks) — Rendering Optimisation ✅
- [x] InstancedMesh for orbs, lamps, lights, heatmap
- [x] DynamicDrawUsage for instance matrices
- [x] LOD switching (near/far spheres)
- [x] Per-frame matrix upload (minimal CPU→GPU bandwidth)
- [x] Chunked instancing for frustum culling
- [x] Camera stationarity optimisation
- [x] Hidden instance trick (avoid count changes)

### Q4a (10 marks) — Adaptive LOD ✅
- [x] House LOD: 3 discrete levels via THREE.LOD
- [x] Orb LOD: 2-tier instanced with hysteresis
- [x] Lamp lighting LOD: light pool with distance sorting
- [x] Shadow LOD: only nearest lamps cast shadows

### Q4b (10 marks) — Signal Processing & Light Transport ✅
- [x] UnrealBloomPass (bright-pass + Gaussian blur)
- [x] FXAA (screen-space anti-aliasing)
- [x] Hardware MSAA (renderer antialias)
- [x] Emissive material strategy for bloom-friendly rendering
- [x] Bézier surface emissive animation (colour + intensity)
- [x] Day/night cycle with full lighting interpolation
- [x] Pixel ratio capping for DPI management
