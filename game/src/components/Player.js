import * as THREE from 'three';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { activeEnemies, COLLISION_DISTANCE } from './Enemy.js';
import { awardKillPoints } from './Score.js';
import { isGameOver, resetGame } from './GameState.js';
import { checkObstacleCollision } from './House.js';
import { triggerCameraImpulse } from './Camera.js';
import { hudManager } from './HUDManager.js';
import { juiceManager } from './JuiceManager.js';

const player = new THREE.Group();
player.position.set(0, 0, 0);

// --- Base Configurations ---
const BASE_MOVE_SPEED = 4.0;
const JUMP_HEIGHT = 15;
const JUMP_DISTANCE = 20;
const BASE_ATTACK_RADIUS = 40.0;
const BASE_ATTACK_COOLDOWN = 1.0;
const MAX_HEALTH = 100;
const MAX_STAMINA = 100;
const DASH_COST = 50;
const DASH_DURATION = 0.15;
const DASH_DISTANCE = JUMP_DISTANCE * 2;
const STAMINA_REGEN_RATE = 25;
const STAMINA_REGEN_DELAY = 1.5;

// --- Live Dynamic Scaling Parameters ---
export let liveMoveSpeed = BASE_MOVE_SPEED;
export let liveAttackCooldown = BASE_ATTACK_COOLDOWN;
export let liveAttackRadius = BASE_ATTACK_RADIUS;

// --- Stamina / Dash State ---
export let currentStamina = MAX_STAMINA;
export let currentHealth = MAX_HEALTH;
export let isDashing = false;
export let isInvulnerable = false;
let lastDashTime = 0;
let staminaRegenCooldown = 0;
let dashTimer = 0;
let dashDirection = new THREE.Vector3();
let dashStartPosition = new THREE.Vector3();
let ghostTrailTimer = 0;
let ghostTrailMeshes = [];

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
const circleGeo = new THREE.CircleGeometry(1, 32);
const circleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
attackVisualMesh = new THREE.Mesh(circleGeo, circleMat);
attackVisualMesh.position.z = 0.25;
attackVisualMesh.visible = false;
player.add(attackVisualMesh);

function disposeGhostTrail(mesh) {
    if (!mesh) return;

    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
        } else {
            mesh.material.dispose();
        }
    }
    if (mesh.parent) mesh.parent.remove(mesh);
}

function createGhostTrail() {
    if (!loadedModel) return;

    const ghost = loadedModel.clone();
    ghost.scale.copy(loadedModel.scale);
    ghost.position.copy(loadedModel.position);
    ghost.rotation.copy(loadedModel.rotation);
    ghost.traverse((child) => {
        if (child.isMesh) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.6;
        }
    });

    player.add(ghost);
    ghostTrailMeshes.push({ mesh: ghost, life: 0.3, maxLife: 0.3 });
}

function triggerDash() {
    if (currentStamina < DASH_COST || isDashing || isGameOver) return;

    const facingDirection = getFacingDirection();
    if (!facingDirection) return;

    const dashVector = facingDirection.clone().multiplyScalar(DASH_DISTANCE);
    const targetPosition = player.position.clone().add(dashVector);
    const clampedPosition = clampToBoard(targetPosition);

    if (clampedPosition.distanceTo(player.position) <= 0.001) return;

    currentStamina -= DASH_COST;
    lastDashTime = performance.now() / 1000;
    staminaRegenCooldown = STAMINA_REGEN_DELAY;
    isDashing = true;
    isInvulnerable = true;
    dashTimer = DASH_DURATION;
    dashDirection.copy(clampedPosition.sub(player.position));
    dashStartPosition.copy(player.position);

    triggerCameraImpulse(5, 0.12);
    juiceManager.triggerShake(0.15, 110);
    juiceManager.triggerHitStop(0.03);
    juiceManager.triggerDashSparks(player.position.clone().add(facingDirection.clone().multiplyScalar(-12)), facingDirection.clone().multiplyScalar(-1));
    juiceManager.triggerSquashStretch(loadedModel || player, 'dash');
    hudManager.updateStamina(currentStamina / MAX_STAMINA);
    createGhostTrail();
    createGhostTrail();
    createGhostTrail();
}

function getFacingDirection() {
    if (!loadedModel) {
        return new THREE.Vector3(1, 0, 0);
    }

    const directionVector = new THREE.Vector3(Math.cos(loadedModel.rotation.y), Math.sin(loadedModel.rotation.y), 0);
    if (directionVector.lengthSq() === 0) {
        return new THREE.Vector3(1, 0, 0);
    }
    return directionVector.normalize();
}

function clampToBoard(targetPosition) {
    const boardHalf = 260;
    const clamped = targetPosition.clone();
    clamped.x = THREE.MathUtils.clamp(clamped.x, -boardHalf, boardHalf);
    clamped.y = THREE.MathUtils.clamp(clamped.y, -boardHalf, boardHalf);
    return clamped;
}

window.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Spacebar') && isGameOver) {
        if (player.parent) resetGame(player.parent);
        return;
    }
    if (isGameOver) return;

    if (event.key === 'Shift') {
        triggerDash();
        return;
    }

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

    attackCooldownTimer = liveAttackCooldown;
    attackVisualMesh.scale.set(liveAttackRadius, liveAttackRadius, 1);
    attackVisualMesh.visible = true;
    attackVisualTimer = 0.2;

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        const dx = player.position.x - enemy.mesh.position.x;
        const dy = player.position.y - enemy.mesh.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= liveAttackRadius) {
            enemy.scene.remove(enemy.mesh);
            activeEnemies.splice(i, 1);
            awardKillPoints();
        }
    }
}

export function updatePlayerDynamicDifficulty(difficultyFactor) {
    liveMoveSpeed = BASE_MOVE_SPEED + (difficultyFactor * 2.0);
    liveAttackRadius = BASE_ATTACK_RADIUS + (difficultyFactor * 15.0);
    liveAttackCooldown = Math.max(0.3, BASE_ATTACK_COOLDOWN - (difficultyFactor * 0.4));
}

function checkPlayerCollision(targetPosition) {
    if (isInvulnerable) {
        return false;
    }

    if (checkObstacleCollision(targetPosition)) {
        return true;
    }

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

    if (isDashing) {
        dashTimer -= deltaTime;
        const dashProgress = 1 - dashTimer / DASH_DURATION;
        const nextPosition = dashStartPosition.clone().add(dashDirection.clone().multiplyScalar(dashProgress));
        player.position.copy(nextPosition);

        if (ghostTrailMeshes.length) {
            ghostTrailTimer += deltaTime;
            for (let i = ghostTrailMeshes.length - 1; i >= 0; i--) {
                const trail = ghostTrailMeshes[i];
                trail.life -= deltaTime;
                const alpha = Math.max(0, trail.life / trail.maxLife) * 0.6;
                trail.mesh.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.transparent = true;
                        child.material.opacity = alpha;
                    }
                });

                if (trail.life <= 0) {
                    disposeGhostTrail(trail.mesh);
                    ghostTrailMeshes.splice(i, 1);
                }
            }
        }

        if (dashTimer <= 0) {
            isDashing = false;
            isInvulnerable = false;
            player.position.copy(dashStartPosition.clone().add(dashDirection));
            ghostTrailTimer = 0;
            juiceManager.triggerSquashStretch(loadedModel || player, 'land');
        }
    }

    if (!isDashing && currentStamina < MAX_STAMINA) {
        staminaRegenCooldown -= deltaTime;
        if (staminaRegenCooldown <= 0) {
            currentStamina = Math.min(MAX_STAMINA, currentStamina + STAMINA_REGEN_RATE * deltaTime);
        }
    }

    hudManager.updateStamina(currentStamina / MAX_STAMINA);
    hudManager.updateHealth(currentHealth / MAX_HEALTH);

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
