import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";
import { setRoute } from "../state/navigationStore.js";

const normalize = s => s.replace(/\s+/g, "_").toUpperCase();

const locText = document.getElementById("locText");
const startBtn = document.getElementById("startBtn");

const qrOverlay = document.getElementById("qr-overlay");
const appUI = document.getElementById("app");
const qrStatus = document.getElementById("qr-status");
const startScanBtn = document.getElementById("startScanBtn");

function showApp() {
  qrOverlay.classList.add("hidden");
  appUI.classList.add("active");
}

let source = null;

if (startScanBtn) {
  const scanner = new Html5Qrcode("qr-reader");

  startScanBtn.onclick = async () => {
    try {
      qrStatus.innerText = "Scanning...";

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        qrText => {
          let data;

          try {
            data = JSON.parse(qrText);
          } catch {
            data = { id: qrText.trim() };
          }

          source = normalize(data.id);

          if (!campusCoords[source]) {
            alert("Unknown block");
            return;
          }

          sessionStorage.setItem(
            "qrAnchor",
            JSON.stringify({ id: source })
          );

          locText.innerText = source;
          qrStatus.innerText = `Location detected: ${source}`;

          scanner.stop();
          showApp();
        }
      );
    } catch (err) {
      console.error(err);
      qrStatus.innerText = "Camera error";
    }
  };
}

startBtn.onclick = () => {
  if (!source) {
    alert("Scan location QR first");
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