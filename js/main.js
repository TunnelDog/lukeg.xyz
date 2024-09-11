import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(0.3, window.innerWidth / window.innerHeight, 1, 1000);

const loader = new GLTFLoader();

const letters = [];
let cube;
let cubeGroup;
let laptop;
let laptopScreen;
let laptopGroup;
let board;
let boardGroup;

let raycaster, mouse;
let isHovering = false;

raycaster = new THREE.Raycaster();
mouse = new THREE.Vector2();

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
            letterGroup.scale.set(0.5, 0.5, 0.5);
            
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

createLetter('L', -0.685);
createLetter('U', -0.395);
createLetter('K', -0.0625);
createLetter('E', 0.235);
createLetter('G', 0.65);

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

function loadBaord() {
    loader.load(
        '/models/board1.gltf',
        function(gltf) {
            board = gltf.scene;
            boardGroup = new THREE.Group();
            boardGroup.add(board);

            const scaleValue = 0.1;
            boardGroup.scale.set(scaleValue, scaleValue, scaleValue);
            boardGroup.position.set(-0.35, -0.25, -5);
            boardGroup.rotation.set(2, -1, 0);

            scene.add(boardGroup);
        }
    );
}

function loadLaptopAndScreen() {
    const laptopLoader = new GLTFLoader();
    const screenLoader = new GLTFLoader();

    Promise.all([
        new Promise((resolve) => laptopLoader.load('/models/laptop.glb', resolve)),
        new Promise((resolve) => screenLoader.load('/models/laptopscreen.glb', resolve))
    ]).then(([laptopGLTF, screenGLTF]) => {
        laptop = laptopGLTF.scene;
        laptopScreen = screenGLTF.scene;

        laptopGroup = new THREE.Group();
        laptopGroup.add(laptop);
        laptopGroup.add(laptopScreen);

        laptopScreen.scale.set(0.95, 0.95, 0.95);
        laptopScreen.position.set(0, 0.35, 0.05);
        laptopScreen.rotation.set(-0.1, 0, 0);

        const scaleValue = 0.15;
        laptopGroup.scale.set(scaleValue, scaleValue, scaleValue);

        laptopGroup.position.set(0.5, -0.3, -5);
        laptopGroup.rotation.set(0.4, -0.2, 0);
        laptopGroup.userData.clickable = true;

        scene.add(laptopGroup);

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
        
        const planeGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -planeWidth/2, -planeHeight/2, 0,
             planeWidth/2, -planeHeight/2, 0,
             planeWidth/2,  planeHeight/2, 0,
            -planeWidth/2,  planeHeight/2, 0
        ]);
        
        const uvScaleX = 0.9;
        const uvScaleY = 0.9;
        const uvOffsetX = (1 - uvScaleX) / 2;
        const uvOffsetY = 0.1;
        
        const uvs = new Float32Array([
            uvOffsetX, uvOffsetY,
            uvScaleX + uvOffsetX, uvOffsetY,
            uvScaleX + uvOffsetX, uvScaleY + uvOffsetY,
            uvOffsetX, uvScaleY + uvOffsetY
        ]);
        
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        
        planeGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        planeGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        planeGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        
        const planeMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
        const videoPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        
        videoPlane.position.set(0.1, 1.1, 0.01);
        videoPlane.scale.set(1, 1, 1);
        videoPlane.rotation.set(-0.1, 0, 0);

        laptopScreen.add(videoPlane);

        // Add glow effect
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
        glowPlane.position.set(0, 0, -0.5);
        laptopScreen.add(glowPlane);

        video.play().catch(e => console.error("Error playing video:", e));
    }).catch(error => {
        console.error('An error happened', error);
    });
}

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const canvas = renderer.domElement;
canvas.style.pointerEvents = "auto";
document.getElementById("container3D").appendChild(canvas);

camera.position.z = 300;

const topLight = new THREE.DirectionalLight(0xffffff, 1);
topLight.position.set(0, 10, 30)
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

canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('click', onClick);

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
    checkIntersection();
    if (isHovering) {
        window.open('https://www.youtube.com/@Luke-dt4jn', '_blank');
    }
}

function checkIntersection() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    let hovering = false;

    for (let i = 0; i < intersects.length; i++) {
        let object = intersects[i].object;
        while (object.parent && !(object.userData && object.userData.clickable)) {
            object = object.parent;
        }
        
        if (object.userData && object.userData.clickable) {
            hovering = true;
            if (!isHovering) {
                isHovering = true;
                document.body.style.cursor = 'pointer';
                laptopGroup.scale.multiplyScalar(1.1);
            }
            break;
        }
    }

    if (!hovering && isHovering) {
        resetHoverState();
    }
}

function resetHoverState() {
    if (isHovering && laptopGroup) {
        isHovering = false;
        document.body.style.cursor = 'auto';
        laptopGroup.scale.set(0.15, 0.15, 0.15);
    }
}

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

    if (boardGroup) {
        const boardFloatAmplitude = 0.3;
        const boardFloatFrequency = 0.5;

        board.rotation.x += 0.002;
        board.rotation.y += 0.002;
        board.rotation.z += 0.002;
    }
    
    if (laptop && laptopScreen) {
        const laptopFloatAmplitude = 0.1; 
        const laptopFloatFrequency = 0.1;
        
        const verticalOffset = Math.sin(time * laptopFloatFrequency) * laptopFloatAmplitude;
        laptop.position.y = -0.4 + verticalOffset;
        laptopScreen.position.y = -0.4 + verticalOffset;
        
        const laptopRotationAmplitude = 0.05;
        const laptopRotationFrequency = 0.3;
        
        const rotationOffset = Math.sin(time * laptopRotationFrequency) * laptopRotationAmplitude;
        laptop.rotation.y = -0.2 + rotationOffset;
        laptopScreen.rotation.y = -0.2 + rotationOffset;
        
        const tiltAmplitude = 0.02;
        const tiltFrequency = 0.7;
        
        const tiltOffset = Math.sin(time * tiltFrequency) * tiltAmplitude;
        laptop.rotation.x = 0.4 + tiltOffset;
        laptopScreen.rotation.x = 0.4 + tiltOffset;
    }

    if (laptopGroup) {
        const laptopFloatAmplitude = 0.2; 
        const laptopFloatFrequency = 0.5;
        
        const verticalOffset = Math.sin(time * laptopFloatFrequency) * laptopFloatAmplitude;
        laptopGroup.position.y = -0.3 + verticalOffset;
        
        const laptopRotationAmplitude = 0.1;
        const laptopRotationFrequency = 0.3;
        
        const rotationOffset = Math.sin(time * laptopRotationFrequency) * laptopRotationAmplitude;
        laptopGroup.rotation.y = -0.2 + rotationOffset;
        
        const tiltAmplitude = 0.05;
        const tiltFrequency = 0.7;
        
        const tiltOffset = Math.sin(time * tiltFrequency) * tiltAmplitude;
        laptopGroup.rotation.x = 0.4 + tiltOffset;
    }

    checkIntersection();
    renderer.render(scene, camera);
}

animate();
loadLaptopAndScreen();
loadCube();
loadBaord();

window.addEventListener('resize', onWindowResize);

if (window.innerWidth < window.innerHeight) {
    onWindowResize();
}