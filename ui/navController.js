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
   THREE SETUP
--------------------------------*/
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;

/* -------------------------------
   AR DIRECTION ARROW
--------------------------------*/
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 1, 16),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
arrow.position.set(0, -1, -3);
arrow.rotation.x = Math.PI / 2;
scene.add(arrow);

/* -------------------------------
   DIRECTION LOGIC
--------------------------------*/
function directionAngle(from, to) {
  const a = campusCoords[from];
  const b = campusCoords[to];
  return Math.atan2(b.z - a.z, b.x - a.x);
}

let deviceHeading = 0;
window.addEventListener("deviceorientation", e => {
  deviceHeading = (e.alpha || 0) * Math.PI / 180;
});

/* -------------------------------
   ANIMATION LOOP
--------------------------------*/
function animate() {
  requestAnimationFrame(animate);

  const nextNode = path[userNodeIndex + 1];
  if (nextNode) {
    const target = directionAngle(currentUserNode, nextNode);
    arrow.rotation.z = target - deviceHeading;
  }

  renderer.render(scene, camera);
}
animate();

/* -------------------------------
   DYNAMIC REROUTING
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
}

setInterval(() => {
  userNodeIndex++;
  if (userNodeIndex >= path.length - 1) return;
  currentUserNode = path[userNodeIndex];
  rerouteFrom(currentUserNode);
}, 4000);
