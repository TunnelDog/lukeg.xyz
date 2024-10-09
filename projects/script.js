document.addEventListener('DOMContentLoaded', function() {
  let prevScrollPos = window.scrollY;
  const navbar = document.getElementById('navbar');
  const navbarHeight = navbar.offsetHeight;
  const scrollThreshold = 2.5; // scroll sensitivity 

  let hideTimeout;

  window.addEventListener('scroll', function() {
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
});