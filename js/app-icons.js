import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { createStudioEnvironment } from "./studio-env.js";

// Turns each <a class="app-icon" data-texture=...> into a glossy 3D app
// icon. The anchor stays the real link (so keyboard, middle-click and
// cmd-click all behave normally); a plain click plays a short "press and
// spin" first and then navigates. Each icon gets its own small renderer
// that only runs while it's on screen.

const ICON_SIZE = 1;
const CORNER_RADIUS = ICON_SIZE * 0.2237; // iOS app icon corner ratio
const DEPTH = 0.1;
const PRESS_DURATION = 0.7; // seconds

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function roundedSquareShape(size, radius) {
    const h = size / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-h + radius, -h);
    shape.lineTo(h - radius, -h);
    shape.quadraticCurveTo(h, -h, h, -h + radius);
    shape.lineTo(h, h - radius);
    shape.quadraticCurveTo(h, h, h - radius, h);
    shape.lineTo(-h + radius, h);
    shape.quadraticCurveTo(-h, h, -h, h - radius);
    shape.lineTo(-h, -h + radius);
    shape.quadraticCurveTo(-h, -h, -h + radius, -h);
    return shape;
}

function createIconGeometry() {
    const geometry = new THREE.ExtrudeGeometry(roundedSquareShape(ICON_SIZE, CORNER_RADIUS), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.03,
        bevelSegments: 8,
        curveSegments: 24
    });
    geometry.center();

    // ExtrudeGeometry's cap UVs are raw shape coordinates; remap them to
    // 0..1 across the whole footprint so the icon artwork fills the face
    // edge to edge. Only the caps (group 0) use the texture; the sides and
    // bevel (group 1) get a solid edge colour, so their UVs don't matter.
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
        uv.setXY(
            i,
            (position.getX(i) - min.x) / (max.x - min.x),
            (position.getY(i) - min.y) / (max.y - min.y)
        );
    }
    uv.needsUpdate = true;
    return geometry;
}

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function setupIcon(anchor, geometry) {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (error) {
        return null; // no WebGL - the fallback <img> stays visible
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    // No tone mapping: the icon art should keep its exact brand colours.

    const scene = new THREE.Scene();
    scene.environment = createStudioEnvironment(renderer);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 4.2);

    const texture = new THREE.TextureLoader().load(anchor.dataset.texture, () => {
        anchor.classList.add('is-3d');
    });
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // The artwork is mostly self-lit (emissive) so it shows its true brand
    // colours regardless of lighting; the clearcoat still adds the gloss.
    const faceMaterial = new THREE.MeshPhysicalMaterial({
        map: texture,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.75,
        roughness: 0.38,
        clearcoat: 1,
        clearcoatRoughness: 0.08
    });
    const edgeMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(anchor.dataset.edge || '#cccccc').convertSRGBToLinear(),
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.1
    });

    const icon = new THREE.Mesh(geometry, [faceMaterial, edgeMaterial]);
    const pivot = new THREE.Group();
    pivot.add(icon);
    scene.add(pivot);

    // Soft contact shadow under the icon, drawn as a blurred radial sprite
    // rather than a real shadow map - cheap, and always looks soft.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(20,20,19,0.38)');
    gradient.addColorStop(1, 'rgba(20,20,19,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.45),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
    );
    shadow.position.set(0, -0.78, -0.3);
    scene.add(shadow);

    anchor.appendChild(renderer.domElement);

    const state = {
        anchor,
        renderer,
        scene,
        camera,
        pivot,
        shadow,
        seed: Math.random() * 10,
        visible: false,
        hover: false,
        pointer: { x: 0, y: 0 },
        tilt: { x: 0, y: 0 },
        scale: 1,
        pressStart: null
    };

    function resize() {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    resize();
    new ResizeObserver(resize).observe(anchor);

    anchor.addEventListener('pointermove', event => {
        const rect = anchor.getBoundingClientRect();
        state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        state.pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    });
    anchor.addEventListener('pointerenter', () => { state.hover = true; });
    anchor.addEventListener('pointerleave', () => {
        state.hover = false;
        state.pointer.x = 0;
        state.pointer.y = 0;
    });

    anchor.addEventListener('click', event => {
        // Let modified clicks (new tab/window) go straight through.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (prefersReducedMotion) return;
        event.preventDefault();
        if (state.pressStart === null) state.pressStart = performance.now();
    });

    return state;
}

function updateIcon(state, time) {
    const { pivot, shadow } = state;

    // Ease toward the cursor while hovered, otherwise drift on a slow idle sway.
    const targetTiltY = state.hover ? state.pointer.x * 0.55 : Math.sin(time * 0.6 + state.seed) * 0.28;
    const targetTiltX = state.hover ? state.pointer.y * 0.45 : -0.12 + Math.sin(time * 0.8 + state.seed) * 0.08;
    const targetScale = state.hover ? 1.08 : 1;
    state.tilt.x += (targetTiltX - state.tilt.x) * 0.1;
    state.tilt.y += (targetTiltY - state.tilt.y) * 0.1;
    state.scale += (targetScale - state.scale) * 0.12;

    let spin = 0;
    let press = 1;
    if (state.pressStart !== null) {
        const progress = Math.min((performance.now() - state.pressStart) / 1000 / PRESS_DURATION, 1);
        spin = easeInOutCubic(progress) * Math.PI * 2;
        // Quick squash at the start of the click, then pop back out.
        press = 1 - Math.sin(Math.min(progress * 3, 1) * Math.PI) * 0.12;
        if (progress >= 1) {
            state.pressStart = null;
            window.location.href = state.anchor.href;
        }
    }

    const float = Math.sin(time * 1.1 + state.seed) * 0.04;
    pivot.position.y = float;
    pivot.rotation.set(state.tilt.x, state.tilt.y + spin, 0);
    pivot.scale.setScalar(state.scale * press);

    // Shadow tightens and darkens as the icon dips toward it.
    const lift = 1 - float * 4;
    shadow.scale.set(lift * state.scale, 1, 1);
    shadow.material.opacity = 0.9 - float * 3;

    state.renderer.render(state.scene, state.camera);
}

const anchors = document.querySelectorAll('.app-icon[data-texture]');
if (anchors.length) {
    const geometry = createIconGeometry();
    const icons = Array.from(anchors).map(anchor => setupIcon(anchor, geometry)).filter(Boolean);

    const visibility = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const icon = icons.find(item => item.anchor === entry.target);
            if (icon) icon.visible = entry.isIntersecting;
        });
    }, { rootMargin: '100px' });
    icons.forEach(icon => visibility.observe(icon.anchor));

    // Back/forward cache can restore the page mid-spin; reset so it isn't stuck.
    window.addEventListener('pageshow', () => icons.forEach(icon => { icon.pressStart = null; }));

    function loop() {
        requestAnimationFrame(loop);
        const time = performance.now() * 0.001;
        icons.forEach(icon => {
            if (icon.visible || icon.pressStart !== null) updateIcon(icon, time);
        });
    }
    loop();
}
