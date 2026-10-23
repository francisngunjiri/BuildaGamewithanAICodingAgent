import * as THREE from 'three';
import './style.css';
import { player, updatePlayer, updatePlayerDynamicDifficulty } from './components/Player.js';
import { camera, updateCameraEffects } from "./components/Camera.js";
import { renderer } from './components/Renderer.js';
import { activeEnemies, handleEnemySpawning, updateEnemyDynamicDifficulty, COLLISION_DISTANCE } from './components/Enemy.js';
import { addSurvivalScore, currentScore } from './components/Score.js';
import { isGameOver, triggerGameOver } from './components/GameState.js';
import { mapGroup, createCheckerboardFloor } from './components/Map.js';
import { spawnHouses } from './components/House.js';
import { juiceManager } from './components/JuiceManager.js';
import { hudManager } from './components/HUDManager.js';

const COMPLEXITY_GROWTH_RATE = 0.005;

// Scene Configuration
const scene = new THREE.Scene();
const color = 0xffffff;
const intensity = 1.5;

// Lights
const ambientlight = new THREE.AmbientLight(color, intensity);
scene.add(ambientlight);

const directionalLight = new THREE.DirectionalLight(color, intensity);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

// --- Environment Initialization ---
// 1. Initialize the checkerboard patterns onto the canvas world map
createCheckerboardFloor();

// 2. Load the house asset instances randomly across your coordinates
spawnHouses();

// 3. Add the entire world map group to the active scene graph
scene.add(mapGroup);

// Entity Hierarchy Attachments
scene.add(player);
player.add(camera);
juiceManager.bindScene(scene);

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    const deltaTime = clock.getDelta();

    hudManager.updateCombo(deltaTime);

    if (!juiceManager.isHitStopActive()) {
        if (!isGameOver) {
            const difficultyFactor = currentScore * COMPLEXITY_GROWTH_RATE;
            updatePlayerDynamicDifficulty(difficultyFactor);
            updateEnemyDynamicDifficulty(difficultyFactor);

            for (let enemy of activeEnemies) {
                const dx = player.position.x - enemy.mesh.position.x;
                const dy = player.position.y - enemy.mesh.position.y;
                if (Math.sqrt(dx * dx + dy * dy) < COLLISION_DISTANCE) {
                    triggerGameOver();
                    break;
                }
            }
        }

        if (!isGameOver) {
            updatePlayer(deltaTime);
            addSurvivalScore(deltaTime);
            handleEnemySpawning(deltaTime, scene);

            for (let i = 0; i < activeEnemies.length; i++) {
                activeEnemies[i].update(deltaTime, player.position);
            }
        }
    }

    juiceManager.update(deltaTime);
    renderer.render(scene, camera);
});