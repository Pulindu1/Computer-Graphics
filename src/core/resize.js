/*
  Keeps camera projection + renderer size
  in sync with browser window resizing.
*/

export function installResizeHandler(camera, renderer) {
  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update camera aspect ratio
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(width, height);

    // Prevent extreme pixel ratios killing performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  window.addEventListener("resize", onResize);

  // Run once on install to ensure correct initial sizing
  onResize();
}
