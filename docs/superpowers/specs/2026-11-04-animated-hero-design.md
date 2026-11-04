# Animated "Luke G" Hero: Design

**Date:** 2026-11-04
**Branch:** `animated-hero`
**Status:** Awaiting review

## Goal

Replace the hero name at the top of `index.html` with an interactive 3D "Luke G" that combines kinetic type, morphing shapes, 3D elements and fluid camera moves, using the supplied color palette.

The site is a personal portfolio, so a visitor must be able to read the name almost immediately. The animation supports the name and never competes with it.

## Success criteria

- The name is readable within about 1.5 seconds of the intro starting.
- All four requested elements are clearly present: kinetic type, morphing shapes, 3D elements and fluid camera moves.
- Scrolling behaves normally, with nothing pinned or hijacked.
- The word always fits the viewport, at every screen size and during every interaction.
- The caption and nav stay readable.
- The real `<h1>` stays in the page for screen readers and search engines.
- Interaction stays smooth on a real phone (checked by Luke; see Testing).

## Palette

| Name | Hex | Role |
|---|---|---|
| Lavender Blush | `#FFEEF2` | Background gradient |
| Lavender Veil | `#FFE4F3` | Background gradient, some shapes |
| Blush Rose | `#E54F6D` | "Luke" letters, some shapes |
| Wisteria Blue | `#8390FA` | "G" letter, some shapes |
| Charcoal | `#595758` | Caption text |

Contrast against Lavender Blush:

- Charcoal: about 6.4:1, suitable for small text.
- Blush Rose: about 3.3:1, large shapes and display type only.
- Wisteria Blue: about 2.6:1, large shapes only.

**Scope:** the palette applies to the hero only. The hero background fades into the site's existing `--bg` (`#fafaf9`) at its bottom edge, so there is no hard seam at the About section. Restyling the rest of the site is out of scope.

## Look

- **Letters:** "Luke G" with that exact capitalization, set in Anton, as solid 3D letters with rounded edges and a soft matte finish.
- **Shapes:** a small set of pills, arches and discs floats around the name in palette colors.
- **Lighting:** soft, studio-style lighting that keeps the palette colors recognizable.
- **Unchanged:** the nav and the caption copy stay as they are. The eyebrow and caption text use Charcoal within the hero.

## Motion

| Moment | Behavior |
|---|---|
| Load (about 2.5s) | Shapes morph into letters while the camera sweeps from a low three-quarter angle to the front. The name is readable by about 1.5s. |
| Idle | Letters and shapes drift gently, so the scene never looks frozen. |
| Pointer | Letters near the cursor stretch while their neighbors squeeze. The word's total width stays constant. The camera follows slightly. |
| Click or tap | That letter melts into a shape and snaps back. |
| Scroll | As the hero scrolls away, the camera glides into the gap between "Luke" and "G" and the scene fades into the site background. Scrolling back reverses it. |
| Phones | Tap and scroll only. Tilt control is excluded because it requires a permission prompt. |

The intro does not replay on every scroll back into view. Scroll-driven motion reverses instead.

## Architecture

The site stays static with no build step for visitors.

### Files

| Path | Responsibility |
|---|---|
| `js/main.js` | Small entry point: checks capabilities and starts the hero or leaves the fallback in place. |
| `js/hero/scene.js` | Renderer, camera, lights, background, resize handling, render loop, pausing. |
| `js/hero/morph-geometry.js` | Builds extruded meshes that can blend between a letter and a shape. |
| `js/hero/choreography.js` | GSAP timelines for the intro, the click melt and the scroll camera path. |
| `js/hero/input.js` | Turns pointer, tap and scroll input into values the scene and choreography read. |
| `js/hero/letters.json` | Pre-generated letter outlines. |
| `js/vendor/` | Local copies of Three.js 0.187 and GSAP 3.15. |
| `scripts/bake-letters.mjs` | Development-only script that generates `letters.json` from Anton using opentype.js. |

### Morphing

Each letter and its paired shape are resampled to the same number of outline points. The mesh stores both positions, and the vertex shader blends between them, so the morph runs on the GPU.

The lowercase "e" has a counter (hole). Its paired shape stores the hole collapsed to a single point, so the hole grows open as the letter forms. "L", "u", "k" and "G" have no holes.

### Kinetic stretch

Each letter has a width factor driven by pointer distance. Factors are normalized on every update so that they keep the word's total width constant, which guarantees the name stays inside the viewport.

### Dependencies

- **Three.js 0.187** replaces the current `0.129` import from Skypack. Stored locally and mapped with an import map, so the page has only one copy of Three.js.
- **GSAP 3.15** under its standard no-charge license, stored locally.
- **opentype.js** is used only by the bake script. It is never shipped to visitors.
- **Anton** (Google Fonts) replaces Yellowtail in the `@import` in `css/style.css`. Only the hero uses Yellowtail. Anton is still needed at runtime for the fallback `<h1>`.

### Changes to existing code

- `js/main.js`: the 2D stroke-tracing hero is removed. It remains recoverable from commit `bdc430e`.
- `index.html`: add the import map and rename `#ribbon-canvas` to `#hero-canvas`. The `<h1>`, caption and scroll cue remain.
- `css/style.css`: update the hero styles for the palette, the Anton fallback and the background fade, and rename `.has-ribbon` to `.has-hero-scene`.
- `js/app-icons.js` and `js/studio-env.js`: move to the new Three.js. `outputEncoding` and `texture.encoding` become `outputColorSpace` and `colorSpace`, and any other changes the upgrade requires are made here. Their appearance should match the current version.

The existing `models/newletters` assets are not used, because outlines from Anton are needed for morphing. They are left in place.

## Fallbacks and performance

- **Reduced motion:** a still, composed scene with no intro sweep, no idle drift, no scroll camera movement and no stretch. A click does nothing beyond normal page behavior.
- **WebGL unavailable or start-up failure:** the plain `<h1>` shows in Anton and Blush Rose, and the error is logged to the console.
- **Font or asset loading failure:** treated the same as a start-up failure.
- **Rendering pauses** while the hero is off-screen or the tab is hidden.
- **Resolution:** device pixel ratio is capped, and it drops automatically if frame times stay too high.
- **Height-only resizes** from mobile address bars do not rebuild the scene.
- **Touch:** the canvas keeps `touch-action: pan-y`, so swiping across it still scrolls the page.

## Testing

The project has no test framework, so verification happens in the browser:

- Desktop and mobile viewport sizes, checking that the word always fits.
- Intro, idle, pointer stretch, click melt and scroll camera, forward and in reverse.
- Reduced-motion mode.
- WebGL failure fallback.
- App icons still render correctly after the Three.js upgrade.
- Clean browser console, with no missing assets.
- Frame timing on the development machine.

**Limitation:** the browser available during development can imitate a phone's screen size, but not its GPU. Luke needs to confirm smoothness on a real phone before merging.

## Out of scope

- Restyling sections other than the hero.
- Changing the "Luke Gamertsfelder" brand text in the nav.
- Device-tilt interaction.
- Sound.
- Deploying or merging to `main`.
