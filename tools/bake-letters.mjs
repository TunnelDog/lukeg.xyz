// Generates js/src/hero/letters.json from the Anton font: one set of outline
// points per letter, so the bundle needs no font parser at runtime.
// Run with: npm run bake (from tools/)
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const TEXT = 'Luke G';
const FONT_FILE = new URL('./node_modules/@fontsource/anton/files/anton-latin-400-normal.woff', import.meta.url);
const OUTPUT = new URL('../js/src/hero/letters.json', import.meta.url);
const OUTER_POINTS = 220;
const HOLE_POINTS = 60;
const CURVE_STEPS = 16;

const bytes = readFileSync(FONT_FILE);
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const em = font.unitsPerEm;

function flatten(commands) {
    const contours = [];
    let current = null;
    let cx = 0, cy = 0;
    for (const c of commands) {
        if (c.type === 'M') {
            current = [{ x: c.x, y: -c.y, corner: true }];
            contours.push(current);
        } else if (c.type === 'L') {
            current.push({ x: c.x, y: -c.y, corner: true });
        } else if (c.type === 'Q') {
            for (let i = 1; i <= CURVE_STEPS; i++) {
                const t = i / CURVE_STEPS, m = 1 - t;
                current.push({
                    x: m * m * cx + 2 * m * t * c.x1 + t * t * c.x,
                    y: -(m * m * -cy + 2 * m * t * c.y1 + t * t * c.y),
                    corner: i === CURVE_STEPS
                });
            }
        } else if (c.type === 'C') {
            for (let i = 1; i <= CURVE_STEPS; i++) {
                const t = i / CURVE_STEPS, m = 1 - t;
                current.push({
                    x: m * m * m * cx + 3 * m * m * t * c.x1 + 3 * m * t * t * c.x2 + t * t * t * c.x,
                    y: -(m * m * m * -cy + 3 * m * m * t * c.y1 + 3 * m * t * t * c.y2 + t * t * t * c.y),
                    corner: i === CURVE_STEPS
                });
            }
        }
        if (c.type !== 'Z') { cx = c.x; cy = -c.y; }
    }
    return contours;
}

function signedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
}

// Resample to exactly `count` points, spaced evenly but always keeping real
// corners so the letters stay crisp.
function resample(raw, count) {
    const points = raw.filter((p, i) => {
        const next = raw[(i + 1) % raw.length];
        return Math.hypot(p.x - next.x, p.y - next.y) > 1e-6;
    });
    const corners = [];
    points.forEach((p, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        const a = Math.atan2(p.y - prev.y, p.x - prev.x);
        const b = Math.atan2(next.y - p.y, next.x - p.x);
        let turn = Math.abs(a - b);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        if (turn > 0.35) corners.push(i);
    });
    if (corners.length === 0) corners.push(0);

    const spans = corners.map((start, k) => {
        const end = corners[(k + 1) % corners.length];
        const span = [];
        for (let i = start; ; i = (i + 1) % points.length) {
            span.push(points[i]);
            if (i === end && span.length > 1) break;
        }
        let length = 0;
        for (let i = 1; i < span.length; i++) length += Math.hypot(span[i].x - span[i - 1].x, span[i].y - span[i - 1].y);
        return { span, length };
    });

    const total = spans.reduce((sum, s) => sum + s.length, 0);
    const budget = count - spans.length;
    const shares = spans.map(s => (s.length / total) * budget);
    const extra = shares.map(Math.floor);
    let left = budget - extra.reduce((a, b) => a + b, 0);
    shares.map((share, i) => [share - extra[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
        if (left-- > 0) extra[i]++;
    });

    const output = [];
    spans.forEach(({ span, length }, k) => {
        const segments = extra[k] + 1;
        let walked = 0, index = 1;
        output.push(span[0]);
        for (let s = 1; s < segments; s++) {
            const target = (length * s) / segments;
            while (index < span.length - 1) {
                const step = Math.hypot(span[index].x - span[index - 1].x, span[index].y - span[index - 1].y);
                if (walked + step >= target) break;
                walked += step;
                index++;
            }
            const a = span[index - 1], b = span[index];
            const step = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const t = Math.min(1, (target - walked) / step);
            output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
    });
    return output;
}

const round = n => Math.round((n / em) * 10000) / 10000;
const toPairs = points => points.flatMap(p => [round(p.x), round(p.y)]);

const glyphs = font.stringToGlyphs(TEXT);
const letters = [];
let spaceAdvance = 0;

glyphs.forEach((glyph, i) => {
    const kerning = i < glyphs.length - 1 ? font.getKerningValue(glyph, glyphs[i + 1]) : 0;
    const advance = (glyph.advanceWidth + kerning) / em;
    const char = TEXT[i];
    if (char === ' ') { spaceAdvance = advance; return; }

    const contours = flatten(glyph.getPath(0, 0, em).commands).map(c => {
        // getPath flips y for canvas; flatten flips it back so y points up.
        return c.map(p => ({ x: p.x, y: p.y }));
    });
    const ranked = contours
        .map(c => ({ points: c, area: signedArea(c) }))
        .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

    const outer = resample(ranked[0].area > 0 ? ranked[0].points : [...ranked[0].points].reverse(), OUTER_POINTS);
    const holes = ranked.slice(1).map(h =>
        resample(h.area < 0 ? h.points : [...h.points].reverse(), HOLE_POINTS)
    );

    letters.push({
        char,
        advance: Math.round(advance * 10000) / 10000,
        spaceBefore: Math.round(spaceAdvance * 10000) / 10000,
        outer: toPairs(outer),
        holes: holes.map(toPairs)
    });
    spaceAdvance = 0;
});

writeFileSync(OUTPUT, JSON.stringify({ text: TEXT, letters }));
for (const l of letters) {
    const ys = l.outer.filter((_, i) => i % 2);
    const xs = l.outer.filter((_, i) => i % 2 === 0);
    console.log(l.char, 'advance', l.advance, 'space', l.spaceBefore, 'holes', l.holes.length,
        'x', Math.min(...xs), Math.max(...xs), 'y', Math.min(...ys), Math.max(...ys), 'pts', l.outer.length / 2);
}
