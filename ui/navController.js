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
const progressFill = document.getElementById("progress-fill");

function updateProgressBar() {
  if (progressFill) {
    const progress = (index / (path.length - 1)) * 100;
    progressFill.style.width = `${progress}%`;
  }
}

instruction.innerText = `To: ${path.at(-1)}`;
distance.innerText = `${path.length - 1} steps remaining`;
updateProgressBar();

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
   AR POINTERS (TURN SYMBOLS)
================================ */
/* ===============================
   3D MINIMAP OVERLAY (REPLACES ARROWS)
================================ */
const minimapPlaneGeo = new THREE.PlaneGeometry(0.8, 0.8);
const minimapTexture = new THREE.CanvasTexture(map);
const minimapMaterial = new THREE.MeshBasicMaterial({
  map: minimapTexture,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide
});
const minimapMesh = new THREE.Mesh(minimapPlaneGeo, minimapMaterial);

// Position it in front of the camera, slightly tilted
minimapMesh.position.set(0, -0.4, -1.5);
minimapMesh.rotation.x = -Math.PI / 6; // Tilt back slightly
camera.add(minimapMesh);
scene.add(camera);

/* ===============================
   DEVICE ORIENTATION
================================ */
let yaw = 0;           // Camera rotation (CCW)
let alphaHeading = 0;  // Raw compass heading (deg CW)
let wrongDirTimer = 0;
const WRONG_DIR_LIMIT = Math.PI / 2;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  // Convert CCW alpha to CW heading (0 = North, 90 = East)
  alphaHeading = (360 - e.alpha) % 360;
  // Camera yaw for Three.js (CCW)
  yaw = -THREE.MathUtils.degToRad(alphaHeading);
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

function updateInstruction(showWarning = false) {
  const next = path[index + 1];

  if (arrived || !next) {
    instruction.innerText = "Scan destination QR to confirm arrival";
    return;
  }

  if (showWarning) {
    instruction.innerText = "Pointing Wrong Direction";
  } else {
    const dist = approxDistance(current, next);
    instruction.innerText = `${next} • ${dist}m`;
  }
}

/* ===============================
   MINIMAP SETUP
================================ */
const map = document.createElement("canvas");
map.width = 300;
map.height = 300;
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
/* ===============================
   DRAW MINIMAP (CORRECT VERSION)
================================ */
function drawMiniMap() {
  ctx.clearRect(0, 0, 300, 300);

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const sx = x => ((x - minX) / (maxX - minX)) * 240 + 30;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 240 + 30;

  /* ---- PATH + NODES (INVERTED Y) ---- */
  ctx.save();
  ctx.translate(0, 300);
  ctx.scale(1, -1);

  // Path
  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 3;
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
    ctx.arc(sx(p.x), sz(p.z), 6, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  /* ---- LABELS (NORMAL CANVAS SPACE) ---- */
  path.forEach((id, i) => {
    const p = campusCoords[id];
    const x = sx(p.x);
    const y = 300 - sz(p.z);

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
  drawUserArrow(sx(c.x), 300 - sz(c.z), THREE.MathUtils.degToRad(alphaHeading));
}

/* ===============================
   NAVIGATION PROGRESS
================================ */
function nextStep() {
  if (index < path.length - 1) {
    index++;
    current = path[index];
    distance.innerText = `${path.length - 1 - index} steps remaining`;
    updateInstruction();
    updateProgressBar();

    if (index === path.length - 1) {
      arrived = true;
      instruction.innerText = "Scan destination QR to confirm arrival";
    }
  }
}

/* ===============================
   UI BUTTONS
================================ */
const nextBtn = document.createElement("button");
nextBtn.className = "nav-action-btn btn-next";
nextBtn.style.bottom = "40px";
nextBtn.style.right = "24px";
nextBtn.innerText = "👣 Next Step";
document.body.appendChild(nextBtn);

nextBtn.onclick = nextStep;

const rerouteBtn = document.createElement("button");
rerouteBtn.className = "nav-action-btn btn-reset";
rerouteBtn.style.bottom = "40px";
rerouteBtn.style.left = "24px";
rerouteBtn.innerText = "🔄 Reset";
document.body.appendChild(rerouteBtn);

rerouteBtn.onclick = () => {
  index = 0;
  current = path[0];
  arrived = false;
  wrongDirTimer = 0;
  distance.innerText = `${path.length - 1} steps remaining`;
  updateInstruction();
  updateProgressBar();
};

// Tap to advance on canvas
renderer.domElement.addEventListener("click", nextStep);

/* ===============================
   RENDER LOOP
================================ */
function animate() {
  requestAnimationFrame(animate);

  camera.rotation.set(0, yaw, 0);

  const next = path[index + 1];
  if (next && !arrived) {
    const p1 = campusCoords[current];
    const p2 = campusCoords[next];
    const target = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    const currentHeadingRad = THREE.MathUtils.degToRad(alphaHeading);
    const relativeAngle = target - currentHeadingRad;

    minimapMesh.rotation.z = -relativeAngle;

    const diff = Math.abs(target - currentHeadingRad);
    const normalizedDiff = Math.abs(((diff + Math.PI) % (Math.PI * 2)) - Math.PI);

    if (normalizedDiff > WRONG_DIR_LIMIT) {
      wrongDirTimer++;
      if (wrongDirTimer > 60) {
        updateInstruction(true);
      }
    } else {
      wrongDirTimer = 0;
      updateInstruction(false);
    }
  }

  drawMiniMap();
  minimapTexture.needsUpdate = true;
  renderer.render(scene, camera);
}
animate();
