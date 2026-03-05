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

function checkTheme() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 18) {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}
checkTheme();

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

// Visual Warning Overlay
const warningOverlay = document.createElement("div");
warningOverlay.className = "wrong-direction-overlay";
document.body.appendChild(warningOverlay);

updateInstruction();
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
   3D WORLD ELEMENTS (WORLD AR)
================================ */
const pathGroup = new THREE.Group();
const labelGroup = new THREE.Group();
const particleGroup = new THREE.Group();
scene.add(pathGroup);
scene.add(labelGroup);
scene.add(particleGroup);

/* ===============================
   PARTICLE SYSTEM
 ================================ */
function createParticles() {
  const geo = new THREE.BufferGeometry();
  const count = 500;
  const pos = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) {
    pos[i] = (Math.random() - 0.5) * 40;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x00f2ff,
    size: 0.05,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(geo, mat);
  particleGroup.add(particles);
}
createParticles();

function makeTextLabel(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.roundRect(0, 0, 256, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.375, 1);

  // Subtle holographic drift
  sprite.onBeforeRender = () => {
    sprite.position.y += Math.sin(Date.now() * 0.002) * 0.0005;
  };

  return sprite;
}

function createWorldPath() {
  pathGroup.clear();
  labelGroup.clear();
  const points = path.map(id => {
    const coords = campusCoords[id];
    return new THREE.Vector3(coords.x * 10, -1.6, coords.z * 10);
  });

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, path.length * 10, 0.08, 8, false);
  const tubeMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.8
  });
  const pathLine = new THREE.Mesh(tubeGeo, tubeMat);
  pathGroup.add(pathLine);

  // Add glowing nodes and labels
  points.forEach((p, i) => {
    const id = path[i];
    const nodeGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({ color: i === index ? 0x00ff00 : 0xffffff });
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.copy(p);
    node.name = i === index ? "activeNode" : "node";
    pathGroup.add(node);

    // Add labels for blocks, roads and key locations
    if (id.startsWith("B") || id.startsWith("R") || id.includes("HOSTEL") || id.includes("ADMIN") || i === 0 || i === path.length - 1) {
      let labelText = id;
      if (id.startsWith("R")) labelText = "ROAD";
      if (i === 0) labelText = "START";
      if (i === path.length - 1) labelText = id;

      const label = makeTextLabel(labelText);
      label.position.set(p.x, p.y + 0.6, p.z);
      labelGroup.add(label);
    }
  });
}

createWorldPath();

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

const synth = window.speechSynthesis;
function speak(text) {
  if (synth.speaking) synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.1;
  utter.pitch = 1.0;
  synth.speak(utter);
}

function updateInstruction(showWarning = false) {
  const start = path[0];
  const end = path.at(-1);
  const next = path[index + 1];

  if (arrived || !next) {
    instruction.innerHTML = `<span style="color:var(--secondary)">DESTINATION REACHED</span>`;
    return;
  }

  if (showWarning) {
    instruction.innerHTML = `<span style="color:#ff3333">POINTING WRONG DIRECTION</span>`;
  } else {
    const dist = approxDistance(current, next);
    const dir = (dist < 2) ? "FORWARD" : "ADVANCE";
    // Using CSS classes defined in style.css for consistent green theme
    instruction.innerHTML = `
      <div class="hud-main">FROM ${start} TO ${end}</div>
      <div class="hud-sub">DIR: ${dir} | NEXT: ${next} (${dist}m)</div>
    `;
  }
}

/* ===============================
   MINIMAP SETUP
================================ */
const map = document.createElement("canvas");
map.width = 150;
map.height = 150;
map.className = "minimap";
document.querySelector(".nav-card").appendChild(map);

const ctx = map.getContext("2d");

// Node Info Popup
const popup = document.createElement("div");
popup.className = "node-info-popup";
document.body.appendChild(popup);

function showNodeInfo(id) {
  const dist = approxDistance(current, id);
  popup.innerHTML = `
    <h3 style="color:var(--primary); margin-bottom:8px;">${id.replace("_", " ")}</h3>
    <div style="font-size:0.9rem; opacity:0.8;">Distance from current: ${dist}m</div>
    <button class="chip" style="margin-top:16px; width:100%;" onclick="this.parentElement.classList.remove('active')">Got it</button>
  `;
  popup.classList.add("active");
  speak(`Building ${id.replace("_", " ")}. Distance: ${dist} meters.`);
}

map.onclick = (e) => {
  const rect = map.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sx = x => ((x - minX) / (maxX - minX || 1)) * 90 + 30;
  const sz = z => ((z - minZ) / (maxZ - minZ || 1)) * 90 + 30;

  path.forEach((id, i) => {
    const p = campusCoords[id];
    const nx = sx(p.x);
    const ny = sz(p.z);
    const d = Math.hypot(mouseX - nx, mouseY - ny);
    if (d < 10) {
      showNodeInfo(id);
    }
  });
};

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
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Outer glow/stroke for legibility
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y + 6);

  ctx.fillStyle = color;
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
  ctx.clearRect(0, 0, 150, 150);

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  // Map campus coords to minimap pixels (north-up: small z = top of screen)
  const sx = x => ((x - minX) / (maxX - minX || 1)) * 90 + 30;
  const sz = z => ((z - minZ) / (maxZ - minZ || 1)) * 90 + 30;

  /* ---- PATH ---- */
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

  /* ---- NODES ---- */
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

  /* ---- LABELS ---- */
  path.forEach((id, i) => {
    const p = campusCoords[id];
    const x = sx(p.x);
    const y = sz(p.z);
    if (i === 0 || i === path.length - 1 || i === index ||
      id.startsWith("B") || id.includes("HOSTEL") || id.includes("ADMIN")) {
      let label = id;
      if (i === 0) label = "START";
      else if (i === path.length - 1) label = id;
      drawLabel(label, x, y);
    }
  });

  /* ---- USER ARROW (north-up, matches 3D camera) ---- */
  const c = campusCoords[current];
  drawUserArrow(sx(c.x), sz(c.z), THREE.MathUtils.degToRad(alphaHeading));
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
      speak("Destination reached. Please scan the QR code to confirm arrival.");
    } else if (next) {
      const dist = approxDistance(current, next);
      speak(`Proceed ${dist} meters to ${next}`);
    }
  }
}

/* ===============================
   UI BUTTONS (INTEGRATED INTO HUD)
================================ */
const nextBtn = document.getElementById("nextBtn");
const rerouteBtn = document.getElementById("rerouteBtn");

if (nextBtn) {
  nextBtn.onclick = nextStep;
}

if (rerouteBtn) {
  rerouteBtn.onclick = () => {
    index = 0;
    current = path[0];
    arrived = false;
    wrongDirTimer = 0;
    distance.innerText = `${path.length - 1} steps remaining`;
    updateInstruction();
    updateProgressBar();
    createWorldPath();
  };
}

// Tap to advance on canvas
renderer.domElement.addEventListener("click", nextStep);

/* ===============================
   RENDER LOOP
================================ */
function animate() {
  requestAnimationFrame(animate);

  const time = Date.now() * 0.005;

  // Pulse animation for active node
  pathGroup.children.forEach(child => {
    if (child.name === "activeNode") {
      const s = 1 + Math.sin(time) * 0.2;
      child.scale.set(s, s, s);
    }
  });

  // World-Space Viewport Logic
  const currentPos = campusCoords[current];
  camera.position.set(currentPos.x * 10, 0, currentPos.z * 10);
  camera.rotation.set(0, yaw, 0);

  const next = path[index + 1];
  if (next && !arrived) {
    const p1 = campusCoords[current];
    const p2 = campusCoords[next];
    const target = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    const currentHeadingRad = THREE.MathUtils.degToRad(alphaHeading);

    // World path logic continues...
    const diff = Math.abs(target - currentHeadingRad);
    const normalizedDiff = Math.abs(((diff + Math.PI) % (Math.PI * 2)) - Math.PI);

    if (normalizedDiff > WRONG_DIR_LIMIT) {
      wrongDirTimer++;
      if (wrongDirTimer > 60) {
        updateInstruction(true);
        warningOverlay.classList.add("active");
      }
    } else {
      wrongDirTimer = 0;
      updateInstruction(false);
      warningOverlay.classList.remove("active");
    }
  }

  // Animate Particles
  particleGroup.children.forEach(p => {
    p.rotation.y += 0.001;
    const positions = p.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] += Math.sin(time + i) * 0.002; // Vertical drift
    }
    p.geometry.attributes.position.needsUpdate = true;
  });

  drawMiniMap();
  renderer.render(scene, camera);
}
animate();
