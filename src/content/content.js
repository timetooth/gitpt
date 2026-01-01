import { getSibling, getNext, getCurrentContent, buildTree, goToNode } from "./adj";

function getConversationIdFromLocation() {
  try {
    const url = new URL(window.location.href);
    const match = url.pathname.match(/\/c\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch (err) {
    console.warn("Unable to parse chat id from URL", err);
    return null;
  }
}

function getCacheKeyForPage() {
  try {
    const url = new URL(window.location.href);
    // Use origin + path so different threads/conversations stay separate.
    return `cachedTree:${url.origin}${url.pathname}`;
  } catch (err) {
    console.warn("Unable to compute cache key from URL", err);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "BUILD_TREE") {
    (async () => {
      try {
        const { graph, meta } = await buildTree();
        const graphObj = Object.fromEntries(Array.from(graph.entries()));
        const metaObj = Object.fromEntries(Array.from(meta.entries()));
        const responsePayload = {
          success: true,
          nodeCount: graph.size,
          metaCount: meta.size,
          graph: graphObj,
          meta: metaObj,
          cached: false,
        };

        const cacheKey = getCacheKeyForPage();
        responsePayload.cacheKey = cacheKey;
        if (!cacheKey) {
          responsePayload.cacheError = "Could not compute cache key for this page.";
          sendResponse(responsePayload);
          return;
        }

        chrome.storage.local.set(
          { [cacheKey]: { graph: graphObj, meta: metaObj, cachedAt: Date.now(), url: window.location.href } },
          () => {
            const storageErr = chrome.runtime.lastError;
            if (storageErr) {
              console.warn("BUILD_TREE cache save failed", storageErr);
              responsePayload.cacheError = storageErr.message;
            } else {
              responsePayload.cached = true;
              responsePayload.cacheKey = cacheKey;
            }
            sendResponse(responsePayload);
          }
        );
      } catch (err) {
        console.error("BUILD_TREE failed", err);
        sendResponse({ success: false, error: err?.message || "Failed to build tree." });
      }
    })();
    return true; // keep channel open for async work
  }

  else if (request.type === "LOAD_TREE") {
    try {
      const cacheKey = getCacheKeyForPage();
      if (!cacheKey) {
        sendResponse({ success: false, error: "Could not compute cache key for this page." });
        return true;
      }

      chrome.storage.local.get([cacheKey], (res) => {
        const storageErr = chrome.runtime.lastError;
        if (storageErr) {
          sendResponse({ success: false, error: storageErr.message || "Failed to load cached tree." });
          return;
        }

        const cached = res?.[cacheKey];
        if (!cached?.graph || !cached?.meta) {
          sendResponse({ success: false, error: "No cached tree found for this page." });
          return;
        }

        sendResponse({ success: true, graph: cached.graph, meta: cached.meta, cachedAt: cached.cachedAt, cacheKey });
      });
    } catch (err) {
      console.error("LOAD_TREE failed", err);
      sendResponse({ success: false, error: err?.message || "Failed to load cached tree." });
    }
    return true; // keep channel open for async work
  }

  else if (request.type === "CLEAR_TREE") {
    try {
      const cacheKey = getCacheKeyForPage();
      if (!cacheKey) {
        sendResponse({ success: false, error: "Could not compute cache key for this page." });
        return true;
      }

      chrome.storage.local.remove([cacheKey], () => {
        const storageErr = chrome.runtime.lastError;
        if (storageErr) {
          sendResponse({ success: false, error: storageErr.message || "Failed to clear cached tree." });
          return;
        }
        sendResponse({ success: true, cacheKey });
      });
    } catch (err) {
      console.error("CLEAR_TREE failed", err);
      sendResponse({ success: false, error: err?.message || "Failed to clear cached tree." });
    }
    return true; // keep channel open for async work
  }

  else if (request.type === "ADD_PROMPT") {
    (async () => {
      try {
        const ok = setPromptOnPage(request.prompt);
        if (!ok) {
          sendResponse({ ok: false, error: "Could not find the prompt input on this page." });
          return;
        }
        sendResponse({ ok: true });
      } catch (err) {
        console.error("Failed to insert prompt", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
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
  else if (request.type === "GET_CURRENT_CHAT") {
    try {
      const id = getConversationIdFromLocation();
      const url = window.location.href;
      if (!id) {
        sendResponse({ success: false, error: "Not on a chat conversation page." });
        return;
      }

      sendResponse({
        success: true,
        chatId: id,
        url,
        title: document.title || "Current chat",
      });
    } catch (err) {
      console.error("GET_CURRENT_CHAT failed", err);
      sendResponse({ success: false, error: err?.message || "Failed to read current chat." });
    }
  }
});

function setPromptOnPage(prompt) {
  if (!prompt) return false;

  const editable =
    document.querySelector("div#prompt-textarea[contenteditable='true']") ||
    document.querySelector("div.ProseMirror[contenteditable='true']");

  if (editable) {
    editable.focus({ preventScroll: true });
    editable.innerHTML = "";

    const paragraph = document.createElement("p");
    paragraph.textContent = prompt;
    const trailingBreak = document.createElement("br");
    trailingBreak.className = "ProseMirror-trailingBreak";
    paragraph.appendChild(trailingBreak);
    editable.appendChild(paragraph);

    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const inputEvent = new InputEvent("input", {
      data: prompt,
      inputType: "insertText",
      bubbles: true,
      cancelable: true,
    });
    editable.dispatchEvent(inputEvent);
    return true;
  }

  const fallback = document.querySelector("textarea[name='prompt-textarea']");
  if (fallback) {
    fallback.focus({ preventScroll: true });
    fallback.value = prompt;
    fallback.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  return false;
}
