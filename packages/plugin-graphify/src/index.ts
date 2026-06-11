import type { McpPlugin, PluginHostContext, RecallContext } from "my-local-storage-mcp/plugin-types";
import { resolveGraphPath } from "./discovery.js";
import { GraphStore } from "./graph-loader.js";
import { buildEnrichBlock, extractTermsFromRecall } from "./graph-query.js";
import {
  getGraphifyTools,
  handleGraphifyTool,
  parseGraphifyEnv,
  type GraphifyEnv
} from "./tools.js";

let store: GraphStore;
let cfg: GraphifyEnv = parseGraphifyEnv(process.env);
let hostRef: PluginHostContext | undefined;

const plugin: McpPlugin = {
  name: "graphify",

  async init(env: NodeJS.ProcessEnv, host?: PluginHostContext): Promise<boolean> {
    cfg = parseGraphifyEnv(env);
    hostRef = host;
    const reloadMs = parseInt(env.MCP_GRAPHIFY_RELOAD_CHECK_MS ?? "5000", 10);
    store = new GraphStore(reloadMs);

    const graphPath = resolveGraphPath(env);
    if (!graphPath) {
      console.error("[graphify-plugin] graph.json não encontrado; tools desabilitadas");
      return false;
    }

    try {
      const index = store.load(graphPath);
      console.error(
        `[graphify-plugin] grafo carregado: ${graphPath} (${index.nodeCount} nós, ${index.edgeCount} arestas)`
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[graphify-plugin] falha ao carregar grafo: ${msg}`);
      return false;
    }
  },

  getTools() {
    return getGraphifyTools();
  },

  async handleTool(name: string, args: Record<string, unknown>) {
    return handleGraphifyTool(name, args, store, cfg, hostRef);
  },

  async afterRecall(ctx: RecallContext): Promise<string | undefined> {
    if (process.env.MCP_GRAPHIFY_ENRICH_RECALL !== "1") return undefined;
    const index = store.getIndex();
    if (!index) return undefined;
    const terms = extractTermsFromRecall(ctx.recallText, ctx.query);
    const block = buildEnrichBlock(index, terms, cfg.maxNodes);
    return block || undefined;
  }
};

export default plugin;
