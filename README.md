# Local Storage MCP Server
<img width="1280" height="632" alt="my-local-storage-mcp" src="https://github.com/user-attachments/assets/cfeb0571-957a-4e4c-ae75-5f0ee3a9e121" />

[![npm version](https://img.shields.io/npm/v/my-local-storage-mcp.svg)](https://www.npmjs.com/package/my-local-storage-mcp)
<br>
<br>
[![Build](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml)
<br>
[![CodeQL](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/github-code-scanning/codeql)
<br>
[![Publish npm](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/publish-npm.yml)
<br>
[![Deploy GitHub Pages](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/pages.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/pages.yml)
<br>
[![npm graphify](https://img.shields.io/npm/v/@avm/my-local-storage-mcp-graphify.svg?label=graphify)](https://www.npmjs.com/package/@avm/my-local-storage-mcp-graphify)


<details>
<summary><strong>Português (BR)</strong></summary>

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) para memória persistente local. Permite que agentes (Cursor, Claude Desktop, etc.) gravem e recuperem nuances de regras de negócio, decisões arquiteturais e conhecimento de domínio — sem inflar o contexto da conversa.

Construído com **Node.js**, **TypeScript** e **SQLite** · Banco: `~/.local_mcp_learning.db` · **Versão `1.5.4`**

## Início rápido

Instalação mínima (só memória local — funciona offline após o install):

```bash
npm install -g my-local-storage-mcp
```

Requer **Node.js 20+**. Use o comando `my-local-storage-mcp` no `mcp.json` (veja abaixo).

**Com Graphify** (grafo de código, pacote npm separado):

```bash
npm install -g my-local-storage-mcp @avm/my-local-storage-mcp-graphify
```

## Princípios de design

| Princípio | O que significa |
|---|---|
| **KISS** | Um único arquivo SQLite (`~/.local_mcp_learning.db`); sem vector DB ou serviços pesados em background |
| **LLM-delegated indexing** | The agent assigns `topic` + `keywords` when saving — no server-side NLP or embeddings |
| **Zero cloud cost** | Armazenamento e recall locais; dados privados; sem API cloud para a memória principal |
| **On-idle compaction** | Background consolidator merges redundancy when idle — keeps recall signal clean over time |

## Plugins (opcionais)

O **core open source** inclui apenas memória local (`remember_fact`, `recall_facts`, `recall_by_topic`). Add-ons são pacotes npm separados, ativados com `MCP_PLUGINS`. Falha ou ausência de um add-on **não impede** o core.

Produtos comerciais derivados (ex.: sync em equipe) ficam fora deste repositório e não são necessários para uso local.

### Graphify add-on (`@avm/my-local-storage-mcp-graphify`)

Consulta um `graph.json` do [Graphify](https://github.com/safishamsi/graphify) e enriquece o recall com contexto estrutural do código. Publicado no npm junto com releases do core.

```bash
npm install -g @avm/my-local-storage-mcp-graphify
```

No `mcp.json`, ative o plugin (o pacote global já basta — sem path local):

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": [],
      "env": {
        "MCP_PLUGINS": "graphify"
      }
    }
  }
}
```

Opcional: `MCP_GRAPHIFY_GRAPH_JSON` com caminho absoluto. Se omitido ou vazio, auto-discovery sobe até a raiz git e carrega `graphify-out/graph.json`.

**Ferramentas (quando o grafo existe):** `graph_query`, `graph_neighbors`, `recall_with_graph`

Spec: [docs/specs/graphify-plugin-v1.md](docs/specs/graphify-plugin-v1.md)

## Prompts que priorizam o MCP

O agente só chama ferramentas MCP quando o pedido deixa a intenção clara. Use frases explícitas para maximizar recall e evitar gravações perdidas:

| Momento | Exemplo de prompt | Ferramenta |
|---|---|---|
| Início da sessão | `Antes de começar, faça recall das âncoras do tópico java-legacy na memória MCP local (compact).` | `recall_by_topic` |
| Consulta de domínio | `Busque na memória MCP local regras sobre PedidoVenda e N+1.` | `recall_facts` |
| Carregar contexto do projeto | `O que já temos gravado na memória local sobre este repositório?` | `recall_facts` / `recall_by_topic` |
| **Checkpoint (gravar)** | `Grave isso na memória MCP — confirmado.` / `Lembre disso nas próximas sessões.` | `remember_fact` |

**Rotina sugerida:** recall compacto ao abrir a sessão → trabalho → frase de checkpoint explícita quando uma nuance deve persistir.

<details>
<summary><strong>Instalação e configuração no Cursor</strong></summary>

### Só memória local (recomendado)

```bash
npm install -g my-local-storage-mcp
```

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": []
    }
  }
}
```

Sem variáveis de ambiente. Banco: `~/.local_mcp_learning.db`.

### Com Graphify

```bash
npm install -g my-local-storage-mcp @avm/my-local-storage-mcp-graphify
```

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": [],
      "env": {
        "MCP_PLUGINS": "graphify"
      }
    }
  }
}
```

### Consolidador semântico (opcional)

`MCP_PRIMARY_*` / `MCP_FALLBACK_*` habilitam merge via LLM quando ocioso. Sem provider, deduplicação por hash e Jaccard continuam.

### Desenvolvimento (contribuidores)

```bash
git clone https://github.com/avm-sistemas/my-local-storage-mcp.git
cd my-local-storage-mcp && npm ci && npm run build
```

Aponte o MCP para `node /caminho/para/my-local-storage-mcp/dist/index.js`. Graphify no monorepo: `MCP_PLUGINS=graphify` (loader resolve `packages/plugin-graphify/dist` automaticamente).

</details>

<details>
<summary><strong>Ferramentas MCP</strong></summary>

<details>
<summary><code>remember_fact</code> — gravar aprendizado</summary>

Grava um aprendizado persistente. Deduplica automaticamente via `fact_hash` (MD5 of normalized text).

| Parâmetro | Descrição |
|---|---|
| `topic` | Contexto macro (ex: `java-legacy`, `mcp-evolucao`) |
| `keywords` | Tags separadas por vírgula |
| `fact` | O fato, regra ou decisão |
| `record_type` | `anchor` (conceitos fundamentais) ou `detail` (padrão) |
| `priority` | `high` (default) or `low` (contexto temporário) |

> **Checkpoint (rotina):** `remember_fact` é só para aprendizados confirmados. O agente deve aguardar um sinal explícito de gravação — não gravar durante exploração ou brainstorming.

| Usuário diz (exemplos) | Ação do agente |
|---|---|
| "Grave isso na memória MCP." | Chamar `remember_fact` |
| "Lembre disso na próxima vez." | Chamar `remember_fact` |
| "Sim, persista essa nuance." | Chamar `remember_fact` |
| Aprovação vaga durante exploração | **Não** chamar `remember_fact` |

Sem frase de checkpoint, o aprendizado fica só no chat e se perde ao encerrar a sessão.

</details>

<details>
<summary><code>recall_facts</code> — busca livre</summary>

Busca em `topic`, `keywords`, or `fact` (LIKE). Retorna no máximo 10 registros; exclui `merged` entries.

| Parameter | Description |
|---|---|
| `query` | Termo de busca |
| `type_filter` | `all`, `anchor`, or `detail` |
| `format` | `full` (default) or `compact` (**recomendado**) |
| `max_chars` | Trunca só `detail`; âncoras nunca são cortadas |
| `limit` | Máximo de registros (padrão: 10) |

```
[anchor] java-legacy | hibernate,n+1 -> Se X for nulo, PedidoVenda gera N+1...
```

</details>

<details>
<summary><code>recall_by_topic</code> — busca por tópico</summary>

Tópico exato — menos ruído que `recall_facts`.

| Parameter | Description |
|---|---|
| `topic` | Tópico exato (case-insensitive) |
| `keyword` | Filtro opcional dentro do tópico |
| `type_filter`, `format`, `max_chars`, `limit` | Igual ao `recall_facts` |

Recomendado no início da sessão:

```json
{ "topic": "java-legacy", "type_filter": "anchor", "format": "compact" }
```

</details>

</details>

<details>
<summary><strong>Schema do banco</strong> (<code>local_learning</code>)</summary>

Migração automática na inicialização — bases antigas ganham colunas novas sem perda de dados.

```sql
CREATE TABLE local_learning (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    topic               TEXT    NOT NULL,
    keywords            TEXT    NOT NULL,
    fact                TEXT    NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fact_hash           TEXT,
    record_type         TEXT    NOT NULL DEFAULT 'detail',
    priority            TEXT    NOT NULL DEFAULT 'high',
    consolidation_status TEXT   NOT NULL DEFAULT 'ok',
    pending_cycles      INTEGER NOT NULL DEFAULT 0,
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed       TIMESTAMP
);

CREATE INDEX idx_learning_lookup ON local_learning(topic, keywords);
CREATE UNIQUE INDEX idx_fact_hash ON local_learning(fact_hash) WHERE fact_hash IS NOT NULL;
```

Records with `consolidation_status = 'merged'` ficam ocultos no recall.

</details>

<details>
<summary><strong>Consolidador on-idle</strong></summary>

1. **Agrupa** records in the same `topic` with similar keywords (Jaccard >= threshold)
2. **Merge semântico** via local LLM when available
3. **Fallback** to concatenation after N cycles without a provider
4. **Grava** a consolidated `anchor` e marca os originais como `merged`

</details>

<details>
<summary><strong><code>fact_hash</code> backfill</strong> (v1.4.1)</summary>

Na inicialização, preenche `fact_hash` em registros legados sem hash. On collision, the oldest ID stays canonical; duplicates get `merged`. Idempotent.

`fact_hash` serve para **deduplicação**, não para busca textual.

</details>

<details>
<summary><strong>Variáveis de ambiente</strong></summary>

| Variável | Padrão | Descrição |
|---|---|---|
| `MCP_CONSOLIDATION_INTERVAL_MINUTES` | `60` | Intervalo do consolidador |
| `MCP_CONSOLIDATION_THRESHOLD` | `0.25` | Threshold Jaccard |
| `MCP_CONSOLIDATION_MAX_PENDING_CYCLES` | `3` | Ciclos antes do fallback concat |
| `MCP_AI_MAX_MERGE_CHARS` | `2000` | Limite de chars para merge via LLM |
| `MCP_RECALL_DEFAULT_MAX_CHARS` | `400` | Truncamento default em `format=compact` |
| `MCP_PRIMARY_HOST` | — | Host primário para merge |
| `MCP_PRIMARY_MODEL` | `qwen2.5-1.5b` | Modelo primário |
| `MCP_PRIMARY_PROVIDER` | `openai` | `openai` or `ollama` |
| `MCP_FALLBACK_HOST` | — | Fallback host |
| `MCP_FALLBACK_MODEL` | `qwen2.5:3b` | Modelo fallback |
| `MCP_FALLBACK_PROVIDER` | `ollama` | Provider fallback |

</details>

<details>
<summary><strong>Changelog</strong></summary>

**v1.5.4** — core OSS desacoplado de produtos comerciais · hook `validateRemember` em plugins · Graphify no npm via release · instalação simplificada

**v1.5.3** — campos `context` / `visibility` / `analyst_id` (validação comercial movida para add-ons em 1.5.4)

**v1.5.2** — plugin architecture · Graphify add-on (optional)

**v1.4.1** — Backfill de `fact_hash` · deduplicação completa em bases legadas

**v1.4.0** — `format=compact` · `recall_by_topic` · contadores de acesso · checkpoint

**v1.3.0** — consolidador on-idle · anchor/detail · `fact_hash`

</details>

---

Licença ISC — ver [LICENSE](LICENSE).

</details>

---

## English

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for persistent local memory. Lets agents (Cursor, Claude Desktop, etc.) store and retrieve business-rule nuances, architectural decisions, and domain knowledge without bloating the conversation context.

Built with **Node.js**, **TypeScript**, and **SQLite** · Database: `~/.local_mcp_learning.db` · **Version `1.5.4`**

## Quick start

Minimal install (local memory only — works offline after install):

```bash
npm install -g my-local-storage-mcp
```

Requires **Node.js 20+**. Use the `my-local-storage-mcp` command in `mcp.json` (see below).

**With Graphify** (code graph, separate npm package):

```bash
npm install -g my-local-storage-mcp @avm/my-local-storage-mcp-graphify
```

## Design principles

| Principle | What it means |
|---|---|
| **KISS** | Single SQLite file (`~/.local_mcp_learning.db`); no vector DB or heavy background services |
| **LLM-delegated indexing** | The agent assigns `topic` + `keywords` when saving — no server-side NLP or embeddings |
| **Zero cloud cost** | Local storage and recall; private data; no cloud API required for core memory |
| **On-idle compaction** | Background consolidator merges redundancy when idle — keeps recall signal clean over time |

## Plugins (optional)

The **open-source core** provides local memory only (`remember_fact`, `recall_facts`, `recall_by_topic`). Add-ons are separate npm packages, enabled via `MCP_PLUGINS`. A missing or failing add-on **does not block** the core.

Commercial derivatives (e.g. team sync) live outside this repo and are not required for local use.

### Graphify add-on (`@avm/my-local-storage-mcp-graphify`)

Queries a [Graphify](https://github.com/safishamsi/graphify) `graph.json` and enriches recall with structural code context. Published to npm with core releases.

```bash
npm install -g @avm/my-local-storage-mcp-graphify
```

In `mcp.json`, enable the plugin (global npm install is enough — no local path):

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": [],
      "env": {
        "MCP_PLUGINS": "graphify"
      }
    }
  }
}
```

Optional: `MCP_GRAPHIFY_GRAPH_JSON` with an absolute path. If omitted or empty, auto-discovery walks up to the git root and loads `graphify-out/graph.json`.

**Tools (when graph is found):** `graph_query`, `graph_neighbors`, `recall_with_graph`

Spec: [docs/specs/graphify-plugin-v1.md](docs/specs/graphify-plugin-v1.md)

## Prompts that prioritize the MCP

The agent invokes MCP tools only when the request makes the intent clear. Use explicit phrases to maximize recall and avoid missed saves:

| Moment | Example prompt | Tool |
|---|---|---|
| Session start | `Before we start, recall anchors for topic java-legacy from my local MCP memory (compact).` | `recall_by_topic` |
| Domain lookup | `Search my local MCP memory for rules about PedidoVenda and N+1.` | `recall_facts` |
| Load project context | `What do we already have stored in local memory about this repo?` | `recall_facts` / `recall_by_topic` |
| **Checkpoint save** | `Save this to my MCP memory — confirmed.` / `Remember this for future sessions.` | `remember_fact` |

**Suggested routine:** compact recall at session open → work → explicit checkpoint phrase when a nuance must persist.

<details>
<summary><strong>Installation &amp; Cursor setup</strong></summary>

### Local memory only (recommended)

```bash
npm install -g my-local-storage-mcp
```

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": []
    }
  }
}
```

No environment variables required. Database: `~/.local_mcp_learning.db`.

### With Graphify

```bash
npm install -g my-local-storage-mcp @avm/my-local-storage-mcp-graphify
```

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": [],
      "env": {
        "MCP_PLUGINS": "graphify"
      }
    }
  }
}
```

### Semantic consolidator (optional)

`MCP_PRIMARY_*` / `MCP_FALLBACK_*` enable LLM merge when idle. Without a provider, hash and Jaccard deduplication still run.

### Development (contributors)

```bash
git clone https://github.com/avm-sistemas/my-local-storage-mcp.git
cd my-local-storage-mcp && npm ci && npm run build
```

Point MCP to `node /path/to/my-local-storage-mcp/dist/index.js`. Monorepo Graphify: `MCP_PLUGINS=graphify` (loader resolves `packages/plugin-graphify/dist` automatically).

</details>

<details>
<summary><strong>MCP tools</strong></summary>

<details>
<summary><code>remember_fact</code> — store a learning</summary>

Stores a persistent learning. Deduplicates automatically via `fact_hash` (MD5 of normalized text).

| Parameter | Description |
|---|---|
| `topic` | Macro context (e.g. `java-legacy`, `mcp-evolution`) |
| `keywords` | Comma-separated tags for indexing |
| `fact` | The fact, rule, or decision |
| `record_type` | `anchor` (fundamental concepts) or `detail` (default) |
| `priority` | `high` (default) or `low` (temporary session context) |

> **Checkpoint (routine):** `remember_fact` is for confirmed learnings only. The agent must wait for an explicit save signal from you — not save while exploring or brainstorming.

| User says (examples) | Agent action |
|---|---|
| "Save this to my MCP memory." | Call `remember_fact` |
| "Remember this for next time." | Call `remember_fact` |
| "Yes, persist that nuance." | Call `remember_fact` |
| Vague approval during exploration | **Do not** call `remember_fact` |

Without a checkpoint phrase, the learning stays in the chat and is lost when the session ends.

</details>

<details>
<summary><code>recall_facts</code> — free-text search</summary>

Search across `topic`, `keywords`, or `fact` (LIKE). Returns up to 10 records; excludes `merged` entries.

| Parameter | Description |
|---|---|
| `query` | Search term |
| `type_filter` | `all`, `anchor`, or `detail` |
| `format` | `full` (default) or `compact` (**recommended**) |
| `max_chars` | Truncates `detail` only; anchors are never cut |
| `limit` | Max records (default: 10) |

```
[anchor] java-legacy | hibernate,n+1 -> If X is null, PedidoVenda triggers N+1...
```

</details>

<details>
<summary><code>recall_by_topic</code> — structured search</summary>

Exact topic search — less noise than `recall_facts`.

| Parameter | Description |
|---|---|
| `topic` | Exact topic (case-insensitive) |
| `keyword` | Optional filter within the topic |
| `type_filter`, `format`, `max_chars`, `limit` | Same as `recall_facts` |

Recommended at session start:

```json
{ "topic": "java-legacy", "type_filter": "anchor", "format": "compact" }
```

</details>

</details>

<details>
<summary><strong>Database schema</strong> (<code>local_learning</code>)</summary>

Automatic migration on startup — existing databases gain new columns without data loss.

```sql
CREATE TABLE local_learning (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    topic               TEXT    NOT NULL,
    keywords            TEXT    NOT NULL,
    fact                TEXT    NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fact_hash           TEXT,
    record_type         TEXT    NOT NULL DEFAULT 'detail',
    priority            TEXT    NOT NULL DEFAULT 'high',
    consolidation_status TEXT   NOT NULL DEFAULT 'ok',
    pending_cycles      INTEGER NOT NULL DEFAULT 0,
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed       TIMESTAMP
);

CREATE INDEX idx_learning_lookup ON local_learning(topic, keywords);
CREATE UNIQUE INDEX idx_fact_hash ON local_learning(fact_hash) WHERE fact_hash IS NOT NULL;
```

Records with `consolidation_status = 'merged'` are hidden from recall.

</details>

<details>
<summary><strong>On-idle consolidator</strong></summary>

1. **Groups** records in the same `topic` with similar keywords (Jaccard >= threshold)
2. **Semantic merge** via local LLM when available
3. **Fallback** to concatenation after N cycles without a provider
4. **Writes** a consolidated `anchor` and marks originals as `merged`

</details>

<details>
<summary><strong><code>fact_hash</code> backfill</strong> (v1.4.1)</summary>

On startup, fills `fact_hash` for legacy records missing a hash. On collision, the oldest ID stays canonical; duplicates get `merged`. Idempotent.

`fact_hash` is for **deduplication**, not text search.

</details>

<details>
<summary><strong>Environment variables</strong></summary>

| Variable | Default | Description |
|---|---|---|
| `MCP_CONSOLIDATION_INTERVAL_MINUTES` | `60` | Consolidator interval |
| `MCP_CONSOLIDATION_THRESHOLD` | `0.25` | Jaccard threshold |
| `MCP_CONSOLIDATION_MAX_PENDING_CYCLES` | `3` | Cycles before concat fallback |
| `MCP_AI_MAX_MERGE_CHARS` | `2000` | Char limit for LLM merge |
| `MCP_RECALL_DEFAULT_MAX_CHARS` | `400` | Default truncation in `format=compact` |
| `MCP_PRIMARY_HOST` | — | Primary merge host |
| `MCP_PRIMARY_MODEL` | `qwen2.5-1.5b` | Primary model |
| `MCP_PRIMARY_PROVIDER` | `openai` | `openai` or `ollama` |
| `MCP_FALLBACK_HOST` | — | Fallback host |
| `MCP_FALLBACK_MODEL` | `qwen2.5:3b` | Fallback model |
| `MCP_FALLBACK_PROVIDER` | `ollama` | Fallback provider |

</details>

<details>
<summary><strong>Changelog</strong></summary>

**v1.5.4** — OSS core decoupled from commercial products · `validateRemember` plugin hook · Graphify on npm via release · simplified install

**v1.5.3** — `context` / `visibility` / `analyst_id` fields (commercial validation moved to add-ons in 1.5.4)

**v1.5.2** — plugin architecture · Graphify add-on (optional)

**v1.4.1** — `fact_hash` backfill · full legacy deduplication

**v1.4.0** — `format=compact` · `recall_by_topic` · access counters · checkpoint

**v1.3.0** — on-idle consolidator · anchor/detail · `fact_hash`

</details>

---

ISC License — see [LICENSE](LICENSE).
