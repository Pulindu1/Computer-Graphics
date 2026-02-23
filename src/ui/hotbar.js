import * as THREE from "three";



export function createHotbar({ debugGrid, scene, dayNightCycle, streetDistrict }) {
  // If reloaded, remove existing bar
  const existing = document.getElementById("hotbar");
  if (existing) existing.remove();

  console.log("createHotbar called with:", { debugGrid, scene, dayNightCycle, streetDistrict });

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
  bar.style.zIndex = "9999";
  bar.style.maxHeight = "80vh";
  bar.style.overflowY = "auto";
  bar.style.boxSizing = "border-box";
  bar.style.pointerEvents = "auto";
  bar.style.display = "block";

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
    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:12px;">
      <button id="presetNight" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Night</button>
      <button id="presetDawn" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Dawn</button>
      <button id="presetNoon" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Noon</button>
      <button id="presetDusk" style="flex:1; padding:4px 6px; font-size:10px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer;">Dusk</button>
    </div>

    <div style="margin-bottom:4px; font-weight:600;">Street Pedestrians</div>
    <input 
      id="pedestriansSlider" 
      type="range" 
      min="0" 
      max="60" 
      value="25" 
      style="width:100%; margin-bottom:4px; height:20px; cursor:pointer;"
    />
    <div id="pedestriansLabel" style="opacity:0.75; font-size:11px; margin-bottom:12px;">
      25 people
    </div>

    <div style="margin-bottom:4px; font-weight:600;">Fireflies</div>
    <input 
      id="firefliesSlider" 
      type="range" 
      min="0" 
      max="50" 
      value="0" 
      style="width:100%; margin-bottom:4px; height:20px; cursor:pointer;"
    />
    <div id="firefliesLabel" style="opacity:0.75; font-size:11px; margin-bottom:8px;">
      0 orbs
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

  if (streetDistrict) {
    const pedestriansSlider = bar.querySelector("#pedestriansSlider");
    const pedestriansLabel = bar.querySelector("#pedestriansLabel");

    if (pedestriansSlider && pedestriansLabel) {
      pedestriansSlider.addEventListener("input", () => {
        const count = parseInt(pedestriansSlider.value);
        console.log("[Hotbar] Setting pedestrians to:", count);
        streetDistrict.setStreetPedestriansPopulation(count);
        pedestriansLabel.textContent = `${count} people`;
      });
    } else {
      console.warn("[Hotbar] Could not find pedestrians slider elements");
    }


    const firefliesSlider = bar.querySelector("#firefliesSlider");
    const firefliesLabel = bar.querySelector("#firefliesLabel");

    if (firefliesSlider && firefliesLabel) {
      firefliesSlider.addEventListener("input", () => {
        const count = parseInt(firefliesSlider.value);
        console.log("[Hotbar] Setting fireflies to:", count);
        streetDistrict.setFirefliesPopulation(count);
        firefliesLabel.textContent = `${count} orbs`;
      });
    } else {
      console.warn("[Hotbar] Could not find fireflies slider elements");
    }
  } else {
    console.warn("[Hotbar] streetDistrict not provided");
  }
}
