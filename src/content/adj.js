// we canmake article class for validations etc.
// Hide away the article loading etc. part

const ARTICLE_SEL = 'article[data-turn-id]';
const PREV_SEL = 'button[aria-label="Previous response"]';
const NEXT_SEL = 'button[aria-label="Next response"]';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForChildTurnChange(parentId, beforeChildId, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const child = getNext(parentId);
    const nowId = child?.getAttribute("data-turn-id") ?? null;
    if (nowId !== beforeChildId) return child;
    await sleep(50);
  }
  throw new Error("Timeout waiting for child turn to change");
}

function getCurrent(node_id) {
    // Return the article with the given node_id
    let articles = Array.from(document.querySelectorAll("article"));
    if (articles.length === 0 || node_id === "root") {
        return null;
    }
    if (node_id === null) {
        return articles[0];
    }

    let index = articles.findIndex(
        (article) => article.getAttribute("data-turn-id") === node_id
    );
    if (index === -1) {
        return null;
    }
    return articles[index];
}

function getCurrentContent(node_id) {
    // Return the article with the given node_id
    let articles = Array.from(document.querySelectorAll("article"));
    if (articles.length === 0 || node_id === "root") {
        return "GitPT";
    }
    if (node_id === null) {
        return articles[0].innerText.trim();
    }

    let index = articles.findIndex(
        (article) => article.getAttribute("data-turn-id") === node_id
    );
    if (index === -1) {
        return "GitPT";
    }
    return articles[index].innerText.trim();
}

function getNext(node_id) {
    // Return the next article after the article with the given node_id
    let articles = Array.from(document.querySelectorAll("article"));
    if (articles.length === 0) {
        return null;
    }
    if (node_id === null || node_id === "root") {
        return articles[0];
    }

    let index = articles.findIndex(
        (article) => article.getAttribute("data-turn-id") === node_id
    );
    if (index === -1 || index === articles.length - 2 || index === articles.length - 1) {
        return null;
    }
    return articles[index + 2];
}

function hasSibling(article) {
    const nextBtn = article.querySelector(NEXT_SEL);
    return nextBtn !== null && !nextBtn.disabled;
}

async function getSibling(article, parent_id) {
  if (!hasSibling(article)) return null;

  const before = getNext(parent_id);
  const beforeId = before?.getAttribute("data-turn-id") ?? null;

  const nextBtn = article.querySelector(NEXT_SEL);
  if (!nextBtn || nextBtn.disabled) return null;

  nextBtn.click();
  await waitForChildTurnChange(parent_id, beforeId);

  return getNext(parent_id);
}

async function resetNext(node_id) {
  let child = getNext(node_id);
  if (!child) return;

  while (true) {
    // Important: reacquire child + prev button fresh each loop (no stale refs)
    child = getNext(node_id);
    if (!child) return;

    const prevBtn = child.querySelector(PREV_SEL);
    if (!prevBtn || prevBtn.disabled) return;

    const beforeChildId = child.getAttribute("data-turn-id");
    prevBtn.click();

    // wait for UI to actually switch
    await waitForChildTurnChange(node_id, beforeChildId);
  }
}

function addEdge(graph, u, v) {
  if (!graph.has(u)) graph.set(u, []);
  graph.get(u).push(v);
}

function addMeta(meta, id, article) {
  if (!id || meta.has(id)) return;
  const content = (article?.innerText || "").trim();
  const turn = article?.getAttribute?.("data-turn") || null;
  meta.set(id, { content, turn });
}

async function dfs(node_id, graph, meta, seen = new Set()) {
  // Avoid infinite recursion / reprocessing the same node
  if (seen.has(node_id)) return;
  seen.add(node_id);

  // Reset the variant carousel for the child (so we start from first)
  await resetNext(node_id);

  let child = getNext(node_id);
  if (!child) return;

  // This set is only for enumerating all sibling-variants at this parent
  const siblingsVisited = new Set();

  while (child) {
    const child_id = child.getAttribute("data-turn-id");
    if (!child_id) break;

    // stop if we loop back to a previously seen sibling variant
    if (siblingsVisited.has(child_id)) break;
    siblingsVisited.add(child_id);

    addEdge(graph, node_id, child_id);
    addMeta(meta, child_id, child);

    // recurse down the visible child
    await dfs(child_id, graph, meta, seen);

    // move to next sibling variant
    if (!hasSibling(child)) break;
    child = await getSibling(child, node_id);
  }
}

async function buildTree() {
  const graph = new Map();
  const meta = new Map();
  const root_id = "root";
  meta.set(root_id, { content: "GitPT", turn: null });
  await dfs(root_id, graph, meta);
  return { graph, meta };
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

async function scrollToArticle(nodeId, timeoutMs = 2000) {
  if (!nodeId) return;
  if (nodeId === "root") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const article = getCurrent(nodeId);
    if (article) {
      article.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    await sleep(50);
  }
}

async function goToDfs(path) {
  if (!path || path.length <= 1) return; // need at least [current, next]

  const nodeId = path.shift();       // current
  const nextId = path[0];            // desired child

  await resetNext(nodeId);

  let nextNode = getNext(nodeId);
  if (!nextNode) return;

  while (nextNode.getAttribute("data-turn-id") !== nextId) {
    if (!hasSibling(nextNode)) return; // can't move to more variants
    nextNode = await getSibling(nextNode, nodeId);
    if (!nextNode) return;
  }

  // now UI is aligned at nodeId -> nextId, continue down
  await goToDfs(path);
}

async function goToNode(targetId, graph) {
  const path = getPath(targetId, graph);
  if (!path) return null;

  // Ensure path starts with root
  if (path[0] !== "root") path.unshift("root");

  await goToDfs(path);
  await scrollToArticle(targetId);
  return path; // optional: return the traversed path
}

export { getNext, hasSibling, getSibling, getCurrentContent, buildTree, resetNext, goToNode };
