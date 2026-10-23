import * as THREE from 'three';

// Create a perspective camera with 30 degrees FOV and far plane set to 9000
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 9000);

// Set the initial camera to 300,-300,300 and set camera.up to 0,0,1
camera.position.set(500, -500, 500);
camera.up.set(0,0,1);

// Point the camera at the origin
camera.lookAt(0,0,0);

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
