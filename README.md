# Local Storage MCP Server

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) para memória persistente local. Permite que agentes (Cursor, Claude Desktop, etc.) gravem e recuperem nuances de regras de negócio, decisões arquiteturais e conhecimento de domínio ? sem inflar o contexto da conversa.

Construído com **Node.js**, **TypeScript** e **SQLite**. Banco em `~/.local_mcp_learning.db`.

**Versão atual:** `1.4.1`

---

## Princípios de design

* **KISS:** um único arquivo SQLite; sem vector DB nem daemons pesados.
* **Indexação delegada ao LLM:** o agente categoriza via `topic` + `keywords` ao gravar.
* **Custo zero:** roda localmente, resposta em milissegundos, dados privados.
* **Compactação on-idle:** consolidador em background reduz redundância antes que vire ruído no recall.

---

## Instalação

```bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```

Ou clone, `npm install` e aponte o MCP para `dist/index.js`.

### Configuração no Cursor (`mcp.json`)

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

As variáveis de consolidador são opcionais ? sem provider AI, o merge semântico fica desabilitado (deduplicação por hash e Jaccard continuam).

---

## Ferramentas MCP

### `remember_fact`

Grava um aprendizado persistente. Deduplica automaticamente via `fact_hash` (MD5 do texto normalizado).

| Parâmetro | Descrição |
|---|---|
| `topic` | Contexto macro (ex: `java-legacy`, `mcp-evolucao`) |
| `keywords` | Tags separadas por vírgula para indexação |
| `fact` | O fato, regra ou decisão |
| `record_type` | `anchor` (conceitos fundamentais) ou `detail` (padrão; nuances pontuais) |
| `priority` | `high` (padrão) ou `low` (contexto temporário de sessão) |

**Checkpoint:** gravar somente quando o usuário confirmar explicitamente que a nuance deve ser persistida ? não durante exploração.

### `recall_facts`

Busca livre por termo em `topic`, `keywords` ou `fact` (LIKE). Retorna no máximo 10 registros; exclui registros `merged`.

| Parâmetro | Descrição |
|---|---|
| `query` | Termo de busca |
| `type_filter` | `all`, `anchor` ou `detail` |
| `format` | `full` (padrão) ou `compact` (1 linha/registro ? **recomendado**) |
| `max_chars` | Trunca só `detail`; âncoras nunca são cortadas |
| `limit` | Máximo de registros (padrão: 10) |

Exemplo compacto:

```
[anchor] java-legacy | hibernate,n+1 -> Se X for nulo, PedidoVenda gera N+1...
```

### `recall_by_topic`

Busca estruturada por tópico exato ? menos ruído que `recall_facts`.

| Parâmetro | Descrição |
|---|---|
| `topic` | Tópico exato (case-insensitive) |
| `keyword` | Filtro opcional dentro do tópico |
| `type_filter`, `format`, `max_chars`, `limit` | Igual ao `recall_facts` |

**Uso recomendado no início da sessão:**

```json
{ "topic": "java-legacy", "type_filter": "anchor", "format": "compact" }
```

---

## Schema do banco (`local_learning`)

Migração automática na inicialização ? bases antigas ganham colunas novas sem perda de dados.

```sql
CREATE TABLE local_learning (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    topic               TEXT    NOT NULL,
    keywords            TEXT    NOT NULL,
    fact                TEXT    NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fact_hash           TEXT,                          -- MD5 para deduplicação
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

Registros com `consolidation_status = 'merged'` são ocultos no recall (absorvidos por consolidação ou deduplicação).

---

## Consolidador on-idle

Roda em intervalo configurável enquanto o MCP está ativo:

1. **Agrupa** registros do mesmo `topic` com keywords similares (Jaccard ? threshold).
2. **Merge semântico** via LLM local (Ollama ou API OpenAI-compatível) quando disponível.
3. **Fallback** para concatenação após N ciclos sem provider.
4. **Grava** um registro `anchor` consolidado e marca os originais como `merged`.

---

## Backfill de `fact_hash` (v1.4.1)

Na inicialização, preenche `fact_hash` em registros legados sem hash. Em colisão, o ID mais antigo fica canônico; duplicatas recebem `merged`. Idempotente.

`fact_hash` serve para **deduplicação**, não para busca textual.

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `MCP_CONSOLIDATION_INTERVAL_MINUTES` | `60` | Intervalo do consolidador |
| `MCP_CONSOLIDATION_THRESHOLD` | `0.25` | Threshold Jaccard para agrupar |
| `MCP_CONSOLIDATION_MAX_PENDING_CYCLES` | `3` | Ciclos antes do fallback concat |
| `MCP_AI_MAX_MERGE_CHARS` | `2000` | Limite de chars para merge via LLM |
| `MCP_RECALL_DEFAULT_MAX_CHARS` | `400` | Truncamento default em `format=compact` |
| `MCP_PRIMARY_HOST` | ? | Host primário para merge (OpenAI-compat) |
| `MCP_PRIMARY_MODEL` | `qwen2.5-1.5b` | Modelo primário |
| `MCP_PRIMARY_PROVIDER` | `openai` | `openai` ou `ollama` |
| `MCP_FALLBACK_HOST` | ? | Host fallback |
| `MCP_FALLBACK_MODEL` | `qwen2.5:3b` | Modelo fallback |
| `MCP_FALLBACK_PROVIDER` | `ollama` | Provider fallback |

---

## Changelog

### v1.4.1
* Backfill automático de `fact_hash` na inicialização
* Deduplicação completa em bases legadas

### v1.4.0
* `recall_facts`: `format=compact`, `max_chars`, `limit`
* Nova tool `recall_by_topic`
* Colunas `access_count` e `last_accessed`
* Checkpoint explícito no `remember_fact`

### v1.3.0
* Consolidador on-idle (Jaccard + merge semântico)
* `record_type` (anchor/detail), `priority`, `consolidation_status`
* Deduplicação por `fact_hash`

---

## Licença

ISC ? ver [LICENSE](LICENSE).
