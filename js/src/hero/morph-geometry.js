import * as THREE from 'three';

// Solid, round-edged 3D shapes that can blend between two outlines on the GPU.
//
// Every state of a shape has to share one set of triangles. A polygon's
// triangles only use its own outline points, so they stay valid when that
// outline is moved onto any convex curve in the same order. That's why the
// morph targets are always convex (see superellipse below).

const BEVEL_SEGMENTS = 3;

// A rounded convex outline: n=2 is an ellipse, higher is boxier, closer to 1
// is more diamond-like. Returned counter-clockwise and evenly spaced.
export function superellipse(a, b, n, count, cx = 0, cy = 0) {
    const dense = [];
    const steps = count * 8;
    for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        dense.push({
            x: Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a,
            y: Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b
        });
    }
    const lengths = [0];
    for (let i = 1; i <= steps; i++) {
        const p = dense[i - 1], q = dense[i % steps];
        lengths.push(lengths[i - 1] + Math.hypot(q.x - p.x, q.y - p.y));
    }
    const total = lengths[steps];
    const points = [];
    let k = 0;
    for (let i = 0; i < count; i++) {
        const target = (i / count) * total;
        while (lengths[k + 1] < target) k++;
        const span = lengths[k + 1] - lengths[k] || 1;
        const t = (target - lengths[k]) / span;
        const p = dense[k], q = dense[(k + 1) % steps];
        points.push({ x: cx + p.x + (q.x - p.x) * t, y: cy + p.y + (q.y - p.y) * t });
    }
    return points;
}

// Direction pointing out of the solid at each outline point.
function outlineNormals(points) {
    const count = points.length;
    return points.map((p, i) => {
        const prev = points[(i - 1 + count) % count];
        const next = points[(i + 1) % count];
        const ax = p.x - prev.x, ay = p.y - prev.y;
        const bx = next.x - p.x, by = next.y - p.y;
        const al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
        const nx = ay / al + by / bl;
        const ny = -ax / al - bx / bl;
        const nl = Math.hypot(nx, ny) || 1;
        return { x: nx / nl, y: ny / nl };
    });
}

// Rotates a target outline so its first point lines up with the source's
// first point around the centre. Stops the morph from twisting.
function alignStart(source, target) {
    const centre = list => {
        let x = 0, y = 0;
        for (const p of list) { x += p.x; y += p.y; }
        return { x: x / list.length, y: y / list.length };
    };
    const a = centre(source), b = centre(target);
    const angle = Math.atan2(source[0].y - a.y, source[0].x - a.x);
    let best = 0, bestDiff = Infinity;
    target.forEach((p, i) => {
        let diff = Math.abs(Math.atan2(p.y - b.y, p.x - b.x) - angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return target.map((_, i) => target[(i + best) % target.length]);
}

// The side profile of the shape, front to back: flat cap edge, rounded bevel,
// wall, rounded bevel, back cap edge.
function buildProfile(depth, bevel) {
    const rings = [];
    for (let s = 0; s <= BEVEL_SEGMENTS; s++) {
        const angle = (s / BEVEL_SEGMENTS) * Math.PI * 0.5;
        rings.push({
            inset: bevel * (1 - Math.sin(angle)),
            z: depth / 2 - bevel * (1 - Math.cos(angle)),
            normalOut: Math.sin(angle),
            normalZ: Math.cos(angle),
            front: true
        });
    }
    for (let s = BEVEL_SEGMENTS; s >= 0; s--) {
        const angle = (s / BEVEL_SEGMENTS) * Math.PI * 0.5;
        rings.push({
            inset: bevel * (1 - Math.sin(angle)),
            z: -depth / 2 + bevel * (1 - Math.cos(angle)),
            normalOut: Math.sin(angle),
            normalZ: -Math.cos(angle),
            front: false
        });
    }
    return rings;
}

// outer/holes describe the rest state. morphOuter is the convex target.
// Holes close to a single point in the target, so they open as the shape forms.
export function createMorphGeometry({ outer, holes = [], morphOuter, depth, bevel }) {
    const target = alignStart(outer, morphOuter);
    const targetCentre = target.reduce((sum, p) => ({
        x: sum.x + p.x / target.length,
        y: sum.y + p.y / target.length
    }), { x: 0, y: 0 });

    const contours = [{ a: outer, b: target, closes: false }];
    for (const hole of holes) {
        contours.push({ a: hole, b: hole.map(() => targetCentre), closes: true });
    }
    contours.forEach(contour => {
        contour.normalsA = outlineNormals(contour.a);
        contour.normalsB = contour.closes ? null : outlineNormals(contour.b);
    });

    const profile = buildProfile(depth, bevel);
    const perRing = contours.reduce((sum, c) => sum + c.a.length, 0);
    const vertexCount = perRing * profile.length;
    const positions = new Float32Array(vertexCount * 3);
    const morphPositions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const morphNormals = new Float32Array(vertexCount * 3);

    let v = 0;
    for (const ring of profile) {
        for (const contour of contours) {
            contour.a.forEach((p, i) => {
                const na = contour.normalsA[i];
                positions.set([p.x - na.x * ring.inset, p.y - na.y * ring.inset, ring.z], v * 3);
                normals.set([na.x * ring.normalOut, na.y * ring.normalOut, ring.normalZ], v * 3);
                if (contour.closes) {
                    // A closed hole sits flat in the cap, so no dimple is left behind.
                    const q = contour.b[i];
                    morphPositions.set([q.x, q.y, ring.front ? depth / 2 : -depth / 2], v * 3);
                    morphNormals.set([0, 0, ring.front ? 1 : -1], v * 3);
                } else {
                    const q = contour.b[i];
                    const nb = contour.normalsB[i];
                    morphPositions.set([q.x - nb.x * ring.inset, q.y - nb.y * ring.inset, ring.z], v * 3);
                    morphNormals.set([nb.x * ring.normalOut, nb.y * ring.normalOut, ring.normalZ], v * 3);
                }
                v++;
            });
        }
    }

    const indices = [];

    // Walls and bevels between neighbouring rings.
    for (let r = 0; r < profile.length - 1; r++) {
        let offset = 0;
        for (const contour of contours) {
            const count = contour.a.length;
            for (let i = 0; i < count; i++) {
                const j = (i + 1) % count;
                const a = r * perRing + offset + i;
                const b = r * perRing + offset + j;
                const c = (r + 1) * perRing + offset + j;
                const d = (r + 1) * perRing + offset + i;
                indices.push(a, d, b, b, d, c);
            }
            offset += count;
        }
    }

    // Front and back caps, sharing the first and last rings.
    const toVectors = list => list.map(p => new THREE.Vector2(p.x, p.y));
    const faces = THREE.ShapeUtils.triangulateShape(toVectors(outer), holes.map(toVectors));
    const lastRing = (profile.length - 1) * perRing;
    for (const [a, b, c] of faces) {
        indices.push(a, b, c);
        indices.push(lastRing + c, lastRing + b, lastRing + a);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('aMorphPosition', new THREE.BufferAttribute(morphPositions, 3));
    geometry.setAttribute('aMorphNormal', new THREE.BufferAttribute(morphNormals, 3));
    geometry.setIndex(indices);
    // Shapes move between two outlines, so give culling a generous bound.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    return geometry;
}

// A soft matte material with a uMorph uniform: 0 is the rest shape, 1 the target.
export function createMorphMaterial(color) {
    const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0,
        side: THREE.DoubleSide
    });
    const uMorph = { value: 0 };
    material.userData.uMorph = uMorph;
    material.onBeforeCompile = shader => {
        shader.uniforms.uMorph = uMorph;
        shader.vertexShader = `attribute vec3 aMorphPosition;
attribute vec3 aMorphNormal;
uniform float uMorph;
${shader.vertexShader}`
            .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(normal, aMorphNormal, uMorph));')
            .replace('#include <begin_vertex>', 'vec3 transformed = mix(position, aMorphPosition, uMorph);');
        // Triangles can briefly fold over mid-morph. Keeping their normals as
        // they are stops the fold from showing up as a dark streak.
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_begin>',
            THREE.ShaderChunk.normal_fragment_begin.replace(/normal\s*\*=\s*faceDirection;/g, '')
        );
    };
    material.customProgramCacheKey = () => 'hero-morph';
    return material;
}
