import * as THREE from "three";
import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";

navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  document.getElementById("camera").srcObject = stream;
});

const saved = JSON.parse(sessionStorage.getItem("navState"));
if (!saved || !saved.path) {
  alert("No route data");
  location.href = "index.html";
}

let path = [...saved.path];
let userNodeIndex = 0;
let currentUserNode = path[userNodeIndex];

const instructionEl = document.getElementById("instruction");
const distanceEl = document.getElementById("distance");

instructionEl.innerText = `Destination: ${path[path.length - 1]}`;
distanceEl.innerText = `${path.length - 1} steps`;

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

const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.3, 1, 20),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
arrow.position.set(0, -1, -3);
arrow.rotation.x = Math.PI / 2;
scene.add(arrow);

let lastAlpha = null;
let relativeRotation = 0;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  if (lastAlpha !== null) {
    let delta = e.alpha - lastAlpha;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    relativeRotation += delta;
  }
  lastAlpha = e.alpha;
});

function angleBetween(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.atan2(p2.z - p1.z, p2.x - p1.x);
}

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

const map = document.createElement("canvas");
map.width = 160;
map.height = 160;
map.style.position = "fixed";
map.style.top = "20px";
map.style.right = "20px";
map.style.background = "rgba(0,0,0,0.55)";
map.style.borderRadius = "10px";
map.style.zIndex = 999;
document.body.appendChild(map);

const ctx = map.getContext("2d");

function drawMiniMap() {
  ctx.clearRect(0, 0, map.width, map.height);

  const nodes = path.map(id => ({ id, ...campusCoords[id] }));
  const minX = Math.min(...nodes.map(n => n.x));
  const maxX = Math.max(...nodes.map(n => n.x));
  const minZ = Math.min(...nodes.map(n => n.z));
  const maxZ = Math.max(...nodes.map(n => n.z));

  const sx = x => ((x - minX) / (maxX - minX)) * 130 + 15;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 130 + 15;

  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  nodes.forEach((n, i) => {
    if (i === 0) ctx.moveTo(sx(n.x), sz(n.z));
    else ctx.lineTo(sx(n.x), sz(n.z));
  });
  ctx.stroke();

  ctx.font = "10px Arial";
  ctx.fillStyle = "#ffffff";
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(sx(n.x), sz(n.z), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(n.id, sx(n.x) + 4, sz(n.z) - 4);
  });

  const cur = campusCoords[currentUserNode];
  ctx.fillStyle = "#00ff00";
  ctx.beginPath();
  ctx.arc(sx(cur.x), sz(cur.z), 5, 0, Math.PI * 2);
  ctx.fill();
}

function animate() {
  requestAnimationFrame(animate);
  const next = path[userNodeIndex + 1];
  if (next) {
    const target = angleBetween(currentUserNode, next);
    arrow.rotation.y = target - (relativeRotation * Math.PI / 180);
  }
  drawMiniMap();
  renderer.render(scene, camera);
}

animate();

setInterval(() => {
  userNodeIndex++;
  if (userNodeIndex >= path.length - 1) return;
  currentUserNode = path[userNodeIndex];
  updateTurnInstruction();
  distanceEl.innerText = `${path.length - userNodeIndex - 1} steps`;
}, 4000);
