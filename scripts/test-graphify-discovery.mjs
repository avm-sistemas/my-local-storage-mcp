import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const discoveryUrl = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "plugin-graphify", "dist", "discovery.js")
).href;

const { resolveGraphPath } = await import(discoveryUrl);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "graphify-disc-"));
const repo = path.join(tmp, "repo");
const sub = path.join(repo, "src", "deep");
fs.mkdirSync(sub, { recursive: true });
fs.mkdirSync(path.join(repo, "graphify-out"), { recursive: true });
fs.writeFileSync(path.join(repo, "graphify-out", "graph.json"), "{}");
fs.writeFileSync(path.join(repo, ".git"), "gitdir: fake");

const found = resolveGraphPath({}, sub);
const expected = path.join(repo, "graphify-out", "graph.json");

if (found !== expected) {
  console.error("FAIL discovery A2");
  console.error("expected:", expected);
  console.error("got:", found);
  process.exit(1);
}

const none = resolveGraphPath({}, tmp);
if (none !== null) {
  console.error("FAIL: deveria retornar null sem grafo");
  process.exit(1);
}

console.log("OK: discovery A2");
