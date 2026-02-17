import * as THREE from "three";
import { campusCoords } from "../data/campusMap.js";

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
let index = 0;
let current = path[index];

const instruction = document.getElementById("instruction");
const distance = document.getElementById("distance");

instruction.innerText = `Destination: ${path[path.length - 1]}`;
distance.innerText = `${path.length - 1} steps`;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.35, 1.1, 20),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
arrow.position.set(0, -1.1, -3);
arrow.rotation.x = Math.PI / 2;
scene.add(arrow);

let yaw = 0;
let lastAlpha = null;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  if (lastAlpha !== null) {
    let delta = e.alpha - lastAlpha;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    yaw += delta * 0.01;
  }
  lastAlpha = e.alpha;
});

let manualRotation = 0;

window.addEventListener("touchmove", e => {
  if (e.touches.length === 1) {
    manualRotation += e.movementX * 0.002;
  }
});

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

const map = document.createElement("canvas");
map.width = 170;
map.height = 170;
map.style.position = "fixed";
map.style.top = "20px";
map.style.right = "20px";
map.style.background = "rgba(0,0,0,0.55)";
map.style.borderRadius = "12px";
map.style.zIndex = 999;
document.body.appendChild(map);

const ctx = map.getContext("2d");

function drawMap() {
  ctx.clearRect(0, 0, 170, 170);

  const nodes = path.map(id => ({ id, ...campusCoords[id] }));
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const sx = x => ((x - minX) / (maxX - minX)) * 130 + 20;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 130 + 20;

  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  nodes.forEach((n, i) => {
    i === 0 ? ctx.moveTo(sx(n.x), sz(n.z)) : ctx.lineTo(sx(n.x), sz(n.z));
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

  const c = campusCoords[current];
  ctx.fillStyle = "#00ff00";
  ctx.beginPath();
  ctx.arc(sx(c.x), sz(c.z), 6, 0, Math.PI * 2);
  ctx.fill();
}

function animate() {
  requestAnimationFrame(animate);
  const next = path[index + 1];
  if (next) {
    arrow.rotation.y = angle(current, next) - yaw - manualRotation;
  }
  drawMap();
  renderer.render(scene, camera);
}

animate();

setInterval(() => {
  index++;
  if (index >= path.length - 1) return;
  current = path[index];
  updateInstruction();
  distance.innerText = `${path.length - index - 1} steps`;
}, 4000);
