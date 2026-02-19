/**
 * treesFolder.js
 * lil-gui folder for the TreeSystem.
 *
 * Adds a "Trees" folder to an existing GUI with:
 *  - Visibility toggle
 *  - Count slider (triggers full rebuild on release)
 *  - Min Spacing slider
 *  - Max Slope² slider
 *  - River / Street margin sliders
 *  - Wind toggle + Strength + Speed
 *  - LOD toggle
 *  - Debug: show placement points
 *  - Debug: show no-tree zones (river band + street boxes)
 *
 * Sliders that require re-placement call treeSystem.rebuild() on finish.
 * Wind strength/speed update the live uniform without rebuild.
 */

export function addTreesFolder(gui, treeSystem, params) {

  // Extend the shared params with tree defaults
  Object.assign(params, {
    treeVisible:       treeSystem.params.visible,
    treeCount:         treeSystem.params.count,
    treeMinSpacing:    treeSystem.params.minSpacing,
    treeMaxSlope:      treeSystem.params.maxSlope2,
    treeRiverMargin:   treeSystem.params.riverMargin,
    treeStreetMargin:  treeSystem.params.streetMargin,
    treeWindEnabled:   treeSystem.params.windEnabled,
    treeWindStrength:  treeSystem.params.windStrength,
    treeWindSpeed:     treeSystem.params.windSpeed,
    treeLodEnabled:    treeSystem.params.lodEnabled,
    treeShowPoints:    false,
    treeShowNoZones:   false,
  });

  const fTrees = gui.addFolder("Trees");

  // ── Visibility ──────────────────────────────────────────────
  fTrees
    .add(params, "treeVisible")
    .name("Visible")
    .onChange(v => treeSystem.setVisible(v));

  // ── Placement ───────────────────────────────────────────────
  fTrees
    .add(params, "treeCount", 0, 2000, 50)
    .name("Count")
    .onFinishChange(v => {
      treeSystem.params.count = Math.floor(v);
      treeSystem.rebuild();
    });

  fTrees
    .add(params, "treeMinSpacing", 2, 60, 1)
    .name("Min Spacing")
    .onFinishChange(v => {
      treeSystem.params.minSpacing = v;
      treeSystem.rebuild();
    });

  fTrees
    .add(params, "treeMaxSlope", 0.05, 2.5, 0.05)
    .name("Max Slope²")
    .onFinishChange(v => {
      treeSystem.params.maxSlope2 = v;
      treeSystem.rebuild();
    });

  fTrees
    .add(params, "treeRiverMargin", 0, 50, 1)
    .name("River Margin")
    .onFinishChange(v => {
      treeSystem.params.riverMargin = v;
      treeSystem.rebuild();
    });

  fTrees
    .add(params, "treeStreetMargin", 0, 120, 1)
    .name("Street Margin")
    .onFinishChange(v => {
      treeSystem.params.streetMargin = v;
      treeSystem.rebuild();
    });

  // ── Wind (GPU shader) ────────────────────────────────────────
  fTrees
    .add(params, "treeWindEnabled")
    .name("Wind (GPU shader)")
    .onChange(v => {
      treeSystem.params.windEnabled = v;
      // Requires shader recompile → full rebuild
      treeSystem.rebuild();
    });

  fTrees
    .add(params, "treeWindStrength", 0.0, 3.0, 0.05)
    .name("  └ Wind Strength")
    .onChange(v => {
      treeSystem.params.windStrength = v;
      // Live update — just write the uniform, no rebuild needed
      const u = treeSystem._materials?.leavesUniforms;
      if (u && treeSystem.params.windEnabled) u.uWindStrength.value = v;
    });

  fTrees
    .add(params, "treeWindSpeed", 0.1, 5.0, 0.1)
    .name("  └ Wind Speed")
    .onChange(v => {
      treeSystem.params.windSpeed = v;
      const u = treeSystem._materials?.leavesUniforms;
      if (u) u.uWindSpeed.value = v;
    });

  // ── LOD ──────────────────────────────────────────────────────
  fTrees
    .add(params, "treeLodEnabled")
    .name("3-Tier LOD")
    .onChange(v => {
      treeSystem.params.lodEnabled = v;
      treeSystem.rebuild();
    });

  // ── Debug ────────────────────────────────────────────────────
  fTrees
    .add(params, "treeShowPoints")
    .name("Debug: Placement Points")
    .onChange(v => {
      treeSystem.enableDebug();
      treeSystem._debug?.setShowPoints(v);
    });

  fTrees
    .add(params, "treeShowNoZones")
    .name("Debug: No-Tree Zones")
    .onChange(v => {
      treeSystem.enableDebug();
      treeSystem._debug?.setShowNoZones(v);
    });

  fTrees.open();
  return fTrees;
}
