import { useEffect, useRef, useState } from "react";
import EdgeCurveProgram, { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { MultiGraph } from "graphology";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";

export default function GraphDemo() {
  const containerRef = useRef(null);
  const [graph, setGraph] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const demoGraph = new MultiGraph();

    demoGraph.addNode("a", { x: 0, y: 0, size: 5, label: "Alexandra", color: "#8843ffff" });
    demoGraph.addNode("b", { x: 1, y: -1, size: 5, label: "Bastian" });
    demoGraph.addNode("c", { x: 3, y: -2, size: 5, label: "Charles" });
    demoGraph.addNode("d", { x: 1, y: -3, size: 5, label: "Dorothea" });
    demoGraph.addNode("e", { x: 3, y: -4, size: 5, label: "Ernestine" });
    demoGraph.addNode("f", { x: 4, y: -5, size: 5, label: "Fabian" });

    demoGraph.addEdge("a", "b", { size: 3, color: "#ff4343ff", curved: true });
    demoGraph.addEdge("b", "c", { size: 3 });
    demoGraph.addEdge("b", "d", { size: 3 });
    demoGraph.addEdge("c", "b", { size: 3 });
    demoGraph.addEdge("c", "e", { size: 3 });
    demoGraph.addEdge("d", "c", { size: 3 });
    demoGraph.addEdge("d", "e", { size: 3 });
    demoGraph.addEdge("e", "d", { size: 3 });
    demoGraph.addEdge("f", "e", { size: 3 });

    const renderer = new Sigma(demoGraph, containerRef.current, {
      allowInvalidContainer: true,
      defaultEdgeType: "straightArrow",
      renderEdgeLabels: true,
      edgeProgramClasses: {
        straightArrow: EdgeArrowProgram,
        curvedArrow: EdgeCurvedArrowProgram,
      },
    });

    setGraph(demoGraph);

    return () => {
      renderer.kill();
      setGraph(null);
    };
  }, []);

  useEffect(() => {
    if (!graph) return;
    graph.forEachEdge((edge, attrs) => {
      const curved = Boolean(attrs.curved);
      graph.setEdgeAttribute(edge, "type", `${curved ? "curved" : "straight"}Arrow`);
    });
  }, [graph]);

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
