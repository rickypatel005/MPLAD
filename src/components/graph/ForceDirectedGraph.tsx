'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

import type { NetworkEdge, NetworkGraphData, NetworkNode } from '@/types/api';
import { RISK_LEVEL_META, riskLevelFromScore } from '@/lib/risk';

interface ForceDirectedGraphProps {
  data: NetworkGraphData;
  focusedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
}

interface D3Node extends d3.SimulationNodeDatum, NetworkNode {
  x?: number;
  y?: number;
}

interface D3Edge extends d3.SimulationLinkDatum<D3Node> {
  weight: number;
}

const NODE_TYPE_FILL: Record<string, string> = {
  MP: '#f59e0b',
  DISTRICT: '#10b981',
};

export function ForceDirectedGraph({ data, focusedNodeId, onSelectNode }: ForceDirectedGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return;

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes: D3Node[] = data.nodes.map((n) => ({ ...n }));
    const edges: D3Edge[] = data.edges.map((e) => ({ ...e }));

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom as any);

    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Edge>(edges).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35));

    const link = g.append('g')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke-width', (d) => Math.max(1, Math.min(6, d.weight / 4)));

    const node = g.append('g')
      .selectAll<SVGGElement, D3Node>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => onSelectNode(d.id));

    node.append('circle')
      .attr('r', (d) => {
        const base = d.type === 'IA' ? 16 : d.type === 'MP' ? 14 : 12;
        return base + Math.min(10, (d.project_count ?? 1) / 5);
      })
      .attr('fill', (d) => {
        if (d.type !== 'IA') return NODE_TYPE_FILL[d.type] ?? '#6366f1';
        return RISK_LEVEL_META[riskLevelFromScore(d.risk ?? 0)].hex;
      })
      .attr('stroke', (d) => (d.id === focusedNodeId ? '#000' : '#fff'))
      .attr('stroke-width', (d) => (d.id === focusedNodeId ? 3.5 : 2));

    node.append('text')
      .text((d) => d.label)
      .attr('x', 0)
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1e293b')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none');

    node.call(
      d3.drag<SVGGElement, D3Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    if (focusedNodeId) {
      const target = nodes.find((n) => n.id === focusedNodeId);
      if (target) {
        setTimeout(() => {
          if (target.x != null && target.y != null) {
            const scale = 1.2;
            const t = d3.zoomIdentity
              .translate(width / 2 - target.x * scale, height / 2 - target.y * scale)
              .scale(scale);
            svg.transition().duration(750).call(zoom.transform as any, t);
          }
        }, 500);
      }
    }

    return () => { simulation.stop(); };
  }, [data, focusedNodeId, onSelectNode]);

  return (
    <div ref={containerRef} className="relative h-[650px] w-full rounded-card border border-line bg-surface overflow-hidden shadow-flat">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
