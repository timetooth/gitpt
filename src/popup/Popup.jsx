import { useState } from "react";
import GraphDemo from "./GraphDemo";
import { MultiGraph } from "graphology";
import { getLocs } from "./graph";

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

  if (!graph) return graphologyGraph;

  const THREAD_COLORS = ["#ae80fc", "#63b6fe", "#ffb347", "#6bd28c", "#f57ba2"];
  const xOffset = -0.6; // nudge everything left so the main thread starts slightly offset
  const graphMap = graph instanceof Map ? graph : new Map(Object.entries(graph));
  const metaMap = meta instanceof Map ? meta : new Map(Object.entries(meta || {}));

  // need 2 algos
  // one for location of edges -> based on dfs
  // one for color of edges -> based on x value

  const locs = getLocs("root", graphMap);
  const pickColor = (nodeId) => {
    const loc = locs.get(nodeId);
    if (!loc) return THREAD_COLORS[0];
    const idx = Math.abs(Math.round(loc.x)) % THREAD_COLORS.length;
    return THREAD_COLORS[idx];
  };

  // Graph data
  // Node: {id, x, y, size, label, color}
  // Edge: {id, src-id, tgt-id, size, color, curved}

  for (let [nodeId, contents] of metaMap.entries()) {
    const loc = locs.get(nodeId);
    if (!loc) continue;
    graphologyGraph.addNode(nodeId, {
      x: loc.x + xOffset,
      y: -loc.y,
      size: 6,
      label: "", // hide by default; actual text stored separately for hover
      hoverLabel: contents?.content.substring(10) ?? "",
      color: pickColor(nodeId),
    });
  }

  for (let [src, children] of graphMap.entries()) {
    for (let tgt of children) {
      const srcLoc = locs.get(src);
      const tgtLoc = locs.get(tgt);
      if (!srcLoc || !tgtLoc) continue;
      const isCurved = srcLoc.x !== tgtLoc.x;
      // Color edges by the child so transitions into a thread pick up that thread's color.
      const color = pickColor(tgt);
      graphologyGraph.addEdge(src.toString(), tgt.toString(), {
        size: 3,
        color,
        curved: isCurved,
      });
    }
  }

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
