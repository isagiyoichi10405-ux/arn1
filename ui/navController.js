import * as THREE from "three";
import { campusCoords } from "../data/campusMap.js";

/* ===============================
   CAMERA FEED
================================ */
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  document.getElementById("camera").srcObject = stream;
});

/* ===============================
   LOAD NAV STATE
================================ */
const navState = JSON.parse(sessionStorage.getItem("navState"));
if (!navState || !navState.path) {
  alert("No route data");
  location.href = "index.html";
}

const path = navState.path;
let index = 0;
let current = path[index];
let arrived = false;

/* ===============================
   UI ELEMENTS
================================ */
const instruction = document.getElementById("instruction");
const distance = document.getElementById("distance");

instruction.innerText = `Destination: ${path.at(-1)}`;
distance.innerText = `${path.length - 1} steps`;

/* ===============================
   THREE.JS SETUP
================================ */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  0.01,
  50
);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

/* ===============================
   AR ARROW
================================ */
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.9, 20),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);

arrow.rotation.x = Math.PI / 2;
arrow.position.set(0, -0.45, -1.5);
arrow.frustumCulled = false;

camera.add(arrow);
scene.add(camera);

/* ===============================
   DEVICE ORIENTATION
================================ */
let yaw = 0;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  yaw = -THREE.MathUtils.degToRad(e.alpha);
});

/* ===============================
   NAVIGATION MATH
================================ */
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
    instruction.innerText = "Scan destination QR to confirm arrival";
    return;
  }

  const delta = angle(curr, next) - angle(prev, curr);

  if (delta > 0.4) instruction.innerText = "Turn left";
  else if (delta < -0.4) instruction.innerText = "Turn right";
  else instruction.innerText = "Go straight";
}

/* ===============================
   END SCREEN UX
================================ */
const endScreen = document.createElement("div");
endScreen.className = "end-screen hidden";
endScreen.innerHTML = `
  <div class="end-card">
    <div class="checkmark">✔</div>
    <h2>You're Here</h2>
    <p>Destination confirmed successfully.</p>
    <button id="endNavBtn">End Navigation</button>
  </div>
`;
document.body.appendChild(endScreen);

document.addEventListener("click", e => {
  if (e.target.id === "endNavBtn") {
    sessionStorage.removeItem("navState");
    sessionStorage.removeItem("qrAnchor");
    location.href = "index.html";
  }
});

function showArrival() {
  arrived = true;
  arrow.visible = false;
  endScreen.classList.remove("hidden");
}

/* ===============================
   QR LOCATION UPDATE
================================ */
function applyQRAnchor(anchor) {
  if (!anchor || !anchor.id) return;

  const idx = path.indexOf(anchor.id);
  if (idx === -1) return;

  index = idx;
  current = path[index];

  // FINAL DESTINATION CONFIRMATION
  if (anchor.id === path.at(-1)) {
    instruction.innerText = "Destination reached";
    distance.innerText = "0 steps";
    showArrival();
    return;
  }

  updateInstruction();
  distance.innerText = `${path.length - index - 1} steps`;
}

/* ===============================
   RESTORE PREVIOUS QR
================================ */
const savedAnchor = JSON.parse(sessionStorage.getItem("qrAnchor"));
if (savedAnchor) applyQRAnchor(savedAnchor);

/* ===============================
   MINIMAP
================================ */
const map = document.createElement("canvas");
map.width = 160;
map.height = 160;
map.className = "minimap";
document.body.appendChild(map);

const ctx = map.getContext("2d");

function drawUserArrow(x, y, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-a);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6, 8);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMiniMap() {
  ctx.clearRect(0, 0, 160, 160);

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const sx = x => ((x - minX) / (maxX - minX)) * 120 + 20;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 120 + 20;

  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  path.forEach((id, i) => {
    const p = campusCoords[id];
    i === 0 ? ctx.moveTo(sx(p.x), sz(p.z)) : ctx.lineTo(sx(p.x), sz(p.z));
  });
  ctx.stroke();

  path.forEach((id, i) => {
    const p = campusCoords[id];
    ctx.fillStyle = i <= index ? "#00ff88" : "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(sx(p.x), sz(p.z), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  const c = campusCoords[current];
  drawUserArrow(sx(c.x), sz(c.z), yaw);
}

/* ===============================
   RENDER LOOP
================================ */
function animate() {
  requestAnimationFrame(animate);

  camera.rotation.set(0, yaw, 0);

  if (!arrived) {
    const next = path[index + 1];
    if (next) arrow.rotation.z = angle(current, next) - yaw;
  }

  drawMiniMap();
  renderer.render(scene, camera);
}

animate();

/* ===============================
   QR SCANNER
================================ */
import("https://unpkg.com/html5-qrcode").then(() => {
  const qrScanner = new Html5Qrcode("qr-reader");

  qrScanner.start(
    { facingMode: "environment" },
    { fps: 5, qrbox: 200 },
    qrText => {
      let data;
      try {
        data = JSON.parse(qrText);
      } catch {
        data = { id: qrText.trim() };
      }

      sessionStorage.setItem("qrAnchor", JSON.stringify(data));
      applyQRAnchor(data);
    }
  );
});