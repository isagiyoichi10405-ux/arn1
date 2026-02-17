// Heuristic: straight-line (Euclidean) distance
function heuristic(a, b, coords) {
  const dx = coords[a].x - coords[b].x;
  const dz = coords[a].z - coords[b].z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function aStarShortestPath(graph, coords, start, goal) {
    console.log("A* running:", start, "→", goal);

  if (!graph[start] || !graph[goal]) return null;

  const openSet = new Set([start]);
  const cameFrom = {};

  const gScore = {};
  const fScore = {};

  Object.keys(graph).forEach(n => {
    gScore[n] = Infinity;
    fScore[n] = Infinity;
  });

  gScore[start] = 0;
  fScore[start] = heuristic(start, goal, coords);

  while (openSet.size > 0) {
    // Node in openSet with lowest fScore
    let current = null;
    let lowest = Infinity;

    for (const node of openSet) {
      if (fScore[node] < lowest) {
        lowest = fScore[node];
        current = node;
      }
    }

    if (current === goal) {
      // reconstruct path
      const path = [];
      let cur = goal;
      while (cur) {
        path.push(cur);
        cur = cameFrom[cur];
      }
      return path.reverse();
    }

    openSet.delete(current);

    for (const neighbor of graph[current]) {
      const tentativeG = gScore[current] + heuristic(current, neighbor, coords);

      if (tentativeG < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] =
          tentativeG + heuristic(neighbor, goal, coords);

        openSet.add(neighbor);
      }
    }
  }

  return null;
}
