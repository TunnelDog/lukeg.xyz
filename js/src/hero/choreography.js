import gsap from 'gsap';
import { Color, SRGBColorSpace } from 'three';
import { PALETTE } from './palette.js';

// Slow devices drop frames rather than stretch the intro out, so the name
// still reads on schedule.
gsap.ticker.lagSmoothing(0);

// The authored moments: the load-in and the click melt. Continuous motion
// (idle drift, pointer stretch, scroll camera) lives in the render loop.
export function playIntro(letters, camera, onDone) {
    const timeline = gsap.timeline({ onComplete: onDone });

    // The camera sweeps from a low three-quarter view round to the front.
    timeline.to(camera, { azimuth: 0, elevation: 0, distance: 1, roll: 0, duration: 2.5, ease: 'power3.inOut' }, 0);

    letters.forEach((letter, index) => {
        const at = index * 0.07;
        // Shapes fly in and settle into their slot in the word.
        timeline.to(letter.intro, {
            x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0,
            duration: 1.15,
            ease: 'expo.out'
        }, at);
        // ...then become letters, so the name reads by about 1.5s.
        timeline.to(letter.morph, { value: 0, duration: 0.85, ease: 'power3.inOut' }, 0.3 + at);
        // A kinetic beat as each letter lands: it arrives wide and squashes in.
        timeline.fromTo(letter.kick, { value: 0.9 }, { value: 0, duration: 1.2, ease: 'elastic.out(1, 0.45)' }, 0.75 + at);
    });
    return timeline;
}

// While a clicked letter morphs, it fades through random colors, then settles
// back to blue.
const SHUFFLE_STEP = 0.2; // seconds to fade to each color
const MORPH_END = 1.45; // when the melt below has finished
const RESTING_COLOR = new Color(PALETTE.wisteria);
const RESTING_HUE = RESTING_COLOR.getHSL({}, SRGBColorSpace).h;

// Any hue goes, but saturation and lightness stay in a range that shows up on
// white. Each hue is at least 60 degrees from the last, so every fade is visible.
function randomColorAfter(previousHue) {
    const hue = (previousHue + 1 / 6 + Math.random() * (2 / 3)) % 1;
    const saturation = 0.65 + Math.random() * 0.3;
    const lightness = 0.48 + Math.random() * 0.14;
    return { hue, color: new Color().setHSL(hue, saturation, lightness, SRGBColorSpace) };
}

export function playMelt(letter) {
    if (letter.melting) return;
    letter.melting = true;

    const timeline = gsap.timeline({ onComplete: () => { letter.melting = false; } })
        .to(letter.morph, { value: 1, duration: 0.42, ease: 'power2.inOut' }, 0)
        .to(letter.intro, { y: 0.14, rotY: Math.PI, duration: 0.42, ease: 'power2.out' }, 0)
        .to(letter.morph, { value: 0, duration: 0.95, ease: 'elastic.out(1, 0.55)' }, 0.5)
        .to(letter.intro, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.5)
        .to(letter.intro, { rotY: Math.PI * 2, duration: 0.8, ease: 'power3.out' }, 0.5)
        .set(letter.intro, { rotY: 0 })
        .fromTo(letter.kick, { value: 0.7 }, { value: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }, 0.5);

    const { color } = letter.material;
    let hue = RESTING_HUE;
    const fades = Math.floor(MORPH_END / SHUFFLE_STEP);
    for (let i = 0; i < fades; i++) {
        const next = randomColorAfter(hue);
        hue = next.hue;
        const { r, g, b } = next.color;
        timeline.to(color, { r, g, b, duration: SHUFFLE_STEP, ease: 'sine.inOut' }, i * SHUFFLE_STEP);
    }
    const { r, g, b } = RESTING_COLOR;
    timeline.to(color, { r, g, b, duration: 0.3, ease: 'sine.inOut' }, MORPH_END);
}

export const ticker = gsap.ticker;
