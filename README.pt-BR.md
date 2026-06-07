# Local Storage MCP Server

[![Build](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml)

**Idiomas:** [English](README.md) · [Português (BR)](README.pt-BR.md)

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
