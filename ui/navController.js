import * as THREE from "three";
import { campusCoords } from "../data/campusMap.js";

/* ===============================
   FORCE AR MODE (CSS FALLBACK)
================================ */
document.body.classList.add("ar-mode");

/* ===============================
   CAMERA FEED
================================ */
const video = document.getElementById("camera");
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  video.srcObject = stream;
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

instruction.innerText = `To: ${path.at(-1)}`;
distance.innerText = `${path.length - 1} steps remaining`;

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

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===============================
   AR ARROW
================================ */
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.9, 24),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);

arrow.rotation.set(Math.PI / 2, 0, Math.PI);
arrow.position.set(0, -0.45, -1.5);
arrow.frustumCulled = false;

camera.add(arrow);
scene.add(camera);

/* ===============================
   DEVICE ORIENTATION
================================ */
let yaw = 0;
let wrongDirTimer = 0;
const WRONG_DIR_LIMIT = Math.PI / 2;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  yaw = -THREE.MathUtils.degToRad(e.alpha);
});

/* ===============================
   NAV HELPERS
================================ */
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
    instruction.innerText = `Turn Left • ${dist}m`;
  else if (delta < -0.4)
    instruction.innerText = `Turn Right • ${dist}m`;
  else
    instruction.innerText = `Go Straight • ${dist}m`;
}

/* ===============================
   MINIMAP SETUP
================================ */
const map = document.createElement("canvas");
map.width = 160;
map.height = 160;
map.className = "minimap";
document.body.appendChild(map);

const ctx = map.getContext("2d");

/* ===============================
   MINIMAP HELPERS
================================ */
function drawUserArrow(x, y, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabel(text, x, y, color = "#ffffff") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y + 6);
  ctx.restore();
}

/* ===============================
   DRAW MINIMAP (CORRECT VERSION)
================================ */
function drawMiniMap() {
  ctx.clearRect(0, 0, 160, 160);

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const sx = x => ((x - minX) / (maxX - minX)) * 120 + 20;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 120 + 20;

  /* ---- PATH + NODES (INVERTED Y) ---- */
  ctx.save();
  ctx.translate(0, 160);
  ctx.scale(1, -1);

  // Path
  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  path.forEach((id, i) => {
    const p = campusCoords[id];
    i === 0
      ? ctx.moveTo(sx(p.x), sz(p.z))
      : ctx.lineTo(sx(p.x), sz(p.z));
  });
  ctx.stroke();

  // Nodes
  path.forEach((id, i) => {
    const p = campusCoords[id];
    let color = "rgba(255,255,255,0.7)";

    if (i === 0) color = "#00ffcc";                     // START
    else if (i === path.length - 1) color = "#ff5555"; // END
    else if (i === index) color = "#00ff88";           // CURRENT

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx(p.x), sz(p.z), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  /* ---- LABELS (NORMAL CANVAS SPACE) ---- */
  path.forEach((id, i) => {
    const p = campusCoords[id];
    const x = sx(p.x);
    const y = 160 - sz(p.z);

    if (
      i === 0 ||
      i === path.length - 1 ||
      i === index ||
      id.startsWith("B") ||
      id.includes("HOSTEL") ||
      id.includes("ADMIN")
    ) {
      let label = id;
      if (i === 0) label = "START";
      else if (i === path.length - 1) label = "END";

      drawLabel(label, x, y);
    }
  });

  /* ---- USER ORIENTATION ---- */
  const c = campusCoords[current];
  drawUserArrow(sx(c.x), 160 - sz(c.z), yaw);
}

/* ===============================
   REROUTE BUTTON
================================ */
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

/* ===============================
   RENDER LOOP
================================ */
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