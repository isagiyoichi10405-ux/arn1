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

// Initial HUD-style rotation: Pointing UP in camera space
arrow.rotation.set(0, 0, 0);
arrow.position.set(0, -0.45, -1.5);
arrow.frustumCulled = false;

camera.add(arrow);
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
  // Normalized CW heading: (180 - alpha) aligns with map orientation + CW winding
  alphaHeading = (180 - e.alpha + 360) % 360;
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
  // Minimap rotation: deg CW -> rad CW
  // We subtract 90 deg because the arrow model points UP (North) in canvas space, 
  // but we want 0 deg to point Right (+X/East) if X is East.
  // Actually, let's keep it simple: 0 deg = North (Up), 90 deg = East (Right).
  // Our drawUserArrow points Up at 0 rotation. Alpha = 0 is North. 
  // So rotation = alpha (in radians).
  drawUserArrow(sx(c.x), 160 - sz(c.z), THREE.MathUtils.degToRad(alphaHeading));
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
nextBtn.style.bottom = "160px"; // Directly above 120px minimap
nextBtn.innerText = "👣 Next Step";
document.body.appendChild(nextBtn);

nextBtn.onclick = nextStep;

const rerouteBtn = document.createElement("button");
rerouteBtn.className = "nav-action-btn btn-reset";
rerouteBtn.style.bottom = "220px"; // Above Next Step button
rerouteBtn.innerText = "🔄 Reset";
document.body.appendChild(rerouteBtn);

rerouteBtn.onclick = () => {
  index = 0;
  current = path[0];
  arrived = false;
  wrongDirTimer = 0;
  distance.innerText = `${path.length - 1} steps remaining`;
  updateInstruction();
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
    // Target calculation: North is +Z, East is +X.
    // Geographical North (0 deg) = +Z.
    // atan2(x, z) gives angle from +Z CW.
    const p1 = campusCoords[current];
    const p2 = campusCoords[next];
    const target = Math.atan2(p2.x - p1.x, p2.z - p1.z);

    // Relative Angle for HUD: target (CW) - heading (CW)
    const currentHeadingRad = THREE.MathUtils.degToRad(alphaHeading);
    const relativeAngle = target - currentHeadingRad;

    // Arrow.rotation.z is the HUD rotation. 
    // Since we fixed the initial rotation to 0 (Up),
    // and simplified the heading logic, we use -relativeAngle 
    // to point accurately in the HUD plane.
    arrow.rotation.z = -relativeAngle;

    const diff = Math.abs(target - currentHeadingRad);
    const normalizedDiff = Math.abs(((diff + Math.PI) % (Math.PI * 2)) - Math.PI);

    if (normalizedDiff > WRONG_DIR_LIMIT) {
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