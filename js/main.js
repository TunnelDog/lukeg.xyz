import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(0.3, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.y = 0.25;

const loader = new GLTFLoader();

function createLetter(letterFile, xOffset) {
    loader.load(
        `models/newletters/${letterFile}/${letterFile}.gltf`,
        function (gltf) {
            const letter = gltf.scene.clone();
            letter.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const material = new THREE.MeshToonMaterial({ color: 0x3C4F76 });
                    child.material = material;
                }
            });

            const outlineLetter = letter.clone();
            outlineLetter.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
                    child.material = outlineMaterial;
                    child.scale.multiplyScalar(1.04);
                }
            });

            const letterGroup = new THREE.Group();
            letterGroup.add(letter);
            letterGroup.add(outlineLetter);
            letterGroup.position.x = xOffset;
            scene.add(letterGroup);
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

const letters = [];

createLetter('L', -1.37);
createLetter('U', -0.79);
createLetter('K', -0.125);
createLetter('E', 0.47);
createLetter('G', 1.3);

function centerLetters() {
    const totalWidth = 1.5 * 2 + 0.5 * 3; 
    const centerOffset = -totalWidth / 2;
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
topLight.position.set(0, 1, 10) //top-left-ish
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
        letter.rotation.z = Math.cos(time * waveFrequency * 0.5 + waveOffset) * 0.06;
    });

    renderer.render(scene, camera);
}

let oldx = window.innerWidth / 2;
let oldy = window.innerHeight / 2;

window.onmousemove = function (ev) {
    const changex = ev.clientX - oldx;
    const changey = ev.clientY - oldy;
    letters.forEach((letter, index) => {
        const factor = 4000 + index * 100;
        letter.position.x += changex / factor;
        letter.position.y += changey / factor;
    });
    oldx = ev.clientX;
    oldy = ev.clientY;
};

animate();

window.addEventListener('resize', onWindowResize);

if (window.innerWidth < window.innerHeight) {
    onWindowResize();
}
