import * as THREE from "three";

// use canvas.game in index.html as the rendering canvas
const gameCanvas = document.querySelector('canvas.game');

// Initialize THREE.WebGLRenderer with enable alpha: true and antialias: true
const renderer = new THREE.WebGLRenderer({
    canvas: gameCanvas,
    alpha: true,
    antialias: true
});

// set the renderer size to match the window dimensions
renderer.setSize(window.innerWidth, window.innerHeight);

export { renderer };