import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "packages", "plugin-graphify", "fixtures", "minimal-graph.json");
const serverJs = path.join(root, "dist", "index.js");

const transport = new StdioClientTransport({
  command: "node",
  args: [serverJs],
  env: {
    ...process.env,
    MCP_PLUGINS: "graphify",
    MCP_GRAPHIFY_GRAPH_JSON: fixture
  }
});

const client = new Client({ name: "graphify-test", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map(t => t.name);
console.log("tools:", names.join(", "));

const expected = ["remember_fact", "recall_facts", "recall_by_topic", "graph_query", "graph_neighbors", "recall_with_graph"];
const missing = expected.filter(n => !names.includes(n));
if (missing.length) {
  console.error("FAIL: tools ausentes:", missing.join(", "));
  process.exit(1);
}

const q1 = await client.callTool({ name: "graph_query", arguments: { query: "touchAccess" } });
console.log("graph_query:", q1.content?.[0]?.text?.slice(0, 120));

const q2 = await client.callTool({ name: "graph_neighbors", arguments: { node: "executeRecall", depth: 1 } });
console.log("graph_neighbors:", q2.content?.[0]?.text?.slice(0, 120));

const q3 = await client.callTool({ name: "recall_with_graph", arguments: { query: "mcp-evolucao", format: "compact", limit: 2 } });
const rwg = String(q3.content?.[0]?.text ?? "");
console.log("recall_with_graph has graphify block:", rwg.includes("--- [graphify] ---"));

await client.close();
console.log("OK: graphify plugin e2e");
