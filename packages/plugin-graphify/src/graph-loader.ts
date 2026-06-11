import fs from "fs";
import type { GraphData, GraphIndex, GraphLink, GraphNode, IndexedEdge } from "./graph-types.js";

function linkEndpoint(value: string | GraphNode): string {
  return typeof value === "string" ? value : String(value.id);
}

export function parseGraphJson(raw: string): GraphData {
  const data = JSON.parse(raw) as GraphData;
  if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    throw new Error("graph.json inválido: nodes/links ausentes");
  }
  return data;
}

export function buildIndex(data: GraphData): GraphIndex {
  const byId = new Map<string, GraphNode>();
  const byLabel = new Map<string, GraphNode[]>();
  const adjacency = new Map<string, IndexedEdge[]>();

  for (const node of data.nodes) {
    const id = String(node.id);
    byId.set(id, node);
    const labelKey = String(node.label ?? id).toLowerCase();
    const bucket = byLabel.get(labelKey) ?? [];
    bucket.push(node);
    byLabel.set(labelKey, bucket);
    if (!adjacency.has(id)) adjacency.set(id, []);
  }

  for (const link of data.links) {
    const source = linkEndpoint(link.source as string | GraphNode);
    const target = linkEndpoint(link.target as string | GraphNode);
    const edgeType = link.type;

    const outList = adjacency.get(source) ?? [];
    outList.push({ target, type: edgeType, direction: "out" });
    adjacency.set(source, outList);

    const inList = adjacency.get(target) ?? [];
    inList.push({ target: source, type: edgeType, direction: "in" });
    adjacency.set(target, inList);
  }

  return {
    byId,
    byLabel,
    adjacency,
    nodeCount: data.nodes.length,
    edgeCount: data.links.length
  };
}

export class GraphStore {
  private graphPath: string | null = null;
  private index: GraphIndex | null = null;
  private lastMtime = 0;
  private lastCheck = 0;
  private reloadCheckMs: number;

  constructor(reloadCheckMs = 5000) {
    this.reloadCheckMs = reloadCheckMs;
  }

  get path(): string | null {
    return this.graphPath;
  }

  get loaded(): boolean {
    return this.index !== null;
  }

  load(graphPath: string): GraphIndex {
    const raw = fs.readFileSync(graphPath, "utf8");
    const data = parseGraphJson(raw);
    this.graphPath = graphPath;
    this.index = buildIndex(data);
    this.lastMtime = fs.statSync(graphPath).mtimeMs;
    return this.index;
  }

  maybeReload(): GraphIndex | null {
    if (!this.graphPath || !this.index) return null;

    const now = Date.now();
    if (now - this.lastCheck < this.reloadCheckMs) return this.index;
    this.lastCheck = now;

    const mtime = fs.statSync(this.graphPath).mtimeMs;
    if (mtime !== this.lastMtime) {
      this.load(this.graphPath);
      console.error("[graphify-plugin] grafo recarregado (mtime alterado)");
    }

    return this.index;
  }

  getIndex(): GraphIndex | null {
    return this.maybeReload();
  }
}
