import type { PluginHostContext, RecallFormat, ToolDefinition } from "my-local-storage-mcp/plugin-types";
import type { GraphStore } from "./graph-loader.js";
import {
  bfsNeighbors,
  buildEnrichBlock,
  extractTermsFromRecall,
  formatNodeLine,
  searchNodes
} from "./graph-query.js";

export interface GraphifyEnv {
  maxNeighbors: number;
  queryDepth: number;
  maxNodes: number;
}

export function parseGraphifyEnv(env: NodeJS.ProcessEnv): GraphifyEnv {
  return {
    maxNeighbors: parseInt(env.MCP_GRAPHIFY_MAX_NEIGHBORS ?? "5", 10),
    queryDepth:   parseInt(env.MCP_GRAPHIFY_QUERY_DEPTH ?? "2", 10),
    maxNodes:     parseInt(env.MCP_GRAPHIFY_MAX_NODES ?? "10", 10)
  };
}

export function getGraphifyTools(): ToolDefinition[] {
  return [
    {
      name: "graph_query",
      description: "Busca nós no grafo Graphify (graph.json) por termo em label, id ou type. Retorna subgrafo compacto.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca." },
          limit: { type: "number", description: "Máximo de nós. Padrão: MCP_GRAPHIFY_MAX_NODES." }
        },
        required: ["query"]
      }
    },
    {
      name: "graph_neighbors",
      description: "Vizinhos BFS a partir de um nó (id ou label) no grafo Graphify.",
      inputSchema: {
        type: "object",
        properties: {
          node:  { type: "string", description: "Id ou label do nó origem." },
          depth: { type: "number", description: "Profundidade BFS. Padrão: MCP_GRAPHIFY_QUERY_DEPTH." },
          limit: { type: "number", description: "Máximo de nós. Padrão: MCP_GRAPHIFY_MAX_NEIGHBORS." }
        },
        required: ["node"]
      }
    },
    {
      name: "recall_with_graph",
      description: "Recall da memória local + bloco compacto do grafo Graphify relacionado aos termos da busca.",
      inputSchema: {
        type: "object",
        properties: {
          query:       { type: "string", description: "Termo de busca na memória local." },
          type_filter: { type: "string", enum: ["all", "anchor", "detail"] },
          format:      { type: "string", enum: ["full", "compact"] },
          max_chars:   { type: "number" },
          limit:       { type: "number" }
        },
        required: ["query"]
      }
    }
  ];
}

function graphBlock(store: GraphStore, terms: string[], cfg: GraphifyEnv): string {
  const index = store.getIndex();
  if (!index) return "";
  const block = buildEnrichBlock(index, terms, cfg.maxNodes);
  return block || "Nenhum nó correspondente no grafo.";
}

export async function handleGraphifyTool(
  name: string,
  args: Record<string, unknown>,
  store: GraphStore,
  cfg: GraphifyEnv,
  host?: PluginHostContext
): Promise<{ content: { type: "text"; text: string }[] } | null> {
  const index = store.getIndex();
  if (!index) return null;

  if (name === "graph_query") {
    const query = String(args.query ?? "");
    const limit = Number(args.limit ?? cfg.maxNodes);
    const nodes = searchNodes(index, query, limit);
    if (nodes.length === 0) {
      return { content: [{ type: "text", text: "Nenhum nó encontrado no grafo." }] };
    }
    const text = nodes.map(n => formatNodeLine(n, index.adjacency.get(String(n.id)) ?? [])).join("\n");
    return { content: [{ type: "text", text }] };
  }

  if (name === "graph_neighbors") {
    const node = String(args.node ?? "");
    const depth = Number(args.depth ?? cfg.queryDepth);
    const limit = Number(args.limit ?? cfg.maxNeighbors);
    const result = bfsNeighbors(index, node, depth, limit);
    if (!result) {
      return { content: [{ type: "text", text: `Nó '${node}' não encontrado no grafo.` }] };
    }
    const lines = [
      `[origin] ${result.origin.label ?? result.origin.id}`,
      ...result.nodes.map(n => formatNodeLine(n, index.adjacency.get(String(n.id)) ?? []))
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  if (name === "recall_with_graph") {
    if (!host?.executeRecall) {
      return { content: [{ type: "text", text: "executeRecall indisponível no host." }] };
    }

    const query = String(args.query ?? "");
    const type_filter = String(args.type_filter ?? "all");
    const format = (args.format ?? "compact") as RecallFormat;
    const max_chars = args.max_chars as number | undefined;
    const limit = Number(args.limit ?? 10);
    const searchPattern = `%${query.toLowerCase().trim()}%`;

    const recallText = await host.executeRecall(
      "(topic LIKE ? OR keywords LIKE ? OR fact LIKE ?)",
      [searchPattern, searchPattern, searchPattern],
      { type_filter, format, max_chars, limit }
    );

    const terms = extractTermsFromRecall(recallText, query);
    const graph = graphBlock(store, terms, cfg);
    const text = `${recallText}\n\n--- [graphify] ---\n${graph}`;
    return { content: [{ type: "text", text }] };
  }

  return null;
}
