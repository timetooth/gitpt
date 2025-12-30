import { useState } from "react";
import GraphDemo from "./GraphDemo";
import { MultiGraph } from "graphology";
import { VscGitMerge } from "react-icons/vsc";
import { VscSettings } from "react-icons/vsc";
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
            lastError.message?.includes("Receiving end does not exist") ||
            lastError.message?.includes("The message port closed before a response was received");

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
    const baseLabel =
      nodeId === "root"
        ? "GitPT"
        : typeof contents?.content === "string"
          ? contents.content.substring(10)
          : "";
    graphologyGraph.addNode(nodeId, {
      x: loc.x + xOffset,
      y: -loc.y,
      size: 6,
      label: "", // hide by default; actual text stored separately for hover
      hoverLabel: baseLabel,
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
  const [navMessage, setNavMessage] = useState("");
  const [graphologyGraph, setGraphologyGraph] = useState(getGraphologyGraph());
  
  const surfaceStyle = {
    padding: 2,
    width: 380,
    maxWidth: 440,
    background: "linear-gradient(180deg, #fdfdff 0%, #f4f6fb 100%)",
    borderRadius: 14,
    boxShadow: "0 10px 35px rgba(15, 23, 42, 0.08)",
    color: "#1f2937",
    fontFamily: "Poppins, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const sectionStyle = {
    background: "#ffffff",
    borderRadius: 12,
    padding: 8,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.04)",
  };

  const titleRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  };

  const labelStyle = {
    margin: 0,
    fontSize: 14,
    letterSpacing: 0.25,
    textTransform: "uppercase",
    color: "#475569",
  };

  const labelContentStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const hintStyle = { margin: 0, fontSize: 12, color: "#6b7280", textAlign: "right" };

  const buttonRowStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  };

  const baseButtonStyle = {
    flex: 1,
    minWidth: 100,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
    transform: "translateY(0)",
  };

  const buttonHover = { transform: "translateY(-1px)", boxShadow: "0 6px 14px rgba(15, 23, 42, 0.12)" };
  const primaryButtonStyle = { background: "linear-gradient(135deg, #111827, #1f2937)", color: "#f9fafb", border: "1px solid #0f172a" };
  const quietButtonStyle = { background: "#f8fafc", color: "#0f172a" };
  const dangerButtonStyle = { background: "#fff3f3", color: "#b91c1c", border: "1px solid #fecdd3" };

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
      `buildTree ran. Nodes: ${payload.nodeCount ?? "unknown"}, meta entries: ${payload.metaCount ?? "unknown"}.`
    );
  };

  const handleLoadCachedTree = async () => {
    setTreeMessage("");
    const res = await sendMessageToActiveTab({ type: "LOAD_TREE" });
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
      setTreeMessage(payload.error || "Failed to load cached tree.");
      return;
    }

    const { graph, meta } = payload;
    setGraphologyGraph(getGraphologyGraph(graph, meta));
    setTreeMessage("Loaded cached tree.");
  };

  const handleClearCache = async () => {
    setTreeMessage("");
    setGraphologyGraph(getGraphologyGraph()); // reset to empty graph

    const res = await sendMessageToActiveTab({ type: "CLEAR_TREE" });
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
      setTreeMessage(payload.error || "Failed to clear cached tree.");
      return;
    }

    setTreeMessage("Cleared cached tree for this page.");
  };

  const handleNodeClick = async (nodeId) => {
    if (!nodeId) return;
    setNavMessage(`Navigating to ${nodeId}...`);
    const res = await sendMessageToActiveTab({ type: "GO_TO_NODE", targetId: nodeId });
    if (res?.error) {
      setNavMessage(res.error);
      return;
    }

    const payload = res?.data;
    if (!payload) {
      setNavMessage("No response from content script.");
      return;
    }

    if (!payload.success) {
      setNavMessage(payload.error || "Failed to navigate.");
      return;
    }

    setNavMessage(`Moved to ${nodeId}`);
  };

  return (
    <div style={surfaceStyle}>
      <div style={sectionStyle}>
        <div style={titleRowStyle}>
          <h3 style={labelStyle}>
            <span style={labelContentStyle}>
              <VscSettings style={{ fontSize: 18 }} />
              Build Tree
            </span>
          </h3>
          <p style={hintStyle}>Refresh or reuse the cached map.</p>
        </div>
        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={handleBuildTree}
            style={{ ...baseButtonStyle, ...primaryButtonStyle }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, baseButtonStyle, primaryButtonStyle)}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLoadCachedTree}
            style={{ ...baseButtonStyle, ...quietButtonStyle }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, baseButtonStyle, quietButtonStyle)}
          >
            Load
          </button>
          <button
            type="button"
            onClick={handleClearCache}
            style={{ ...baseButtonStyle, ...dangerButtonStyle }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, baseButtonStyle, dangerButtonStyle)}
          >
            Clear
          </button>
        </div>
        {treeMessage && <p style={{ margin: "8px 0 0", color: "#334155", fontSize: 13 }}>{treeMessage}</p>}
      </div>

      <div style={sectionStyle}>
        <div style={titleRowStyle}>
          <h3 style={labelStyle}>
            <span style={labelContentStyle}>
              <VscGitMerge style={{ fontSize: 18 }} />
              Conversation Flow
            </span>
          </h3>
          <p style={hintStyle}>Tap a node to jump back.</p>
        </div>
        <GraphDemo graph={graphologyGraph} onNodeClick={handleNodeClick} />
        {navMessage && <p style={{ marginTop: 10, color: "#475569", fontSize: 13 }}>{navMessage}</p>}
      </div>
    </div>
  );
}
