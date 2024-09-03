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
            
            const scaleValue = 0.2;
            cubeGroup.scale.set(scaleValue, scaleValue, scaleValue);
            
            scene.add(cubeGroup);
            
            if (window.innerWidth > window.innerHeight) {
                cubeGroup.position.set(-0.92, 0.3, -5);
            }
            else {
                cubeGroup.position.set(-0.75, 0.6, -5);
            }
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
            laptop.scale.set(0.15, 0.15, 0.15);
            laptop.position.set(0.5, -0.3, -5);
            laptop.rotation.set(0.4, -0.2, 0);
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
            
            const video = document.createElement('video');
            video.src = 'models/loop.mp4';
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            
            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            
            const aspectRatio = 16 / 9;
            const planeWidth = 2.45;
            const planeHeight = planeWidth / aspectRatio;
            const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const planeMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
            const videoPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            
            videoPlane.position.set(0, 0.95, 0);
            videoPlane.rotation.set(0, 0, 0);
    
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
            glowPlane.position.set(0, 0.4, -1);
            laptopScreen.add(glowPlane);
            laptopScreen.add(videoPlane);
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
const laptopFloatInterval = 15000;

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    letters.forEach((letter, index) => {
        const waveFrequency = 1.5;
        const waveAmplitude = 0.05;
        const waveOffset = index * 0.5;

        letter.position.y = Math.sin(time * waveFrequency + waveOffset) * waveAmplitude;
        letter.rotation.x = Math.sin(time * waveFrequency * 0.5 + waveOffset) * 0.05;
        letter.rotation.z = Math.cos(time * waveFrequency * 0.5 + waveOffset) * 0.06;
    });

    if (cubeGroup) {
        const cubeFloatAmplitude = 0.3;
        const cubeFloatFrequency = 0.5;
    
        cube.rotation.x += 0.002;
        cube.rotation.y += 0.002;
        cube.rotation.z += 0.002;
    }

    
    if (laptop && laptopScreen) {
        const laptopFloatAmplitude = 0.2; 
        const laptopFloatFrequency = 0.5;
        
        const verticalOffset = Math.sin(time * laptopFloatFrequency) * laptopFloatAmplitude;
        laptop.position.y = -0.4 + verticalOffset;
        laptopScreen.position.y = -0.4 + verticalOffset;
        
        const laptopRotationAmplitude = 0.1;
        const laptopRotationFrequency = 0.3;
        
        const rotationOffset = Math.sin(time * laptopRotationFrequency) * laptopRotationAmplitude;
        laptop.rotation.y = -0.2 + rotationOffset;
        laptopScreen.rotation.y = -0.2 + rotationOffset;
        
        const tiltAmplitude = 0.05;
        const tiltFrequency = 0.7;
        
        const tiltOffset = Math.sin(time * tiltFrequency) * tiltAmplitude;
        laptop.rotation.x = 0.4 + tiltOffset;
        laptopScreen.rotation.x = 0.4 + tiltOffset;

    }


    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', onWindowResize);

if (window.innerWidth < window.innerHeight) {
    onWindowResize();
}