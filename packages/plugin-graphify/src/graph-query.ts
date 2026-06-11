import type { GraphIndex, GraphNode, IndexedEdge } from "./graph-types.js";

export function resolveNode(index: GraphIndex, ref: string): GraphNode | null {
  const byId = index.byId.get(ref);
  if (byId) return byId;

  const matches = index.byLabel.get(ref.toLowerCase());
  return matches?.[0] ?? null;
}

export function searchNodes(index: GraphIndex, query: string, limit: number): GraphNode[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: GraphNode[] = [];
  const seen = new Set<string>();

  for (const node of index.byId.values()) {
    const id = String(node.id);
    if (seen.has(id)) continue;

    const label = String(node.label ?? "").toLowerCase();
    const type = String(node.type ?? "").toLowerCase();
    if (id.toLowerCase().includes(q) || label.includes(q) || type.includes(q)) {
      results.push(node);
      seen.add(id);
      if (results.length >= limit) break;
    }
  }

  return results;
}

export function bfsNeighbors(
  index: GraphIndex,
  ref: string,
  depth: number,
  limit: number
): { origin: GraphNode; nodes: GraphNode[]; edges: IndexedEdge[] } | null {
  const origin = resolveNode(index, ref);
  if (!origin) return null;

  const originId = String(origin.id);
  const visited = new Set<string>([originId]);
  const nodes: GraphNode[] = [];
  const edges: IndexedEdge[] = [];
  let frontier = [originId];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const nodeEdges = index.adjacency.get(nodeId) ?? [];
      for (const edge of nodeEdges) {
        if (nodes.length >= limit) break;
        edges.push(edge);
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          const n = index.byId.get(edge.target);
          if (n) {
            nodes.push(n);
            next.push(edge.target);
          }
        }
      }
    }
    frontier = next;
    if (nodes.length >= limit) break;
  }

  return { origin, nodes: nodes.slice(0, limit), edges };
}

export function formatNodeLine(node: GraphNode, edges: IndexedEdge[]): string {
  const id = String(node.id);
  const label = String(node.label ?? id);
  const type = String(node.type ?? "node");
  const nodeEdges = edges.filter(e => e.direction === "out");
  const lines = [`[graph] ${label} (${type}) | id: ${id}`];
  for (const edge of nodeEdges.slice(0, 5)) {
    const arrow = edge.direction === "out" ? "\u2192" : "\u2190";
    lines.push(`  ${arrow} ${edge.type ?? "LINK"} ${edge.target}`);
  }
  return lines.join("\n");
}

export function buildEnrichBlock(
  index: GraphIndex,
  terms: string[],
  maxNodes: number
): string {
  const blocks: string[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const matches = searchNodes(index, term, maxNodes);
    for (const node of matches) {
      const id = String(node.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const edges = index.adjacency.get(id) ?? [];
      blocks.push(formatNodeLine(node, edges));
      if (blocks.length >= maxNodes) break;
    }
    if (blocks.length >= maxNodes) break;
  }

  return blocks.join("\n");
}

export function extractTermsFromRecall(recallText: string, query: string): string[] {
  const terms = new Set<string>();
  const add = (t: string) => {
    const s = t.trim();
    if (s.length >= 3) terms.add(s);
  };

  add(query);
  for (const token of query.split(/[\s,|]+/)) add(token);

  const labelMatches = recallText.match(/\b[A-Z][A-Za-z0-9_]{2,}\b/g) ?? [];
  for (const m of labelMatches.slice(0, 5)) add(m);

  return [...terms].slice(0, 8);
}
