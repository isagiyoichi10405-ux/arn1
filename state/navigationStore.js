const state = {
  source: null,
  destination: null,
  path: []
};

export function setRoute(data) {
  Object.assign(state, data);
}

export function getRoute() {
  return structuredClone(state);
}
