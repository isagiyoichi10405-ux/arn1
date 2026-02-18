import * as THREE from "three";
import { campusCoords } from "../data/campusMap.js";

/* -----------------------------
   CAMERA FEED
----------------------------- */
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  document.getElementById("camera").srcObject = stream;
});

/* -----------------------------
   LOAD ROUTE
----------------------------- */
const saved = JSON.parse(sessionStorage.getItem("navState"));
if (!saved || !saved.path) {
  alert("No route data");
  location.href = "index.html";
}

const path = saved.path;
let index = 0;
let current = path[index];

/* -----------------------------
   UI
----------------------------- */
const instruction = document.getElementById("instruction");
const distance = document.getElementById("distance");

instruction.innerText = `Destination: ${path[path.length - 1]}`;
distance.innerText = `${path.length - 1} steps`;

/* -----------------------------
   THREE.JS SETUP
----------------------------- */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  0.01,
  100
);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

/* -----------------------------
   AR ARROW (HUD-LOCKED)
----------------------------- */
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.9, 20),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);

// Arrow points forward
arrow.rotation.x = Math.PI / 2;

// LOCK arrow in front of camera
arrow.position.set(0, -0.4, -1.5);
arrow.frustumCulled = false;

// Attach arrow to camera (CRITICAL)
camera.add(arrow);
scene.add(camera);

/* -----------------------------
   DEVICE ORIENTATION → CAMERA
----------------------------- */
let yaw = 0;
let lastAlpha = null;

// iOS permission fix
if (
  typeof DeviceOrientationEvent !== "undefined" &&
  typeof DeviceOrientationEvent.requestPermission === "function"
) {
  DeviceOrientationEvent.requestPermission().catch(console.error);
}

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;

  if (lastAlpha !== null) {
    let delta = e.alpha - lastAlpha;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    yaw += delta * 0.015;
  }

  lastAlpha = e.alpha;
});

/* -----------------------------
   NAVIGATION MATH
----------------------------- */
function angle(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.atan2(p2.z - p1.z, p2.x - p1.x);
}

function updateInstruction() {
  const prev = path[index - 1];
  const curr = path[index];
  const next = path[index + 1];

  if (!prev || !next) {
    instruction.innerText = "Go straight";
    return;
  }

  const a1 = angle(prev, curr);
  const a2 = angle(curr, next);
  const d = a2 - a1;

  if (d > 0.4) instruction.innerText = "Turn left";
  else if (d < -0.4) instruction.innerText = "Turn right";
  else instruction.innerText = "Go straight";
}

/* -----------------------------
   RENDER LOOP
----------------------------- */
function animate() {
  requestAnimationFrame(animate);

  // CAMERA follows phone
  camera.rotation.set(0, yaw, 0);

  // ARROW follows path (NOT phone)
  const next = path[index + 1];
  if (next) {
    arrow.rotation.z = angle(current, next);
  }

  renderer.render(scene, camera);
}

animate();

/* -----------------------------
   SIMULATED WALK (TESTING)
----------------------------- */
setInterval(() => {
  index++;
  if (index >= path.length - 1) return;

  current = path[index];
  updateInstruction();
  distance.innerText = `${path.length - index - 1} steps`;
}, 4000);
