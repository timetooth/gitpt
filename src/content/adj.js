// we canmake article class for validations etc.
// Hide away the article loading etc. part

const ARTICLE_SEL = 'article[data-turn-id]';
const PREV_SEL = 'button[aria-label="Previous response"]';

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
    nextBtn = article.querySelector('button[aria-label="Next response"]');
    return nextBtn !== null && !nextBtn.disabled;
}

function getSibling(article, parent_id = null) {
    article_id = article.getAttribute("data-turn-id");
    if (!hasSibling(article)) {
        return null;
    }
    nextBtn = article.querySelector('button[aria-label="Next response"]');
    nextBtn.click();
    // After clicking, the next article should be the sibling
    let sibling = getNext(parent_id);
    return sibling;
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

function dfs(node_id, graph) {
    // node is turn-id of the article

    let child = getNext(node_id); // child is the next article
    if (child === null) {
        return;
    }

    resetNext(node_id);

    while (getNext(node_id)) {
        child_id = child.getAttribute("data-turn-id");
        addEdge(graph, node_id, child.getAttribute("data-turn-id"));
        dfs(child.getAttribute("data-turn-id"), graph);
        child = getSibling(child, node_id);
    }
}

function buildTree() {
    let graph = new Map();
    root_id = "root";
    dfs(root_id, graph);
    return graph;
}

export { getNext, hasSibling, getSibling, buildTree, resetNext };