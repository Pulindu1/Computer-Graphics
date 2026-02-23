
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

    // Update post-processing composer if it exists
    if (window.updateComposerSize) {
      window.updateComposerSize();
    }
  }

  window.addEventListener("resize", onResize);

  onResize();
}
