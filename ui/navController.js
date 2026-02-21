import * as THREE from "three";
import { campusCoords } from "../data/campusMap.js";

/* CAMERA */
const video = document.getElementById("camera");
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  video.srcObject = stream;
});

/* LOAD STATE */
const navState = JSON.parse(sessionStorage.getItem("navState"));
if (!navState || !navState.path) {
  alert("No route data");
  location.href = "index.html";
}

const path = navState.path;
let index = 0;
let current = path[index];
let arrived = false;

/* UI */
const instruction = document.getElementById("instruction");
const distance = document.getElementById("distance");

instruction.innerText = `Destination: ${path.at(-1)}`;
distance.innerText = `${path.length - 1} steps`;

/* THREE */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

/* AR ARROW */
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.9, 24),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);

arrow.rotation.set(Math.PI / 2, 0, Math.PI);
arrow.position.set(0, -0.45, -1.5);
camera.add(arrow);
scene.add(camera);

/* ORIENTATION */
let yaw = 0;
let wrongDirTimer = 0;
const WRONG_DIR_LIMIT = Math.PI / 2;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  yaw = -THREE.MathUtils.degToRad(e.alpha);
});

/* HELPERS */
function angle(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.atan2(p2.z - p1.z, p2.x - p1.x);
}

function approxDistance(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.round(Math.hypot(p2.x - p1.x, p2.z - p1.z) * 10);
}

function updateInstruction() {
  const prev = path[index - 1];
  const curr = path[index];
  const next = path[index + 1];

  if (!prev || !next) {
    instruction.innerText = "Scan destination QR to confirm arrival";
    return;
  }

  const delta = angle(curr, next) - angle(prev, curr);
  const dist = approxDistance(curr, next);

  if (delta > 0.4)
    instruction.innerText = `Turn left • ${dist} m`;
  else if (delta < -0.4)
    instruction.innerText = `Turn right • ${dist} m`;
  else
    instruction.innerText = `Go straight • ${dist} m`;
}

/* MINIMAP */
const map = document.createElement("canvas");
map.width = 160;
map.height = 160;
map.className = "minimap";
document.body.appendChild(map);
const ctx = map.getContext("2d");

function drawMiniMap() {
  ctx.clearRect(0, 0, 160, 160);
  const nodes = path.map(id => campusCoords[id]);
  const minX = Math.min(...nodes.map(n => n.x));
  const maxX = Math.max(...nodes.map(n => n.x));
  const minZ = Math.min(...nodes.map(n => n.z));
  const maxZ = Math.max(...nodes.map(n => n.z));

  const sx = x => ((x - minX) / (maxX - minX)) * 120 + 20;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 120 + 20;

  ctx.strokeStyle = "#00c6ff";
  ctx.beginPath();
  path.forEach((id, i) => {
    const p = campusCoords[id];
    i === 0 ? ctx.moveTo(sx(p.x), sz(p.z)) : ctx.lineTo(sx(p.x), sz(p.z));
  });
  ctx.stroke();
}

/* REROUTE BUTTON */
const rerouteBtn = document.createElement("button");
rerouteBtn.className = "scan-dest-btn";
rerouteBtn.style.bottom = "80px";
rerouteBtn.innerText = "🔄 Recalculate Route";
document.body.appendChild(rerouteBtn);

rerouteBtn.onclick = () => {
  index = 0;
  current = path[0];
  wrongDirTimer = 0;
  updateInstruction();
};

/* LOOP */
function animate() {
  requestAnimationFrame(animate);
  camera.rotation.set(0, yaw, 0);

  const next = path[index + 1];
  if (next && !arrived) {
    const target = angle(current, next);
    const diff = Math.abs(target - yaw);
    arrow.rotation.z = target - yaw;

    if (diff > WRONG_DIR_LIMIT) {
      wrongDirTimer++;
      if (wrongDirTimer > 120)
        instruction.innerText = "You may be facing the wrong direction";
    } else {
      wrongDirTimer = 0;
    }
  }

  drawMiniMap();
  renderer.render(scene, camera);
}
animate();