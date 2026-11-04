// Hero name: "Luke G" in Yellowtail, traced in as one flat, solid shape.
//
// There's no hand-made path data here. On load the word is rendered
// offscreen in the real font, thinned down to the centre line of each pen
// stroke (Zhang-Suen), and its thickness measured with a distance
// transform. The centre-line pixels are turned into a graph and re-joined
// into continuous strokes, passing straight through places where a stroke
// crosses itself, the way a pen would. The strokes are then traced in as a
// smooth, evenly thick line. Every outline is drawn before any fill, so
// crossings and joins melt together and the name reads as a single flat
// cut-out piece rather than overlapping layers.
//
// Hover: the colours warm up and the word gives a springy little pop.
// Click / tap: the name traces itself in again.

const TEXT = 'Luke G';
const FONT_FAMILY = 'Yellowtail';
const DESIGN_FONT_SIZE = 220; // resolution the strokes are extracted at

const LACE_DURATION = 2.8; // seconds
const STROKE_GAP = 60;     // design units of "pen travel" between strokes

// Cobalt -> violet -> magenta, with warmer tones past the end that the
// hover shift slides into view. Deliberately one side of the colour wheel.
const PALETTE = ['#2233ff', '#5a2dff', '#9b2cf0', '#e0288f', '#ff5a3c'];
const PALETTE_SPAN = 0.72; // fraction of the palette shown across the word at rest

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hero = document.getElementById('home');
const canvas = document.getElementById('ribbon-canvas');
const ctx = canvas.getContext('2d');

// ---------------------------------------------------------------------------
// 1. Rasterise the word
// ---------------------------------------------------------------------------

function rasterize() {
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    const font = `${DESIGN_FONT_SIZE}px "${FONT_FAMILY}", cursive`;
    octx.font = font;
    const pad = Math.round(DESIGN_FONT_SIZE * 0.4);
    const w = Math.ceil(octx.measureText(TEXT).width) + pad * 2;
    const h = Math.round(DESIGN_FONT_SIZE * 1.7);
    off.width = w;
    off.height = h;
    octx.font = font;
    octx.fillText(TEXT, pad, Math.round(DESIGN_FONT_SIZE * 1.1));

    const data = octx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
    return { mask, w, h };
}

// ---------------------------------------------------------------------------
// 2. Thin to a 1px skeleton, and measure thickness
// ---------------------------------------------------------------------------

function thin(src, w, h) {
    const img = src.slice();
    const remove = [];
    let changed = true;
    while (changed) {
        changed = false;
        for (let pass = 0; pass < 2; pass++) {
            remove.length = 0;
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const i = y * w + x;
                    if (!img[i]) continue;
                    const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1];
                    const p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
                    const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                    if (b < 2 || b > 6) continue;
                    const a = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) +
                              (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
                    if (a !== 1) continue;
                    if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8)
                                   : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
                    remove.push(i);
                }
            }
            for (const i of remove) img[i] = 0;
            if (remove.length) changed = true;
        }
    }

    // Zhang-Suen leaves "staircase" corners where a pixel touches both a
    // horizontal and a vertical neighbour that already touch each other.
    // Those read as tiny junctions, so drop them while it keeps the line joined.
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!img[i]) continue;
            const n = img[i - w], e = img[i + 1], s = img[i + w], wv = img[i - 1];
            if (!((n && e) || (e && s) || (s && wv) || (wv && n))) continue;
            img[i] = 0;
            if (neighbourComponents(img, w, i) !== 1) img[i] = 1;
        }
    }
    return img;
}

// Number of separate 8-connected groups among a pixel's neighbours. Ring
// order is N, NE, E, SE, S, SW, W, NW: neighbours in the ring touch each
// other, and so do two edge neighbours one step apart (N and E meet at a corner).
function neighbourComponents(img, w, i) {
    const ring = [i - w, i - w + 1, i + 1, i + w + 1, i + w, i + w - 1, i - 1, i - w - 1];
    const set = ring.map(r => img[r]);
    const parent = [0, 1, 2, 3, 4, 5, 6, 7];
    const find = k => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    const join = (a, b) => { if (set[a] && set[b]) parent[find(a)] = find(b); };
    for (let k = 0; k < 8; k++) {
        join(k, (k + 1) % 8);
        if (k % 2 === 0) join(k, (k + 2) % 8);
    }
    const roots = new Set();
    for (let k = 0; k < 8; k++) if (set[k]) roots.add(find(k));
    return roots.size;
}

// Two-pass chamfer distance: distance from each ink pixel to the nearest
// background pixel. On the skeleton that's the stroke's half-thickness.
function distanceField(mask, w, h) {
    const d = new Float32Array(w * h);
    for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 1e6 : 0;
    const D = Math.SQRT2;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!d[i]) continue;
            d[i] = Math.min(d[i], d[i - 1] + 1, d[i - w] + 1, d[i - w - 1] + D, d[i - w + 1] + D);
        }
    }
    for (let y = h - 2; y > 0; y--) {
        for (let x = w - 2; x > 0; x--) {
            const i = y * w + x;
            if (!d[i]) continue;
            d[i] = Math.min(d[i], d[i + 1] + 1, d[i + w] + 1, d[i + w + 1] + D, d[i + w - 1] + D);
        }
    }
    return d;
}

// ---------------------------------------------------------------------------
// 3. Skeleton -> graph -> pen strokes
// ---------------------------------------------------------------------------

function buildStrokes(skel, dist, w, h) {
    const N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
    const xy = i => [i % w, (i / w) | 0];

    const degree = new Uint8Array(w * h);
    for (let i = 0; i < skel.length; i++) {
        if (!skel[i]) continue;
        for (const o of N8) degree[i] += skel[i + o];
    }

    // Junction and end pixels (degree != 2); touching ones form one node.
    const nodeOf = new Int32Array(w * h).fill(-1);
    const nodes = [];
    for (let i = 0; i < skel.length; i++) {
        if (!skel[i] || degree[i] === 2 || degree[i] === 0 || nodeOf[i] >= 0) continue;
        const id = nodes.length;
        const pixels = [i];
        nodeOf[i] = id;
        for (let k = 0; k < pixels.length; k++) {
            for (const o of N8) {
                const j = pixels[k] + o;
                if (skel[j] && degree[j] !== 2 && nodeOf[j] < 0) {
                    nodeOf[j] = id;
                    pixels.push(j);
                }
            }
        }
        let sx = 0, sy = 0;
        for (const p of pixels) { const [px, py] = xy(p); sx += px; sy += py; }
        nodes.push({ x: sx / pixels.length, y: sy / pixels.length, pixels });
    }

    // Walk every chain of degree-2 pixels between nodes.
    const visited = new Uint8Array(w * h);
    const edges = [];
    nodes.forEach((node, id) => {
        for (const start of node.pixels) {
            for (const o of N8) {
                const first = start + o;
                if (!skel[first] || visited[first] || nodeOf[first] === id) continue;
                const path = [start];
                let prev = start;
                let cur = first;
                let end = -1;
                for (;;) {
                    path.push(cur);
                    if (nodeOf[cur] >= 0) { end = nodeOf[cur]; break; }
                    visited[cur] = 1;
                    let next = -1;
                    for (const o2 of N8) {
                        const j = cur + o2;
                        if (j !== prev && skel[j] && !visited[j] && !(nodeOf[j] === id && path.length < 3)) {
                            if (nodeOf[j] >= 0) { next = j; break; }
                            if (next < 0) next = j;
                        }
                    }
                    if (next < 0) break;
                    prev = cur;
                    cur = next;
                }
                if (end >= 0 || path.length > 2) edges.push({ pixels: path, a: id, b: end });
            }
        }
    });

    // Closed loops with no junction at all (e.g. a clean "o").
    for (let i = 0; i < skel.length; i++) {
        if (!skel[i] || visited[i] || nodeOf[i] >= 0 || degree[i] !== 2) continue;
        const path = [i];
        visited[i] = 1;
        let cur = i;
        for (;;) {
            let next = -1;
            for (const o of N8) {
                const j = cur + o;
                if (skel[j] && !visited[j]) { next = j; break; }
            }
            if (next < 0) break;
            visited[next] = 1;
            path.push(next);
            cur = next;
        }
        if (path.length > 8) edges.push({ pixels: path, a: -1, b: -1, closed: true });
    }

    const halfWidthAt = p => dist[p] || 1;
    const lengthOf = e => e.pixels.length;
    const nodeDegree = () => {
        const deg = new Array(nodes.length).fill(0);
        for (const e of edges) {
            if (e.removed || e.closed) continue;
            if (e.a >= 0) deg[e.a]++;
            if (e.b >= 0) deg[e.b]++;
        }
        return deg;
    };

    // Prune short spurs - thinning artefacts sticking off a stroke near
    // its ends or at sharp corners.
    let deg = nodeDegree();
    for (const e of edges) {
        if (e.closed || e.b < 0) continue;
        const junction = deg[e.a] >= 3 ? e.a : deg[e.b] >= 3 ? e.b : -1;
        const free = junction === e.a ? e.b : e.a;
        if (junction < 0 || deg[free] !== 1) continue;
        const width = halfWidthAt(nodes[junction].pixels[0]);
        if (lengthOf(e) < width * 2.2) {
            e.removed = true;
            deg[junction]--;
            deg[free]--;
        }
    }

    // A crossing usually thins into two nearby 3-way junctions joined by a
    // short link rather than one clean X. Merge those into a single node so
    // the strokes can be paired straight through it.
    // Two junctions joined by more than one edge are a small loop (the eye
    // of the "e"), not a crossing, so those are left alone.
    const parent = nodes.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const linkCount = new Map();
    for (const e of edges) {
        if (e.removed || e.closed || e.b < 0) continue;
        const key = Math.min(e.a, e.b) + ':' + Math.max(e.a, e.b);
        linkCount.set(key, (linkCount.get(key) || 0) + 1);
    }
    deg = nodeDegree();
    for (const e of edges) {
        if (e.removed || e.closed || e.b < 0 || e.a === e.b) continue;
        if (linkCount.get(Math.min(e.a, e.b) + ':' + Math.max(e.a, e.b)) > 1) continue;
        if (deg[e.a] >= 3 && deg[e.b] >= 3) {
            const width = Math.max(halfWidthAt(nodes[e.a].pixels[0]), halfWidthAt(nodes[e.b].pixels[0]));
            if (lengthOf(e) < width * 2.5) {
                e.removed = true;
                parent[find(e.a)] = find(e.b);
            }
        }
    }
    const live = edges.filter(e => !e.removed);
    for (const e of live) {
        if (e.a >= 0) e.a = find(e.a);
        if (e.b >= 0) e.b = find(e.b);
    }
    const merged = new Map();
    for (const e of live) {
        for (const end of ['a', 'b']) {
            const id = e[end];
            if (id < 0) continue;
            if (!merged.has(id)) merged.set(id, { x: 0, y: 0, n: 0, ends: [] });
            const m = merged.get(id);
            const p = end === 'a' ? e.pixels[0] : e.pixels[e.pixels.length - 1];
            const [px, py] = xy(p);
            m.x += px; m.y += py; m.n++;
            m.ends.push({ edge: e, end });
        }
    }
    for (const m of merged.values()) { m.x /= m.n; m.y /= m.n; }

    // At each node, pair up the edge-ends that continue most nearly
    // straight through it - good continuation, like a pen crossing over.
    for (const m of merged.values()) {
        const ends = m.ends.map(item => {
            const px = item.edge.pixels;
            const reach = Math.min(px.length - 1, Math.max(6, Math.round(halfWidthAt(px[0]) * 2.5)));
            const p = item.end === 'a' ? px[reach] : px[px.length - 1 - reach];
            const [x, y] = xy(p);
            const len = Math.hypot(x - m.x, y - m.y) || 1;
            return { ...item, dx: (x - m.x) / len, dy: (y - m.y) / len };
        });
        const pairs = [];
        for (let i = 0; i < ends.length; i++) {
            for (let j = i + 1; j < ends.length; j++) {
                if (ends[i].edge === ends[j].edge && ends.length > 2) continue;
                pairs.push([ends[i].dx * ends[j].dx + ends[i].dy * ends[j].dy, i, j]);
            }
        }
        pairs.sort((p, q) => p[0] - q[0]);
        const used = new Set();
        for (const [score, i, j] of pairs) {
            if (used.has(i) || used.has(j)) continue;
            if (ends.length > 2 && score > -0.35) continue; // too sharp a turn to be one stroke
            used.add(i);
            used.add(j);
            ends[i].edge[`link_${ends[i].end}`] = { edge: ends[j].edge, end: ends[j].end };
            ends[j].edge[`link_${ends[j].end}`] = { edge: ends[i].edge, end: ends[i].end };
        }
    }

    // Follow the pairings to chain edges into whole strokes.
    const toPoints = (e, reverse) => {
        const pts = e.pixels.map(p => { const [x, y] = xy(p); return [x, y, halfWidthAt(p)]; });
        return reverse ? pts.reverse() : pts;
    };
    const strokes = [];
    const chain = (edge, entryEnd) => {
        const points = [];
        let e = edge;
        let enter = entryEnd;
        while (e && !e.used) {
            e.used = true;
            const pts = toPoints(e, enter === 'b');
            points.push(...(points.length ? pts.slice(1) : pts));
            const exit = enter === 'a' ? 'b' : 'a';
            const link = e[`link_${exit}`];
            if (!link) break;
            e = link.edge;
            enter = link.end;
        }
        return points;
    };
    // Open strokes first (start from an unpaired end), then closed loops.
    for (const e of live) {
        if (e.used || e.closed) continue;
        if (!e.link_a) strokes.push(chain(e, 'a'));
        else if (!e.link_b) strokes.push(chain(e, 'b'));
    }
    for (const e of live) {
        if (!e.used) strokes.push(chain(e, 'a'));
    }
    return strokes.filter(s => s.length > 6);
}

// ---------------------------------------------------------------------------
// 4. Smooth into tube geometry
// ---------------------------------------------------------------------------

function smoothStroke(raw) {
    // Resample evenly, then average generously - the cartoon look wants long,
    // calm curves rather than the pixel-accurate wobble of the skeleton.
    const spacing = 2;
    const pts = [raw[0]];
    let carry = 0;
    for (let i = 1; i < raw.length; i++) {
        const [x0, y0, w0] = raw[i - 1];
        const [x1, y1, w1] = raw[i];
        const seg = Math.hypot(x1 - x0, y1 - y0);
        let t = spacing - carry;
        while (t <= seg) {
            const f = t / seg;
            pts.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, w0 + (w1 - w0) * f]);
            t += spacing;
        }
        carry = seg - (t - spacing);
    }
    if (pts.length < 4) return null;

    const n = pts.length;
    const smooth = (k, radius) => pts.map((_, i) => {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
            sum += pts[j][k];
            count++;
        }
        return sum / count;
    });
    const xs = smooth(0, 6);
    const ys = smooth(1, 6);

    let length = 0;
    const points = xs.map((x, i) => {
        if (i > 0) length += Math.hypot(x - xs[i - 1], ys[i] - ys[i - 1]);
        return { x, y: ys[i], w: pts[i][2], s: length };
    });
    return { points, length };
}

// ---------------------------------------------------------------------------
// 5. Draw
// ---------------------------------------------------------------------------

const INK = '#1b1446'; // outline around the whole shape

const paletteRgb = PALETTE.map(hex => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});

function paletteAt(t) {
    const f = Math.min(Math.max(t, 0), 0.9999) * (paletteRgb.length - 1);
    const i = Math.floor(f);
    const k = f - i;
    const a = paletteRgb[i];
    const b = paletteRgb[i + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

let ribbon = null; // { strokes, bounds, total, halfWidth, outline }
let view = { scale: 1, ox: 0, oy: 0, dpr: 1, width: 0, height: 0 };
let laceStart = 0;
let hovering = false;
let warmth = 0;
let pop = 1;
let popVelocity = 0;
let running = false;

function prepare() {
    const { mask, w, h } = rasterize();
    const skel = thin(mask, w, h);
    const dist = distanceField(mask, w, h);
    const strokes = buildStrokes(skel, dist, w, h)
        .map(smoothStroke)
        .filter(Boolean);
    if (!strokes.length) throw new Error('no strokes');

    // One even tube thickness for the whole name - the median, so the ink
    // blobs where strokes cross don't skew it.
    const widths = [];
    for (const s of strokes) for (const p of s.points) widths.push(p.w);
    widths.sort((a, b) => a - b);
    const thickness = widths[Math.floor(widths.length / 2)] + 0.6;
    const outline = Math.max(2, thickness * 0.3);
    const halfWidth = thickness - outline * 0.4; // keeps the overall weight close to the font's
    const reach = halfWidth + outline;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) {
        for (const p of s.points) {
            minX = Math.min(minX, p.x - reach); maxX = Math.max(maxX, p.x + reach);
            minY = Math.min(minY, p.y - reach); maxY = Math.max(maxY, p.y + reach);
        }
        // Order the pen: strokes go left to right.
        const first = s.points[0];
        const last = s.points[s.points.length - 1];
        s.startX = Math.min(first.x, last.x);
    }
    strokes.sort((a, b) => a.startX - b.startX);

    let offset = 0;
    for (const s of strokes) {
        s.offset = offset;
        offset += s.length + STROKE_GAP;
    }
    ribbon = {
        strokes,
        bounds: { minX, minY, maxX, maxY },
        total: offset - STROKE_GAP,
        halfWidth,
        outline
    };
}

function layout() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const { minX, minY, maxX, maxY } = ribbon.bounds;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const narrow = rect.width < 600;
    const scale = Math.min((rect.width * (narrow ? 0.9 : 0.72)) / bw, (rect.height * 0.46) / bh);
    view = {
        dpr,
        scale,
        width: rect.width,
        height: rect.height,
        // Centred, sitting a little above the middle to leave the caption room.
        ox: rect.width / 2 - (minX + bw / 2) * scale,
        oy: rect.height * 0.42 - (minY + bh / 2) * scale
    };
}

const easeInOut = t => 0.5 - Math.cos(Math.PI * t) / 2;

function revealedEnd(stroke, reveal) {
    const pts = stroke.points;
    let end = 0;
    while (end < pts.length - 1 && pts[end + 1].s <= reveal) end++;
    return end;
}

// The whole revealed name as one path, stroked twice: a wide outline pass,
// then the fill on top. Because every outline goes down before any fill,
// the fill covers all the outline where strokes cross or meet, leaving a
// border only around the outside of the shape - one flat piece.
function drawName(penAt, fill) {
    ctx.beginPath();
    for (const stroke of ribbon.strokes) {
        const reveal = penAt - stroke.offset;
        if (reveal <= 0) break;
        const pts = stroke.points;
        const end = revealedEnd(stroke, reveal);
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= end; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineWidth = (ribbon.halfWidth + ribbon.outline) * 2;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.lineWidth = ribbon.halfWidth * 2;
    ctx.strokeStyle = fill;
    ctx.stroke();
}

function render(time) {
    const elapsed = (time - laceStart) / 1000;
    const progress = prefersReducedMotion ? 1 : easeInOut(Math.min(Math.max(elapsed / LACE_DURATION, 0), 1));
    const penAt = progress * ribbon.total;

    // Hover warms the colours and gives the word a springy little pop.
    const warmTarget = hovering ? 1 : 0;
    warmth += (warmTarget - warmth) * 0.08;
    const popTarget = hovering && !prefersReducedMotion ? 1.045 : 1;
    popVelocity += (popTarget - pop) * 0.2;
    popVelocity *= 0.72;
    pop += popVelocity;

    const { minX, minY, maxX, maxY } = ribbon.bounds;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const k = view.scale * pop;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
        view.dpr * k, 0, 0, view.dpr * k,
        view.dpr * (view.ox + cx * (view.scale - k)),
        view.dpr * (view.oy + cy * (view.scale - k))
    );
    const shift = warmth * (1 - PALETTE_SPAN);
    const fill = ctx.createLinearGradient(minX, 0, maxX, 0);
    for (let i = 0; i <= 8; i++) {
        const [r, g, b] = paletteAt((i / 8) * PALETTE_SPAN + shift);
        fill.addColorStop(i / 8, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
    }

    drawName(penAt, fill);

    const settling = Math.abs(pop - popTarget) > 0.0005 || Math.abs(popVelocity) > 0.0005;
    return progress < 1 || settling || Math.abs(warmth - warmTarget) > 0.005;
}

function loop(time) {
    if (!running) return;
    if (render(time)) {
        requestAnimationFrame(loop);
    } else {
        running = false;
    }
}

function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
}

function relace() {
    if (prefersReducedMotion) return;
    laceStart = performance.now();
    kick();
}

function overName(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - view.ox) / view.scale;
    const y = (event.clientY - rect.top - view.oy) / view.scale;
    const { minX, minY, maxX, maxY } = ribbon.bounds;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

async function init() {
    try {
        await document.fonts.load(`${DESIGN_FONT_SIZE}px "${FONT_FAMILY}"`);
    } catch (error) {
        // Falls back to a generic cursive face; the lacing still works.
    }

    try {
        prepare();
    } catch (error) {
        console.error('Ribbon name failed, showing plain text instead', error);
        return; // the plain <h1> stays visible
    }

    hero.classList.add('has-ribbon');
    layout();
    laceStart = performance.now() + 250;
    kick();

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        // Ignore the height-only resizes mobile browsers fire while the
        // address bar slides in and out during scroll.
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        layout();
        render(performance.now());
    });

    canvas.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        const over = overName(event);
        canvas.style.cursor = over ? 'pointer' : '';
        if (over !== hovering) {
            hovering = over;
            kick();
        }
    });
    canvas.addEventListener('pointerleave', () => {
        hovering = false;
        canvas.style.cursor = '';
    });
    canvas.addEventListener('click', event => {
        if (overName(event)) relace();
    });

    // Replay the lacing whenever the hero scrolls back into view.
    let wasVisible = true;
    new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !wasVisible) relace();
            wasVisible = entry.isIntersecting;
        });
    }, { threshold: 0.35 }).observe(hero);
}

init();
