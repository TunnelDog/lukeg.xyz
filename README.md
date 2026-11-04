# lukeg.xyz

Personal website for Luke Gamertsfelder — portfolio, blog, and poetry, built
with vanilla HTML, CSS, and JavaScript, plus [Three.js](https://threejs.org/)
and [GSAP](https://gsap.com/) for the interactive 3D "Luke G" hero.

**Live site:** [lukeg.xyz](https://www.lukeg.xyz)

## Pages

- `/` — Home: animated hero, about, apps and projects
- `/about`, `/projects` — Redirect to their sections on the home page
- `/blog` — Blog posts
- `/poetry` — A collection of poems
- `/contact` — Contact form

## Tech stack

- HTML5 / CSS3 / vanilla JavaScript
- [Three.js](https://threejs.org/) for 3D rendering
- [GSAP](https://gsap.com/) for the hero's animation timing
- [Web3Forms](https://web3forms.com/) for the contact form
- Deployed on [Vercel](https://vercel.com/)

## Running locally

Open `index.html` directly, or serve the folder with any static file server:

```bash
python3 -m http.server 8000
```

Visitors don't need a build step. All the site's JavaScript is committed as one
file, `js/dist/site.js`.

## Changing the JavaScript

Edit the files in `js/src`, not `js/dist`, then rebuild from the `tools` folder:

```bash
cd tools
npm install
npm run bundle
```

Use `npm run watch` to rebuild on every save. `npm run bake` regenerates the
hero's letter shapes, and is only needed if the hero's text or font changes.

The palette and fonts live in `css/tokens.css`. `js/src/hero/palette.js` keeps
a copy of the colors for the 3D scene, so change both together.

### Docker

A `Dockerfile` is included that serves the site with nginx:

```bash
docker build -t lukeg-xyz .
docker run -p 8080:80 lukeg-xyz
```
