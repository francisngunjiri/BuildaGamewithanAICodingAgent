import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mapGroup } from './Map.js';

// Configuration parameters matching spec requirements
const HOUSE_SCALE = 65;
export const HOUSE_COLLISION_RADIUS = 30.0; // Keeps players and bugs outside the walls

// Master tracking array for obstacle locations
export const activeHouses = [];
export const activeObstacles = [];

export function registerObstacle(position, radius, height, jumpable = false) {
    const obstacle = {
        position: new THREE.Vector3(position.x, position.y ?? 0, position.z),
        radius,
        height,
        jumpable
    };
    activeObstacles.push(obstacle);
    return obstacle;
}

function isPathClear(start, displacement, radius, jumpHeight) {
    const endX = start.x + displacement.x;
    const endZ = start.z + displacement.z;
    const lengthSq = displacement.x * displacement.x + displacement.z * displacement.z;

    return activeObstacles.every((obstacle) => {
        if (obstacle.jumpable && jumpHeight >= obstacle.height) return true;

        const offsetX = obstacle.position.x - start.x;
        const offsetZ = obstacle.position.z - start.z;
        const projection = lengthSq === 0
            ? 0
            : THREE.MathUtils.clamp((offsetX * displacement.x + offsetZ * displacement.z) / lengthSq, 0, 1);
        const closestX = start.x + displacement.x * projection;
        const closestZ = start.z + displacement.z * projection;
        const minDistance = obstacle.radius + radius;
        return Math.hypot(closestX - obstacle.position.x, closestZ - obstacle.position.z) >= minDistance;
    });
}

export function resolveObstacleMovement(start, displacement, {
    radius = 1.5,
    jumpHeight = 0
} = {}) {
    if (isPathClear(start, displacement, radius, jumpHeight)) return displacement.clone();

    const magnitude = Math.hypot(displacement.x, displacement.z);
    if (magnitude === 0) return new THREE.Vector3();

    const directionX = displacement.x / magnitude;
    const directionZ = displacement.z / magnitude;
    const steeringAngles = [Math.PI / 4, -Math.PI / 4, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];

    for (const angle of steeringAngles) {
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const candidate = new THREE.Vector3(
            (directionX * cosine - directionZ * sine) * magnitude,
            0,
            (directionX * sine + directionZ * cosine) * magnitude
        );
        if (isPathClear(start, candidate, radius, jumpHeight)) return candidate;
    }

    return new THREE.Vector3();
}

const loader = new GLTFLoader();

export function spawnHouses() {
    // Add 3 houses to the map in random positions
    for (let i = 0; i < 3; i++) {
        loader.load('/models/small_house.glb', (gltf) => {
            const houseModel = gltf.scene;

            // Set the model scale using a scalar of 65
            houseModel.scale.setScalar(HOUSE_SCALE);

            // Rotate all houses Math.PI / 2 around the X-axis to align with Z-up coordinate system
            houseModel.rotation.x = Math.PI / 2;

            // Assign each house a random rotation around the Y-axis in multiples of Math.PI / 2
            const randomMultiplier = Math.floor(Math.random() * 4);
            houseModel.rotation.y = randomMultiplier * (Math.PI / 2);

            // Calculate bounding box to ensure houses sit exactly on the ground level (Z = 0)
            const box = new THREE.Box3().setFromObject(houseModel);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Center the model's physical base perfectly flush with the ground line
            houseModel.position.z = size.z / 2;

            // Distribute randomly over our map landscape (avoiding dead-center (0,0) spawn)
            const rangeX = (Math.random() - 0.5) * 350;
            const rangeY = (Math.random() - 0.5) * 350;

            // Ensure houses do not spawn right on top of Tode's start zone
            houseModel.position.x = Math.abs(rangeX) < 40 ? (rangeX > 0 ? 60 : -60) : rangeX;
            houseModel.position.y = Math.abs(rangeY) < 40 ? (rangeY > 0 ? 60 : -60) : rangeY;

            // Save a clean reference vector coordinates specifically for hit detection sweeps
            activeHouses.push(new THREE.Vector3(houseModel.position.x, houseModel.position.y, 0));

            // Load the houses and add them to the map group so the whole world stays organized
            mapGroup.add(houseModel);
        });
    }
}

/**
 * Universal look-ahead check function to validate if an entity hits an obstacle wall
 */
export function checkObstacleCollision(targetPosition) {
    return activeObstacles.some((obstacle) => {
        if (obstacle.jumpable) return false;
        return Math.hypot(
            targetPosition.x - obstacle.position.x,
            targetPosition.z - obstacle.position.z
        ) < obstacle.radius + 1.5;
    });
}