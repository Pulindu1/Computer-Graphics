// FPS-style free camera controller for WASD and mouse look
// Fast, responsive movement like a video game

import * as THREE from "three";

export class KeyboardCameraController {
  constructor(camera, speed = 500.0) {
    this.camera = camera;
    this.speed = speed;  // Units per second - very high for fast traversal
    
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      arrowUp: false,
      arrowDown: false,
      arrowLeft: false,
      arrowRight: false,
      space: false,
      shift: false,
    };

    // Euler angles for camera rotation
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.quat = new THREE.Quaternion();
    
    // Mouse movement
    this.mouseSensitivity = 0.003;
    
    // Bind keyboard events
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (key === 'w') this.keys.w = true;
    if (key === 'a') this.keys.a = true;
    if (key === 's') this.keys.s = true;
    if (key === 'd') this.keys.d = true;
    if (key === 'arrowup') this.keys.arrowUp = true;
    if (key === 'arrowdown') this.keys.arrowDown = true;
    if (key === 'arrowleft') this.keys.arrowLeft = true;
    if (key === 'arrowright') this.keys.arrowRight = true;
    if (key === ' ') {
      this.keys.space = true;
      e.preventDefault();
    }
    if (key === 'shift') this.keys.shift = true;
  }

  onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === 'w') this.keys.w = false;
    if (key === 'a') this.keys.a = false;
    if (key === 's') this.keys.s = false;
    if (key === 'd') this.keys.d = false;
    if (key === 'arrowup') this.keys.arrowUp = false;
    if (key === 'arrowdown') this.keys.arrowDown = false;
    if (key === 'arrowleft') this.keys.arrowLeft = false;
    if (key === 'arrowright') this.keys.arrowRight = false;
    if (key === ' ') this.keys.space = false;
    if (key === 'shift') this.keys.shift = false;
  }

  onMouseMove(e) {
    // Update euler angles based on mouse movement (only when mouse button is pressed)
    if (e.buttons !== 1) return;  // Only rotate when left mouse button is held

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * this.mouseSensitivity;
    this.euler.x -= e.movementY * this.mouseSensitivity;

    // Clamp pitch to prevent flipping
    this.euler.x = Math.max(-Math.PI * 0.5, Math.min(Math.PI * 0.5, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  update(dt = 1.0 / 60.0) {
    const distance = this.speed * dt;

    // Get camera forward, right, and up vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    // WASD / Arrow keys movement
    if (this.keys.w || this.keys.arrowUp) {
      this.camera.position.addScaledVector(forward, distance);
    }
    if (this.keys.s || this.keys.arrowDown) {
      this.camera.position.addScaledVector(forward, -distance);
    }
    if (this.keys.a || this.keys.arrowLeft) {
      this.camera.position.addScaledVector(right, -distance);
    }
    if (this.keys.d || this.keys.arrowRight) {
      this.camera.position.addScaledVector(right, distance);
    }

    // Space to go up, Shift to go down
    if (this.keys.space) {
      this.camera.position.addScaledVector(up, distance);
    }
    if (this.keys.shift) {
      this.camera.position.addScaledVector(up, -distance);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }
}

