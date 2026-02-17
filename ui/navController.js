import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";

/* -------------------------------
   CAMERA FEED (AR BACKGROUND)
--------------------------------*/
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  document.getElementById("camera").srcObject = stream;
}).catch(err => {
  alert("Camera access denied");
  console.error(err);
});

/* -------------------------------
   LOAD NAV STATE
--------------------------------*/
const saved = JSON.parse(sessionStorage.getItem("navState"));
if (!saved || !saved.path) {
  alert("No route data");
  location.href = "index.html";
}

let path = [...saved.path];
let userNodeIndex = 0;
let currentUserNode = path[userNodeIndex];

/* -------------------------------
   UI TEXT
--------------------------------*/
document.getElementById("instruction").innerText =
  `Destination: ${path[path.length - 1]}`;
document.getElementById("distance").innerText =
  `${path.length - 1} steps`;

/* -------------------------------
   THREE.JS SETUP
--------------------------------*/
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableRotate = false;

/* -------------------------------
   AR DIRECTION ARROW
--------------------------------*/
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 1, 16),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);

// Arrow in front of camera
arrow.position.set(0, -1, -3);
arrow.rotation.x = Math.PI / 2;
scene.add(arrow);

/* -------------------------------
   DEVICE ORIENTATION PERMISSION
--------------------------------*/
async function requestOrientationPermission() {
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        alert("Device orientation permission denied");
      }
    } catch (err) {
      console.error(err);
    }
  }
}

// MUST be user-triggered (mobile requirement)
document.body.addEventListener(
  "click",
  requestOrientationPermission,
  { once: true }
);

/* -------------------------------
   DIRECTION LOGIC
--------------------------------*/
function directionAngle(from, to) {
  const a = campusCoords[from];
  const b = campusCoords[to];
  return Math.atan2(b.z - a.z, b.x - a.x);
}

// Compass heading (radians)
let deviceHeading = 0;

// Use ABSOLUTE orientation (real compass)
window.addEventListener("deviceorientationabsolute", e => {
  if (e.alpha !== null) {
    // Convert compass heading to radians
    deviceHeading = (360 - e.alpha) * Math.PI / 180;
  }
});

/* -------------------------------
   ANIMATION LOOP
--------------------------------*/
function animate() {
  requestAnimationFrame(animate);

  const nextNode = path[userNodeIndex + 1];
  if (nextNode) {
    const target = directionAngle(currentUserNode, nextNode);

    // ROTATE AROUND Y AXIS (CORRECT)
    arrow.rotation.y = target - deviceHeading;
  }

  renderer.render(scene, camera);
}

animate();

/* -------------------------------
   DYNAMIC REROUTING (SIMULATED)
--------------------------------*/
function rerouteFrom(nodeId) {
  const destination = path[path.length - 1];

  const newPath = aStarShortestPath(
    campusGraph,
    campusCoords,
    nodeId,
    destination
  );

  if (!newPath) return;

  path = newPath;
  userNodeIndex = 0;
  currentUserNode = path[0];

  document.getElementById("distance").innerText =
    `${path.length - 1} steps`;
}

// Simulated movement (every 4s)
setInterval(() => {
  userNodeIndex++;

  if (userNodeIndex >= path.length - 1) return;

  currentUserNode = path[userNodeIndex];
  rerouteFrom(currentUserNode);

}, 4000);

/* -------------------------------
   HANDLE RESIZE
--------------------------------*/
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
