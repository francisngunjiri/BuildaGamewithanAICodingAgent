import * as THREE from 'three';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { activeEnemies, COLLISION_DISTANCE } from './Enemy.js';
import { awardKillPoints } from './Score.js';
import { isGameOver, resetGame } from './GameState.js';
import { checkObstacleCollision } from './House.js';

const player = new THREE.Group();
player.position.set(0, 0, 0);

// --- Base Configurations ---
const BASE_MOVE_SPEED = 4.0;
const JUMP_HEIGHT = 15;
const JUMP_DISTANCE = 20;
const BASE_ATTACK_RADIUS = 40.0;
const BASE_ATTACK_COOLDOWN = 1.0;

// --- Live Dynamic Scaling Parameters ---
export let liveMoveSpeed = BASE_MOVE_SPEED;
export let liveAttackCooldown = BASE_ATTACK_COOLDOWN;
export let liveAttackRadius = BASE_ATTACK_RADIUS;

// --- State Variables ---
const inputQueue = [];
let currentMove = null;
let moveProgress = 0;
let loadedModel = null;
let modelBaseZ = 0;
let attackCooldownTimer = 0;
let attackVisualMesh = null;
let attackVisualTimer = 0;

const loader = new GLTFLoader();
loader.load('/models/tode.glb', (gltf) => {
    const model = gltf.scene;
    loadedModel = model;
    model.rotation.x = Math.PI / 2;
    model.scale.setScalar(20);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    modelBaseZ = size.z / 2;
    model.position.z = modelBaseZ;
    player.add(model);
});

// Create the visual indicator ring
const circleGeo = new THREE.CircleGeometry(1, 32); // Base radius 1 to safely rescale on the fly
const circleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
attackVisualMesh = new THREE.Mesh(circleGeo, circleMat);
attackVisualMesh.position.z = 0.25;
attackVisualMesh.visible = false;
player.add(attackVisualMesh);

window.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Spacebar') && isGameOver) {
        if (player.parent) resetGame(player.parent);
        return;
    }
    if (isGameOver) return;

    if (event.key === ' ' || event.key === 'Spacebar') {
        executeAttack();
        return;
    }

    let direction = null;
    let angle = 0;
    switch (event.key) {
        case 'ArrowUp': direction = new THREE.Vector3(0, JUMP_DISTANCE, 0); angle = 0; break;
        case 'ArrowDown': direction = new THREE.Vector3(0, -JUMP_DISTANCE, 0); angle = Math.PI; break;
        case 'ArrowLeft': direction = new THREE.Vector3(-JUMP_DISTANCE, 0, 0); angle = Math.PI / 2; break;
        case 'ArrowRight': direction = new THREE.Vector3(JUMP_DISTANCE, 0, 0); angle = -Math.PI / 2; break;
    }
    if (direction) inputQueue.push({ direction, angle });
});

function executeAttack() {
    if (attackCooldownTimer > 0 || isGameOver) return;

    // Use dynamic cooldown limit
    attackCooldownTimer = liveAttackCooldown;

    // Scale visual helper geometry explicitly to match active attack reach context
    attackVisualMesh.scale.set(liveAttackRadius, liveAttackRadius, 1);
    attackVisualMesh.visible = true;
    attackVisualTimer = 0.2;

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        const dx = player.position.x - enemy.mesh.position.x;
        const dy = player.position.y - enemy.mesh.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check against active dynamically scaling reach boundary
        if (distance <= liveAttackRadius) {
            enemy.scene.remove(enemy.mesh);
            activeEnemies.splice(i, 1);
            awardKillPoints();
        }
    }
}

// Global update hook called by main rendering cycle loop
export function updatePlayerDynamicDifficulty(difficultyFactor) {
    // Slightly increase the player's movement speed and reach, while decreasing attack wait delay
    liveMoveSpeed = BASE_MOVE_SPEED + (difficultyFactor * 2.0); // Caps gently
    liveAttackRadius = BASE_ATTACK_RADIUS + (difficultyFactor * 15.0);
    liveAttackCooldown = Math.max(0.3, BASE_ATTACK_COOLDOWN - (difficultyFactor * 0.4));
}

function checkPlayerCollision(targetPosition) {
    // 1. Check if the player is jumping into an obstacle house
    if (checkObstacleCollision(targetPosition)) {
        return true;
    }

    // 2. Existing check against active chasing enemies
    for (let enemy of activeEnemies) {
        const dx = targetPosition.x - enemy.mesh.position.x;
        const dy = targetPosition.y - enemy.mesh.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < COLLISION_DISTANCE) {
            return true;
        }
    }
    return false;
}

export function updatePlayer(deltaTime) {
    if (isGameOver) return;

    if (attackCooldownTimer > 0) attackCooldownTimer -= deltaTime;
    if (attackVisualMesh.visible) {
        attackVisualTimer -= deltaTime;
        if (attackVisualTimer <= 0) attackVisualMesh.visible = false;
    }

    if (!currentMove && inputQueue.length > 0) {
        const nextMove = inputQueue.shift();
        const targetLandingPos = player.position.clone().add(nextMove.direction);
        if (!checkPlayerCollision(targetLandingPos)) {
            currentMove = nextMove;
            moveProgress = 0;
            if (loadedModel) loadedModel.rotation.y = currentMove.angle;
        }
    }

    if (currentMove) {
        // Use live dynamic scaling movement speeds
        moveProgress += liveMoveSpeed * deltaTime;
        if (moveProgress >= 1) {
            player.position.add(currentMove.direction);
            if (loadedModel) loadedModel.position.z = modelBaseZ;
            currentMove = null;
            moveProgress = 0;
        } else {
            const currentStep = currentMove.direction.clone().multiplyScalar(liveMoveSpeed * deltaTime);
            player.position.add(currentStep);
            if (loadedModel) {
                const hopArcHeight = Math.sin(moveProgress * Math.PI) * JUMP_HEIGHT;
                loadedModel.position.z = modelBaseZ + hopArcHeight;
            }
        }
    }
}

export { player };
