import { useState } from "react";
import GraphDemo from "./GraphDemo";

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

export default function Popup() {
  const [siblingNodeId, setSiblingNodeId] = useState("");
  const [siblingMessage, setSiblingMessage] = useState("");
  const [treeMessage, setTreeMessage] = useState("");
  const [currentNodeId, setCurrentNodeId] = useState("");
  const [currentContentMessage, setCurrentContentMessage] = useState("");

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

  const handleGetCurrentContent = async () => {
    setCurrentContentMessage("");
    const nodeId = currentNodeId.trim();

    const res = await sendMessageToActiveTab({
      type: "GET_CURRENT_CONTENT",
      nodeId
    });

    if (res?.error) {
      setCurrentContentMessage(res.error);
      return;
    }

    const payload = res?.data;
    if (!payload) {
      setCurrentContentMessage("No response from content script.");
      return;
    }

    if (!payload.success) {
      setCurrentContentMessage(payload.error || "Failed to get content.");
      return;
    }

    const content =
      typeof payload.content === "string" && payload.content.trim().length > 0
        ? payload.content.trim()
        : "(empty)";
    setCurrentContentMessage(content);
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

    setTreeMessage(
      `buildTree ran. Nodes: ${payload.nodeCount ?? "unknown"}, meta entries: ${payload.metaCount ?? "unknown"}. Check console for details.`
    );
  };

  return (
    <div style={{ padding: 12, width: 380, maxWidth: 440 }}>
      <h3 style={{ marginBottom: 6 }}>Graph demo</h3>
      <p style={{ marginTop: 0, color: "#4b5563" }}>
        Hardcoded Sigma graph with straight, curved, and double arrows. Use the selector to toggle arrow heads.
      </p>
      <GraphDemo />

      <hr style={{ margin: "16px 0" }} />

      <h3>Article Tools</h3>

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

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <input
          type="text"
          value={currentNodeId}
          onChange={(e) => setCurrentNodeId(e.target.value)}
          placeholder="Node id (blank = first)"
          style={{ flex: 1 }}
        />
        <button onClick={handleGetCurrentContent}>Get content</button>
      </div>
      {currentContentMessage && (
        <textarea
          readOnly
          value={currentContentMessage}
          style={{ width: "100%", minHeight: 80, marginTop: 6 }}
        />
      )}

      <button onClick={handleBuildTree} style={{ marginTop: 12 }}>
        Build tree (logs to console)
      </button>
      {treeMessage && <p>{treeMessage}</p>}
    </div>
  );
}
