import { useState } from "react";
import GraphDemo from "./GraphDemo";
import { MultiGraph } from "graphology";

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

function getGraphologyGraph(graph = null, meta = null) {
    const graphologyGraph = new MultiGraph();

    // Graph data
    // Node: {id, x, y, size, label, color}
    // Edge: {id, src-id, tgt-id, size, color, curved}

    graphologyGraph.addNode("a", { x: 0, y: 0, size: 5, label: Math.random().toString(36).substring(2, 7), color: "#8843ffff" });
    graphologyGraph.addNode("b", { x: 1, y: -1, size: 5, label: "Bastian" });
    graphologyGraph.addNode("c", { x: 3, y: -2, size: 5, label: "Charles" });
    graphologyGraph.addNode("d", { x: 1, y: -3, size: 5, label: "Dorothea" });
    graphologyGraph.addNode("e", { x: 3, y: -4, size: 5, label: "Ernestine" });
    graphologyGraph.addNode("f", { x: 4, y: -5, size: 5, label: "Fabian" });

    graphologyGraph.addEdge("a", "b", { size: 3, color: "#ff4343ff", curved: true });
    graphologyGraph.addEdge("b", "c", { size: 3 });
    graphologyGraph.addEdge("b", "d", { size: 3 });
    graphologyGraph.addEdge("c", "b", { size: 3 });
    graphologyGraph.addEdge("c", "e", { size: 3 });
    graphologyGraph.addEdge("d", "c", { size: 3 });
    graphologyGraph.addEdge("d", "e", { size: 3 });
    graphologyGraph.addEdge("e", "d", { size: 3 });
    graphologyGraph.addEdge("f", "e", { size: 3 });

    return graphologyGraph;
}

export default function Popup() {
  const [treeMessage, setTreeMessage] = useState("");
  const [graphologyGraph, setGraphologyGraph] = useState(getGraphologyGraph());
  
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
    // destructure everything from payload
    const { success, nodeCount, metaCount, graph, meta } = payload;
    console.log("BUILD_TREE success:", graph);
    console.log("BUILD meta success:", meta);
    setGraphologyGraph(getGraphologyGraph(graph, meta));

    setTreeMessage(
      `buildTree ran. Nodes: ${payload.nodeCount ?? "unknown"}, meta entries: ${payload.metaCount ?? "unknown"}. Check console for details.`
    );
  };

  return (
    <div style={{ padding: 12, width: 380, maxWidth: 440 }}>

      {/* Build Tree Button */}
      <h3>Build Tree Button</h3>
      <button onClick={handleBuildTree} style={{ marginTop: 8 }}>
        Build tree button
      </button>
      {treeMessage && <p>{treeMessage}</p>}

      <hr style={{ margin: "16px 0" }} />

      {/* Demo Graph */}
      <h3 style={{ marginBottom: 6 }}>Graph demo</h3>
      <p style={{ marginTop: 0, color: "#4b5563" }}>
        Hardcoded Sigma graph using single-sided arrows.
      </p>
      <GraphDemo graph={graphologyGraph} />

    </div>
  );
}
