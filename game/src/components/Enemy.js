import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { checkObstacleCollision } from './House.js';
import '../style.css';
import { player, updatePlayer, updatePlayerDynamicDifficulty } from './components/Player.js';
import { camera } from "./components/Camera.js";
import { renderer } from './components/Renderer.js';
import { addSurvivalScore, currentScore } from './components/Score.js';
import { isGameOver, triggerGameOver } from './components/GameState.js';
import { mapGroup, createCheckerboardFloor } from './components/Map.js';
import { spawnHouses } from './components/House.js';


// --- Base Configurations ---
const BASE_ENEMY_SPEED = 25.0;
const BASE_SPAWN_DELAY = 3.0;
export const COLLISION_DISTANCE = 18.0;

// --- Live Dynamic Scaling Challenge Parameters ---
export let liveEnemySpeed = BASE_ENEMY_SPEED;
export let liveSpawnDelay = BASE_SPAWN_DELAY;

export const activeEnemies = [];

const SPAWN_POINTS = [
    new THREE.Vector3(-250, -250, 0),
    new THREE.Vector3(250, -250, 0),
    new THREE.Vector3(-250, 250, 0),
    new THREE.Vector3(250, 250, 0)
];

const loader = new GLTFLoader();

export class Enemy {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();

        const randomSpawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
        this.mesh.position.copy(randomSpawn);

        this.scene.add(this.mesh);
        this.loadedModel = null;
        this.modelBaseZ = 0;

        
        loader.load('/models/enemy.glb', (gltf) => {
            const model = gltf.scene;
            this.loadedModel = model;
            model.rotation.x = Math.PI / 2;
            model.scale.setScalar(5);

            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);

            this.modelBaseZ = size.z / 2;
            model.position.z = this.modelBaseZ;

            this.mesh.add(model);
        });
    }

    checkFutureCollision(intendedPosition, playerPosition) {
        // 1. New Rule: Enemy vs House - Block moving bugs if they scrape the house walls
        if (checkObstacleCollision(intendedPosition)) {
            return true;
        }

        // 2. Existing Rule: Enemy vs Player
        const dxPlayer = intendedPosition.x - playerPosition.x;
        const dyPlayer = intendedPosition.y - playerPosition.y;
        if (Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer) < COLLISION_DISTANCE) return true;

        // 3. Existing Rule: Enemy vs Enemy
        for (let other of activeEnemies) {
            if (other === this) continue;
            const dxEnemy = intendedPosition.x - other.mesh.position.x;
            const dyEnemy = intendedPosition.y - other.mesh.position.y;
            if (Math.sqrt(dxEnemy * dxEnemy + dyEnemy * dyEnemy) < COLLISION_DISTANCE) return true;
        }
        return false;
    }

    update(deltaTime, playerPosition) {
        const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
        direction.z = 0;
        const distance = direction.length();

        if (distance > 0.5) {
            direction.normalize();

            // Use live dynamic scaling speeds to track target coordinates
            const step = direction.clone().multiplyScalar(liveEnemySpeed * deltaTime);
            const intendedPosition = this.mesh.position.clone().add(step);

            if (!this.checkFutureCollision(intendedPosition, playerPosition)) {
                this.mesh.position.copy(intendedPosition);
            }

            const angle = Math.atan2(direction.y, direction.x);
            if (this.loadedModel) {
                this.loadedModel.rotation.y = angle - Math.PI / 2;
            }
        }
    }
}

// Global update hook called by main rendering cycle loop
export function updateEnemyDynamicDifficulty(difficultyFactor) {
    // Enemies scale slightly faster than player parameters to preserve difficulty curves
    liveEnemySpeed = BASE_ENEMY_SPEED + (difficultyFactor * 35.0);
    liveSpawnDelay = Math.max(0.6, BASE_SPAWN_DELAY - (difficultyFactor * 2.0));
}

let spawnTimer = 0;
export function handleEnemySpawning(deltaTime, scene) {
    spawnTimer += deltaTime;

    // Checks against live progressive spawn thresholds
    if (spawnTimer >= liveSpawnDelay) {
        spawnTimer = 0;
        const newEnemy = new Enemy(scene);
        activeEnemies.push(newEnemy);
    }
}
