import { initHero } from './hero/scene.js';
import { initAppIcons } from './app-icons.js';

// Each piece fails on its own: if WebGL is missing, the plain <h1> and the
// plain app icon images are already on the page and simply stay visible.
try {
    initHero();
} catch (error) {
    console.error('Animated hero failed to start, showing the plain name instead', error);
    document.documentElement.classList.remove('hero-pending');
}

initAppIcons().catch(error => {
    console.error('3D app icons failed to start, showing the plain images instead', error);
});
