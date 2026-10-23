import * as THREE from 'three';

// Create a perspective camera with a sane default viewing angle for the 3D scene.
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 9000);

// Keep the camera on the standard Y-up world axis; the game logic later drives the
// follow camera behind the player, but this default position keeps the scene visible.
camera.position.set(0, 8, 14);
camera.up.set(0, 1, 0);

// Point the camera at the origin.
camera.lookAt(0, 1.5, 0);

const cameraImpulse = {
    active: false,
    duration: 0,
    elapsed: 0,
    startFov: camera.fov,
    amount: 0
};

export function triggerCameraImpulse(amount = 5, duration = 0.12) {
    cameraImpulse.active = true;
    cameraImpulse.duration = duration;
    cameraImpulse.elapsed = 0;
    cameraImpulse.startFov = camera.fov;
    cameraImpulse.amount = amount;
}

export function updateCameraEffects(deltaTime) {
    if (!cameraImpulse.active) return;

    cameraImpulse.elapsed += deltaTime;
    const progress = Math.min(cameraImpulse.elapsed / cameraImpulse.duration, 1);
    const eased = 1 - (1 - progress) ** 2;
    camera.fov = THREE.MathUtils.lerp(cameraImpulse.startFov + cameraImpulse.amount, cameraImpulse.startFov, eased);
    camera.updateProjectionMatrix();

    if (progress >= 1) {
        cameraImpulse.active = false;
        camera.fov = cameraImpulse.startFov;
        camera.updateProjectionMatrix();
    }
}

export { camera };
