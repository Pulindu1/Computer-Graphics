import * as THREE from "three";

/*
  Simple right-side hotbar UI.
  Currently supports:
  - Spatial grid toggle
  - Fog intensity control

  Keep UI separate from scene logic.
*/

export function createHotbar({ debugGrid, scene }) {
  // If reloaded, remove existing bar
  const existing = document.getElementById("hotbar");
  if (existing) existing.remove();

  if (!debugGrid) {
    console.error("createHotbar: debugGrid was not provided");
    return;
  }

  if (!scene) {
    console.error("createHotbar: scene was not provided");
    return;
  }

  const bar = document.createElement("div");
  bar.id = "hotbar";

  bar.style.position = "fixed";
  bar.style.top = "12px";
  bar.style.right = "12px";
  bar.style.width = "220px";
  bar.style.padding = "10px 12px";
  bar.style.background = "rgba(0,0,0,0.35)";
  bar.style.border = "1px solid rgba(255,255,255,0.15)";
  bar.style.borderRadius = "10px";
  bar.style.color = "#eaeaea";
  bar.style.font = "12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial";
  bar.style.userSelect = "none";
  bar.style.backdropFilter = "blur(6px)";

  bar.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 8px;">Hotbar</div>

    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:6px;">
      <input id="toggleGrid" type="checkbox" checked />
      <span>Show spatial grid</span>
    </label>

    <div style="opacity:0.75; font-size:11px; margin-bottom:12px;">
      Spatial partition debug overlay
    </div>

    <div style="margin-bottom:4px; font-weight:600;">Fog Intensity</div>
    <input 
      id="fogSlider" 
      type="range" 
      min="0" 
      max="100" 
      value="0" 
      style="width:100%; margin-bottom:4px; height:20px; cursor:pointer;"
    />
    <div id="fogLabel" style="opacity:0.75; font-size:11px;">
      Off
    </div>
  `;

  document.body.appendChild(bar);

  // Bind checkbox to grid visibility
  const toggle = bar.querySelector("#toggleGrid");
  toggle.addEventListener("change", () => {
    debugGrid.setVisible(toggle.checked);
  });

  // Bind slider to fog control
  const fogSlider = bar.querySelector("#fogSlider");
  const fogLabel = bar.querySelector("#fogLabel");
  const maxFar = 900;
  const maxNear = 200;

  fogSlider.addEventListener("input", () => {
    const intensity = parseFloat(fogSlider.value) / 100;

    if (intensity === 0) {
      // Turn off fog
      scene.fog = null;
      fogLabel.textContent = "Off";
    } else {
      // Scale fog based on intensity (inverted: higher intensity = more fog = lower far distance)
      const fogFar = maxFar - (maxFar - 200) * intensity;
      const fogNear = maxNear - (maxNear - 50) * intensity;
      
      if (!scene.fog) {
        scene.fog = new THREE.Fog(0x1b2133, fogNear, fogFar);
      } else {
        scene.fog.near = fogNear;
        scene.fog.far = fogFar;
      }
      
      fogLabel.textContent = `Near: ${Math.round(fogNear)}, Far: ${Math.round(fogFar)}`;
    }
  });
}
