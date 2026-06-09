import fs from "fs";
import path from "path";

const MAX_LEVELS = 50;

function graphJsonInDir(dir: string): string | null {
  const candidate = path.join(dir, "graphify-out", "graph.json");
  return fs.existsSync(candidate) ? candidate : null;
}

export function resolveGraphPath(env: NodeJS.ProcessEnv, cwd = process.cwd()): string | null {
  const explicit = env.MCP_GRAPHIFY_GRAPH_JSON?.trim();
  if (explicit) {
    const resolved = path.resolve(explicit);
    return fs.existsSync(resolved) ? resolved : null;
  }

  let current = path.resolve(cwd);
  for (let i = 0; i < MAX_LEVELS; i++) {
    const inCwd = graphJsonInDir(current);
    if (inCwd) return inCwd;

    const hasGit = fs.existsSync(path.join(current, ".git"));
    if (hasGit) {
      const atRoot = graphJsonInDir(current);
      if (atRoot) return atRoot;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}
