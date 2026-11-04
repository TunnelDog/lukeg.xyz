// Collects pointer and scroll input into one object the render loop reads.
// Touch has no hover, so only mouse movement drives the letter stretch.
export function createInput(hero, { onSelect }) {
    const input = {
        hasPointer: false,
        x: 0, // CSS pixels within the hero
        y: 0,
        nx: 0, // -1..1 across the hero
        ny: 0,
        scroll: 0 // 0 at the top of the page, 1 once the hero has scrolled away
    };

    let rect = hero.getBoundingClientRect();
    const measure = () => { rect = hero.getBoundingClientRect(); };

    function place(event) {
        measure();
        input.x = event.clientX - rect.left;
        input.y = event.clientY - rect.top;
        input.nx = (input.x / rect.width) * 2 - 1;
        input.ny = (input.y / rect.height) * 2 - 1;
    }

    window.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        place(event);
        input.hasPointer = input.y >= 0 && input.y <= rect.height;
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => { input.hasPointer = false; });

    // Links inside the hero (the scroll cue) keep their normal behaviour.
    hero.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        place(event);
        onSelect(input.x, input.y);
    });

    input.readScroll = () => {
        const height = hero.offsetHeight || 1;
        input.scroll = Math.min(Math.max(window.scrollY / height, 0), 1);
    };
    input.readScroll();
    return input;
}
