import * as THREE from 'three';

// Create a single group anchor to keep the whole map and its buildings organized
export const mapGroup = new THREE.Group();

export function createCheckerboardFloor(gridSize = 26, tileSize = 20) {
    const darkGreen = new THREE.Color(0x228B22);
    const lightGreen = new THREE.Color(0x90EE90);

    // Single reusable box geometry representing a flat grid floor tile
    const tileGeo = new THREE.BoxGeometry(tileSize, tileSize, 1);

    // Generate tiles symmetrically centered around the origin (0, 0)
    const offset = (gridSize * tileSize) / 2 - tileSize / 2;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            // Alternate tile colors cleanly based on grid coordinates
            const isEven = (row + col) % 2 === 0;
            const tileMat = new THREE.MeshBasicMaterial({
                color: isEven ? lightGreen : darkGreen
            });

            const tileMesh = new THREE.Mesh(tileGeo, tileMat);

            // Map layout positions on the flat horizontal XY plane
            tileMesh.position.x = col * tileSize - offset;
            tileMesh.position.y = row * tileSize - offset;
            tileMesh.position.z = -0.5; // Sink slightly so things sit cleanly at Z = 0

            mapGroup.add(tileMesh);
        }
    }
}
