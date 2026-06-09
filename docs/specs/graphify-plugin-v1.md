# Graphify Plugin v1 ? Especificação

**Status:** Aprovado  
**Data:** 2026-06-09  
**Versão alvo:** `my-local-storage-mcp@1.5.0` + `@avm/my-local-storage-mcp-graphify@1.0.0`  
**Princípio:** KISS ? core inalterado sem plugin; um grafo ativo por sessão.

---

## 0. Política de versionamento (semver)

Com downloads crescentes no [npm](https://www.npmjs.com/package/my-local-storage-mcp), a previsibilidade importa mais que um número grande.

| Pacote | Versão | Motivo |
|---|---|---|
| `my-local-storage-mcp` | **1.5.0** (minor) | Plugin loader + interface `McpPlugin` são aditivos; tools core inalteradas; zero breaking para quem já usa 1.4.x |
| `@avm/my-local-storage-mcp-graphify` | **1.0.0** (major do add-on) | Primeiro plugin estável do ecossistema ? marco público separado do core |
| `my-local-storage-mcp` | **2.0.0** (reservado) | Só quando houver breaking real: rename/remoção de tools, schema SQLite intrusivo, mudança de defaults |

**Regra:** não inflar o core para `2.0.0` por marketing. O salto visível é o add-on `1.0.0`, não o minor do core.

**Quem só usa memória local:** `npm update -g my-local-storage-mcp` (1.4.1 ? 1.5.0), sem mudar `mcp.json`.

**Quem quer Graphify:** instalar o segundo pacote; core permanece em 1.5.0.

---

## 1. Contexto

O `my-local-storage-mcp` guarda memória **semântica aprendida** (regras, decisões, checkpoints) em SQLite. O [Graphify](https://github.com/safishamsi/graphify) gera um grafo **estrutural** do repositório (`graphify-out/graph.json`).

São camadas complementares:

| Camada | Fonte | Pergunta que responde |
|---|---|---|
| Memória local | `remember_fact` / recall | ?O que decidimos / qual regra de negócio?? |
| Graphify | AST + extração semântica | ?Onde no código isso vive / quem chama quem?? |
| Codegraph (já no `mcp.json`) | Indexação ampla | Navegação global em `C:\Users\andre.mesquita` |

O plugin Graphify liga a memória ao **grafo do projeto aberto**, sem Python em runtime e sem vector DB.

---

## 2. Objetivos v1

- Add-on opcional, instalado separadamente do core.
- Carregar `graph.json` (formato NetworkX node-link) em Node puro.
- Auto-discovery **A2**: subir diretórios até achar `.git`, então `graphify-out/graph.json`.
- Expor 3 tools MCP quando o grafo estiver resolvido.
- Enriquecer recall com subgrafo compacto (`recall_with_graph`).
- Zero regressão quando o plugin não está instalado ou o grafo não existe.

## 3. Fora do escopo v1

- `MCP_GRAPHIFY_GRAPHS` (multi-repo) ? documentado como extensão futura.
- Colunas `graph_node_id` / `graph_repo` no SQLite.
- Spawn de `graphify serve` ou dependência Python.
- Substituição do `codegraph` no `mcp.json`.

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

O core publica apenas `dist/` atual. O plugin publica seu próprio `dist/`.

Instalação opcional:

```bash
npm install -g my-local-storage-mcp
npm install -g @avm/my-local-storage-mcp-graphify
```

---

## 5. Ativação (variáveis de ambiente)

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `MCP_PLUGINS` | Não | ? | Lista separada por vírgula. Ex.: `graphify` |
| `MCP_GRAPHIFY_GRAPH_JSON` | Não | ? | Path absoluto ou relativo ao `graph.json`. Se vazio, auto-discovery A2 |
| `MCP_GRAPHIFY_MAX_NEIGHBORS` | Não | `5` | Máximo de nós vizinhos retornados |
| `MCP_GRAPHIFY_QUERY_DEPTH` | Não | `2` | Profundidade BFS para `graph_neighbors` |
| `MCP_GRAPHIFY_MAX_NODES` | Não | `10` | Teto de nós em `graph_query` / bloco de enrich |
| `MCP_GRAPHIFY_RELOAD_CHECK_MS` | Não | `5000` | Intervalo mínimo entre checagens de `mtime` |

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

Algoritmo executado na inicialização do plugin (e ao recarregar):

```
1. Se MCP_GRAPHIFY_GRAPH_JSON estiver definido e não vazio:
     resolver path absoluto ? se arquivo existe, usar; senão plugin inativo + log stderr

2. Senão, começar em process.cwd():
     a. Se existe ./graphify-out/graph.json ? usar
     b. Se existe ./.git E ./graphify-out/graph.json na mesma pasta ? usar
     c. Subir um nível (dirname) e repetir (a?b)
     d. Parar em filesystem root ou após 50 níveis

3. Se nenhum arquivo encontrado:
     plugin inativo (não registra tools graph_*)
     log único: [graphify-plugin] graph.json não encontrado; tools desabilitadas
```

**Precedência:** path explícito no env > `graphify-out` no `cwd` > `graphify-out` na raiz do repo (`.git`).

**Recarregamento:** a cada chamada de tool graph_* (ou a cada N ms), comparar `mtime` do JSON; se mudou, reconstruir índice em memória.

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

  /** Chamado na inicialização; retorna false se plugin ficar inativo */
  init(env: NodeJS.ProcessEnv): Promise<boolean>;

  /** Tools extras registradas no ListTools */
  getTools(): ToolDefinition[];

  /** Handler de tools do plugin; retorna null se tool não for deste plugin */
  handleTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: { type: "text"; text: string }[] } | null>;

  /** Bloco opcional anexado após recall core */
  afterRecall?(ctx: RecallContext): Promise<string | undefined>;
}
```

### Loader no core (`src/plugin-loader.ts`)

```
1. Ler MCP_PLUGINS (split por vírgula, trim)
2. Para cada nome:
     graphify ? import dinâmico de '@avm/my-local-storage-mcp-graphify'
                fallback: './packages/plugin-graphify/dist/index.js' (dev local)
3. Chamar plugin.init(process.env)
4. Agregar getTools() de plugins ativos
5. No CallTool: tentar handler core; se não achar, delegar aos plugins
6. Após executeRecall bem-sucedido: chamar afterRecall de cada plugin ativo e concatenar blocos
```

Se import falhar ? log stderr, core continua sem plugin (não é erro fatal).

---

## 8. Tools do plugin (v1)

Registradas somente quando `init()` retorna `true` (grafo resolvido).

### 8.1 `graph_query`

Busca nós por termo (label, id, tipo) e retorna subgrafo compacto.

| Parâmetro | Tipo | Obrigatório | Default |
|---|---|---|---|
| `query` | string | sim | ? |
| `limit` | number | não | `MCP_GRAPHIFY_MAX_NODES` |

Saída compacta (1 linha por nó):

```
[graph] UserService (class) | degree: 12
  ? calls DatabasePool [CALLS]
  ? imported_by OrderController [IMPORTS]
```

### 8.2 `graph_neighbors`

Vizinhos BFS a partir de um nó.

| Parâmetro | Tipo | Obrigatório | Default |
|---|---|---|---|
| `node` | string | sim | id ou label exato |
| `depth` | number | não | `MCP_GRAPHIFY_QUERY_DEPTH` |
| `limit` | number | não | `MCP_GRAPHIFY_MAX_NEIGHBORS` |

### 8.3 `recall_with_graph`

Combina recall core + enrich Graphify.

| Parâmetro | Tipo | Obrigatório | Default |
|---|---|---|---|
| `query` | string | sim | ? |
| `type_filter` | enum | não | `all` |
| `format` | enum | não | `compact` |
| `max_chars` | number | não | env recall |
| `limit` | number | não | `10` |

Fluxo:

1. Delegar recall ao core (`executeRecall` ? mesma lógica de `recall_facts`, incluindo `touchAccess`)
2. Extrair termos da query + labels mencionados nos fatos retornados
3. `graph_query` interno com esses termos
4. Concatenar: `recallText + "\n\n--- [graphify] ---\n" + graphBlock`

Se grafo inativo ? comportar como `recall_facts` puro (sem erro).

---

## 9. Formato `graph.json` esperado

NetworkX node-link JSON (saída padrão do Graphify):

```json
{
  "directed": true,
  "multigraph": false,
  "graph": {},
  "nodes": [{ "id": "...", "label": "...", "type": "..." }],
  "links": [{ "source": "...", "target": "...", "type": "..." }]
}
```

O plugin normaliza `source`/`target` como string id. Índices em memória:

- `byId: Map<string, Node>`
- `byLabel: Map<string, Node[]>` (colisões permitidas)
- `adjacency: Map<string, Edge[]>` (lista de adjacência direcionada + reversa opcional para inbound)

---

## 10. Comportamento sem plugin / sem grafo

| Cenário | Comportamento |
|---|---|
| `MCP_PLUGINS` ausente | Idêntico ao 1.4.1 |
| Plugin não instalado | Log stderr; core normal |
| Grafo não encontrado | Plugin inativo; tools graph_* ausentes em ListTools |
| `recall_with_graph` com grafo inativo | Fallback para recall puro |

---

## 11. Logging

Tudo em `stderr` (não polui stdio MCP):

```
[graphify-plugin] grafo carregado: C:\...\graphify-out\graph.json (4821 nós, 9102 arestas)
[graphify-plugin] graph.json não encontrado; tools desabilitadas
[graphify-plugin] grafo recarregado (mtime alterado)
```

---

## 12. Extensão futura (v2 ? não implementar agora)

### Multi-repo (`MCP_GRAPHIFY_GRAPHS`)

```json
{
  "MCP_GRAPHIFY_GRAPHS": {
    "my-local-storage-mcp": "C:/.../graphify-out/graph.json",
    "legado-java": "C:/.../legado/graphify-out/graph.json"
  }
}
```

Mesmas tools; parâmetro opcional `repo` em `graph_query` / `graph_neighbors`.

### Links no SQLite

```sql
ALTER TABLE local_learning ADD COLUMN graph_node_id TEXT;
ALTER TABLE local_learning ADD COLUMN graph_repo TEXT;
```

`remember_fact` ganha `graph_node` opcional; recall enriquece automaticamente vizinhos do nó linkado.

---

## 13. Critérios de aceite v1

- [ ] Core sem `MCP_PLUGINS` passa build e comporta-se como 1.4.1
- [ ] Com plugin + `graph.json` válido, `ListTools` inclui `graph_query`, `graph_neighbors`, `recall_with_graph`
- [ ] Auto-discovery A2 encontra grafo na raiz do git quando `cwd` é subpasta
- [ ] `recall_with_graph` incrementa `access_count` (reusa `executeRecall`)
- [ ] `mtime` alterado recarrega índice sem reiniciar MCP
- [ ] Grafo ausente não impede startup do core
- [ ] README documenta instalação e env do plugin

---

## 14. Referências

- Graphify: https://github.com/safishamsi/graphify
- Roadmap Fase 2 (grafo leve): âncoras em `mcp-evolucao` no banco local
- Codegraph existente no `mcp.json` do usuário (escopo global, não substituído)
