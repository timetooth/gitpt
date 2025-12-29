
function normalizeGraph(graphLike) {
  if (graphLike instanceof Map) return graphLike;
  if (!graphLike || typeof graphLike !== "object") return new Map();
  // Convert object payload from content script into a Map
  return new Map(
    Object.entries(graphLike).map(([key, value]) => [key, value || []])
  );
}

function dfs(node, graph, loc, x, y) {
  // graph and loc are maps, x,y is its location
  const children = graph.get(node) || [];
  loc.set(node, { x, y });

  let maxWidth = x;
  for (const child of children) {
    const childMaxWidth = dfs(child, graph, loc, x, y + 1);
    maxWidth = Math.max(maxWidth, childMaxWidth);
    x = maxWidth + 1;
  }
  return maxWidth;
}

function getLocs(root, graphLike) {
  const graph = normalizeGraph(graphLike);
  const loc = new Map();
  if (!graph.has(root)) return loc;
  dfs(root, graph, loc, 0, 0);
  return loc;
}

function dfsPath(nodeId, target, graph, path) {
  path.push(nodeId);
  if (nodeId === target) return true;

  for (const child of (graph.get(nodeId) || [])) {
    if (dfsPath(child, target, graph, path)) return true;
  }

  path.pop();
  return false;
}

function getPath(target, graph) {
  const path = [];
  return dfsPath("root", target, graph, path) ? path : null;
}

// const graph = new Map([ ["root", [1]],[1, [2]],[2, [3, 4, 5]],
//   [3, [6]],[4, [7]],[5, [8]],[6, [9, 10]],[7, []],[8, [11, 12, 13]],
//   [9, []],[10, []],[11, []],[12, []],[13, []] ]);
// const pathfinal = getPath(10, graph);
// console.log(pathfinal);

export { getLocs, getPath };