import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { checkObstacleCollision } from './House.js';
import { hudManager } from './HUDManager.js';

// --- Base Configurations ---
const BASE_ENEMY_SPEED = 25.0;
const BASE_SPAWN_DELAY = 3.0;
export const COLLISION_DISTANCE = 18.0;
const NEAR_MISS_DISTANCE = 24.0;

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
        this.lastNearMissAt = 0;

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
        if (checkObstacleCollision(intendedPosition)) {
            return true;
        }

        const dxPlayer = intendedPosition.x - playerPosition.x;
        const dyPlayer = intendedPosition.y - playerPosition.y;
        if (Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer) < COLLISION_DISTANCE) return true;

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

            const step = direction.clone().multiplyScalar(liveEnemySpeed * deltaTime);
            const intendedPosition = this.mesh.position.clone().add(step);

            if (!this.checkFutureCollision(intendedPosition, playerPosition)) {
                this.mesh.position.copy(intendedPosition);
            }

            const nearMissDistance = Math.abs(distance - NEAR_MISS_DISTANCE);
            if (distance <= NEAR_MISS_DISTANCE && distance > COLLISION_DISTANCE) {
                hudManager.registerNearMiss();
            }

            const angle = Math.atan2(direction.y, direction.x);
            if (this.loadedModel) {
                this.loadedModel.rotation.y = angle - Math.PI / 2;
            }
        }
    }
}

export function updateEnemyDynamicDifficulty(difficultyFactor) {
    liveEnemySpeed = BASE_ENEMY_SPEED + (difficultyFactor * 35.0);
    liveSpawnDelay = Math.max(0.6, BASE_SPAWN_DELAY - (difficultyFactor * 2.0));
}

let spawnTimer = 0;
export function handleEnemySpawning(deltaTime, scene) {
    spawnTimer += deltaTime;

    if (spawnTimer >= liveSpawnDelay) {
        spawnTimer = 0;
        const newEnemy = new Enemy(scene);
        activeEnemies.push(newEnemy);
    }
}
