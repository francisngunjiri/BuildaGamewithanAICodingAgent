import * as THREE from 'three';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { activeEnemies, COLLISION_DISTANCE } from './Enemy.js';
import { awardKillPoints } from './Score.js';
import { isGameOver, resetGame } from './GameState.js';
import { checkObstacleCollision, resolveObstacleMovement } from './House.js';
import { triggerCameraImpulse } from './Camera.js';
import { hudManager } from './HUDManager.js';
import { juiceManager } from './JuiceManager.js';

const player = new THREE.Group();
player.position.set(0, 0, 0);
player.userData = { facingAngle: 0, isDashing: false };

const fallbackBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.85, 2.2, 6, 12),
    new THREE.MeshStandardMaterial({
        color: 0x73f0d1,
        emissive: 0x0f7866,
        emissiveIntensity: 0.7,
        roughness: 0.5,
        metalness: 0.2,
        flatShading: true
    })
);
fallbackBody.position.y = 1.7;
player.add(fallbackBody);

const fallbackHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 18, 18),
    new THREE.MeshStandardMaterial({
        color: 0xf3d597,
        emissive: 0x2a1d0f,
        emissiveIntensity: 0.25,
        roughness: 0.6,
        metalness: 0.1
    })
);
fallbackHead.position.y = 3.3;
player.add(fallbackHead);

const fallbackAura = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.08, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x67f7d0, transparent: true, opacity: 0.85 })
);
fallbackAura.rotation.x = Math.PI / 2;
fallbackAura.position.y = 0.12;
player.add(fallbackAura);

// --- Base Configurations ---
const BASE_MOVE_SPEED = 4.0;
const JUMP_HEIGHT = 4.5;
const BASE_ATTACK_RADIUS = 40.0;
const BASE_ATTACK_COOLDOWN = 1.0;
const MAX_HEALTH = 100;
const MAX_STAMINA = 100;
const ENEMY_HIT_DAMAGE = 20;
const ENEMY_HIT_STAMINA_COST = 15;
const HIT_INVULNERABILITY_DURATION = 1.25;
const DASH_COST = 50;
const DASH_DURATION = 0.15;
const DASH_DISTANCE = 40;
const STAMINA_REGEN_RATE = 25;
let staminaRegenRate = STAMINA_REGEN_RATE;
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
let hitInvulnerabilityTimer = 0;
let dashTimer = 0;
let dashDirection = new THREE.Vector3();
let dashStartPosition = new THREE.Vector3();
let ghostTrailTimer = 0;
let ghostTrailMeshes = [];

// --- State Variables ---
let jumpPhase = 0;
let loadedModel = null;
let modelBaseY = 0;
let attackCooldownTimer = 0;
let attackVisualMesh = null;
let attackVisualTimer = 0;

const loader = new GLTFLoader();
loader.load('/models/tode.glb', (gltf) => {
    const model = gltf.scene;
    loadedModel = model;
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    model.scale.setScalar(4.2 / Math.max(size.y, 0.001));
    const scaledBox = new THREE.Box3().setFromObject(model);
    modelBaseY = -scaledBox.min.y;
    model.position.y = modelBaseY;
    fallbackBody.visible = false;
    fallbackHead.visible = false;
    fallbackAura.visible = false;
    player.add(model);
});

// Create the visual indicator ring
const circleGeo = new THREE.CircleGeometry(1, 32);
const circleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
attackVisualMesh = new THREE.Mesh(circleGeo, circleMat);
attackVisualMesh.rotation.x = -Math.PI / 2;
attackVisualMesh.position.y = 0.25;
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

export function triggerDash() {
    if (currentStamina < DASH_COST || isDashing || isGameOver) return;

    const facingDirection = getFacingDirection();
    if (!facingDirection) return;

    const dashVector = facingDirection.clone().multiplyScalar(DASH_DISTANCE);
    const obstacleSafeDash = resolveObstacleMovement(player.position, dashVector, { radius: 1.8 });
    const clampedPosition = clampToBoard(player.position.clone().add(obstacleSafeDash));

    if (clampedPosition.distanceTo(player.position) <= 0.001) return;

    currentStamina -= DASH_COST;
    lastDashTime = performance.now() / 1000;
    staminaRegenCooldown = STAMINA_REGEN_DELAY;
    isDashing = true;
    player.userData.isDashing = true;
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

export function setStaminaRegenRate(rate) {
    staminaRegenRate = rate;
}

export function takeEnemyHit() {
    if (isGameOver || isInvulnerable || hitInvulnerabilityTimer > 0) return false;

    currentHealth = Math.max(0, currentHealth - ENEMY_HIT_DAMAGE);
    currentStamina = Math.max(0, currentStamina - ENEMY_HIT_STAMINA_COST);
    staminaRegenCooldown = STAMINA_REGEN_DELAY;
    hitInvulnerabilityTimer = HIT_INVULNERABILITY_DURATION;
    hudManager.updateHealth(currentHealth / MAX_HEALTH);
    hudManager.updateStamina(currentStamina / MAX_STAMINA);

    return currentHealth === 0;
}

export function resetPlayerVitals() {
    currentHealth = MAX_HEALTH;
    currentStamina = MAX_STAMINA;
    staminaRegenCooldown = 0;
    hitInvulnerabilityTimer = 0;
    isDashing = false;
    isInvulnerable = false;
    player.userData.isDashing = false;
    hudManager.updateHealth(1);
    hudManager.updateStamina(1);
}

function getFacingDirection() {
    const angle = player.userData.facingAngle ?? 0;
    return new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
}

function clampToBoard(targetPosition) {
    const boardHalf = 260;
    const clamped = targetPosition.clone();
    clamped.x = THREE.MathUtils.clamp(clamped.x, -boardHalf, boardHalf);
    clamped.z = THREE.MathUtils.clamp(clamped.z, -boardHalf, boardHalf);
    return clamped;
}

window.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Spacebar') && isGameOver) {
        if (player.parent) resetGame(player.parent);
    }
});

export function executeAttack() {
    if (attackCooldownTimer > 0 || isGameOver) return;

    attackCooldownTimer = liveAttackCooldown;
    attackVisualMesh.scale.set(liveAttackRadius, liveAttackRadius, 1);
    attackVisualMesh.visible = true;
    attackVisualTimer = 0.2;

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        const dx = player.position.x - enemy.mesh.position.x;
        const dz = player.position.z - enemy.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

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
    if (isInvulnerable || hitInvulnerabilityTimer > 0) {
        return false;
    }

    if (checkObstacleCollision(targetPosition)) {
        return true;
    }

    for (let enemy of activeEnemies) {
        const targetDistance = Math.hypot(
            targetPosition.x - enemy.mesh.position.x,
            targetPosition.z - enemy.mesh.position.z
        );
        const currentDistance = Math.hypot(
            player.position.x - enemy.mesh.position.x,
            player.position.z - enemy.mesh.position.z
        );
        if (targetDistance < COLLISION_DISTANCE && targetDistance < currentDistance) {
            return true;
        }
    }
    return false;
}

export function updatePlayer(deltaTime, moveDirection = new THREE.Vector3(), attackPressed = false) {
    if (isGameOver) return;

    hitInvulnerabilityTimer = Math.max(0, hitInvulnerabilityTimer - deltaTime);
    if (attackPressed) executeAttack();
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
            player.userData.isDashing = false;
            isInvulnerable = false;
            player.position.copy(dashStartPosition.clone().add(dashDirection));
            ghostTrailTimer = 0;
            juiceManager.triggerSquashStretch(loadedModel || player, 'land');
        }
    }

    if (!isDashing && currentStamina < MAX_STAMINA) {
        staminaRegenCooldown -= deltaTime;
        if (staminaRegenCooldown <= 0) {
            currentStamina = Math.min(MAX_STAMINA, currentStamina + staminaRegenRate * deltaTime);
        }
    }

    hudManager.updateStamina(currentStamina / MAX_STAMINA);
    hudManager.updateHealth(currentHealth / MAX_HEALTH);

    const direction = moveDirection.clone();
    direction.y = 0;
    if (!isDashing && direction.lengthSq() > 1e-5) {
        direction.normalize();
        const targetAngle = Math.atan2(direction.x, direction.z);
        player.userData.facingAngle = targetAngle;
        if (loadedModel) {
            const targetRotation = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                targetAngle
            );
            loadedModel.quaternion.slerp(targetRotation, Math.min(1, 12 * deltaTime));
        }

        jumpPhase += deltaTime * 5.5;
        const jumpHeight = Math.max(0, Math.sin(jumpPhase)) * JUMP_HEIGHT;
        const displacement = direction.multiplyScalar(liveMoveSpeed * deltaTime);
        const safeDisplacement = resolveObstacleMovement(player.position, displacement, {
            radius: 1.8,
            jumpHeight
        });
        const nextPosition = player.position.clone().add(safeDisplacement);
        if (!checkPlayerCollision(nextPosition)) player.position.copy(nextPosition);

        if (loadedModel) {
            loadedModel.position.y = modelBaseY + jumpHeight;
        } else {
            fallbackBody.position.y = 1.7 + jumpHeight;
            fallbackHead.position.y = 3.3 + jumpHeight;
        }
    } else {
        jumpPhase = 0;
        if (loadedModel) loadedModel.position.y = modelBaseY;
        fallbackBody.position.y = 1.7;
        fallbackHead.position.y = 3.3;
    }
}

export { player };
