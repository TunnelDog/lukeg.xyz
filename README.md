# lukeg.xyz

Personal website for Luke Gamertsfelder — portfolio, blog, and poetry, built
with vanilla HTML, CSS, and JavaScript, plus [Three.js](https://threejs.org/)
for the interactive 3D homepage scene.

**Live site:** [lukeg.xyz](https://www.lukeg.xyz)

## Pages

- `/` — Home (Three.js scene)
- `/about` — About me
- `/projects` — Software and hardware projects
- `/blog` — Blog posts
- `/poetry` — A collection of poems
- `/contact` — Contact form

## Tech stack

- HTML5 / CSS3 / vanilla JavaScript
- [Three.js](https://threejs.org/) for 3D rendering
- [Web3Forms](https://web3forms.com/) for the contact form
- Deployed on [Vercel](https://vercel.com/)

## Running locally

This is a static site with no build step. Serve the directory with any
static file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

### Docker

A `Dockerfile` is included that serves the site with nginx:

```bash
docker build -t lukeg-xyz .
docker run -p 8080:80 lukeg-xyz
```
