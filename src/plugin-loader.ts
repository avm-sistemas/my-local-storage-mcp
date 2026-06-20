import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import type { McpPlugin, PluginHostContext, ToolDefinition, McpToolResult } from "./plugin-types.js";

const PLUGIN_IMPORTS: Record<string, string[]> = {
  graphify: [
    "@avm/my-local-storage-mcp-graphify",
    "my-local-storage-mcp-graphify"
  ],
  teams: [
    "@avm/my-local-storage-mcp-teams",
    "my-local-storage-mcp-teams"
  ]
};

async function tryImport(moduleId: string): Promise<McpPlugin | null> {
  try {
    const mod = await import(moduleId);
    const plugin = (mod.default ?? mod.plugin) as McpPlugin | undefined;
    if (plugin && typeof plugin.init === "function") {
      return plugin;
    }
  } catch {
    // próximo candidato
  }
  return null;
}

async function loadPluginByName(name: string): Promise<McpPlugin | null> {
  const candidates = PLUGIN_IMPORTS[name] ?? [name];

  for (const moduleId of candidates) {
    const plugin = await tryImport(moduleId);
    if (plugin) return plugin;
  }

  if (name === "graphify") {
    const localPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../packages/plugin-graphify/dist/index.js"
    );
    const plugin = await tryImport(pathToFileURL(localPath).href);
    if (plugin) return plugin;
  }

  if (name === "teams") {
    const envPath = process.env.MCP_TEAMS_PLUGIN_PATH?.trim();
    if (envPath) {
      const plugin = await tryImport(pathToFileURL(envPath).href);
      if (plugin) return plugin;
    }
    const base = path.dirname(fileURLToPath(import.meta.url));
    const localCandidates = [
      path.join(base, "../../my-local-storage-mcp-teams/packages/plugin-teams/dist/index.js"),
      path.join(base, "../../../my-local-storage-mcp-teams/packages/plugin-teams/dist/index.js")
    ];
    for (const localPath of localCandidates) {
      const plugin = await tryImport(pathToFileURL(localPath).href);
      if (plugin) return plugin;
    }
  }

  console.error(`[plugin-loader] plugin '${name}' não encontrado (instale o pacote add-on ou omita de MCP_PLUGINS).`);
  return null;
}

export async function loadPlugins(
  env: NodeJS.ProcessEnv,
  host?: PluginHostContext
): Promise<McpPlugin[]> {
  const raw = env.MCP_PLUGINS?.trim();
  if (!raw) return [];

  const names = raw.split(",").map(n => n.trim()).filter(Boolean);
  const active: McpPlugin[] = [];

  for (const name of names) {
    const plugin = await loadPluginByName(name);
    if (!plugin) continue;

    try {
      const ok = await plugin.init(env, host);
      if (ok) {
        active.push(plugin);
        console.error(`[plugin-loader] plugin '${plugin.name}' ativo.`);
      } else {
        console.error(`[plugin-loader] plugin '${plugin.name}' inativo (init retornou false).`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[plugin-loader] falha ao iniciar '${name}': ${msg}`);
    }
  }

  return active;
}

export function getAllPluginTools(plugins: McpPlugin[]): ToolDefinition[] {
  return plugins.flatMap(p => p.getTools());
}

export async function dispatchPluginTool(
  plugins: McpPlugin[],
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResult | null> {
  for (const plugin of plugins) {
    const result = await plugin.handleTool(name, args);
    if (result) return result;
  }
  return null;
}
