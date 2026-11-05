import * as THREE from 'three';
import { createStudioEnvironment } from '../studio-env.js';
import { createMorphGeometry, createMorphMaterial, superellipse } from './morph-geometry.js';
import { createInput } from './input.js';
import { playIntro, playMelt, ticker } from './choreography.js';
import { PALETTE } from './palette.js';
import data from './letters.json';

// "Luke G" as giant 3D poster letters. See docs/superpowers/specs for the
// design. All world units are ems of the Anton font.

const FOV = 26;
const DEPTH = 0.2;
const BEVEL = 0.016;
const CAP_MIDDLE = 0.43; // vertical centre of the capital letters
const WORD_HEIGHT = 0.875;
const MAX_TALL = 1.5; // how far letters may stretch to fill a tall screen
const MAX_TALL_PHONE = 2.7; // phones have far more height to fill

const FLOAT_HEIGHT = 0.032; // ems each letter bobs up and down
const FLOAT_PHONE_BOOST = 2; // letters are small on phones and there's room to spare
const FLOAT_SWAY = 0.075; // radians each letter turns as it floats

const CAPTION_CLEARANCE = 0.085; // fraction of the hero's height
const CAPTION_CLEARANCE_MIN = 40; // CSS pixels

const STRETCH_REACH = 0.42; // ems of pointer influence
const STRETCH_AMOUNT = 0.8;
const MAX_DPR_COARSE = 2;
const MAX_DPR_FINE = 2;
const SLOW_FRAME_MS = 26;

// The shape each letter melts into. All convex (see morph-geometry.js).
const LETTER_SHAPES = {
    L: { a: 0.2, b: 0.43, n: 3 },
    u: { a: 0.3, b: 0.3, n: 2 },
    k: { a: 0.22, b: 0.3, n: 1.45 },
    e: { a: 0.29, b: 0.29, n: 3.2 },
    G: { a: 0.27, b: 0.4, n: 2 }
};


// Where each letter's shape begins before it flies into the word.
const INTRO_STARTS = [
    { x: -0.9, y: 0.62, z: 0.5, rotX: 0.8, rotY: -1.6, rotZ: 0.5 },
    { x: -0.4, y: -0.75, z: 0.9, rotX: -0.7, rotY: 1.2, rotZ: -0.4 },
    { x: 0.1, y: 0.85, z: -0.6, rotX: 1.1, rotY: 1.5, rotZ: 0.3 },
    { x: 0.5, y: -0.7, z: 0.4, rotX: -0.9, rotY: -1.3, rotZ: 0.6 },
    { x: 0.95, y: 0.55, z: -0.5, rotX: 0.6, rotY: 1.8, rotZ: -0.5 }
];

const toPoints = flat => {
    const points = [];
    for (let i = 0; i < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] - CAP_MIDDLE });
    return points;
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

function createContactShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(89, 87, 88, 0.42)');
    gradient.addColorStop(0.55, 'rgba(89, 87, 88, 0.14)');
    gradient.addColorStop(1, 'rgba(89, 87, 88, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

function buildLetters(scene) {
    const shadowTexture = createContactShadowTexture();
    return data.letters.map((source, index) => {
        const outer = toPoints(source.outer);
        const holes = source.holes.map(toPoints);
        const xs = outer.map(p => p.x);
        const left = Math.min(...xs), right = Math.max(...xs);
        const centre = (left + right) / 2;
        const shape = LETTER_SHAPES[source.char];

        const geometry = createMorphGeometry({
            outer,
            holes,
            morphOuter: superellipse(shape.a, shape.b, shape.n, outer.length, centre, 0),
            depth: DEPTH,
            bevel: BEVEL
        });
        const material = createMorphMaterial(PALETTE.wisteria);
        const mesh = new THREE.Mesh(geometry, material);

        // Rotations and scale happen around the letter's centre.
        const pivot = new THREE.Group();
        geometry.translate(-centre, 0, 0);
        mesh.geometry.attributes.aMorphPosition.array.forEach((_, i, array) => {
            if (i % 3 === 0) array[i] -= centre;
        });
        pivot.add(mesh);
        scene.add(pivot);

        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        scene.add(shadow);

        return {
            char: source.char,
            advance: source.advance,
            spaceBefore: source.spaceBefore,
            glyphWidth: right - left,
            glyphCentre: centre,
            pivot,
            mesh,
            shadow,
            material,
            morph: material.userData.uMorph,
            intro: { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 },
            kick: { value: 0 },
            width: 1,
            seed: index * 1.7 + 0.4,
            melting: false,
            screen: { left: 0, right: 0, top: 0, bottom: 0, centre: 0 },
            worldX: 0,
            start: INTRO_STARTS[index % INTRO_STARTS.length]
        };
    });
}

export function initHero() {
    const hero = document.getElementById('home');
    const canvas = document.getElementById('hero-canvas');
    if (!hero || !canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    // Throws when WebGL isn't available; main.js leaves the plain <h1> showing.
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    let pixelRatio = Math.min(window.devicePixelRatio || 1, coarsePointer ? MAX_DPR_COARSE : MAX_DPR_FINE);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);

    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        hero.classList.remove('has-hero-scene');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        hero.classList.add('has-hero-scene');
    });

    const scene = new THREE.Scene();
    scene.environment = createStudioEnvironment(renderer);
    scene.environmentIntensity = 0.5;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe4f3, 1.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-1.5, 3, 4);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);

    // Rest values; the intro starts away from these and tweens back.
    const view = { azimuth: 0, elevation: 0, distance: 1, roll: 0 };
    const parallax = { x: 0, y: 0 };
    const layout = { distance: 5, tall: 1, width: 1, height: 1, shift: 0, wordWidth: 1 };

    const letters = buildLetters(scene);

    const totalAdvance = letters.reduce((sum, l) => sum + l.advance + l.spaceBefore, 0);
    const lettersAdvance = letters.reduce((sum, l) => sum + l.advance, 0);
    layout.wordWidth = totalAdvance;

    const raw = new THREE.Vector3();
    let scrollEased = 0;

    function fit() {
        const width = hero.clientWidth;
        const height = hero.clientHeight;
        if (!width || !height) return;
        layout.width = width;
        layout.height = height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;

        // The name sits in the space between the nav and the caption.
        const heroRect = hero.getBoundingClientRect();
        const caption = hero.querySelector('.hero-caption');
        const captionTop = caption ? caption.getBoundingClientRect().top - heroRect.top : height * 0.85;
        // Letters float and squash past their resting size, so leave them room
        // to do that without passing behind the caption.
        const clearance = Math.max(CAPTION_CLEARANCE_MIN, height * CAPTION_CLEARANCE);
        const top = 72;
        const bottom = Math.max(captionTop - clearance, height * 0.55);
        const region = bottom - top;

        const fitWidth = (width * (width < 720 ? 0.94 : 0.88)) / totalAdvance;
        const fitHeight = region / WORD_HEIGHT;
        const pixelsPerEm = Math.min(fitWidth, fitHeight);
        layout.tall = clamp(region / (WORD_HEIGHT * pixelsPerEm), 1, width < 720 ? MAX_TALL_PHONE : MAX_TALL);
        layout.distance = height / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * pixelsPerEm);
        layout.shift = height / 2 - (top + bottom) / 2;
        camera.setViewOffset(width, height, 0, layout.shift, width, height);
    }

    function placeLetters(time, dt, input) {
        const progress = scrollEased;

        // Each letter's width comes from how close the pointer is. Normalising
        // keeps the word's total width fixed, so it can never leave the screen.
        const weights = letters.map(letter => {
            let weight = 1 + letter.kick.value;
            if (input && input.hasPointer && !prefersReducedMotion && progress < 0.3) {
                const px = (input.x - letter.screen.centre) / (layout.width * 0.5) * (layout.wordWidth * 0.5);
                weight += STRETCH_AMOUNT * Math.exp(-(px * px) / (STRETCH_REACH * STRETCH_REACH));
            }
            return weight;
        });
        const weightedAdvance = letters.reduce((sum, l, i) => sum + l.advance * weights[i], 0);
        const normaliser = lettersAdvance / weightedAdvance;

        let cursor = -totalAdvance / 2;
        const parts = { gap: 0 };
        letters.forEach((letter, i) => {
            letter.width = dt === null
                ? weights[i] * normaliser
                : damp(letter.width, weights[i] * normaliser, 11, dt);
            cursor += letter.spaceBefore;
            if (letter.spaceBefore) parts.gap = cursor - letter.spaceBefore / 2;
            letter.worldX = cursor + (letter.advance * letter.width) / 2;
            cursor += letter.advance * letter.width;
        });

        letters.forEach(letter => {
            const isRight = letter.spaceBefore > 0 || letter === letters[letters.length - 1];
            const part = isRight ? 0.75 : -0.85;
            const drift = prefersReducedMotion ? 0 : 1;
            // Each letter bobs and sways on its own slow rhythm.
            const floatHeight = FLOAT_HEIGHT * (layout.width < 720 ? FLOAT_PHONE_BOOST : 1);
            const floatY = Math.sin(time * 0.9 + letter.seed) * floatHeight * drift;
            const floatX = Math.cos(time * 0.6 + letter.seed * 1.3) * FLOAT_HEIGHT * 0.3 * drift;
            const swayY = Math.sin(time * 0.55 + letter.seed) * FLOAT_SWAY * drift;
            const swayX = Math.cos(time * 0.7 + letter.seed * 0.8) * FLOAT_SWAY * 0.35 * drift;
            const swayZ = Math.sin(time * 0.45 + letter.seed * 1.6) * FLOAT_SWAY * 0.25 * drift;

            const { intro } = letter;
            const squash = 1 + (1 - letter.width) * 0.32;
            const glyphOffset = (letter.glyphCentre - letter.advance / 2) * letter.width;

            letter.pivot.position.set(
                letter.worldX + glyphOffset + intro.x + floatX + part * progress,
                floatY + intro.y,
                intro.z
            );
            letter.pivot.rotation.set(intro.rotX + swayX, intro.rotY + swayY, intro.rotZ + swayZ);
            letter.pivot.scale.set(letter.width, layout.tall * squash, 1);

            const floor = -(WORD_HEIGHT / 2) * layout.tall - 0.02;
            const lift = clamp(1 - (Math.abs(intro.y) + Math.abs(intro.z)) * 1.2, 0, 1);
            letter.shadow.position.set(letter.pivot.position.x, floor, intro.z + 0.02);
            // The shadow spreads and fades a little as the letter rises.
            const rise = floatY / floatHeight;
            letter.shadow.scale.set(letter.glyphWidth * letter.width * (1.5 + rise * 0.08), 0.55, 1);
            letter.shadow.material.opacity = lift * (1 - progress) * (1 - rise * 0.12);
        });
        return parts;
    }

    function placeCamera(gapX) {
        const progress = scrollEased;
        const eased = progress * progress * (3 - 2 * progress);
        const distance = layout.distance * view.distance * (1 - eased * 0.84);
        const azimuth = view.azimuth + parallax.x * 0.07 * (1 - eased);
        const elevation = view.elevation + parallax.y * 0.045 * (1 - eased);
        const targetX = gapX * eased;

        camera.position.set(
            targetX + Math.sin(azimuth) * Math.cos(elevation) * distance,
            Math.sin(elevation) * distance,
            Math.cos(azimuth) * Math.cos(elevation) * distance
        );
        camera.up.set(Math.sin(view.roll), Math.cos(view.roll), 0);
        camera.lookAt(targetX, 0, 0);
        camera.updateMatrixWorld();
    }

    function measureLetters() {
        letters.forEach(letter => {
            letter.pivot.updateMatrixWorld();
            const halfWidth = (letter.glyphWidth / 2) * letter.width;
            const halfHeight = (WORD_HEIGHT / 2) * layout.tall;
            const project = (x, y) => {
                raw.set(letter.pivot.position.x + x, letter.pivot.position.y + y, DEPTH / 2).project(camera);
                return {
                    x: (raw.x * 0.5 + 0.5) * layout.width,
                    y: (-raw.y * 0.5 + 0.5) * layout.height
                };
            };
            const a = project(-halfWidth, halfHeight);
            const b = project(halfWidth, -halfHeight);
            letter.screen.left = a.x;
            letter.screen.right = b.x;
            letter.screen.top = a.y;
            letter.screen.bottom = b.y;
            letter.screen.centre = (a.x + b.x) / 2;
        });
    }

    const letterAt = (x, y) => letters.find(({ screen }) =>
        x >= screen.left && x <= screen.right && y >= screen.top && y <= screen.bottom);

    function renderStill() {
        const parts = placeLetters(0, null, null);
        placeCamera(parts.gap);
        renderer.render(scene, camera);
    }

    const caption = hero.querySelector('.hero-caption');
    const showScene = () => {
        hero.classList.add('has-hero-scene');
        document.documentElement.classList.remove('hero-pending');
    };

    fit();
    // The caption's height decides where the name sits, so re-measure once
    // its web fonts have arrived.
    if (document.fonts) document.fonts.ready.then(fit);

    if (prefersReducedMotion) {
        // A still, composed poster. It only redraws when the screen size changes.
        renderStill();
        showScene();
        new ResizeObserver(() => { fit(); renderStill(); }).observe(hero);
        return;
    }

    const input = createInput(hero, {
        onSelect(x, y) {
            const letter = letterAt(x, y);
            if (letter && !introPlaying) playMelt(letter);
        }
    });

    new ResizeObserver(fit).observe(hero);

    let onScreen = true;
    new IntersectionObserver(entries => {
        onScreen = entries[0].isIntersecting;
    }).observe(hero);

    // Compile the shaders up front so the intro doesn't start with a stutter.
    renderer.compile(scene, camera);

    let introPlaying = false;
    if (input.scroll < 0.5) {
        // Start as scattered shapes, seen from a low three-quarter angle.
        introPlaying = true;
        view.azimuth = -0.85;
        view.elevation = -0.3;
        view.distance = 1.22;
        view.roll = -0.1;
        letters.forEach(letter => {
            Object.assign(letter.intro, letter.start);
            letter.morph.value = 1;
        });
        playIntro(letters, view, () => { introPlaying = false; });
    }

    let lastTime = performance.now();
    let slowFrames = 0;
    let frames = 0;
    let firstFrame = true;

    function frame() {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        const frameMs = now - lastTime;
        lastTime = now;
        if (!onScreen) return;

        const time = now * 0.001;
        input.readScroll();
        scrollEased = damp(scrollEased, input.scroll, 9, dt);
        parallax.x = damp(parallax.x, input.hasPointer ? input.nx : 0, 2.6, dt);
        parallax.y = damp(parallax.y, input.hasPointer ? input.ny : 0, 2.6, dt);

        const parts = placeLetters(time, dt, input);
        placeCamera(parts.gap);
        measureLetters();

        // Fades into the page background as the camera passes through the name.
        canvas.style.opacity = String(1 - smoothstep(0.3, 0.72, scrollEased));
        // The letters pass behind the caption on the way, so it clears first.
        if (caption) caption.style.opacity = String(1 - smoothstep(0.01, 0.16, input.scroll));

        const hovering = input.hasPointer && !introPlaying && letterAt(input.x, input.y);
        hero.style.cursor = hovering ? 'pointer' : '';

        renderer.render(scene, camera);

        if (firstFrame) {
            firstFrame = false;
            showScene();
        }

        // Trade sharpness for smoothness if this device is struggling.
        if (document.visibilityState === 'visible') {
            frames++;
            if (frameMs > SLOW_FRAME_MS) slowFrames++;
            if (frames >= 90) {
                if (slowFrames > 45 && pixelRatio > 1) {
                    pixelRatio = Math.max(1, pixelRatio - 0.25);
                    renderer.setPixelRatio(pixelRatio);
                    fit();
                }
                frames = 0;
                slowFrames = 0;
            }
        }
    }

    ticker.add(frame);
}
