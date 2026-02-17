import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";
import { setRoute } from "../state/navigationStore.js";

/* -------------------------------
   Helpers
--------------------------------*/
const normalize = s => s.replace(/\s+/g, "_").toUpperCase();

/* -------------------------------
   SOURCE LOCATION (QR or URL)
--------------------------------*/
const params = new URLSearchParams(window.location.search);
const rawLoc = params.get("loc");

let source = null;

// Case 1: location came from URL (QR redirect or manual test)
if (rawLoc) {
  source = normalize(rawLoc);
  document.getElementById("locText").innerText = source;
}

/* -------------------------------
   START NAVIGATION
--------------------------------*/
document.getElementById("startBtn").onclick = () => {

  // Enforce QR scan first
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
