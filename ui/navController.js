import * as THREE from "three";
import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";

/* ===============================
   CAMERA FEED
================================*/
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  document.getElementById("camera").srcObject = stream;
});

/* ===============================
   LOAD NAV STATE
================================*/
const saved = JSON.parse(sessionStorage.getItem("navState"));
if (!saved || !saved.path) {
  alert("No route data");
  location.href = "index.html";
}

let path = [...saved.path];
let userNodeIndex = 0;
let currentUserNode = path[userNodeIndex];

/* ===============================
   UI TEXT
================================*/
const instructionEl = document.getElementById("instruction");
const distanceEl = document.getElementById("distance");

instructionEl.innerText = `Destination: ${path[path.length - 1]}`;
distanceEl.innerText = `${path.length - 1} steps`;

/* ===============================
   THREE.JS SETUP
================================*/
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

/* ===============================
   AR ARROW
================================*/
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.3, 1, 20),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
arrow.position.set(0, -1, -3);
arrow.rotation.x = Math.PI / 2;
scene.add(arrow);

/* ===============================
   DEVICE ORIENTATION (FIXED)
================================*/
let deviceHeading = 0;
let hasOrientation = false;

window.addEventListener("deviceorientation", e => {
  if (e.alpha !== null) {
    hasOrientation = true;
    deviceHeading = (360 - e.alpha) * Math.PI / 180;
  }
});

/* ===============================
   DIRECTION MATH
================================*/
function angleBetween(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.atan2(p2.z - p1.z, p2.x - p1.x);
}

/* ===============================
   TURN BY TURN TEXT
================================*/
function updateTurnInstruction() {
  const prev = path[userNodeIndex - 1];
  const curr = path[userNodeIndex];
  const next = path[userNodeIndex + 1];

  if (!prev || !next) {
    instructionEl.innerText = "Go straight";
    return;
  }

  const a1 = angleBetween(prev, curr);
  const a2 = angleBetween(curr, next);
  const diff = a2 - a1;

  if (diff > 0.4) instructionEl.innerText = "Turn left";
  else if (diff < -0.4) instructionEl.innerText = "Turn right";
  else instructionEl.innerText = "Go straight";
}

/* ===============================
   MINIMAP (TOP RIGHT)
================================*/
const map = document.createElement("canvas");
map.width = 160;
map.height = 160;
map.style.position = "fixed";
map.style.top = "20px";
map.style.right = "20px";
map.style.background = "rgba(0,0,0,0.5)";
map.style.borderRadius = "10px";
map.style.zIndex = 999;

document.body.appendChild(map);
const ctx = map.getContext("2d");

function drawMiniMap() {
  ctx.clearRect(0, 0, map.width, map.height);

  const nodes = path.map(n => campusCoords[n]);
  const minX = Math.min(...nodes.map(n => n.x));
  const maxX = Math.max(...nodes.map(n => n.x));
  const minZ = Math.min(...nodes.map(n => n.z));
  const maxZ = Math.max(...nodes.map(n => n.z));

  const sx = x => ((x - minX) / (maxX - minX)) * 140 + 10;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 140 + 10;

  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 3;
  ctx.beginPath();

  path.forEach((n, i) => {
    const p = campusCoords[n];
    if (i === 0) ctx.moveTo(sx(p.x), sz(p.z));
    else ctx.lineTo(sx(p.x), sz(p.z));
  });

  ctx.stroke();

  const cur = campusCoords[currentUserNode];
  ctx.fillStyle = "#00ff00";
  ctx.beginPath();
  ctx.arc(sx(cur.x), sz(cur.z), 6, 0, Math.PI * 2);
  ctx.fill();
}

/* ===============================
   ANIMATION LOOP
================================*/
function animate() {
  requestAnimationFrame(animate);

  const next = path[userNodeIndex + 1];
  if (next) {
    const target = angleBetween(currentUserNode, next);
    if (hasOrientation) {
      arrow.rotation.y = target - deviceHeading;
    }
  }

  drawMiniMap();
  renderer.render(scene, camera);
}

animate();

/* ===============================
   SIMULATED MOVEMENT
================================*/
setInterval(() => {
  userNodeIndex++;
  if (userNodeIndex >= path.length - 1) return;

  currentUserNode = path[userNodeIndex];
  updateTurnInstruction();
  distanceEl.innerText = `${path.length - userNodeIndex - 1} steps`;
}, 4000);
