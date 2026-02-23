# ACG Swarm Project

## How to Run the Game

1. **Start a Local Server**
   
   From the project root, run:
   
   ```sh
   python3 -m http.server 8000
   ```
   
   This will serve the files at [http://localhost:8000].

2. **Open the Game**
   
   Open your browser and go to:
   
   [http://localhost:8000/index.html]
   
   - For debugging, you can use `debug.html` or `test.html` in the same way.

## External Resources Used

- **Three.js**  
  CDN: https://unpkg.com/three@0.126.1/build/three.module.js  
  Used for all 3D rendering and scene management.  
  Additional modules from the Three.js examples are loaded via CDN for postprocessing and controls.

- **lil-gui**  
  CDN: https://cdn.jsdelivr.net/npm/lil-gui@0.17/dist/lil-gui.esm.js  
  Used for the in-game UI controls and parameter tweaking.

## Notes

- No external 3D assets or textures are used; all geometry and textures are generated procedurally.
- The project is entirely client-side and requires no installation or build step.
- Tested on google Chrome.
