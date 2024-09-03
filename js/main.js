import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(0.3, window.innerWidth / window.innerHeight, 1, 1000);

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
                    child.scale.multiplyScalar(1.08);
                    child.position.y = -0.02
                }
            });

            const letterGroup = new THREE.Group();
            letterGroup.add(letter);
            letterGroup.add(outlineLetter);
            letterGroup.position.x = xOffset;
            
            // Scale down the entire letter group
            letterGroup.scale.set(0.5, 0.5, 0.5); // Adjust this value to make letters smaller or larger
            
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

createLetter('L', -0.685);
createLetter('U', -0.395);
createLetter('K', -0.0625);
createLetter('E', 0.235);
createLetter('G', 0.65);

let cube;
let cubeGroup;
let laptop;
let laptopScreen;

function loadCube() {
    loader.load(
        '/models/cube.gltf',
        function (gltf) {
            cube = gltf.scene;
            cubeGroup = new THREE.Group();
            cubeGroup.add(cube);
            
            // Scale down the cube
            const scaleValue = 0.2; // Adjust this value to make the cube smaller or larger
            cubeGroup.scale.set(scaleValue, scaleValue, scaleValue);
            
            scene.add(cubeGroup);
            cubeGroup.position.set(-0.92, 0.3, -5);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('An error happened', error);
        }
    );
}

function loadLaptop() {
    loader.load(
        '/models/laptop.glb',
        function (gltf) {
            laptop = gltf.scene;
            laptop.scale.set(0.15, 0.15, 0.15); // Adjust scale as needed
            laptop.position.set(0.5, -0.3, -5); // Adjust position as needed
            laptop.rotation.set(0.4, -0.2, 0); // Adjust position as needed
            scene.add(laptop);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('An error happened', error);
        }
    );
}

function loadLaptopScreen() {
    loader.load(
        '/models/laptopscreen.glb',
        function (gltf) {
            laptopScreen = gltf.scene;
            laptopScreen.scale.set(0.15, 0.15, 0.15);
            laptopScreen.position.set(0.51, -0.3, -5);
            laptopScreen.rotation.set(0.4, -0.2, 0);
            
            // Create a video element
            const video = document.createElement('video');
            video.src = 'models/loop.mp4';
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            
            // Create a video texture
            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            
            // Create a plane for the video
            const aspectRatio = 16 / 9; // Adjust if your video has a different aspect ratio
            const planeWidth = 2.45;
            const planeHeight = planeWidth / aspectRatio;
            const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
            const videoPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            
            // Position the video plane slightly in front of the laptop screen
            videoPlane.position.set(0, 0.95, 0);
            videoPlane.rotation.set(0, 0, 0);
            
            // Create a glow plane
            const glowGeometry = new THREE.PlaneGeometry(planeWidth * 2.4, planeHeight * 2.4);
            const glowMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    glowColor: { value: new THREE.Color(0x00ffff) },
                    intensity: { value: 0.4 }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 glowColor;
                    uniform float intensity;
                    varying vec2 vUv;
                    void main() {
                        float distance = length(vUv - 0.5);
                        float glow = 1.0 - smoothstep(0.0, 0.5, distance);
                        gl_FragColor = vec4(glowColor, glow * intensity);
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending
            });
            const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
            
            // Position the glow plane slightly behind the video plane
            glowPlane.position.set(0, 0.4, -1);
            
            // Add both planes to the laptop screen
            laptopScreen.add(glowPlane);
            laptopScreen.add(videoPlane);
            
            // Start video playback
            video.play().catch(e => console.error("Error playing video:", e));
            
            scene.add(laptopScreen);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('An error happened', error);
        }
    );
}


loadCube();
loadLaptop();
loadLaptopScreen();

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const canvas = renderer.domElement;
canvas.style.pointerEvents = "none";
document.getElementById("container3D").appendChild(canvas);

camera.position.z = 300;

const topLight = new THREE.DirectionalLight(0xffffff, 1);
topLight.position.set(0, 0, 10)
topLight.castShadow = false;
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

let lastFloatTime = 0;
const floatInterval = 20000;
let lastLaptopFloatTime = 0;
const laptopFloatInterval = 15000; // Adjust this value to change how often the laptop moves

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    letters.forEach((letter, index) => {
        // wave animation
        const waveFrequency = 1.5;
        const waveAmplitude = 0.15;
        const waveOffset = index * 0.5;

        letter.position.y = Math.sin(time * waveFrequency + waveOffset) * waveAmplitude;
        letter.rotation.x = Math.sin(time * waveFrequency * 0.5 + waveOffset) * 0.05;
        letter.rotation.z = Math.cos(time * waveFrequency * 0.5 + waveOffset) * 0.06;
    });

    // Cube animation
    if (cubeGroup) {
        // Vertical floating animation (up and down)
        const cubeFloatAmplitude = 0.3; // Adjust the amplitude for more or less noticeable movement
        const cubeFloatFrequency = 0.5; // Adjust frequency to control the speed of floating
    
    
        // Slow rotation in all directions
        cube.rotation.x += 0.002; // Slow down the rotation speed for a smoother effect
        cube.rotation.y += 0.002;
        cube.rotation.z += 0.002;
    }

    
    if (laptop && laptopScreen) {
        // Vertical floating animation (up and down)
        const laptopFloatAmplitude = 0.2; // Increased amplitude for more noticeable movement
        const laptopFloatFrequency = 0.5;
        
        const verticalOffset = Math.sin(time * laptopFloatFrequency) * laptopFloatAmplitude;
        laptop.position.y = -0.4 + verticalOffset;
        laptopScreen.position.y = -0.4 + verticalOffset;
        
        // Left-to-right rotation animation
        const laptopRotationAmplitude = 0.1; // Increased for more noticeable rotation
        const laptopRotationFrequency = 0.3;
        
        const rotationOffset = Math.sin(time * laptopRotationFrequency) * laptopRotationAmplitude;
        laptop.rotation.y = -0.2 + rotationOffset;
        laptopScreen.rotation.y = -0.2 + rotationOffset;
        
        // Slight forward-backward tilt
        const tiltAmplitude = 0.05;
        const tiltFrequency = 0.7;
        
        const tiltOffset = Math.sin(time * tiltFrequency) * tiltAmplitude;
        laptop.rotation.x = 0.4 + tiltOffset;
        laptopScreen.rotation.x = 0.4 + tiltOffset;

    }


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