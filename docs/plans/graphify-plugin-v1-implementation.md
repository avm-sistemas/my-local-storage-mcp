# Graphify Plugin v1 ? Plano de ImplementaÃ§Ã£o

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar add-on `@avm/my-local-storage-mcp-graphify` que enriquece o MCP core com consultas ao `graph.json` do Graphify, ativado por env, com auto-discovery A2 e zero regressÃ£o sem plugin.

**Architecture:** Interface `McpPlugin` no core + loader dinÃ¢mico; pacote separado implementa loader de NetworkX node-link JSON, Ã­ndice em memÃ³ria e 3 tools MCP. Core delega tools desconhecidas aos plugins e chama `afterRecall` opcionalmente.

**Tech Stack:** Node.js 20+, TypeScript, ESM, `@modelcontextprotocol/sdk`, sem dependÃªncias Python.

**Versioning:** core `1.5.0` (minor, compatÃ­vel com 1.4.x) + plugin `@avm/my-local-storage-mcp-graphify@1.0.0` (primeiro add-on estÃ¡vel). Reservar core `2.0.0` para breaking changes reais. Ver spec Â§0.

**Spec:** [docs/specs/graphify-plugin-v1.md](../specs/graphify-plugin-v1.md)

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/plugin-types.ts` | Interface `McpPlugin`, tipos compartilhados |
| `src/plugin-loader.ts` | Parse `MCP_PLUGINS`, import dinÃ¢mico, agregaÃ§Ã£o |
| `src/index.ts` | Integrar loader em ListTools/CallTool; exportar `executeRecall` para plugin |
| `packages/plugin-graphify/package.json` | Pacote add-on |
| `packages/plugin-graphify/src/graph-loader.ts` | Leitura JSON + mtime |
| `packages/plugin-graphify/src/graph-index.ts` | Mapas byId, byLabel, adjacency |
| `packages/plugin-graphify/src/graph-query.ts` | BFS, busca por termo, formataÃ§Ã£o compacta |
| `packages/plugin-graphify/src/discovery.ts` | Auto-discovery A2 |
| `packages/plugin-graphify/src/tools.ts` | Schemas + handlers das 3 tools |
| `packages/plugin-graphify/src/index.ts` | `McpPlugin` default export |
| `scripts/test-graphify-plugin.mjs` | Teste manual com graph.json fixture |
| `packages/plugin-graphify/fixtures/minimal-graph.json` | Grafo mÃ­nimo para testes |

---

## Task 1: Tipos e loader no core

**Files:**
- Create: `src/plugin-types.ts`
- Create: `src/plugin-loader.ts`

- [ ] **Step 1:** Criar `plugin-types.ts` com `McpPlugin`, `ToolDefinition`, `RecallContext` conforme spec Â§7.

- [ ] **Step 2:** Criar `plugin-loader.ts` com:
  - `loadPlugins(env): Promise<McpPlugin[]>`
  - parse `MCP_PLUGINS` (split `,`, trim, ignorar vazio)
  - import dinÃ¢mico `graphify` ? `@avm/my-local-storage-mcp-graphify`, catch ? log stderr
  - `init()` em cada plugin; manter sÃ³ os que retornam `true`
  - `getAllPluginTools(plugins)` agregador
  - `dispatchPluginTool(plugins, name, args)` delegador

- [ ] **Step 3:** Build ? `npm run build` deve passar (arquivos ainda nÃ£o importados no index).

---

## Task 2: Integrar loader no `index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1:** No topo de `main()`, apÃ³s `initDb()`:
  ```ts
  const plugins = await loadPlugins(process.env);
  ```

- [ ] **Step 2:** Em `ListToolsRequestSchema`, concatenar `plugins.flatMap(p => p.getTools())` ao array existente.

- [ ] **Step 3:** Em `CallToolRequestSchema`, antes do `throw` final:
  - tentar `dispatchPluginTool(plugins, name, args)`
  - se retornar resultado, devolver

- [ ] **Step 4:** Em handlers `recall_facts` e `recall_by_topic`, apÃ³s `executeRecall`:
  ```ts
  let text = await executeRecall(...);
  for (const p of plugins) {
    const extra = await p.afterRecall?.({ query, recallText: text, format });
    if (extra) text += "\n\n--- [graphify] ---\n" + extra;
  }
  ```
  (Apenas plugins que implementam `afterRecall`; hoje sÃ³ graphify.)

- [ ] **Step 5:** Exportar `executeRecall` via refactor mÃ­nimo se `recall_with_graph` precisar importar do core ? alternativa: passar callback no `init` do plugin. **Preferir:** export nomeado em `src/recall.ts` extraÃ­do de `index.ts` (split pequeno, ~30 linhas) para evitar acoplamento circular.

- [ ] **Step 6:** `npm run build` + smoke: servidor sobe sem `MCP_PLUGINS`.

---

## Task 3: Pacote `plugin-graphify` ? scaffold

**Files:**
- Create: `packages/plugin-graphify/package.json`
- Create: `packages/plugin-graphify/tsconfig.json`
- Create: `packages/plugin-graphify/src/index.ts` (stub)

- [ ] **Step 1:** `package.json` do plugin:
  - `name`: `@avm/my-local-storage-mcp-graphify`
  - `version`: `1.0.0`
  - `type`: `module`
  - `main` / `exports`: `./dist/index.js`
  - `peerDependency`: `my-local-storage-mcp` (opcional, range `>=1.5.0`)
  - `files`: `["dist"]`
  - scripts: `build`, `prepare`

- [ ] **Step 2:** `tsconfig.json` com `outDir: dist`, `rootDir: src`, mesmo target do core.

- [ ] **Step 3:** Stub `index.ts` exportando objeto que implementa `McpPlugin` (retorna `false` em `init`).

- [ ] **Step 4:** Adicionar workspace no root `package.json` (opcional mas recomendado):
  ```json
  "workspaces": ["packages/*"]
  ```

- [ ] **Step 5:** `npm run build` no plugin.

---

## Task 4: Auto-discovery A2

**Files:**
- Create: `packages/plugin-graphify/src/discovery.ts`
- Test: `packages/plugin-graphify/fixtures/minimal-graph.json`

- [ ] **Step 1:** Implementar `resolveGraphPath(env, cwd): string | null`:
  - path explÃ­cito `MCP_GRAPHIFY_GRAPH_JSON`
  - loop A2 conforme spec Â§6
  - limite 50 nÃ­veis

- [ ] **Step 2:** Teste manual em `scripts/test-graphify-discovery.mjs`:
  - criar Ã¡rvore temp com `.git` + `graphify-out/graph.json`
  - `cwd` em subpasta ? deve achar
  - sem `.git` e sem json ? `null`

- [ ] **Step 3:** Rodar script; confirmar paths corretos.

---

## Task 5: Graph loader e Ã­ndice

**Files:**
- Create: `packages/plugin-graphify/src/graph-loader.ts`
- Create: `packages/plugin-graphify/src/graph-index.ts`
- Create: `packages/plugin-graphify/fixtures/minimal-graph.json`

- [ ] **Step 1:** Fixture mÃ­nima (3 nÃ³s, 2 arestas, labels conhecidos).

- [ ] **Step 2:** `loadGraph(path): GraphData` ? parse JSON, validar `nodes`/`links`.

- [ ] **Step 3:** `buildIndex(data): GraphIndex` ? `byId`, `byLabel` (lowercase), `adjacency` bidirecional para inbound.

- [ ] **Step 4:** `GraphStore` classe com:
  - `load(path)`
  - `maybeReload()` ? checa mtime + `MCP_GRAPHIFY_RELOAD_CHECK_MS`
  - getters para Ã­ndice

- [ ] **Step 5:** Teste manual: carregar fixture, assert contagens.

---

## Task 6: Graph query e formataÃ§Ã£o

**Files:**
- Create: `packages/plugin-graphify/src/graph-query.ts`

- [ ] **Step 1:** `searchNodes(index, query, limit)` ? match em label/id/type (case-insensitive, includes).

- [ ] **Step 2:** `bfsNeighbors(index, nodeRef, depth, limit)` ? BFS com teto.

- [ ] **Step 3:** `formatNodeCompact(node, edges)` ? 1 linha por nÃ³ + arestas resumidas.

- [ ] **Step 4:** `buildEnrichBlock(terms, index, env)` ? usado por `afterRecall` e `recall_with_graph`.

- [ ] **Step 5:** Teste manual com fixture: query `"User"` retorna nÃ³ esperado.

---

## Task 7: Tools MCP do plugin

**Files:**
- Create: `packages/plugin-graphify/src/tools.ts`
- Modify: `packages/plugin-graphify/src/index.ts`

- [ ] **Step 1:** Definir schemas JSON das 3 tools (spec Â§8).

- [ ] **Step 2:** Handlers:
  - `graph_query`
  - `graph_neighbors`
  - `recall_with_graph` ? **requer** acesso a `executeRecall` do core via injeÃ§Ã£o no `init`:
    ```ts
    init(env, { executeRecall }) { ... }
    ```
    Ajustar `McpPlugin.init` em `plugin-types.ts` para aceitar `PluginHostContext` opcional com `executeRecall`.

- [ ] **Step 3:** `index.ts` do plugin ? wiring completo; `getTools()`, `handleTool()`, `afterRecall()`.

- [ ] **Step 4:** Build plugin + core.

---

## Task 8: Teste integrado end-to-end

**Files:**
- Create: `scripts/test-graphify-plugin.mjs`

- [ ] **Step 1:** Script stdio MCP (padrÃ£o `_mcp-recall-test.mjs`):
  - env `MCP_PLUGINS=graphify`
  - env `MCP_GRAPHIFY_GRAPH_JSON=<fixture>`
  - chamar `graph_query`, `graph_neighbors`, `recall_with_graph`

- [ ] **Step 2:** Teste auto-discovery A2 com repo real (se `graphify-out/` existir) ou temp dir.

- [ ] **Step 3:** Confirmar:
  - tools listadas
  - respostas nÃ£o vazias
  - `recall_with_graph` incrementa `access_count` no banco (query SQL antes/depois)

- [ ] **Step 4:** Teste regressÃ£o: sem `MCP_PLUGINS`, apenas 3 tools core.

---

## Task 9: DocumentaÃ§Ã£o e versÃ£o

**Files:**
- Modify: `package.json` (core ? `1.5.0`)
- Modify: `scripts/write-readmes.mjs` (seÃ§Ã£o plugin Graphify)
- Modify: `README.md` via script

- [ ] **Step 1:** Bump core para `1.5.0` (minor ? plugin loader opt-in; compatÃ­vel com 1.4.x; ver spec Â§0).

- [ ] **Step 1b:** Bump plugin para `1.0.0` (primeiro add-on estÃ¡vel do ecossistema).

- [ ] **Step 2:** Adicionar ao README (PT + EN):
  - o que Ã© o plugin
  - instalaÃ§Ã£o separada
  - env vars
  - auto-discovery A2
  - fluxo recall ? recall_with_graph
  - link para spec

- [ ] **Step 3:** Regenerar README: `node scripts/write-readmes.mjs`.

- [ ] **Step 4:** `remember_fact` opcional com tÃ³pico `mcp-evolucao` registrando decisÃ£o do plugin (somente se usuÃ¡rio pedir checkpoint).

---

## Task 10: PublicaÃ§Ã£o (quando usuÃ¡rio autorizar)

- [ ] Publicar `my-local-storage-mcp@1.5.0` (core ? changelog: plugin architecture, sem breaking).
- [ ] Publicar `@avm/my-local-storage-mcp-graphify@1.0.0` (add-on ? requer scope `@avm` ou nome alternativo disponÃ­vel).
- [ ] Tags git: `v1.5.0` (core) + `plugin-graphify-v1.0.0` (ou monorepo tag Ãºnica documentada no release notes).

---

## Ordem de execuÃ§Ã£o recomendada

```
Task 1 ? 2 ? 3 ? 4 ? 5 ? 6 ? 7 ? 8 ? 9 ? (10 quando autorizado)
```

Tasks 4?6 podem ser paralelizadas apÃ³s Task 3.

---

## Riscos e mitigaÃ§Ãµes

| Risco | MitigaÃ§Ã£o |
|---|---|
| Import dinÃ¢mico falha no Windows/ESM | Testar `createRequire` fallback; documentar instalaÃ§Ã£o global do plugin |
| `cwd` do MCP diferente do workspace | Auto-discovery A2 sobe atÃ© `.git` |
| `graph.json` grande (>50k nÃ³s) | Limites `MAX_NODES`; log de aviso; nÃ£o gerar HTML no plugin |
| Acoplamento core?plugin | Interface `McpPlugin` + `PluginHostContext` mÃ­nimo |
| DuplicaÃ§Ã£o com codegraph | README deixa claro: graphify = repo aberto + link com memÃ³ria |

---

## DefiniÃ§Ã£o de pronto

- [ ] Spec Â§13 (critÃ©rios de aceite) todos marcados
- [ ] `npm run build` passa no core e no plugin
- [ ] `scripts/test-graphify-plugin.mjs` exit 0
- [ ] Core sem plugin = comportamento 1.4.1
- [ ] README atualizado
