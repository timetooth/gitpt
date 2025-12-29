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
  const [treeMessage, setTreeMessage] = useState("");
  
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
        Hardcoded Sigma graph with straight and curved edges using single-sided arrows.
      </p>
      <GraphDemo />

      <hr style={{ margin: "16px 0" }} />

      <h3>Article Tools</h3>
      <p style={{ marginTop: 6, color: "#4b5563" }}>
        Run the tree builder to inspect logging output in the console.
      </p>
      <button onClick={handleBuildTree} style={{ marginTop: 8 }}>
        Build tree (logs to console)
      </button>
      {treeMessage && <p>{treeMessage}</p>}
    </div>
  );
}
