import * as THREE from 'three';

// Create a perspective camera with 30 degrees FOV and far plane set to 9000
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 9000);

// Set the initial camera to 300,-300,300 and set camera.up to 0,0,1
camera.position.set(300,-300,300);
camera.up.set(0,0,1);

// Point the camera at the origin
camera.lookAt(0,0,0);

export {camera};
