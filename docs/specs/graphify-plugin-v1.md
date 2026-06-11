# Graphify Plugin v1 ? EspecificaÃ§Ã£o

**Status:** Aprovado  
**Data:** 2026-06-09  
**VersÃ£o alvo:** `my-local-storage-mcp@1.5.0` + `@avm/my-local-storage-mcp-graphify@1.0.0`  
**PrincÃ­pio:** KISS ? core inalterado sem plugin; um grafo ativo por sessÃ£o.

---

## 0. PolÃ­tica de versionamento (semver)

Com downloads crescentes no [npm](https://www.npmjs.com/package/my-local-storage-mcp), a previsibilidade importa mais que um nÃºmero grande.

| Pacote | VersÃ£o | Motivo |
|---|---|---|
| `my-local-storage-mcp` | **1.5.0** (minor) | Plugin loader + interface `McpPlugin` sÃ£o aditivos; tools core inalteradas; zero breaking para quem jÃ¡ usa 1.4.x |
| `@avm/my-local-storage-mcp-graphify` | **1.0.0** (major do add-on) | Primeiro plugin estÃ¡vel do ecossistema ? marco pÃºblico separado do core |
| `my-local-storage-mcp` | **2.0.0** (reservado) | SÃ³ quando houver breaking real: rename/remoÃ§Ã£o de tools, schema SQLite intrusivo, mudanÃ§a de defaults |

**Regra:** nÃ£o inflar o core para `2.0.0` por marketing. O salto visÃ­vel Ã© o add-on `1.0.0`, nÃ£o o minor do core.

**Quem sÃ³ usa memÃ³ria local:** `npm update -g my-local-storage-mcp` (1.4.1 ? 1.5.0), sem mudar `mcp.json`.

**Quem quer Graphify:** instalar o segundo pacote; core permanece em 1.5.0.

---

## 1. Contexto

O `my-local-storage-mcp` guarda memÃ³ria **semÃ¢ntica aprendida** (regras, decisÃµes, checkpoints) em SQLite. O [Graphify](https://github.com/safishamsi/graphify) gera um grafo **estrutural** do repositÃ³rio (`graphify-out/graph.json`).

SÃ£o camadas complementares:

| Camada | Fonte | Pergunta que responde |
|---|---|---|
| MemÃ³ria local | `remember_fact` / recall | ?O que decidimos / qual regra de negÃ³cio?? |
| Graphify | AST + extraÃ§Ã£o semÃ¢ntica | ?Onde no cÃ³digo isso vive / quem chama quem?? |
| Codegraph (jÃ¡ no `mcp.json`) | IndexaÃ§Ã£o ampla | NavegaÃ§Ã£o global em `C:\Users\andre.mesquita` |

O plugin Graphify liga a memÃ³ria ao **grafo do projeto aberto**, sem Python em runtime e sem vector DB.

---

## 2. Objetivos v1

- Add-on opcional, instalado separadamente do core.
- Carregar `graph.json` (formato NetworkX node-link) em Node puro.
- Auto-discovery **A2**: subir diretÃ³rios atÃ© achar `.git`, entÃ£o `graphify-out/graph.json`.
- Expor 3 tools MCP quando o grafo estiver resolvido.
- Enriquecer recall com subgrafo compacto (`recall_with_graph`).
- Zero regressÃ£o quando o plugin nÃ£o estÃ¡ instalado ou o grafo nÃ£o existe.

## 3. Fora do escopo v1

- `MCP_GRAPHIFY_GRAPHS` (multi-repo) ? documentado como extensÃ£o futura.
- Colunas `graph_node_id` / `graph_repo` no SQLite.
- Spawn de `graphify serve` ou dependÃªncia Python.
- SubstituiÃ§Ã£o do `codegraph` no `mcp.json`.

---

## 4. Empacotamento

```
my-local-storage-mcp/                 # npm: my-local-storage-mcp (core)
  src/
    index.ts
    plugin-types.ts                 # interface McpPlugin (novo)
    plugin-loader.ts                # carrega plugins por env (novo)
  packages/
    plugin-graphify/                # npm: @avm/my-local-storage-mcp-graphify
      package.json
      src/
        index.ts                    # export default plugin
        graph-loader.ts
        graph-index.ts
        graph-query.ts
        tools.ts
```

O core publica apenas `dist/` atual. O plugin publica seu prÃ³prio `dist/`.

InstalaÃ§Ã£o opcional:

```bash
npm install -g my-local-storage-mcp
npm install -g @avm/my-local-storage-mcp-graphify
```

---

## 5. AtivaÃ§Ã£o (variÃ¡veis de ambiente)

| VariÃ¡vel | ObrigatÃ³ria | Default | DescriÃ§Ã£o |
|---|---|---|---|
| `MCP_PLUGINS` | NÃ£o | ? | Lista separada por vÃ­rgula. Ex.: `graphify` |
| `MCP_GRAPHIFY_GRAPH_JSON` | NÃ£o | ? | Path absoluto ou relativo ao `graph.json`. Se vazio, auto-discovery A2 |
| `MCP_GRAPHIFY_MAX_NEIGHBORS` | NÃ£o | `5` | MÃ¡ximo de nÃ³s vizinhos retornados |
| `MCP_GRAPHIFY_QUERY_DEPTH` | NÃ£o | `2` | Profundidade BFS para `graph_neighbors` |
| `MCP_GRAPHIFY_MAX_NODES` | NÃ£o | `10` | Teto de nÃ³s em `graph_query` / bloco de enrich |
| `MCP_GRAPHIFY_RELOAD_CHECK_MS` | NÃ£o | `5000` | Intervalo mÃ­nimo entre checagens de `mtime` |

Exemplo `mcp.json`:

```json
{
  "my-local-storage-mcp": {
    "command": "my-local-storage-mcp",
    "args": [],
    "env": {
      "MCP_PLUGINS": "graphify",
      "MCP_GRAPHIFY_GRAPH_JSON": ""
    }
  }
}
```

---

## 6. Auto-discovery A2

Algoritmo executado na inicializaÃ§Ã£o do plugin (e ao recarregar):

```
1. Se MCP_GRAPHIFY_GRAPH_JSON estiver definido e nÃ£o vazio:
     resolver path absoluto ? se arquivo existe, usar; senÃ£o plugin inativo + log stderr

2. SenÃ£o, comeÃ§ar em process.cwd():
     a. Se existe ./graphify-out/graph.json ? usar
     b. Se existe ./.git E ./graphify-out/graph.json na mesma pasta ? usar
     c. Subir um nÃ­vel (dirname) e repetir (a?b)
     d. Parar em filesystem root ou apÃ³s 50 nÃ­veis

3. Se nenhum arquivo encontrado:
     plugin inativo (nÃ£o registra tools graph_*)
     log Ãºnico: [graphify-plugin] graph.json nÃ£o encontrado; tools desabilitadas
```

**PrecedÃªncia:** path explÃ­cito no env > `graphify-out` no `cwd` > `graphify-out` na raiz do repo (`.git`).

**Recarregamento:** a cada chamada de tool graph_* (ou a cada N ms), comparar `mtime` do JSON; se mudou, reconstruir Ã­ndice em memÃ³ria.

---

## 7. Contrato do plugin (core)

```ts
// src/plugin-types.ts

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RecallContext {
  query: string;
  recallText: string;
  format: "full" | "compact";
}

export interface McpPlugin {
  readonly name: string;

  /** Chamado na inicializaÃ§Ã£o; retorna false se plugin ficar inativo */
  init(env: NodeJS.ProcessEnv): Promise<boolean>;

  /** Tools extras registradas no ListTools */
  getTools(): ToolDefinition[];

  /** Handler de tools do plugin; retorna null se tool nÃ£o for deste plugin */
  handleTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: { type: "text"; text: string }[] } | null>;

  /** Bloco opcional anexado apÃ³s recall core */
  afterRecall?(ctx: RecallContext): Promise<string | undefined>;
}
```

### Loader no core (`src/plugin-loader.ts`)

```
1. Ler MCP_PLUGINS (split por vÃ­rgula, trim)
2. Para cada nome:
     graphify ? import dinÃ¢mico de '@avm/my-local-storage-mcp-graphify'
                fallback: './packages/plugin-graphify/dist/index.js' (dev local)
3. Chamar plugin.init(process.env)
4. Agregar getTools() de plugins ativos
5. No CallTool: tentar handler core; se nÃ£o achar, delegar aos plugins
6. ApÃ³s executeRecall bem-sucedido: chamar afterRecall de cada plugin ativo e concatenar blocos
```

Se import falhar ? log stderr, core continua sem plugin (nÃ£o Ã© erro fatal).

---

## 8. Tools do plugin (v1)

Registradas somente quando `init()` retorna `true` (grafo resolvido).

### 8.1 `graph_query`

Busca nÃ³s por termo (label, id, tipo) e retorna subgrafo compacto.

| ParÃ¢metro | Tipo | ObrigatÃ³rio | Default |
|---|---|---|---|
| `query` | string | sim | ? |
| `limit` | number | nÃ£o | `MCP_GRAPHIFY_MAX_NODES` |

SaÃ­da compacta (1 linha por nÃ³):

```
[graph] UserService (class) | degree: 12
  ? calls DatabasePool [CALLS]
  ? imported_by OrderController [IMPORTS]
```

### 8.2 `graph_neighbors`

Vizinhos BFS a partir de um nÃ³.

| ParÃ¢metro | Tipo | ObrigatÃ³rio | Default |
|---|---|---|---|
| `node` | string | sim | id ou label exato |
| `depth` | number | nÃ£o | `MCP_GRAPHIFY_QUERY_DEPTH` |
| `limit` | number | nÃ£o | `MCP_GRAPHIFY_MAX_NEIGHBORS` |

### 8.3 `recall_with_graph`

Combina recall core + enrich Graphify.

| ParÃ¢metro | Tipo | ObrigatÃ³rio | Default |
|---|---|---|---|
| `query` | string | sim | ? |
| `type_filter` | enum | nÃ£o | `all` |
| `format` | enum | nÃ£o | `compact` |
| `max_chars` | number | nÃ£o | env recall |
| `limit` | number | nÃ£o | `10` |

Fluxo:

1. Delegar recall ao core (`executeRecall` ? mesma lÃ³gica de `recall_facts`, incluindo `touchAccess`)
2. Extrair termos da query + labels mencionados nos fatos retornados
3. `graph_query` interno com esses termos
4. Concatenar: `recallText + "\n\n--- [graphify] ---\n" + graphBlock`

Se grafo inativo ? comportar como `recall_facts` puro (sem erro).

---

## 9. Formato `graph.json` esperado

NetworkX node-link JSON (saÃ­da padrÃ£o do Graphify):

```json
{
  "directed": true,
  "multigraph": false,
  "graph": {},
  "nodes": [{ "id": "...", "label": "...", "type": "..." }],
  "links": [{ "source": "...", "target": "...", "type": "..." }]
}
```

O plugin normaliza `source`/`target` como string id. Ãndices em memÃ³ria:

- `byId: Map<string, Node>`
- `byLabel: Map<string, Node[]>` (colisÃµes permitidas)
- `adjacency: Map<string, Edge[]>` (lista de adjacÃªncia direcionada + reversa opcional para inbound)

---

## 10. Comportamento sem plugin / sem grafo

| CenÃ¡rio | Comportamento |
|---|---|
| `MCP_PLUGINS` ausente | IdÃªntico ao 1.4.1 |
| Plugin nÃ£o instalado | Log stderr; core normal |
| Grafo nÃ£o encontrado | Plugin inativo; tools graph_* ausentes em ListTools |
| `recall_with_graph` com grafo inativo | Fallback para recall puro |

---

## 11. Logging

Tudo em `stderr` (nÃ£o polui stdio MCP):

```
[graphify-plugin] grafo carregado: C:\...\graphify-out\graph.json (4821 nÃ³s, 9102 arestas)
[graphify-plugin] graph.json nÃ£o encontrado; tools desabilitadas
[graphify-plugin] grafo recarregado (mtime alterado)
```

---

## 12. ExtensÃ£o futura (v2 ? nÃ£o implementar agora)

### Multi-repo (`MCP_GRAPHIFY_GRAPHS`)

```json
{
  "MCP_GRAPHIFY_GRAPHS": {
    "my-local-storage-mcp": "C:/.../graphify-out/graph.json",
    "legado-java": "C:/.../legado/graphify-out/graph.json"
  }
}
```

Mesmas tools; parÃ¢metro opcional `repo` em `graph_query` / `graph_neighbors`.

### Links no SQLite

```sql
ALTER TABLE local_learning ADD COLUMN graph_node_id TEXT;
ALTER TABLE local_learning ADD COLUMN graph_repo TEXT;
```

`remember_fact` ganha `graph_node` opcional; recall enriquece automaticamente vizinhos do nÃ³ linkado.

---

## 13. CritÃ©rios de aceite v1

- [ ] Core sem `MCP_PLUGINS` passa build e comporta-se como 1.4.1
- [ ] Com plugin + `graph.json` vÃ¡lido, `ListTools` inclui `graph_query`, `graph_neighbors`, `recall_with_graph`
- [ ] Auto-discovery A2 encontra grafo na raiz do git quando `cwd` Ã© subpasta
- [ ] `recall_with_graph` incrementa `access_count` (reusa `executeRecall`)
- [ ] `mtime` alterado recarrega Ã­ndice sem reiniciar MCP
- [ ] Grafo ausente nÃ£o impede startup do core
- [ ] README documenta instalaÃ§Ã£o e env do plugin

---

## 14. ReferÃªncias

- Graphify: https://github.com/safishamsi/graphify
- Roadmap Fase 2 (grafo leve): Ã¢ncoras em `mcp-evolucao` no banco local
- Codegraph existente no `mcp.json` do usuÃ¡rio (escopo global, nÃ£o substituÃ­do)
