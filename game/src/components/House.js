import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mapGroup } from './Map.js';

// Configuration parameters matching spec requirements
const HOUSE_SCALE = 65;
export const HOUSE_COLLISION_RADIUS = 30.0; // Keeps players and bugs outside the walls

// Master tracking array for obstacle locations
export const activeHouses = [];

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
    for (let housePos of activeHouses) {
        const dx = targetPosition.x - housePos.x;
        const dy = targetPosition.y - housePos.y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (currentDistance < HOUSE_COLLISION_RADIUS) {
            return true; // Collision detected! Movement blocked
        }
    }
    return false;
}