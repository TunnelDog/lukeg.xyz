import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(0.3, window.innerWidth / window.innerHeight, 1, 1000);

// The hero content is split into three groups so each can recede its own
// way once the user scrolls past the hero - that's what lets the starfield
// read as a single continuous scene that the hero recedes into, rather than
// a hard cut. The letters just scale down in place; the props exit sideways
// (cube/balls/racket left, laptop right).
const lettersRoot = new THREE.Group();
const leftExitRoot = new THREE.Group();
const rightExitRoot = new THREE.Group();
scene.add(lettersRoot, leftExitRoot, rightExitRoot);

const loader = new GLTFLoader();

const letters = [];
let cube;
let cubeGroup;
let laptop;
let laptopScreen;
let laptopGroup;
let ball;
let ballGroup;
let racket;
let racketGroup;

let raycaster, mouse;
let isHovering = false;

raycaster = new THREE.Raycaster();
mouse = new THREE.Vector2();

// Procedural gradient so MeshToonMaterial actually cel-shades instead of
// falling back to smooth shading (no external texture needed). Uses linear
// filtering so shading eases between bands instead of hard-cutting - with
// NearestFilter, the subtle per-frame letter wobble kept flipping surface
// normals across step boundaries, which read as a flicker.
function createToonGradientTexture(steps) {
    const canvas = document.createElement('canvas');
    canvas.width = steps;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    for (let i = 0; i < steps; i++) {
        const value = Math.round((i / (steps - 1)) * 255);
        context.fillStyle = `rgb(${value},${value},${value})`;
        context.fillRect(i, 0, 1, 1);
    }
    const texture = new THREE.Texture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

const toonGradientMap = createToonGradientTexture(8);

function createLetter(letterFile, xOffset) {
    loader.load(
        `models/newletters/${letterFile}/${letterFile}.gltf`,
        function (gltf) {
            const letter = gltf.scene.clone();
            letter.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const material = new THREE.MeshToonMaterial({ color: 0x3C4F76, gradientMap: toonGradientMap });
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
            
            lettersRoot.add(letterGroup);
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
            
            leftExitRoot.add(cubeGroup);
            
            if (window.innerWidth > window.innerHeight) {
                cubeGroup.position.set(-0.92, 0.35, -5);
            }
            else {
                cubeGroup.position.set(-0.75, 0.43, -5);
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

function loadRacket() {
    loader.load(
        'models/racket.glb',
        function(gltf) {
            racket = gltf.scene;
            racketGroup = new THREE.Group();
            racketGroup.add(racket);

            const scaleValue = 0.8;
            racketGroup.scale.set(scaleValue, scaleValue, scaleValue);
            racketGroup.position.x = -0.23;
            racketGroup.position.y = -0.65;
            racketGroup.position.z = -6;
            racketGroup.rotation.x = 0.6;
            racketGroup.rotation.z = 0.3;
            leftExitRoot.add(racketGroup);
            
        }
    )
}

function loadBall() {
    loader.load(
        '/models/ball.gltf',
        function(gltf) {
            const ballModel = gltf.scene;
            ballGroup = new THREE.Group();

            for (let i = 0; i < 3; i++) {
                const ball = ballModel.clone();
                const individualBallGroup = new THREE.Group();
                individualBallGroup.add(ball);

                const scaleValue = 0.14;
                individualBallGroup.scale.set(scaleValue, scaleValue, scaleValue);

                const xOffset = (i - 1) * 0.13;
                let yOffset;
                if (i === 1) {
                    yOffset = 0; // Center ball
                } else if (i === 0) {
                    yOffset = 0; // Left ball
                } else {
                    yOffset = 0; // Right ball
                }
                individualBallGroup.position.set(-0.35 + xOffset, -0.3 + yOffset, -5);

                ballGroup.add(individualBallGroup);
            }

            leftExitRoot.add(ballGroup);
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

        // The screen has to share the base's exact position/rotation to stay
        // seated on it - they're separate GLTF files parented as siblings,
        // not one mesh, and laptopGroup's per-frame float/tilt below moves
        // both together, so any offset here would visibly separate them.
        laptopScreen.scale.set(0.95, 0.95, 0.95);
        laptopScreen.position.copy(laptop.position);
        laptopScreen.rotation.copy(laptop.rotation);

        const scaleValue = 0.15;
        laptopGroup.scale.set(scaleValue, scaleValue, scaleValue);

        laptopGroup.position.set(0.5, -0.3, -5);
        laptopGroup.rotation.set(0.4, -0.2, 0);
        laptopGroup.userData.clickable = true;

        rightExitRoot.add(laptopGroup);

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
                intensity: { value: 0.45 }
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

// --- Background starfield ---------------------------------------------
// Rendered as its own scene/camera so it can use a completely different
// scale and FOV than the telephoto hero shot above, but drawn into the
// same canvas/renderer so the whole page reads as one 3D backdrop. Depth
// no longer autoplays - it's tied to scroll position (see animate()) so
// scrolling the page reads as flying forward through the dots, and the
// dots stay visible behind every section, not just the hero.
const dotsScene = new THREE.Scene();
const dotsCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
dotsCamera.position.z = 10;

const dots = [];
const DOTS_Z_RANGE = 1000; // stars span [-DOTS_Z_RANGE, DOTS_Z_RANGE]
const DOTS_GEOMETRY = new THREE.SphereGeometry(0.5, 10, 8);
const DOTS_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x3c4f76 });

function createDots() {
    for (let z = -DOTS_Z_RANGE; z < DOTS_Z_RANGE; z += 10) {
        const dot = new THREE.Mesh(DOTS_GEOMETRY, DOTS_MATERIAL);
        dot.position.x = Math.random() * 2000 - 500;
        dot.position.y = Math.random() * 2000 - 500;
        dot.position.z = z;
        dot.userData.baseZ = z;
        dot.scale.setScalar(2.5);
        dotsScene.add(dot);
        dots.push(dot);
    }
}
createDots();

// How far (in world units) the starfield travels per pixel scrolled, and
// the smoothing factor that turns scroll jumps into an eased drift.
const SCROLL_FLIGHT_SPEED = 1.1;
const SCROLL_FLIGHT_EASE = 0.06;
let flightOffset = 0;

function updateDots() {
    const targetOffset = window.scrollY * SCROLL_FLIGHT_SPEED;
    flightOffset += (targetOffset - flightOffset) * SCROLL_FLIGHT_EASE;

    for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        let z = dot.userData.baseZ + flightOffset;
        z = ((z + DOTS_Z_RANGE) % (DOTS_Z_RANGE * 2) + DOTS_Z_RANGE * 2) % (DOTS_Z_RANGE * 2) - DOTS_Z_RANGE;
        dot.position.z = z;
    }
}

let dotsOldX = 0;
let dotsOldY = 0;

function onDotsMouseMove(event) {
    const changeX = event.clientX - dotsOldX;
    const changeY = event.clientY - dotsOldY;
    dotsCamera.position.x += changeX / 10;
    dotsCamera.position.y -= changeY / 10;
    dotsOldX = event.clientX;
    dotsOldY = event.clientY;
}

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;

const canvas = renderer.domElement;
canvas.style.pointerEvents = "auto";
document.getElementById("bg3D").appendChild(canvas);
canvas.addEventListener('mousemove', onDotsMouseMove);

camera.position.z = 300;

const topLight = new THREE.DirectionalLight(0xffffff, 1);
topLight.position.set(0, 10, 30)
topLight.castShadow = false;
scene.add(topLight);

// Soft fill so the toon shading doesn't crush to black in shadow
const fillLight = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(fillLight);

// Cool-toned hemisphere light for a touch of sky/ground color variation
const hemiLight = new THREE.HemisphereLight(0xbfd4ff, 0x2a3a5c, 0.1);
scene.add(hemiLight);

// Rim light from behind/side to pop the edges of the models
const rimLight = new THREE.DirectionalLight(0x6ea8ff, 0.2);
rimLight.position.set(-15, 6, -25);
scene.add(rimLight);

// Slowly orbiting accent light so the toon-shaded facets shift and catch
// the light over time instead of looking static
const accentLight = new THREE.PointLight(0x7fd4ff, 0.35, 40);
accentLight.position.set(0, 3, 4);
scene.add(accentLight);

// Base FOV tuned for a typical desktop window. On narrower/taller windows
// (mobile portrait) we widen the FOV so the letters and props still fit
// horizontally, but we never go narrower than the base - going narrower is
// what was causing the scene to zoom in and clip the props on short, wide
// windows. This same formula runs on load AND on resize so there's no
// mismatch/pop between the first paint and the first resize.
const BASE_FOV = 0.3;
function computeFov(aspect) {
    return Math.max(BASE_FOV, 0.34 / aspect);
}

let lastKnownWidth = window.innerWidth;

// Below this width there's no side margin next to the About/Projects text
// for the props to park in, so they recede fully like the letters instead.
const MOBILE_BREAKPOINT = 768;
let isMobileLayout = window.innerWidth < MOBILE_BREAKPOINT;

function updateCameraAspect() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.fov = computeFov(aspect);
    camera.updateProjectionMatrix();

    dotsCamera.aspect = aspect;
    dotsCamera.updateProjectionMatrix();
}

function updateRendererSize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onWindowResize() {
    // Mobile browsers fire a resize event when the address bar shows/hides
    // during scroll - that only changes innerHeight, not innerWidth. Ignore
    // it so the scene doesn't visibly rescale the instant the page scrolls.
    if (window.innerWidth === lastKnownWidth) return;
    lastKnownWidth = window.innerWidth;

    updateCameraAspect();
    updateRendererSize();
    HERO_SCROLL_RANGE = window.innerHeight;
    isMobileLayout = window.innerWidth < MOBILE_BREAKPOINT;
    renderScene();
}

function adjustForMobile() {
    updateCameraAspect();
    updateRendererSize();
}

// Draws the starfield first, then the hero on top with only the depth
// buffer cleared in between - that's what lets the hero's props occlude
// each other correctly while still compositing over the dots behind them.
function renderScene() {
    renderer.clear();
    renderer.render(dotsScene, dotsCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);
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

// The hero (letters + props) transitions over the first viewport-height of
// scroll: the letters scale down and drift off, while on desktop the props
// ease into a parked spot beside the page content and stay there - still
// floating - for the rest of the scroll instead of disappearing. On mobile
// there's no side margin for that, so the props recede fully like the
// letters.
let HERO_SCROLL_RANGE = window.innerHeight;

const HERO_EXIT_X = 1.6;
const HERO_DEPTH_Z = -5; // approximate depth of the props, for sizing the parked frustum
const PARK_FRACTION = 0.72; // how far toward the screen edge the parked props sit
const PARK_SCALE = 0.58;

// Half-width (world units) of the camera frustum at the props' depth - the
// edge the parked props ease toward. Recomputed each call since it depends
// on the live FOV/aspect.
function frustumHalfWidthAtDepth(depthZ) {
    const distance = camera.position.z - depthZ;
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
    return halfHeight * camera.aspect;
}

// Layered sine waves at incommensurate frequencies read as loose, organic
// wandering without the jitter true per-frame randomness would cause. Each
// side gets its own seed so the two groups don't drift in lockstep.
function wanderOffset(time, seed) {
    return {
        x: Math.sin(time * 0.15 + seed) * 0.22 + Math.sin(time * 0.06 + seed * 1.7) * 0.15,
        y: Math.cos(time * 0.11 + seed * 0.6) * 0.18 + Math.sin(time * 0.19 + seed * 2.3) * 0.1
    };
}

function updateHero(time) {
    const heroProgress = Math.min(window.scrollY / HERO_SCROLL_RANGE, 1);
    const heroScale = THREE.MathUtils.clamp(1 - heroProgress * 1.15, 0.001, 1);

    // Letters always just scale down and drift away with the hero.
    lettersRoot.scale.setScalar(heroScale);
    lettersRoot.position.y = heroProgress * 0.6;

    if (isMobileLayout) {
        leftExitRoot.scale.setScalar(heroScale);
        leftExitRoot.position.set(-heroProgress * HERO_EXIT_X, 0, 0);

        rightExitRoot.scale.setScalar(heroScale);
        rightExitRoot.position.set(heroProgress * HERO_EXIT_X, 0, 0);
    } else {
        const parkX = frustumHalfWidthAtDepth(HERO_DEPTH_Z) * PARK_FRACTION;
        const parkScale = THREE.MathUtils.lerp(1, PARK_SCALE, heroProgress);

        // A loose, multi-frequency wander on top of each prop's own
        // float/spin animation, so the parked cluster reads as adrift
        // rather than pinned to a fixed spot - it's big enough to carry
        // them in behind the text sometimes, not just hover at the edge.
        const leftWander = wanderOffset(time, 1.3);
        const rightWander = wanderOffset(time, 4.1);

        leftExitRoot.scale.setScalar(parkScale);
        leftExitRoot.position.set(
            -heroProgress * parkX + leftWander.x * heroProgress,
            leftWander.y * heroProgress,
            0
        );

        rightExitRoot.scale.setScalar(parkScale);
        rightExitRoot.position.set(
            heroProgress * parkX + rightWander.x * heroProgress,
            rightWander.y * heroProgress,
            0
        );
    }

    return heroProgress;
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;
    const heroProgress = updateHero(time);

    accentLight.position.set(
        Math.sin(time * 0.12) * 3.5,
        2 + Math.cos(time * 0.16) * 1.2,
        3 + Math.cos(time * 0.12) * 3.5
    );

    letters.forEach((letter, index) => {
        const waveFrequency = 1.5;
        const waveAmplitude = 0.05;
        const waveOffset = index * 0.5;

        letter.position.y = Math.sin(time * waveFrequency + waveOffset) * waveAmplitude;
        letter.rotation.x = Math.sin(time * waveFrequency * 0.5 + waveOffset) * 0.05;
        letter.rotation.z = Math.cos(time * waveFrequency * 0.5 + waveOffset) * 0.06;
    });

    if (cubeGroup) {
        if (cubeGroup.userData.baseX === undefined) {
            cubeGroup.userData.baseX = cubeGroup.position.x;
            cubeGroup.userData.baseY = cubeGroup.position.y;
        }
        cubeGroup.position.x = cubeGroup.userData.baseX + Math.sin(time * 0.27) * 0.16;
        cubeGroup.position.y = cubeGroup.userData.baseY + Math.sin(time * 0.35 + 1.1) * 0.16;

        cube.rotation.x += 0.0035;
        cube.rotation.y += 0.0048;
        cube.rotation.z += 0.0021;
    }

    if (ballGroup) {
        ballGroup.children.forEach((individualBallGroup, index) => {
            const ball = individualBallGroup.children[0];
            const ballFloatAmplitude = 0.14;
            const ballFloatFrequency = 0.45;
            const ballFloatPhase = index * (Math.PI * 2 / 3);

            if (individualBallGroup.userData.baseX === undefined) {
                individualBallGroup.userData.baseX = individualBallGroup.position.x;
                individualBallGroup.userData.baseY = individualBallGroup.position.y;
            }

            const verticalOffset = Math.sin(time * ballFloatFrequency + ballFloatPhase) * ballFloatAmplitude;
            const horizontalOffset = Math.cos(time * 0.3 + ballFloatPhase) * 0.08;

            individualBallGroup.position.y = individualBallGroup.userData.baseY + verticalOffset;
            individualBallGroup.position.x = individualBallGroup.userData.baseX + horizontalOffset;
            ball.rotation.x = Math.sin(time * 0.5 + index) * 0.50;
            ball.rotation.y = Math.cos(time * 0.5 + index) * 0.50;
            ball.rotation.z = Math.sin(time * 0.7 + index) * 0.50;
        });
    }

    if (laptopGroup) {
        const laptopFloatAmplitude = 0.16;
        const laptopFloatFrequency = 0.4;

        const verticalOffset = Math.sin(time * laptopFloatFrequency) * laptopFloatAmplitude;
        const horizontalOffset = Math.cos(time * 0.22 + 0.8) * 0.12;
        laptopGroup.position.y = -0.3 + verticalOffset;
        laptopGroup.position.x = 0.5 + horizontalOffset;

        const laptopRotationAmplitude = 0.18;
        const laptopRotationFrequency = 0.3;

        const rotationOffset = Math.sin(time * laptopRotationFrequency) * laptopRotationAmplitude;
        laptopGroup.rotation.y = -0.2 + rotationOffset;

        const tiltAmplitude = 0.09;
        const tiltFrequency = 0.55;

        const tiltOffset = Math.sin(time * tiltFrequency) * tiltAmplitude;
        laptopGroup.rotation.x = 0.4 + tiltOffset;
        laptopGroup.rotation.z = Math.sin(time * 0.33 + 2) * 0.05;
    }

    if (racketGroup) {
        const racketFloatAmplitude = 0.22;
        const racketFloatFrequency = 0.42;
        const racketRotationAmplitude = 0.45;
        const racketRotationFrequency = 0.7;

        // Vertical + horizontal floating motion
        const verticalOffset = Math.sin(time * racketFloatFrequency) * racketFloatAmplitude;
        const horizontalOffset = Math.cos(time * 0.24 + 1.6) * 0.14;
        racketGroup.position.y = -0.65 + verticalOffset;
        racketGroup.position.x = -0.23 + horizontalOffset;

        // Tumbling rotation across multiple axes
        const rotationOffset = Math.sin(time * racketRotationFrequency) * racketRotationAmplitude;
        racketGroup.rotation.y = rotationOffset;
        racketGroup.rotation.x = 0.6 + Math.sin(time * 0.3 + 0.5) * 0.2;
        racketGroup.rotation.z = 0.3 + Math.cos(time * 0.26) * 0.25;
    }

    // On mobile the props fully recede past ~85%, so there's nothing left to
    // hover/click - skip the raycast and clear any lingering hover state. On
    // desktop the laptop stays parked and clickable for the rest of the page.
    if (!isMobileLayout || heroProgress < 0.85) {
        checkIntersection();
    } else if (isHovering) {
        resetHoverState();
    }

    updateDots();
    renderScene();
}

animate();
loadLaptopAndScreen();
loadCube();
loadBall();
loadRacket();

window.addEventListener('resize', onWindowResize);