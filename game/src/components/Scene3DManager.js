import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { camera } from './Camera.js';
import { registerObstacle } from './House.js';

const CHUNK_SIZE = 90;
const WORLD_RADIUS = 3;

function makeMaterial(color, emissive = 0x000000) {
    return new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: emissive ? 0.55 : 0,
        roughness: 0.42,
        metalness: 0.18,
        flatShading: true
    });
}

function createProp(scene, x, z, variant) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const stone = makeMaterial(variant % 2 ? 0x58634d : 0x77725a);
    const accent = makeMaterial(0x6da49a, 0x173e38);
    const gold = makeMaterial(0x9b7950, 0x24190d);

    if (variant % 4 === 0) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.1, 8, 6), stone);
        tower.position.y = 3;
        group.add(tower);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(3.5, 3, 6), gold);
        cap.position.y = 7.2;
        group.add(cap);
        registerObstacle(group.position, 4.2, 9);
    } else if (variant % 4 === 1) {
        const crystal = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 0), accent);
        crystal.position.y = 2.8;
        crystal.rotation.set(0.3, 0.4, 0.2);
        group.add(crystal);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 1, 7), stone);
        base.position.y = 0.5;
        group.add(base);
        registerObstacle(group.position, 3.1, 5);
    } else if (variant % 4 === 2) {
        const barricade = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 1.6), gold);
        barricade.position.y = 1.3;
        barricade.rotation.y = Math.random() * Math.PI;
        group.add(barricade);
        const postGeo = new THREE.CylinderGeometry(0.45, 0.6, 3, 5);
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(postGeo, stone);
            post.position.set(side * 3.2, 1.1, 0);
            group.add(post);
        }
        registerObstacle(group.position, 5.2, 3);
    } else {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 1), stone);
        rock.scale.set(1.35, 0.72, 1.1);
        rock.position.y = 1.5;
        rock.rotation.set(0.12, Math.random() * Math.PI, 0.08);
        group.add(rock);
        const smallerRock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 0), makeMaterial(0x666550));
        smallerRock.scale.set(1.25, 0.85, 1);
        smallerRock.position.set(2.1, 0.8, 0.9);
        group.add(smallerRock);
        registerObstacle(group.position, 3.8, 2, true);
    }

    scene.add(group);
    return group;
}

function createHouseProp(scene, x, z, modelTemplate) {
    const house = modelTemplate.clone(true);
    const angle = Math.random() * Math.PI * 2;
    house.rotation.y = angle;

    const initialBounds = new THREE.Box3().setFromObject(house);
    const initialSize = new THREE.Vector3();
    initialBounds.getSize(initialSize);
    const largestHorizontalDimension = Math.max(initialSize.x, initialSize.z, 0.001);
    house.scale.setScalar(12 / largestHorizontalDimension);

    const bounds = new THREE.Box3().setFromObject(house);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    house.position.set(x - center.x, -bounds.min.y, z - center.z);
    scene.add(house);

    const radius = Math.hypot(size.x, size.z) / 2;
    registerObstacle(new THREE.Vector3(x, 0, z), radius, size.y);
    return house;
}

export class Scene3DManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101b24);
        this.scene.fog = new THREE.FogExp2(0x101b24, 0.009);
        this.camera = camera;
        this.camera.up.set(0, 1, 0);
        this.camera.fov = 70;
        this.camera.updateProjectionMatrix();
        this.overviewCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 9000);
        this.overviewCamera.up.set(0, 1, 0);
        this.activeCamera = this.camera;
        this.terrainChunks = new Map();
        this.props = [];
        this.clock = 0;
        this.ambient = new THREE.HemisphereLight(0x9ed9dc, 0x1c2925, 2.1);
        this.scene.add(this.ambient);
        this.keyLight = new THREE.DirectionalLight(0xffe0a3, 2.7);
        this.keyLight.position.set(-16, 24, -8);
        this.scene.add(this.keyLight);
        this.spotlights = [-1, 1].map((side) => {
            const light = new THREE.SpotLight(side < 0 ? 0x50e7cf : 0xffc46b, 40, 55, Math.PI / 5, 0.5);
            light.position.set(side * 10, 18, 4);
            light.target.position.set(0, 0, 0);
            this.scene.add(light, light.target);
            return light;
        });
        this.createTerrain();
        this.createPedestal();
        this.createProps();
        window.addEventListener('resize', this.onResize);
    }

    onResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.overviewCamera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.overviewCamera.updateProjectionMatrix();
    };

    createTerrain() {
        const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getY(i);
            positions.setZ(i, Math.sin(x * 0.18) * Math.cos(z * 0.13) * 0.13);
        }
        geometry.computeVertexNormals();
        geometry.rotateX(-Math.PI / 2);
        this.terrainGeometry = geometry;
        this.terrainMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            roughness: 0.82,
            metalness: 0,
            flatShading: false
        });
        const colors = [];
        const baseColor = new THREE.Color();
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getY(i);
            const variation = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.045;
            baseColor.setRGB(0.27 + variation, 0.36 + variation, 0.24 + variation * 0.6);
            colors.push(baseColor.r, baseColor.g, baseColor.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
            for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
                this.addTerrainChunk(x, z);
            }
        }
    }

    addTerrainChunk(x, z) {
        const mesh = new THREE.Mesh(this.terrainGeometry, this.terrainMaterial);
        mesh.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE);
        this.scene.add(mesh);
        this.terrainChunks.set(`${x},${z}`, mesh);
    }

    createPedestal() {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 1, 8), makeMaterial(0x455a62));
        base.position.y = -0.5;
        base.name = 'menu-pedestal';
        this.scene.add(base);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.12, 6, 32), makeMaterial(0x47e8cb, 0x146a5f));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.03;
        rim.name = 'menu-pedestal-rim';
        this.scene.add(rim);
    }

    createProps() {
        const houseLoader = new GLTFLoader();
        houseLoader.load('/models/small_house.glb', (gltf) => {
            const houseTemplate = gltf.scene;
            for (let i = 0; i < 44; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 18 + Math.random() * 82;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                if (i % 4 === 0) {
                    this.props.push(createHouseProp(this.scene, x, z, houseTemplate));
                } else {
                    this.props.push(createProp(this.scene, x, z, i));
                }
            }
        }, undefined, (error) => {
            console.error('Failed to load /models/small_house.glb:', error);
        });
    }

    toggleCamera() {
        this.activeCamera = this.activeCamera === this.camera ? this.overviewCamera : this.camera;
    }

    update(deltaTime, player, state, isDashing = false) {
        this.clock += deltaTime;
        const menuActive = state === 'MENU' || state === 'DIFFICULTY_SELECT';
        const position = player.position;
        this.spotlights.forEach((light, index) => {
            light.intensity = menuActive ? 40 + Math.sin(this.clock * 2 + index) * 8 : 0;
            light.target.position.set(position.x, 0, position.z);
            light.position.x = position.x + Math.sin(this.clock * 0.7 + index * Math.PI) * 11;
            light.position.z = position.z + 5;
        });

        const chunkX = Math.round(position.x / CHUNK_SIZE);
        const chunkZ = Math.round(position.z / CHUNK_SIZE);
        for (const [key, chunk] of this.terrainChunks) {
            const [x, z] = key.split(',').map(Number);
            let nextX = x;
            let nextZ = z;
            while (nextX - chunkX > WORLD_RADIUS) nextX -= WORLD_RADIUS * 2 + 1;
            while (nextX - chunkX < -WORLD_RADIUS) nextX += WORLD_RADIUS * 2 + 1;
            while (nextZ - chunkZ > WORLD_RADIUS) nextZ -= WORLD_RADIUS * 2 + 1;
            while (nextZ - chunkZ < -WORLD_RADIUS) nextZ += WORLD_RADIUS * 2 + 1;
            if (nextX !== x || nextZ !== z) {
                this.terrainChunks.delete(key);
                chunk.position.set(nextX * CHUNK_SIZE, 0, nextZ * CHUNK_SIZE);
                this.terrainChunks.set(`${nextX},${nextZ}`, chunk);
            }
        }

    }

    dispose() {
        window.removeEventListener('resize', this.onResize);
        this.terrainGeometry.dispose();
        this.terrainMaterial.dispose();
    }
}

export const sceneManager = new Scene3DManager();
