import * as THREE from "three";

/*
  Simple right-side hotbar UI.
  Currently supports:
  - Spatial grid toggle
  - Fog intensity control

  Keep UI separate from scene logic.
*/

export function createHotbar({ debugGrid, scene, dayNightCycle }) {
  // If reloaded, remove existing bar
  const existing = document.getElementById("hotbar");
  if (existing) existing.remove();

  console.log("createHotbar called with:", { debugGrid, scene, dayNightCycle });

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
    <div id="fogLabel" style="opacity:0.75; font-size:11px; margin-bottom:12px;">
      Off
    </div>

    <div style="margin-bottom:4px; font-weight:600;">Time of Day</div>
    <input 
      id="timeSlider" 
      type="range" 
      min="0" 
      max="1000" 
      value="500" 
      style="width:100%; margin-bottom:4px; height:20px; cursor:pointer;"
    />
    <div id="timeLabel" style="opacity:0.75; font-size:11px; margin-bottom:8px;">
      12:00 - ☀️ Day
    </div>
    <div style="display:flex; gap:4px; flex-wrap:wrap;">
      <button id="presetNight" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Night</button>
      <button id="presetDawn" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Dawn</button>
      <button id="presetNoon" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Noon</button>
      <button id="presetDusk" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Dusk</button>
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

  // Bind time slider to day/night cycle
  if (dayNightCycle) {
    const timeSlider = bar.querySelector("#timeSlider");
    const timeLabel = bar.querySelector("#timeLabel");
    
    const updateTimeLabel = (timeOfDay) => {
      const hours = Math.floor(timeOfDay * 24);
      const minutes = Math.floor((timeOfDay * 24 - hours) * 60);
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const sunAngle = timeOfDay * Math.PI * 2 - Math.PI / 2;
      const sunHeight = Math.sin(sunAngle);
      const isDaytime = sunHeight > 0;
      const period = isDaytime ? '☀️ Day' : '🌙 Night';
      timeLabel.textContent = `${timeString} - ${period}`;
    };

    timeSlider.addEventListener("input", () => {
      const timeOfDay = parseFloat(timeSlider.value) / 1000;
      dayNightCycle.setTime(timeOfDay);
      updateTimeLabel(timeOfDay);
    });

    // Bind preset buttons
    const presets = [
      { id: "presetNight", value: 0.0 },
      { id: "presetDawn", value: 0.25 },
      { id: "presetNoon", value: 0.5 },
      { id: "presetDusk", value: 0.75 },
    ];

    presets.forEach(preset => {
      const btn = bar.querySelector(`#${preset.id}`);
      btn.addEventListener("click", () => {
        timeSlider.value = preset.value * 1000;
        dayNightCycle.setTime(preset.value);
        updateTimeLabel(preset.value);
      });
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#444";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "#333";
      });
    });
  }
}
