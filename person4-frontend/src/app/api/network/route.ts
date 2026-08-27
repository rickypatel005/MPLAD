import type { NetworkEdge, NetworkNode, NetworkNodeDetail, NetworkResponse } from '@/types/api';
import { HHI_CONCENTRATION_THRESHOLD, getDataset } from '@/mocks/dataset';
import { json, searchParamsOf, simulateLatency } from '@/mocks/http';
import { readNumber, readString } from '@/mocks/query';

/**
 * GET /api/network — the agency ↔ constituency graph.
 *
 * The graph is bipartite: implementing agencies on one side, constituencies on the other,
 * an edge for every work one implements for the other, weighted by how many. That shape is
 * the finding. An agency drawing one thick edge and no others is doing nearly all its work
 * for a single member, which is what the concentration index measures numerically and what
 * this screen shows in a form a reviewer can take in at a glance.
 *
 * `focus` returns a two-hop neighbourhood rather than the whole graph. Two hops is the
 * audit question: from an agency, out to the constituencies it serves, then out to the
 * other agencies those constituencies also use. One hop answers "who does this agency work
 * for"; two answers "and is anyone else doing this work" — which is the question that
 * distinguishes a specialist from a captured relationship.
 *
 * The legend maxima are recomputed over whatever subgraph is returned, because the client
 * scales node radius and edge width against them. Sending the full graph's maxima with a
 * filtered subgraph would draw every remaining edge hairline-thin.
 */

export const dynamic = 'force-dynamic';

/** Hard ceiling on returned nodes, whatever `limit` asks for — D3 has to lay these out. */
const MAX_NODES = 240;
const DEFAULT_HOPS = 2;

export async function GET(request: Request): Promise<Response> {
  await simulateLatency();

  const params = searchParamsOf(request);
  const dataset = getDataset();
  const { network } = dataset;

  const stateId = readString(params, 'state');
  const focus = readString(params, 'focus');
  const minWeight = readNumber(params, 'min_weight');
  const limit = Math.min(MAX_NODES, Math.max(1, Math.floor(readNumber(params, 'limit') ?? MAX_NODES)));

  const untouched =
    stateId === undefined && focus === undefined && minWeight === undefined && limit >= MAX_NODES;

  let nodes: NetworkNode[] = network.nodes;
  let edges: NetworkEdge[] = network.edges;

  if (!untouched) {
    // The focus node survives every filter below. A deep link that resolved to an empty
    // canvas because the node fell outside a state filter would be worse than no filter.
    const pinned = new Set<string>(focus !== undefined && network.nodeIds.has(focus) ? [focus] : []);

    if (stateId !== undefined) {
      const keep = new Set(
        nodes.filter((n) => n.state_id === stateId || pinned.has(n.id)).map((n) => n.id),
      );
      nodes = nodes.filter((n) => keep.has(n.id));
      edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    }

    if (minWeight !== undefined) {
      edges = edges.filter((e) => e.weight >= minWeight || pinned.has(e.source) || pinned.has(e.target));
      const connected = new Set<string>(pinned);
      for (const e of edges) {
        connected.add(e.source);
        connected.add(e.target);
      }
      nodes = nodes.filter((n) => connected.has(n.id));
    }

    if (pinned.size > 0 && focus !== undefined) {
      const reachable = withinHops(focus, edges, DEFAULT_HOPS);
      nodes = nodes.filter((n) => reachable.has(n.id));
      edges = edges.filter((e) => reachable.has(e.source) && reachable.has(e.target));
    }

    if (nodes.length > limit) {
      // Trimmed by portfolio size, not at random: the nodes worth keeping are the ones
      // carrying the most works. Ties break on id so a reload draws the same graph.
      const keep = new Set(
        [...nodes]
          .sort(
            (a, b) =>
              Number(pinned.has(b.id)) - Number(pinned.has(a.id)) ||
              (b.project_count ?? 0) - (a.project_count ?? 0) ||
              a.id.localeCompare(b.id),
          )
          .slice(0, limit)
          .map((n) => n.id),
      );
      nodes = nodes.filter((n) => keep.has(n.id));
      edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    }
  }

  const returned = new Set(nodes.map((n) => n.id));
  const nodeDetails: NetworkNodeDetail[] = untouched
    ? network.nodeDetails
    : network.nodeDetails.filter((d) => returned.has(d.node_id));

  const body: NetworkResponse = {
    nodes,
    edges,
    node_details: nodeDetails,
    legend: {
      max_edge_weight: untouched
        ? network.maxEdgeWeight
        : edges.reduce((max, e) => Math.max(max, e.weight), 0),
      max_project_count: untouched
        ? network.maxProjectCount
        : nodes.reduce((max, n) => Math.max(max, n.project_count ?? 0), 0),
      hhi_concentration_threshold: HHI_CONCENTRATION_THRESHOLD,
    },
  };

  return json(body);
}

/**
 * Breadth-first walk out from a node, `hops` levels deep.
 *
 * Adjacency is rebuilt per request rather than cached: the graph holds a few hundred
 * edges, so the walk costs less than the JSON serialisation of its result, and a cached
 * adjacency map would have to be invalidated against the filters applied above it.
 */
function withinHops(start: string, edges: readonly NetworkEdge[], hops: number): Set<string> {
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const edge of edges) {
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }

  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let depth = 0; depth < hops; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of adjacency.get(id) ?? []) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return seen;
}
