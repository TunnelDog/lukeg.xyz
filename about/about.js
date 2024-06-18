let material;
let stars = [];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable alpha for transparency
renderer.setSize(window.innerWidth + 1000, window.innerHeight + 1000);
container.appendChild(renderer.domElement);

function addSphere(starColor) {
  for (let z = -1000; z < 1000; z += 10) {
    const geometry = new THREE.SphereGeometry(0.5, 150, 16);
    material = new THREE.MeshBasicMaterial({ color: starColor });
    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.x = Math.random() * 2000 - 500;
    sphere.position.y = Math.random() * 2000 - 500;
    sphere.position.z = z;

    sphere.scale.x = sphere.scale.y = 2;

    scene.add(sphere);
    stars.push(sphere);
  }
}

function animateStars() {
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    star.position.z += i / 50;
    if (star.position.z > 1000) star.position.z -= 2000;
  }
}

let backgroundColor = 'rgba(230, 230, 233, 0)'; // Transparent background
scene.background = new THREE.Color(backgroundColor);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  animateStars();
}

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let oldx = 0;
let oldy = 0;

window.onmousemove = function (ev) {
  const changex = ev.x - oldx;
  const changey = ev.y - oldy;
  camera.position.x += changex / 10;
  camera.position.y -= changey / 10;
  oldx = ev.x;
  oldy = ev.y;
};

addSphere('rgba(60, 79, 118, 0)');
animate();