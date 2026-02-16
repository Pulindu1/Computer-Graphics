/**
 * Day/Night Cycle Controller
 * Manages lighting transitions between day and night with a slider UI
 */

import * as THREE from 'three';

export class DayNightCycle {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.timeOfDay = 0.5; // 0 = midnight, 0.5 = noon, 1 = midnight again
        
        // Create lighting
        this.createLights();
        
        // Initial update
        this.updateLighting();
    }
    
    createLights() {
        // Ambient light (varies with time of day)
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(this.ambientLight);
        
        // Sun (directional light)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.sunLight.position.set(100, 100, 50);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        this.scene.add(this.sunLight);
        
        // Moon (spotlight for night)
        this.moonLight = new THREE.SpotLight(0x8888ff, 0.3);
        this.moonLight.position.set(-100, 100, -50);
        this.moonLight.angle = Math.PI / 4;
        this.moonLight.penumbra = 0.5;
        this.moonLight.decay = 2;
        this.moonLight.distance = 500;
        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 1024;
        this.moonLight.shadow.mapSize.height = 1024;
        this.scene.add(this.moonLight);
        
        // Hemisphere light for sky gradient effect
        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x545454, 0.6);
        this.scene.add(this.hemisphereLight);
    }
    
    updateLighting() {
        // Calculate sun position based on time (arc across sky)
        const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
        const sunHeight = Math.sin(sunAngle);
        const sunRadius = 150;
        
        this.sunLight.position.set(
            Math.cos(sunAngle) * sunRadius,
            sunHeight * sunRadius,
            50
        );
        
        // Moon is opposite to sun
        this.moonLight.position.set(
            -Math.cos(sunAngle) * sunRadius,
            -sunHeight * sunRadius,
            -50
        );
        
        // Determine if it's day or night
        const isDaytime = sunHeight > 0;
        
        // Smooth transition factor (0 = night, 1 = day)
        const dayFactor = Math.max(0, Math.min(1, (sunHeight + 0.2) / 1.2));
        
        // Update sun intensity
        this.sunLight.intensity = dayFactor * 1.5;
        
        // Update moon intensity (inverse of day)
        this.moonLight.intensity = (1 - dayFactor) * 0.4;
        
        // Update ambient light
        this.ambientLight.intensity = 0.2 + dayFactor * 0.5;
        
        // Update ambient color (blue during day, dark during night)
        const dayColor = new THREE.Color(0x404040);
        const nightColor = new THREE.Color(0x1a1a2e);
        this.ambientLight.color.lerpColors(nightColor, dayColor, dayFactor);
        
        // Update hemisphere light
        const skyColorDay = new THREE.Color(0x87ceeb);
        const skyColorNight = new THREE.Color(0x0a0a1a);
        const groundColorDay = new THREE.Color(0x545454);
        const groundColorNight = new THREE.Color(0x0a0a0a);
        
        this.hemisphereLight.color.lerpColors(skyColorNight, skyColorDay, dayFactor);
        this.hemisphereLight.groundColor.lerpColors(groundColorNight, groundColorDay, dayFactor);
        this.hemisphereLight.intensity = 0.3 + dayFactor * 0.5;
        
        // Update background color
        const bgColorDay = new THREE.Color(0x87ceeb);
        const bgColorNight = new THREE.Color(0x0a0a1a);
        const bgColor = new THREE.Color();
        bgColor.lerpColors(bgColorNight, bgColorDay, dayFactor);
        this.scene.background = bgColor;
        
        // Update fog if it exists
        if (this.scene.fog) {
            this.scene.fog.color.copy(bgColor);
        }
    }
    
    // Method to set time programmatically
    setTime(value) {
        this.timeOfDay = Math.max(0, Math.min(1, value));
        this.updateLighting();
    }
    
    // Method to animate time progression
    startTimeProgression(speed = 0.0001) {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        const animate = () => {
            this.timeOfDay = (this.timeOfDay + speed) % 1;
            this.updateLighting();
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    stopTimeProgression() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    // Cleanup
    destroy() {
        this.stopTimeProgression();
        this.scene.remove(this.ambientLight);
        this.scene.remove(this.sunLight);
        this.scene.remove(this.moonLight);
        this.scene.remove(this.hemisphereLight);
    }
}
