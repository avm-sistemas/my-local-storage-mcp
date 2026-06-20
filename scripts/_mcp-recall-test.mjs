import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import os from "os";

const dbPath = path.join(os.homedir(), ".local_mcp_learning.db");
const db = await open({ filename: dbPath, driver: sqlite3.Database });

const before = await db.all(
  "SELECT id, access_count, last_accessed FROM local_learning WHERE topic = 'mcp-evolucao' ORDER BY id"
);

const transport = new StdioClientTransport({
  command: "node",
  args: ["C:\\Projetos\\_avmesquita\\my-repos\\my-local-storage-mcp\\dist\\index.js"],
  env: process.env
});

const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(transport);

const result = await client.callTool({
  name: "recall_facts",
  arguments: { query: "mcp-evolucao", limit: 10 }
});

await client.close();

const after = await db.all(
  "SELECT id, access_count, last_accessed FROM local_learning WHERE topic = 'mcp-evolucao' ORDER BY id"
);

console.log(JSON.stringify({
  toolOk: !result.isError,
  rowsReturned: String(result.content?.[0]?.text || "").split("---").length,
  before,
  after
}, null, 2));

await db.close();
