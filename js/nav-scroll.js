document.addEventListener('DOMContentLoaded', function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const navbarHeight = navbar.offsetHeight;
  const scrollThreshold = 2.5; // scroll sensitivity
  let prevScrollPos = window.scrollY;
  let hideTimeout;

  window.addEventListener('scroll', function () {
    const currentScrollPos = window.scrollY;
    const scrollDifference = prevScrollPos - currentScrollPos;

    clearTimeout(hideTimeout);

    if (scrollDifference > scrollThreshold) {
      navbar.classList.remove('hidden');
    } else if (scrollDifference < 0) {
      if (currentScrollPos > navbarHeight) {
        hideTimeout = setTimeout(() => {
          navbar.classList.add('hidden');
        }, 5); // delay
      }
    }

    prevScrollPos = currentScrollPos;
  });

  // Highlight the nav link for whichever section (home/about/projects) is in view
  const navLinks = document.querySelectorAll('.nav-link[data-section]');
  if (!navLinks.length) return;

  const sections = Array.from(navLinks)
    .map(link => document.getElementById(link.dataset.section))
    .filter(Boolean);

  const setActive = (sectionId) => {
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActive(visible.target.id);
    }
  }, { threshold: [0.25, 0.5, 0.75] });

  sections.forEach(section => observer.observe(section));
});
