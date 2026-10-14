import  * as THREE from 'three';
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
// Player represented by THREE.Group
const player = new THREE.Group();

// Load the 3D model from public/models
// 1. Instantiate a loader
const loader = new GLTFLoader();
// 2. Add path to the model
loader.load('/models/tode.glb',
    (gltf) => {
    const model = gltf.scene;
    // 3. Apply rotation and scaling
        model.rotation.x = Math.PI /2;
        // 4. Scale x,y,z by 20
        model.scale.setScalar(20);
        // 5. Calculate dimensions to sit model flush on the ground
        // 5.1 Create a bounding box around the model to calculate its current height
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        // 5.2 Drop the model size into our vector variable
        box.getSize(size);
        // 5.3 Apply the Z-offset so tode sits perfectly flush on the ground
        model.position.z = size.z/2;
        // 6. Add the model as a child of the player group
        player.add(model);
    }, (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    }, (error) => {
    console.error('An error happened loading tode:', error);
    }
    );

export { player };