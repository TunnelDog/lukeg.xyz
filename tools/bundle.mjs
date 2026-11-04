// Bundles the site's JavaScript into one classic script, js/dist/site.js.
// A classic script is what lets index.html work when it's opened straight
// from the folder: browsers refuse to load ES modules from file:// pages.
// It also writes js/dist/app-textures.local.js, which only file:// pages load,
// because WebGL can't read image files from a file:// page.
// Run with: npm run bundle (from tools/), or npm run watch while editing.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

const options = {
    entryPoints: [`${root}js/src/main.js`],
    outfile: `${root}js/dist/site.js`,
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    nodePaths: [`${root}tools/node_modules`],
    legalComments: 'none',
    logLevel: 'info'
};

function writeLocalTextures() {
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    const textures = {};
    for (const name of readdirSync(`${root}images/apps`)) {
        const type = mime[name.split('.').pop().toLowerCase()];
        if (!type) continue;
        const data = readFileSync(`${root}images/apps/${name}`).toString('base64');
        textures[`images/apps/${name}`] = `data:${type};base64,${data}`;
    }
    mkdirSync(`${root}js/dist`, { recursive: true });
    writeFileSync(`${root}js/dist/app-textures.local.js`, `window.__APP_TEXTURES=${JSON.stringify(textures)};\n`);
}

writeLocalTextures();
if (process.argv.includes('--watch')) {
    const context = await esbuild.context(options);
    await context.watch();
    console.log('Watching js/src for changes');
} else {
    await esbuild.build(options);
}
