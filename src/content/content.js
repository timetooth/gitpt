import { getSibling, getNext, getCurrentContent, buildTree } from "./adj";

function get_articles() {
  const articles = document.querySelectorAll("article");

  if (!articles.length) {
    sendResponse({ error: "No articles found" });
    return;
  }

  const article = articles[0];

  const turnId = article.getAttribute("data-turn-id");
  const turnType = article.getAttribute("data-turn"); // "user" or "assistant"

  const prevButton = article.querySelector(
    'button[aria-label="Previous response"]'
  );
  const nextButton = article.querySelector(
    'button[aria-label="Next response"]'
  );

  const isPrevDisabled = !prevButton || prevButton.disabled;
  const isNextDisabled = !nextButton || nextButton.disabled;

  sendResponse({
    articleCount: articles.length,
    turnId,
    turnType,
    hasPrev: !!prevButton,
    hasNext: !!nextButton,
    isPrevDisabled,
    isNextDisabled
  });

  return;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_ARTICLE_COUNT") {
    const articles = document.querySelectorAll("article");
    
    sendResponse({ count: articles.length });
    return;
  }
  
  if (request.type === "GET_SIBLING") {
    (async () => {
      const nodeId = typeof request.nodeId === "string" ? request.nodeId.trim() : "";
      if (!nodeId) {
        sendResponse({ success: false, error: "nodeId is required" });
        return;
      }

      try {
        const child = getNext(nodeId);
        if (!child) {
          sendResponse({ success: false, error: `No child found for "${nodeId}".` });
          return;
        }

        const sibling = await getSibling(child, nodeId);
        sendResponse({
          success: true,
          siblingFound: !!sibling,
          siblingId: sibling?.getAttribute("data-turn-id") || null
        });
      } catch (err) {
        console.error("GET_SIBLING failed", err);
        sendResponse({ success: false, error: err?.message || "Failed to get sibling." });
      }
    })();
    return true; // keep the message channel open for async work
  }

  if (request.type === "GET_CURRENT_CONTENT") {
    try {
      const nodeId = typeof request.nodeId === "string" ? request.nodeId.trim() : null;
      const content = getCurrentContent(nodeId || null);
      sendResponse({ success: true, content });
    } catch (err) {
      console.error("GET_CURRENT_CONTENT failed", err);
      sendResponse({ success: false, error: err?.message || "Failed to get current content." });
    }
    return;
  }

  if (request.type === "LOG_ARTICLE_TEXTS") {
    const articles = document.querySelectorAll("article");
    articles.forEach((article, index) => {
      const text = (article.innerText || "").trim();
      console.log(`[Article ${index + 1}] ${text}`);
    });
    sendResponse({ success: true, count: articles.length });
    return;
  }

  if (request.type === "GET_PARAGRAPH_COUNT") {
    const paragraphs = document.querySelectorAll("p");
    sendResponse({ count: paragraphs.length });
  }

  if (request.type === "BUILD_TREE") {
    try {
      const graph = buildTree();
      console.log("buildTree graph:", graph);
      sendResponse({ success: true, nodeCount: graph.size });
    } catch (err) {
      console.error("BUILD_TREE failed", err);
      sendResponse({ success: false, error: err?.message || "Failed to build tree." });
    }
    return;
  }
});
