import { useState } from "react";

function getContentScriptFiles() {
  const manifest = chrome.runtime.getManifest();
  const contentScripts = manifest?.content_scripts || [];
  const files = contentScripts.flatMap((entry) => entry.js || []);
  return Array.from(new Set(files));
}

function sendMessageToActiveTab(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        resolve({ error: "No active tab found." });
        return;
      }

      const send = (allowInject) => {
        chrome.tabs.sendMessage(tabId, message, (res) => {
          const lastError = chrome.runtime.lastError;
          if (!lastError) {
            resolve({ data: res });
            return;
          }

          const missingReceiver =
            lastError.message?.includes("Could not establish connection") ||
            lastError.message?.includes("Receiving end does not exist");

          if (!allowInject || !missingReceiver) {
            console.warn("Message failed:", lastError);
            resolve({ error: lastError.message });
            return;
          }

          const files = getContentScriptFiles();
          if (!files.length) {
            resolve({ error: lastError.message });
            return;
          }

          chrome.scripting.executeScript(
            { target: { tabId, allFrames: true }, files },
            () => {
              const injectError = chrome.runtime.lastError;
              if (injectError) {
                console.warn("Content script inject failed:", injectError);
                resolve({ error: injectError.message });
                return;
              }
              send(false);
            }
          );
        });
      };

      send(true);
    });
  });
}

function countArticlesWithScripting() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        resolve({ error: "No active tab found." });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          func: () => document.querySelectorAll("article").length,
        },
        (injections) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.warn("Scripting injection failed:", lastError);
            resolve({ error: lastError.message });
            return;
          }

          if (!injections?.length) {
            resolve({ error: "No accessible frames to count articles." });
            return;
          }

          const total = injections.reduce((sum, injection) => {
            return typeof injection?.result === "number" ? sum + injection.result : sum;
          }, 0);

          resolve({ count: total });
        }
      );
    });
  });
}

function logArticlesWithScripting() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        resolve({ error: "No active tab found." });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          func: () => {
            const articles = Array.from(document.querySelectorAll("article"));
            articles.forEach((article, index) => {
              const text = (article.innerText || "").trim();
              console.log(`[Article ${index + 1}] ${text}`);
            });
            return articles.length;
          },
        },
        (injections) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.warn("Log injection failed:", lastError);
            resolve({ error: lastError.message });
            return;
          }

          if (!injections?.length) {
            resolve({ error: "No accessible frames to log articles." });
            return;
          }

          const total = injections.reduce((sum, injection) => {
            return typeof injection?.result === "number" ? sum + injection.result : sum;
          }, 0);

          resolve({ count: total });
        }
      );
    });
  });
}

export default function Popup() {
  const [articleCount, setArticleCount] = useState(null);
  const [logMessage, setLogMessage] = useState("");
  const [siblingNodeId, setSiblingNodeId] = useState("");
  const [siblingMessage, setSiblingMessage] = useState("");
  const [treeMessage, setTreeMessage] = useState("");

  const handleCountArticles = async () => {
    setLogMessage("");
    const res = await sendMessageToActiveTab({ type: "GET_ARTICLE_COUNT" });
    if (typeof res?.data?.count === "number") {
      setArticleCount(res.data.count);
      return;
    }

    const fallbackCount = await countArticlesWithScripting();
    if (typeof fallbackCount?.count === "number") {
      setArticleCount(fallbackCount.count);
      return;
    }

    setArticleCount(0);
    setLogMessage(
      fallbackCount?.error || res?.error || "Could not read articles on this page. Check site access or reload."
    );
  };

  const handleLogArticles = async () => {
    setLogMessage("");
    const res = await sendMessageToActiveTab({ type: "LOG_ARTICLE_TEXTS" });
    if (typeof res?.data?.count === "number") {
      setLogMessage(
        `Printed ${res.data.count} article${res.data.count === 1 ? "" : "s"} to the console.`
      );
      return;
    }

    const fallback = await logArticlesWithScripting();
    if (typeof fallback?.count === "number") {
      setLogMessage(
        `Printed ${fallback.count} article${fallback.count === 1 ? "" : "s"} to the console.`
      );
      return;
    }

    setLogMessage(
      fallback?.error || res?.error || "Could not read articles on this page."
    );
  };

  const handleGetSibling = async () => {
    setSiblingMessage("");
    const nodeId = siblingNodeId.trim();
    if (!nodeId) {
      setSiblingMessage("Enter a node id first.");
      return;
    }

    const res = await sendMessageToActiveTab({ type: "GET_SIBLING", nodeId });
    if (res?.error) {
      setSiblingMessage(res.error);
      return;
    }

    const payload = res?.data;
    if (!payload) {
      setSiblingMessage("No response from content script.");
      return;
    }

    if (!payload.success) {
      setSiblingMessage(payload.error || "Could not get sibling.");
      return;
    }

    if (payload.siblingFound && payload.siblingId) {
      setSiblingMessage(`Sibling found: ${payload.siblingId}`);
      return;
    }

    setSiblingMessage("No sibling found.");
  };

  const handleBuildTree = async () => {
    setTreeMessage("");
    const res = await sendMessageToActiveTab({ type: "BUILD_TREE" });
    if (res?.error) {
      setTreeMessage(res.error);
      return;
    }

    const payload = res?.data;
    if (!payload) {
      setTreeMessage("No response from content script.");
      return;
    }

    if (!payload.success) {
      setTreeMessage(payload.error || "Failed to build tree.");
      return;
    }

    setTreeMessage(`buildTree ran. Nodes: ${payload.nodeCount ?? "unknown"}. Check console for graph.`);
  };

  return (
    <div style={{ padding: 12, width: 240 }}>
      <h3>Article Tools</h3>

      <button onClick={handleCountArticles} style={{ marginBottom: 8 }}>
        Count article tags
      </button>
      <p>
        {articleCount === null
          ? "Click the button to count <article> tags on the page."
          : `Article tags found: ${articleCount}`}
      </p>

      <button onClick={handleLogArticles} style={{ marginBottom: 8 }}>
        Log article text to console
      </button>
      {logMessage && <p>{logMessage}</p>}

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <input
          type="text"
          value={siblingNodeId}
          onChange={(e) => setSiblingNodeId(e.target.value)}
          placeholder="Enter node id"
          style={{ flex: 1 }}
        />
        <button onClick={handleGetSibling}>Get sibling</button>
      </div>
      {siblingMessage && <p>{siblingMessage}</p>}

      <button onClick={handleBuildTree} style={{ marginTop: 12 }}>
        Build tree (logs to console)
      </button>
      {treeMessage && <p>{treeMessage}</p>}
    </div>
  );
}
