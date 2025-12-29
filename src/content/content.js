import { getSibling, getNext, getCurrentContent, buildTree, goToNode } from "./adj";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "BUILD_TREE") {
    (async () => {
      try {
        const { graph, meta } = await buildTree();
        const graphObj = Object.fromEntries(Array.from(graph.entries()));
        const metaObj = Object.fromEntries(Array.from(meta.entries()));
        sendResponse({
          success: true,
          nodeCount: graph.size,
          metaCount: meta.size,
          graph: graphObj,
          meta: metaObj
        });
      } catch (err) {
        console.error("BUILD_TREE failed", err);
        sendResponse({ success: false, error: err?.message || "Failed to build tree." });
      }
    })();
    return true; // keep channel open for async work
  }

  else if (request.type === "GO_TO_NODE") {
    (async () => {
      try {
        const targetId = request?.targetId;
        if (!targetId) {
          sendResponse({ success: false, error: "No target id provided." });
          return;
        }

        const { graph } = await buildTree();
        const path = await goToNode(targetId, graph);
        if (!path) {
          sendResponse({ success: false, error: "Target id not found in tree." });
          return;
        }

        sendResponse({
          success: true,
          path,
        });
      } catch (err) {
        console.error("GO_TO_NODE failed", err);
        sendResponse({ success: false, error: err?.message || "Failed to go to node." });
      }
    })();
    return true; // keep channel open for async work
  }
});
