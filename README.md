# Local Storage MCP Server

[![Build](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml)

<details>
<summary><strong>Português (BR)</strong></summary>

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) para memória persistente local. Permite que agentes (Cursor, Claude Desktop, etc.) gravem e recuperem nuances de regras de negócio, decisões arquiteturais e conhecimento de domínio — sem inflar o contexto da conversa.

Construído com **Node.js**, **TypeScript** e **SQLite** · Banco: `~/.local_mcp_learning.db` · **Versão `1.4.1`**

> O GitHub não suporta abas nativas em README. Este doc usa **seções colapsáveis** (`<details>`) para manter a visão geral enxuta — clique no título para expandir.

## Início rápido

```bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```

**Princípios:** KISS (single SQLite file) · LLM-delegated indexing (`topic` + `keywords`) · zero cloud cost · on-idle compaction

<details>
<summary><strong>Instalação e configuração no Cursor</strong></summary>

Ou clone o repositório, rode `npm install`, e aponte o MCP para `dist/index.js`.

### Cursor (`mcp.json`)

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "node",
      "args": ["C:/caminho/para/my-local-storage-mcp/dist/index.js"],
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

Variáveis do consolidador são opcionais. Sem provider AI, o merge semântico fica desabilitado (deduplicação por hash e Jaccard continuam).

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

**Checkpoint:** gravar somente quando o usuário confirmar explicitamente que a nuance deve ser persistida — não durante exploração.

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

Built with **Node.js**, **TypeScript**, and **SQLite** · Database: `~/.local_mcp_learning.db` · **Version `1.4.1`**

> GitHub README does not support native tabs. This doc uses **collapsible sections** (`<details>`) to keep the overview scannable — click a heading to expand.

## Quick start

```bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```

**Design principles:** KISS (single SQLite file) · LLM-delegated indexing (`topic` + `keywords`) · zero cloud cost · on-idle compaction

<details>
<summary><strong>Installation &amp; Cursor setup</strong></summary>

Or clone the repo, run `npm install`, and point your MCP client to `dist/index.js`.

### Cursor (`mcp.json`)

```json
{
  "mcpServers": {
    "my-local-storage-mcp": {
      "command": "node",
      "args": ["C:/path/to/my-local-storage-mcp/dist/index.js"],
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
<summary><code>remember_fact</code> — store a learning</summary>

Stores a persistent learning. Deduplicates automatically via `fact_hash` (MD5 of normalized text).

| Parameter | Description |
|---|---|
| `topic` | Macro context (e.g. `java-legacy`, `mcp-evolution`) |
| `keywords` | Comma-separated tags for indexing |
| `fact` | The fact, rule, or decision |
| `record_type` | `anchor` (fundamental concepts) or `detail` (default) |
| `priority` | `high` (default) or `low` (temporary session context) |

**Checkpoint:** save only when the user explicitly confirms the nuance should be persisted — not during exploration.

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

**v1.4.1** — `fact_hash` backfill · full legacy deduplication

**v1.4.0** — `format=compact` · `recall_by_topic` · access counters · checkpoint

**v1.3.0** — on-idle consolidator · anchor/detail · `fact_hash`

</details>

---

ISC License — see [LICENSE](LICENSE).
