import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { marked } from "marked";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "site");
const readmePath = path.join(root, "README.md");
const cname = "my-local-storage-mcp.avmsistemas.net";
const pagesUrl = `https://${cname}/`;

execSync("node scripts/write-readmes.mjs", { cwd: root, stdio: "inherit" });

const md = fs.readFileSync(readmePath, "utf8");
const body = marked.parse(md, { gfm: true });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Local Storage MCP Server</title>
  <meta name="description" content="MCP server for persistent local memory (SQLite). Store and recall business rules and domain knowledge for Cursor and other MCP clients.">
  <link rel="canonical" href="${pagesUrl}">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
  <style>
    body { background: #fff; }
    .markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }
    @media (max-width: 767px) {
      .markdown-body { padding: 15px; }
    }
    .markdown-body img { max-width: 100%; height: auto; }
    .markdown-body details { margin: 1em 0; }
  </style>
</head>
<body>
  <article class="markdown-body">
${body}
  </article>
</body>
</html>
`;

fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, "index.html"), html, "utf8");
fs.writeFileSync(path.join(siteDir, ".nojekyll"), "", "utf8");
fs.writeFileSync(path.join(siteDir, "CNAME"), cname + "\n", "utf8");

console.log("OK", { siteDir, pagesUrl, cname, bytes: fs.statSync(path.join(siteDir, "index.html")).size });
