import * as THREE from 'three';

// A tiny "photo studio" baked into an environment map: a neutral grey room
// with a few bright softbox panels. Glossy materials pick up those panels
// as clean highlights, which is most of what makes them read as real
// objects instead of flat-shaded ones.
export function createStudioEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new THREE.Scene();

    const walls = new THREE.Mesh(
        new THREE.BoxGeometry(20, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0x2e2e2c, side: THREE.BackSide })
    );
    room.add(walls);

    function softbox(intensity, width, height, x, y, z) {
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        material.color.multiplyScalar(intensity);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        panel.position.set(x, y, z);
        panel.lookAt(0, 0, 0);
        room.add(panel);
    }

    softbox(6, 8, 4, 0, 9, 3);     // key, overhead and slightly forward
    softbox(3, 3, 8, -9, 1, 4);    // left strip
    softbox(2, 3, 8, 9, 2, -2);    // right strip
    softbox(0.4, 10, 3, 0, -6, 9); // dim low front fill - kept faint since flat faces look straight at it

    const envMap = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    return envMap;
}
