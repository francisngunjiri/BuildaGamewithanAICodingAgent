import * as THREE from 'three';

// Create a single group anchor to keep the whole map and its buildings organized
export const mapGroup = new THREE.Group();

export function createCheckerboardFloor(gridSize = 64, tileSize = 28) {
    const darkGreen = new THREE.Color(0x1d5f2e);
    const lightGreen = new THREE.Color(0x8fde9b);

    const tileGeo = new THREE.BoxGeometry(tileSize, tileSize, 1);
    const offset = (gridSize * tileSize) / 2 - tileSize / 2;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const isEven = (row + col) % 2 === 0;
            const tileMat = new THREE.MeshBasicMaterial({
                color: isEven ? lightGreen : darkGreen,
                transparent: true,
                opacity: 0.97
            });

            const tileMesh = new THREE.Mesh(tileGeo, tileMat);
            tileMesh.position.x = col * tileSize - offset;
            tileMesh.position.y = row * tileSize - offset;
            tileMesh.position.z = -0.5;

            mapGroup.add(tileMesh);
        }
    }

    const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(gridSize * tileSize * 1.7, gridSize * tileSize * 1.7),
        new THREE.MeshBasicMaterial({
            color: 0x7fd69a,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide
        })
    );
    haze.position.z = -2;
    mapGroup.add(haze);
}
