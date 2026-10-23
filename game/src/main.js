import * as THREE from 'three';
import './style.css';
import { player, updatePlayer, updatePlayerDynamicDifficulty, triggerDash, executeAttack, takeEnemyHit } from './components/Player.js';
import { updateCameraEffects } from './components/Camera.js';
import { renderer } from './components/Renderer.js';
import { activeEnemies, handleEnemySpawning, updateEnemyDynamicDifficulty, COLLISION_DISTANCE } from './components/Enemy.js';
import { addSurvivalScore, currentScore } from './components/Score.js';
import { GAME_STATES, currentGameState, setGameState, applyDifficultyConfig, triggerGameOver, resetGame, togglePause } from './components/GameState.js';
import { sceneManager } from './components/Scene3DManager.js';
import { MinimapManager } from './components/MinimapManager.js';
import { CameraMovementController } from './components/CameraMovementController.js';
import { juiceManager } from './components/JuiceManager.js';
import { hudManager } from './components/HUDManager.js';

const COMPLEXITY_GROWTH_RATE = 0.005;
const scene = sceneManager.scene;
const clock = new THREE.Clock();
const minimapCanvas = document.querySelector('#minimap-canvas');
const minimapManager = new MinimapManager(minimapCanvas, player);

scene.add(player);
juiceManager.bindScene(scene);
applyDifficultyConfig('MEDIUM');

const cameraMovement = new CameraMovementController({
    camera: sceneManager.camera,
    overviewCamera: sceneManager.overviewCamera,
    player,
    renderer,
    onDash: triggerDash
});

const buttons = document.querySelectorAll('[data-action]');
for (const button of buttons) {
    button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'play') {
            setGameState(GAME_STATES.DIFFICULTY_SELECT);
        } else if (action === 'resume') {
            setGameState(GAME_STATES.PLAYING);
        } else if (action === 'pause') {
            togglePause();
        } else if (action === 'dash') {
            triggerDash();
        } else if (action === 'pound') {
            executeAttack();
        }
    });
}

const pauseButton = document.querySelector('#pause-button');
const cameraButton = document.querySelector('#camera-toggle');
cameraButton?.addEventListener('click', () => sceneManager.toggleCamera());

document.querySelectorAll('.difficulty-button').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-button').forEach((item) => item.classList.toggle('selected', item === button));
        const difficulty = button.dataset.difficulty;
        applyDifficultyConfig(difficulty);
        setGameState(GAME_STATES.PLAYING);
        resetGame(scene);
    });
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        togglePause();
        return;
    }
    if (event.key === 'Enter' && currentGameState === GAME_STATES.MENU) {
        setGameState(GAME_STATES.DIFFICULTY_SELECT);
        return;
    }
    if (event.key.toLowerCase() === 'c' && currentGameState === GAME_STATES.PLAYING) {
        sceneManager.toggleCamera();
    }
});

const updatePauseButton = () => {
    if (!pauseButton) return;
    pauseButton.hidden = currentGameState !== GAME_STATES.PLAYING;
    if (cameraButton) cameraButton.hidden = currentGameState !== GAME_STATES.PLAYING;
};

renderer.setAnimationLoop(() => {
    const deltaTime = clock.getDelta();
    updatePauseButton();
    hudManager.updateCombo(deltaTime);
    updateCameraEffects(deltaTime);

    if (currentGameState === GAME_STATES.PLAYING && !juiceManager.isHitStopActive()) {
        const difficultyFactor = currentScore * COMPLEXITY_GROWTH_RATE + 1;
        updatePlayerDynamicDifficulty(difficultyFactor);
        updateEnemyDynamicDifficulty(difficultyFactor);

        for (let enemy of activeEnemies) {
            const dx = player.position.x - enemy.mesh.position.x;
            const dz = player.position.z - enemy.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < COLLISION_DISTANCE) {
                if (takeEnemyHit()) triggerGameOver();
                break;
            }
        }

        const movementDirection = cameraMovement.getMovementDirection(sceneManager.activeCamera);
        updatePlayer(deltaTime, movementDirection, cameraMovement.consumeAttackPress());
        addSurvivalScore(deltaTime);
        handleEnemySpawning(deltaTime, scene);

        for (let i = 0; i < activeEnemies.length; i++) {
            activeEnemies[i].update(deltaTime, player.position);
        }
    }

    sceneManager.update(deltaTime, player, currentGameState, player.userData.isDashing ?? false);
    cameraMovement.update(deltaTime, currentGameState, player.userData.isDashing ?? false);
    minimapManager.update(deltaTime, activeEnemies);
    juiceManager.update(deltaTime);
    renderer.render(scene, sceneManager.activeCamera);
});