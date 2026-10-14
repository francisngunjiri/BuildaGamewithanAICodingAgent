import * as THREE from 'three';
import './style.css';
import { player } from './components/Player.js';

// Scene
const scene = new THREE.Scene();
const color = 0xffffff;
const intensity = 1.5;

// Light
// Add an ambient light to the scene with an intensity of 1.5
const ambientlight = new THREE.AmbientLight(color,intensity);
scene.add(ambientlight);

// Add a DirectionalLight to the scene. Intensity 1.5, positioned to (-100, -100,200)
const directionalLight = new THREE.DirectionalLight(color, intensity);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

// Player
// components/Player.js
scene.add(player);

// Camera
// components/Camera.js
