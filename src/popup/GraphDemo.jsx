import { useEffect, useRef } from "react";
import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";

export default function GraphDemo({ graph, onNodeClick, onNodeDoubleClick }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return undefined;

    // Recreate the renderer whenever the graph instance changes so Sigma sees updates.
    const renderer = new Sigma(graph, containerRef.current, {
      allowInvalidContainer: true,
      defaultEdgeType: "straightArrow",
      renderEdgeLabels: true,
      edgeProgramClasses: {
        straightArrow: EdgeArrowProgram,
        curvedArrow: EdgeCurvedArrowProgram,
      },
    });
    rendererRef.current = renderer;

    return () => {
      renderer.kill();
      rendererRef.current = null;
    };
  }, [graph]);

  useEffect(() => {
    if (!graph) return;
    graph.forEachEdge((edge, attrs) => {
      const curved = Boolean(attrs.curved);
      graph.setEdgeAttribute(edge, "type", `${curved ? "curved" : "straight"}Arrow`);
    });
  }, [graph]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !graph) return undefined;

    const showLabel = ({ node }) => {
      const label = graph.getNodeAttribute(node, "hoverLabel") || "";
      graph.setNodeAttribute(node, "label", label);
    };
    const hideLabel = ({ node }) => {
      graph.setNodeAttribute(node, "label", "");
    };
    const handleClick = ({ node }) => onNodeClick?.(node);
    const handleDoubleClick = ({ node, event, preventSigmaDefault }) => {
      preventSigmaDefault?.();
      const baseLabel = graph.getNodeAttribute(node, "baseLabel") || "";
      const specialLabel = graph.getNodeAttribute(node, "specialLabel") || "";
      onNodeDoubleClick?.({ node, baseLabel, specialLabel });
    };

    renderer.on("enterNode", showLabel);
    renderer.on("leaveNode", hideLabel);
    renderer.on("clickNode", handleClick);
    renderer.on("doubleClickNode", handleDoubleClick);

    return () => {
      renderer.off?.("enterNode", showLabel);
      renderer.off?.("leaveNode", hideLabel);
      renderer.off?.("clickNode", handleClick);
      renderer.off?.("doubleClickNode", handleDoubleClick);
      renderer.removeListener?.("enterNode", showLabel);
      renderer.removeListener?.("leaveNode", hideLabel);
      renderer.removeListener?.("clickNode", handleClick);
      renderer.removeListener?.("doubleClickNode", handleDoubleClick);
    };
  }, [graph, onNodeClick, onNodeDoubleClick]);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 300,
          borderRadius: 10,
          border: "1px solid #d9d9d9",
          background: "#fafafa",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
        }}
      />
    </div>
  );
}
