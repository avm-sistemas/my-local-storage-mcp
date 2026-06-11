# Local Storage MCP Server
<img width="1280" height="632" alt="my-local-storage-mcp" src="https://github.com/user-attachments/assets/cfeb0571-957a-4e4c-ae75-5f0ee3a9e121" />

[![Build](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/my-local-storage-mcp.svg)](https://www.npmjs.com/package/my-local-storage-mcp)

<details>
<summary><strong>PortuguÃªs (BR)</strong></summary>

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) para memÃ³ria persistente local. Permite que agentes (Cursor, Claude Desktop, etc.) gravem e recuperem nuances de regras de negÃ³cio, decisÃµes arquiteturais e conhecimento de domÃ­nio â sem inflar o contexto da conversa.

ConstruÃ­do com **Node.js**, **TypeScript** e **SQLite** Â· Banco: `~/.local_mcp_learning.db` Â· **VersÃ£o `1.5.0`**

## InÃ­cio rÃ¡pido

```bash
npm install -g my-local-storage-mcp
```

Requer **Node.js 20+**. ApÃ³s instalar, use o comando `my-local-storage-mcp` no cliente MCP.

## PrincÃ­pios de design

| PrincÃ­pio | O que significa |
|---|---|
| **KISS** | Um Ãºnico arquivo SQLite (`~/.local_mcp_learning.db`); sem vector DB ou serviÃ§os pesados em background |
| **LLM-delegated indexing** | The agent assigns `topic` + `keywords` when saving â no server-side NLP or embeddings |
| **Zero cloud cost** | Armazenamento e recall locais; dados privados; sem API cloud para a memÃ³ria principal |
| **On-idle compaction** | Background consolidator merges redundancy when idle â keeps recall signal clean over time |

## Plugins (opcionais)

O core permanece KISS. Add-ons opcionais estendem o servidor sem alterar o comportamento padrÃ£o.

### Graphify add-on (`@avm/my-local-storage-mcp-graphify`)

Consulta um `graph.json` do [Graphify](https://github.com/safishamsi/graphify) e enriquece o recall com contexto estrutural do cÃ³digo.

```bash
npm install -g @avm/my-local-storage-mcp-graphify
```

```json
"env": {
  "MCP_PLUGINS": "graphify",
  "MCP_GRAPHIFY_GRAPH_JSON": ""
}
```

Deixe `MCP_GRAPHIFY_GRAPH_JSON` vazio para auto-discovery: sobe atÃ© a raiz git e carrega `graphify-out/graph.json`.

**Ferramentas (quando o grafo existe):** `graph_query`, `graph_neighbors`, `recall_with_graph`

Spec: [docs/specs/graphify-plugin-v1.md](docs/specs/graphify-plugin-v1.md)

## Prompts que priorizam o MCP

O agente sÃ³ chama ferramentas MCP quando o pedido deixa a intenÃ§Ã£o clara. Use frases explÃ­citas para maximizar recall e evitar gravaÃ§Ãµes perdidas:

| Momento | Exemplo de prompt | Ferramenta |
|---|---|---|
| InÃ­cio da sessÃ£o | `Antes de comeÃ§ar, faÃ§a recall das Ã¢ncoras do tÃ³pico java-legacy na memÃ³ria MCP local (compact).` | `recall_by_topic` |
| Consulta de domÃ­nio | `Busque na memÃ³ria MCP local regras sobre PedidoVenda e N+1.` | `recall_facts` |
| Carregar contexto do projeto | `O que jÃ¡ temos gravado na memÃ³ria local sobre este repositÃ³rio?` | `recall_facts` / `recall_by_topic` |
| **Checkpoint (gravar)** | `Grave isso na memÃ³ria MCP â confirmado.` / `Lembre disso nas prÃ³ximas sessÃµes.` | `remember_fact` |

**Rotina sugerida:** recall compacto ao abrir a sessÃ£o â trabalho â frase de checkpoint explÃ­cita quando uma nuance deve persistir.

<details>
<summary><strong>InstalaÃ§Ã£o e configuraÃ§Ã£o no Cursor</strong></summary>

### Via npm (recomendado)

```bash
npm install -g my-local-storage-mcp
```

### Via Git (desenvolvimento)

```bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```

Ou clone o repositÃ³rio, rode `npm install`, e aponte o MCP para `dist/index.js`.

### Cursor (`mcp.json`)

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": [],
      "env": {
        "MCP_PRIMARY_HOST": "http://127.0.0.1:8080",
        "MCP_PRIMARY_MODEL": "qwen2.5-1.5b",
        "MCP_PRIMARY_PROVIDER": "openai",
        "MCP_FALLBACK_HOST": "http://127.0.0.1:11434",
        "MCP_FALLBACK_MODEL": "qwen2.5:3b",
        "MCP_FALLBACK_PROVIDER": "ollama"
      }
    }
  }
}
```

VariÃ¡veis do consolidador sÃ£o opcionais. Sem provider AI, o merge semÃ¢ntico fica desabilitado (deduplicaÃ§Ã£o por hash e Jaccard continuam).

</details>

<details>
<summary><strong>Ferramentas MCP</strong></summary>

<details>
<summary><code>remember_fact</code> â gravar aprendizado</summary>

Grava um aprendizado persistente. Deduplica automaticamente via `fact_hash` (MD5 of normalized text).

| ParÃ¢metro | DescriÃ§Ã£o |
|---|---|
| `topic` | Contexto macro (ex: `java-legacy`, `mcp-evolucao`) |
| `keywords` | Tags separadas por vÃ­rgula |
| `fact` | O fato, regra ou decisÃ£o |
| `record_type` | `anchor` (conceitos fundamentais) ou `detail` (padrÃ£o) |
| `priority` | `high` (default) or `low` (contexto temporÃ¡rio) |

> **Checkpoint (rotina):** `remember_fact` Ã© sÃ³ para aprendizados confirmados. O agente deve aguardar um sinal explÃ­cito de gravaÃ§Ã£o â nÃ£o gravar durante exploraÃ§Ã£o ou brainstorming.

| UsuÃ¡rio diz (exemplos) | AÃ§Ã£o do agente |
|---|---|
| "Grave isso na memÃ³ria MCP." | Chamar `remember_fact` |
| "Lembre disso na prÃ³xima vez." | Chamar `remember_fact` |
| "Sim, persista essa nuance." | Chamar `remember_fact` |
| AprovaÃ§Ã£o vaga durante exploraÃ§Ã£o | **NÃ£o** chamar `remember_fact` |

Sem frase de checkpoint, o aprendizado fica sÃ³ no chat e se perde ao encerrar a sessÃ£o.

</details>

<details>
<summary><code>recall_facts</code> â busca livre</summary>

Busca em `topic`, `keywords`, or `fact` (LIKE). Retorna no mÃ¡ximo 10 registros; exclui `merged` entries.

| Parameter | Description |
|---|---|
| `query` | Termo de busca |
| `type_filter` | `all`, `anchor`, or `detail` |
| `format` | `full` (default) or `compact` (**recomendado**) |
| `max_chars` | Trunca sÃ³ `detail`; Ã¢ncoras nunca sÃ£o cortadas |
| `limit` | MÃ¡ximo de registros (padrÃ£o: 10) |

```
[anchor] java-legacy | hibernate,n+1 -> Se X for nulo, PedidoVenda gera N+1...
```

</details>

<details>
<summary><code>recall_by_topic</code> â busca por tÃ³pico</summary>

TÃ³pico exato â menos ruÃ­do que `recall_facts`.

| Parameter | Description |
|---|---|
| `topic` | TÃ³pico exato (case-insensitive) |
| `keyword` | Filtro opcional dentro do tÃ³pico |
| `type_filter`, `format`, `max_chars`, `limit` | Igual ao `recall_facts` |

Recomendado no inÃ­cio da sessÃ£o:

```json
{ "topic": "java-legacy", "type_filter": "anchor", "format": "compact" }
```

</details>

</details>

<details>
<summary><strong>Schema do banco</strong> (<code>local_learning</code>)</summary>

MigraÃ§Ã£o automÃ¡tica na inicializaÃ§Ã£o â bases antigas ganham colunas novas sem perda de dados.

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
2. **Merge semÃ¢ntico** via local LLM when available
3. **Fallback** to concatenation after N cycles without a provider
4. **Grava** a consolidated `anchor` e marca os originais como `merged`

</details>

<details>
<summary><strong><code>fact_hash</code> backfill</strong> (v1.4.1)</summary>

Na inicializaÃ§Ã£o, preenche `fact_hash` em registros legados sem hash. On collision, the oldest ID stays canonical; duplicates get `merged`. Idempotent.

`fact_hash` serve para **deduplicaÃ§Ã£o**, nÃ£o para busca textual.

</details>

<details>
<summary><strong>VariÃ¡veis de ambiente</strong></summary>

| VariÃ¡vel | PadrÃ£o | DescriÃ§Ã£o |
|---|---|---|
| `MCP_CONSOLIDATION_INTERVAL_MINUTES` | `60` | Intervalo do consolidador |
| `MCP_CONSOLIDATION_THRESHOLD` | `0.25` | Threshold Jaccard |
| `MCP_CONSOLIDATION_MAX_PENDING_CYCLES` | `3` | Ciclos antes do fallback concat |
| `MCP_AI_MAX_MERGE_CHARS` | `2000` | Limite de chars para merge via LLM |
| `MCP_RECALL_DEFAULT_MAX_CHARS` | `400` | Truncamento default em `format=compact` |
| `MCP_PRIMARY_HOST` | â | Host primÃ¡rio para merge |
| `MCP_PRIMARY_MODEL` | `qwen2.5-1.5b` | Modelo primÃ¡rio |
| `MCP_PRIMARY_PROVIDER` | `openai` | `openai` or `ollama` |
| `MCP_FALLBACK_HOST` | â | Fallback host |
| `MCP_FALLBACK_MODEL` | `qwen2.5:3b` | Modelo fallback |
| `MCP_FALLBACK_PROVIDER` | `ollama` | Provider fallback |

</details>

<details>
<summary><strong>Changelog</strong></summary>

**v1.5.0** â plugin architecture Â· Graphify add-on (optional)

**v1.4.1** â Backfill de `fact_hash` Â· deduplicaÃ§Ã£o completa em bases legadas

**v1.4.0** â `format=compact` Â· `recall_by_topic` Â· contadores de acesso Â· checkpoint

**v1.3.0** â consolidador on-idle Â· anchor/detail Â· `fact_hash`

</details>

---

LicenÃ§a ISC â ver [LICENSE](LICENSE).

</details>

---

## English

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for persistent local memory. Lets agents (Cursor, Claude Desktop, etc.) store and retrieve business-rule nuances, architectural decisions, and domain knowledge without bloating the conversation context.

Built with **Node.js**, **TypeScript**, and **SQLite** Â· Database: `~/.local_mcp_learning.db` Â· **Version `1.5.0`**

## Quick start

```bash
npm install -g my-local-storage-mcp
```

Requires **Node.js 20+**. After install, use the `my-local-storage-mcp` command in your MCP client.

## Design principles

| Principle | What it means |
|---|---|
| **KISS** | Single SQLite file (`~/.local_mcp_learning.db`); no vector DB or heavy background services |
| **LLM-delegated indexing** | The agent assigns `topic` + `keywords` when saving â no server-side NLP or embeddings |
| **Zero cloud cost** | Local storage and recall; private data; no cloud API required for core memory |
| **On-idle compaction** | Background consolidator merges redundancy when idle â keeps recall signal clean over time |

## Plugins (optional)

The core stays KISS. Optional add-ons extend the server without changing default behavior.

### Graphify add-on (`@avm/my-local-storage-mcp-graphify`)

Queries a [Graphify](https://github.com/safishamsi/graphify) `graph.json` and enriches recall with structural code context.

```bash
npm install -g @avm/my-local-storage-mcp-graphify
```

```json
"env": {
  "MCP_PLUGINS": "graphify",
  "MCP_GRAPHIFY_GRAPH_JSON": ""
}
```

Leave `MCP_GRAPHIFY_GRAPH_JSON` empty for auto-discovery: walks up to the git root and loads `graphify-out/graph.json`.

**Tools (when graph is found):** `graph_query`, `graph_neighbors`, `recall_with_graph`

Spec: [docs/specs/graphify-plugin-v1.md](docs/specs/graphify-plugin-v1.md)

## Prompts that prioritize the MCP

The agent invokes MCP tools only when the request makes the intent clear. Use explicit phrases to maximize recall and avoid missed saves:

| Moment | Example prompt | Tool |
|---|---|---|
| Session start | `Before we start, recall anchors for topic java-legacy from my local MCP memory (compact).` | `recall_by_topic` |
| Domain lookup | `Search my local MCP memory for rules about PedidoVenda and N+1.` | `recall_facts` |
| Load project context | `What do we already have stored in local memory about this repo?` | `recall_facts` / `recall_by_topic` |
| **Checkpoint save** | `Save this to my MCP memory â confirmed.` / `Remember this for future sessions.` | `remember_fact` |

**Suggested routine:** compact recall at session open â work â explicit checkpoint phrase when a nuance must persist.

<details>
<summary><strong>Installation &amp; Cursor setup</strong></summary>

### From npm (recommended)

```bash
npm install -g my-local-storage-mcp
```

### From Git (development)

```bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```

Or clone the repo, run `npm install`, and point your MCP client to `dist/index.js`.

### Cursor (`mcp.json`)

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "my-local-storage-mcp",
      "args": [],
      "env": {
        "MCP_PRIMARY_HOST": "http://127.0.0.1:8080",
        "MCP_PRIMARY_MODEL": "qwen2.5-1.5b",
        "MCP_PRIMARY_PROVIDER": "openai",
        "MCP_FALLBACK_HOST": "http://127.0.0.1:11434",
        "MCP_FALLBACK_MODEL": "qwen2.5:3b",
        "MCP_FALLBACK_PROVIDER": "ollama"
      }
    }
  }
}
```

Consolidator env vars are optional. Without an AI provider, semantic merge is disabled (hash and Jaccard deduplication still work).

</details>

<details>
<summary><strong>MCP tools</strong></summary>

<details>
<summary><code>remember_fact</code> â store a learning</summary>

Stores a persistent learning. Deduplicates automatically via `fact_hash` (MD5 of normalized text).

| Parameter | Description |
|---|---|
| `topic` | Macro context (e.g. `java-legacy`, `mcp-evolution`) |
| `keywords` | Comma-separated tags for indexing |
| `fact` | The fact, rule, or decision |
| `record_type` | `anchor` (fundamental concepts) or `detail` (default) |
| `priority` | `high` (default) or `low` (temporary session context) |

> **Checkpoint (routine):** `remember_fact` is for confirmed learnings only. The agent must wait for an explicit save signal from you â not save while exploring or brainstorming.

| User says (examples) | Agent action |
|---|---|
| "Save this to my MCP memory." | Call `remember_fact` |
| "Remember this for next time." | Call `remember_fact` |
| "Yes, persist that nuance." | Call `remember_fact` |
| Vague approval during exploration | **Do not** call `remember_fact` |

Without a checkpoint phrase, the learning stays in the chat and is lost when the session ends.

</details>

<details>
<summary><code>recall_facts</code> â free-text search</summary>

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
<summary><code>recall_by_topic</code> â structured search</summary>

Exact topic search â less noise than `recall_facts`.

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

Automatic migration on startup â existing databases gain new columns without data loss.

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
| `MCP_PRIMARY_HOST` | â | Primary merge host |
| `MCP_PRIMARY_MODEL` | `qwen2.5-1.5b` | Primary model |
| `MCP_PRIMARY_PROVIDER` | `openai` | `openai` or `ollama` |
| `MCP_FALLBACK_HOST` | â | Fallback host |
| `MCP_FALLBACK_MODEL` | `qwen2.5:3b` | Fallback model |
| `MCP_FALLBACK_PROVIDER` | `ollama` | Fallback provider |

</details>

<details>
<summary><strong>Changelog</strong></summary>

**v1.5.0** â plugin architecture Â· Graphify add-on (optional)

**v1.4.1** â `fact_hash` backfill Â· full legacy deduplication

**v1.4.0** â `format=compact` Â· `recall_by_topic` Â· access counters Â· checkpoint

**v1.3.0** â on-idle consolidator Â· anchor/detail Â· `fact_hash`

</details>

---

ISC License â see [LICENSE](LICENSE).
