import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";
import { setRoute } from "../state/navigationStore.js";


const normalize = s => s.replace(/\s+/g,"_").toUpperCase();

const params = new URLSearchParams(location.search);
const rawLoc = params.get("loc");

if (!rawLoc) {
  alert("Location not detected");
  throw new Error("Missing location");
}

const source = normalize(rawLoc);
document.getElementById("locText").innerText = source;

document.getElementById("startBtn").onclick = () => {
  const dest = normalize(document.getElementById("destinationInput").value);
  const path = aStarShortestPath(
  campusGraph,
  campusCoords,
  source,
  dest
);

  if (!path) return alert("No route found");

  setRoute({ source, destination: dest, path });
  sessionStorage.setItem("navState", JSON.stringify({ source, dest, path }));
  location.href = "nav.html";
};
