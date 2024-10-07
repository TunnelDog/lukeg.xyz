document.addEventListener('DOMContentLoaded', function() {
    let prevScrollPos = window.scrollY;
    const navbar = document.getElementById('navbar');
    const navbarHeight = navbar.offsetHeight;
  
    window.addEventListener('scroll', function() {
      const currentScrollPos = window.scrollY;
      
      if (prevScrollPos > currentScrollPos) {

        navbar.classList.remove('hidden');
      } else {

        if (currentScrollPos > navbarHeight) {
          navbar.classList.add('hidden');
        }
      }
      
      prevScrollPos = currentScrollPos;
    });
  });