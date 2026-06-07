# Local Storage MCP Server

**Languages:** [English](README.md) · [Português (BR)](README.pt-BR.md)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for persistent local memory. Lets agents (Cursor, Claude Desktop, etc.) store and retrieve business-rule nuances, architectural decisions, and domain knowledge without bloating the conversation context.

Built with **Node.js**, **TypeScript**, and **SQLite**. Database file: `~/.local_mcp_learning.db`.

**Current version:** `1.4.1`

---

## Design principles

* **KISS:** a single SQLite file; no vector DB or heavy background daemons.
* **LLM-delegated indexing:** the agent categorizes entries via `topic` + `keywords` when saving.
* **Zero operational cost:** runs locally, millisecond responses, private data.
* **On-idle compaction:** a background consolidator reduces redundancy before it becomes recall noise.

---

## Installation

```bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```

Or clone, run `npm install`, and point your MCP client to `dist/index.js`.

### Cursor configuration (`mcp.json`)

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

---

## MCP tools

### `remember_fact`

Stores a persistent learning. Deduplicates automatically via `fact_hash` (MD5 of normalized text).

| Parameter | Description |
|---|---|
| `topic` | Macro context (e.g. `java-legacy`, `mcp-evolution`) |
| `keywords` | Comma-separated tags for indexing |
| `fact` | The fact, rule, or decision |
| `record_type` | `anchor` (fundamental concepts) or `detail` (default; point-in-time nuances) |
| `priority` | `high` (default) or `low` (temporary session context) |

**Checkpoint:** save only when the user explicitly confirms the nuance should be persisted ? not during exploration.

### `recall_facts`

Free-text search across `topic`, `keywords`, or `fact` (LIKE). Returns up to 10 records; excludes `merged` entries.

| Parameter | Description |
|---|---|
| `query` | Search term |
| `type_filter` | `all`, `anchor`, or `detail` |
| `format` | `full` (default) or `compact` (one line per record ? **recommended**) |
| `max_chars` | Truncates `detail` only; anchors are never cut |
| `limit` | Max records returned (default: 10) |

Compact example:

```
[anchor] java-legacy | hibernate,n+1 -> If X is null, PedidoVenda triggers N+1...
```

### `recall_by_topic`

Structured search by exact topic ? less noise than `recall_facts`.

| Parameter | Description |
|---|---|
| `topic` | Exact topic (case-insensitive) |
| `keyword` | Optional filter within the topic |
| `type_filter`, `format`, `max_chars`, `limit` | Same as `recall_facts` |

**Recommended at session start:**

```json
{ "topic": "java-legacy", "type_filter": "anchor", "format": "compact" }
```

---

## Database schema (`local_learning`)

Automatic migration on startup ? existing databases gain new columns without data loss.

```sql
CREATE TABLE local_learning (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    topic               TEXT    NOT NULL,
    keywords            TEXT    NOT NULL,
    fact                TEXT    NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fact_hash           TEXT,                          -- MD5 for deduplication
    record_type         TEXT    NOT NULL DEFAULT 'detail',  -- anchor | detail
    priority            TEXT    NOT NULL DEFAULT 'high',    -- high | low
    consolidation_status TEXT   NOT NULL DEFAULT 'ok',      -- ok | pending_merge | merged
    pending_cycles      INTEGER NOT NULL DEFAULT 0,
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed       TIMESTAMP
);

CREATE INDEX idx_learning_lookup ON local_learning(topic, keywords);
CREATE UNIQUE INDEX idx_fact_hash ON local_learning(fact_hash) WHERE fact_hash IS NOT NULL;
```

Records with `consolidation_status = 'merged'` are hidden from recall (absorbed by consolidation or deduplication).

---

## On-idle consolidator

Runs on a configurable interval while the MCP server is active:

1. **Groups** records in the same `topic` with similar keywords (Jaccard >= threshold).
2. **Semantic merge** via local LLM (Ollama or OpenAI-compatible API) when available.
3. **Fallback** to concatenation after N cycles without a provider.
4. **Writes** a consolidated `anchor` record and marks originals as `merged`.

---

## `fact_hash` backfill (v1.4.1)

On startup, fills `fact_hash` for legacy records missing a hash. On collision, the oldest ID stays canonical; duplicates get `merged`. Idempotent.

`fact_hash` is for **deduplication**, not text search.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_CONSOLIDATION_INTERVAL_MINUTES` | `60` | Consolidator interval |
| `MCP_CONSOLIDATION_THRESHOLD` | `0.25` | Jaccard threshold for grouping |
| `MCP_CONSOLIDATION_MAX_PENDING_CYCLES` | `3` | Cycles before concat fallback |
| `MCP_AI_MAX_MERGE_CHARS` | `2000` | Char limit for LLM merge |
| `MCP_RECALL_DEFAULT_MAX_CHARS` | `400` | Default truncation in `format=compact` |
| `MCP_PRIMARY_HOST` | ? | Primary host for merge (OpenAI-compat) |
| `MCP_PRIMARY_MODEL` | `qwen2.5-1.5b` | Primary model |
| `MCP_PRIMARY_PROVIDER` | `openai` | `openai` or `ollama` |
| `MCP_FALLBACK_HOST` | ? | Fallback host |
| `MCP_FALLBACK_MODEL` | `qwen2.5:3b` | Fallback model |
| `MCP_FALLBACK_PROVIDER` | `ollama` | Fallback provider |

---

## Changelog

### v1.4.1
* Automatic `fact_hash` backfill on startup
* Full deduplication coverage for legacy databases

### v1.4.0
* `recall_facts`: `format=compact`, `max_chars`, `limit`
* New `recall_by_topic` tool
* `access_count` and `last_accessed` columns
* Explicit checkpoint in `remember_fact`

### v1.3.0
* On-idle consolidator (Jaccard + semantic merge)
* `record_type` (anchor/detail), `priority`, `consolidation_status`
* `fact_hash` deduplication

---

## License

ISC ? see [LICENSE](LICENSE).
