import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

//Create a Three.JS Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(0.3, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.y = 0.25;

//Instantiate a loader for the .gltf file
const loader = new GLTFLoader();

function createLetter(letterFile, xOffset) {
    loader.load(
        `models/newletters/${letterFile}/${letterFile}.gltf`,
        function (gltf) {
            const letter = gltf.scene.clone();

            // Apply material to original letter
            letter.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const material = new THREE.MeshToonMaterial({ color: 0x3C4F76 });
                    child.material = material;
                }
            });

            // Create outline mesh
            const outlineLetter = letter.clone();
            outlineLetter.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
                    child.material = outlineMaterial;
                    child.scale.multiplyScalar(1.04); // Scale up slightly to make the outline visible
                }
            });

            // Create a group to hold both the letter and its outline
            const letterGroup = new THREE.Group();
            letterGroup.add(letter);
            letterGroup.add(outlineLetter);

            // Position the group
            letterGroup.position.x = xOffset;

            // Add the group to the scene
            scene.add(letterGroup);

            // Store letter groups for further manipulation
            letters.push(letterGroup);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error(error);
        }
    );
}

// Create and position letters
const letters = [];

// Create letters
createLetter('L', -1.37);
createLetter('U', -0.79);
createLetter('K', -0.125);
createLetter('E', 0.47);
createLetter('G', 1.3);

// Function to center letters horizontally
function centerLetters() {
    const totalWidth = 1.5 * 2 + 0.5 * 3; // Total width of letters LUKE
    const centerOffset = -totalWidth / 2;

    // Position letters relative to the center
    letters.forEach((letter, index) => {
        letter.position.x = centerOffset + index * 0.5;
    });
}

centerLetters();

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const canvas = renderer.domElement;
canvas.style.pointerEvents = "none";
document.getElementById("container3D").appendChild(canvas);

camera.position.z = 600;

const topLight = new THREE.DirectionalLight(0xffffff, 1); // (color, intensity)
topLight.position.set(0, 1, 10)
topLight.castShadow = true;
scene.add(topLight);

function updateCameraAspect() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function updateRendererSize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.fov = 0.34 * (1 / aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function adjustForMobile() {
    updateCameraAspect();
    updateRendererSize();
}

adjustForMobile();

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    letters.forEach((letter, index) => {
        // Wave animation
        const waveFrequency = 1.5;
        const waveAmplitude = 0.15;
        const waveOffset = index * 0.5;
        letter.position.y = Math.sin(time * waveFrequency + waveOffset) * waveAmplitude;
        letter.rotation.x = Math.sin(time * waveFrequency * 0.5 + waveOffset) * 0.05;
        letter.rotation.z = Math.cos(time * waveFrequency * 0.5 + waveOffset) * 0.05;
    });
    renderer.render(scene, camera);
}

let oldx = window.innerWidth / 2;
let oldy = window.innerHeight / 2;

window.onmousemove = function (ev) {
    const changex = ev.clientX - oldx;
    const changey = ev.clientY - oldy;
    letters.forEach((letter, index) => {
        const factorx = 2200 + index * 100;
        const factory = 10000 + index * 100;
        letter.position.x += changex / factorx;
        camera.position.y += changey / factory;
    });
    oldx = ev.clientX;
    oldy = ev.clientY;
};

animate();

window.addEventListener('resize', onWindowResize);

if (window.innerWidth < window.innerHeight) {
    onWindowResize();
}
