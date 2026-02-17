import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";
import { setRoute } from "../state/navigationStore.js";

/* -------------------------------
   Helpers
--------------------------------*/
const normalize = s => s.replace(/\s+/g, "_").toUpperCase();

/* -------------------------------
   UI REFERENCES
--------------------------------*/
const locText = document.getElementById("locText");
const startBtn = document.getElementById("startBtn");

// QR UI
const qrOverlay = document.getElementById("qr-overlay");
const appUI = document.getElementById("app");
const qrStatus = document.getElementById("qr-status");
const startScanBtn = document.getElementById("startScanBtn");

/* -------------------------------
   SOURCE LOCATION
--------------------------------*/
let source = null;

// Case 1: URL param (?loc=ENTRY)
const params = new URLSearchParams(window.location.search);
const rawLoc = params.get("loc");

if (rawLoc) {
  source = normalize(rawLoc);
  locText.innerText = source;

  // FORCE UI STATE
  qrOverlay.style.display = "none";
  appUI.style.display = "block";
}

/* -------------------------------
   QR SCANNING (USER-TRIGGERED)
--------------------------------*/
if (!source && startScanBtn) {
  const scanner = new Html5Qrcode("qr-reader");

  startScanBtn.onclick = async () => {
    try {
      qrStatus.innerText = "Starting camera...";

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        qrText => {
          source = normalize(qrText);

          locText.innerText = source;
          qrStatus.innerText = `Location detected: ${source}`;

          scanner.stop();

          // FORCE UI TRANSITION (IMPORTANT)
          qrOverlay.style.display = "none";
          appUI.style.display = "flex";
        }
      );
    } catch (err) {
      console.error(err);
      qrStatus.innerText = "Camera permission denied or unavailable";
    }
  };
}

/* -------------------------------
   START NAVIGATION
--------------------------------*/
startBtn.onclick = () => {

  if (!source) {
    alert("Please scan location QR first");
    return;
  }

  const destInput = document.getElementById("destinationInput").value;
  const destination = normalize(destInput);

  if (!campusCoords[destination]) {
    alert("Invalid destination");
    return;
  }

  const path = aStarShortestPath(
    campusGraph,
    campusCoords,
    source,
    destination
  );

  if (!path) {
    alert("No route found");
    return;
  }

  setRoute({ source, destination, path });
  sessionStorage.setItem(
    "navState",
    JSON.stringify({ source, destination, path })
  );

  window.location.href = "nav.html";
};
