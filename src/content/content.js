import { getSibling, getNext, getCurrentContent, buildTree } from "./adj";

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
});
