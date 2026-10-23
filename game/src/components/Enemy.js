import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveObstacleMovement } from './House.js';
import { hudManager } from './HUDManager.js';

const BASE_ENEMY_SPEED = 25.0;
const BASE_SPAWN_DELAY = 3.0;
export const COLLISION_DISTANCE = 18.0;
const NEAR_MISS_DISTANCE = 24.0;
const ENEMY_SEPARATION_DISTANCE = 4.5;

export let liveEnemySpeed = BASE_ENEMY_SPEED;
export let liveSpawnDelay = BASE_SPAWN_DELAY;
export const activeEnemies = [];

const SPAWN_POINTS = [
    new THREE.Vector3(-250, 0, -250),
    new THREE.Vector3(250, 0, -250),
    new THREE.Vector3(-250, 0, 250),
    new THREE.Vector3(250, 0, 250)
];

const loader = new GLTFLoader();

export function setEnemySpawnConfig(hazardInterval = 2.5) {
    liveSpawnDelay = hazardInterval;
}

export class Enemy {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.lastNearMissAt = 0;

        const randomSpawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
        this.mesh.position.copy(randomSpawn);

        this.scene.add(this.mesh);
        this.loadedModel = null;
        this.modelBaseY = 0;

        loader.load('/models/enemy.glb', (gltf) => {
            const model = gltf.scene;
            this.loadedModel = model;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            model.scale.setScalar(2.6 / Math.max(size.y, 0.001));
            const scaledBox = new THREE.Box3().setFromObject(model);
            this.modelBaseY = -scaledBox.min.y;
            model.position.y = this.modelBaseY;
            this.mesh.add(model);
        });
    }

    checkFutureCollision(intendedPosition) {
        for (let other of activeEnemies) {
            if (other === this) continue;
            const dxEnemy = intendedPosition.x - other.mesh.position.x;
            const dzEnemy = intendedPosition.z - other.mesh.position.z;
            if (Math.sqrt(dxEnemy * dxEnemy + dzEnemy * dzEnemy) < ENEMY_SEPARATION_DISTANCE) return true;
        }
        return false;
    }

    update(deltaTime, playerPosition) {
        const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
        direction.y = 0;
        const distance = direction.length();

        if (distance > 0.5) {
            direction.normalize();

            const step = direction.clone().multiplyScalar(liveEnemySpeed * deltaTime);
            const obstacleAwareStep = resolveObstacleMovement(this.mesh.position, step, { radius: 2.2 });
            const intendedPosition = this.mesh.position.clone().add(obstacleAwareStep);

            if (!this.checkFutureCollision(intendedPosition)) {
                this.mesh.position.copy(intendedPosition);
            }

            if (distance <= NEAR_MISS_DISTANCE && distance > COLLISION_DISTANCE) {
                hudManager.registerNearMiss();
            }

            const angle = Math.atan2(direction.z, direction.x);
            if (this.loadedModel) {
                this.loadedModel.rotation.y = angle;
            }
        }
    }
}

export function updateEnemyDynamicDifficulty(difficultyFactor) {
    liveEnemySpeed = BASE_ENEMY_SPEED * difficultyFactor;
    liveSpawnDelay = Math.max(0.6, BASE_SPAWN_DELAY / difficultyFactor);
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
