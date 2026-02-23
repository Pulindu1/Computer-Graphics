export function addTreesFolder(gui, treeSystem, params) {


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


  fTrees
    .add(params, "treeVisible")
    .name("Visible")
    .onChange(v => treeSystem.setVisible(v));


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


  fTrees
    .add(params, "treeWindEnabled")
    .name("Wind (GPU shader)")
    .onChange(v => {
      treeSystem.params.windEnabled = v;

      treeSystem.rebuild();
    });

  fTrees
    .add(params, "treeWindStrength", 0.0, 3.0, 0.05)
    .name("  └ Wind Strength")
    .onChange(v => {
      treeSystem.params.windStrength = v;

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

  // LOD 
  fTrees
    .add(params, "treeLodEnabled")
    .name("3-Tier LOD")
    .onChange(v => {
      treeSystem.params.lodEnabled = v;
      treeSystem.rebuild();
    });

  // Debug
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
