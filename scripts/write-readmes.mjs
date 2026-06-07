import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dash = "\u2014";

function translateToPt(enBody) {
  return enBody
    .replace("A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for persistent local memory. Lets agents (Cursor, Claude Desktop, etc.) store and retrieve business-rule nuances, architectural decisions, and domain knowledge without bloating the conversation context.",
      `Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) para mem\u00f3ria persistente local. Permite que agentes (Cursor, Claude Desktop, etc.) gravem e recuperem nuances de regras de neg\u00f3cio, decis\u00f5es arquiteturais e conhecimento de dom\u00ednio ${dash} sem inflar o contexto da conversa.`)
    .replace("Built with **Node.js**, **TypeScript**, and **SQLite** \u00b7 Database:", "Constru\u00eddo com **Node.js**, **TypeScript** e **SQLite** \u00b7 Banco:")
    .replace("**Version \`1.4.1\`", "**Vers\u00e3o \`1.4.1\`")
    .replace("## Quick start", "## In\u00edcio r\u00e1pido")
    .replace("Requires **Node.js 20+**. After install, use the `my-local-storage-mcp` command in your MCP client.",
      "Requer **Node.js 20+**. Ap\u00f3s instalar, use o comando `my-local-storage-mcp` no cliente MCP.")
    .replace("## Prompts that prioritize the MCP", "## Prompts que priorizam o MCP")
    .replace("The agent invokes MCP tools only when the request makes the intent clear. Use explicit phrases to maximize recall and avoid missed saves:",
      "O agente s\u00f3 chama ferramentas MCP quando o pedido deixa a inten\u00e7\u00e3o clara. Use frases expl\u00edcitas para maximizar recall e evitar grava\u00e7\u00f5es perdidas:")
    .replace("| Moment | Example prompt | Tool |", "| Momento | Exemplo de prompt | Ferramenta |")
    .replace("| Session start |", "| In\u00edcio da sess\u00e3o |")
    .replace("| Domain lookup |", "| Consulta de dom\u00ednio |")
    .replace("| Load project context |", "| Carregar contexto do projeto |")
    .replace("| **Checkpoint save** |", "| **Checkpoint (gravar)** |")
    .replace("`Before we start, recall anchors for topic java-legacy from my local MCP memory (compact).`",
      "`Antes de come\u00e7ar, fa\u00e7a recall das \u00e2ncoras do t\u00f3pico java-legacy na mem\u00f3ria MCP local (compact).`")
    .replace("`Search my local MCP memory for rules about PedidoVenda and N+1.`",
      "`Busque na mem\u00f3ria MCP local regras sobre PedidoVenda e N+1.`")
    .replace("`What do we already have stored in local memory about this repo?`",
      "`O que j\u00e1 temos gravado na mem\u00f3ria local sobre este reposit\u00f3rio?`")
    .replace("`Save this to my MCP memory " + dash + " confirmed.` / `Remember this for future sessions.`",
      "`Grave isso na mem\u00f3ria MCP " + dash + " confirmado.` / `Lembre disso nas pr\u00f3ximas sess\u00f5es.`")
    .replace("**Suggested routine:** compact recall at session open \u2192 work \u2192 explicit checkpoint phrase when a nuance must persist.",
      "**Rotina sugerida:** recall compacto ao abrir a sess\u00e3o \u2192 trabalho \u2192 frase de checkpoint expl\u00edcita quando uma nuance deve persistir.")
    .replace("> **Checkpoint (routine):** `remember_fact` is for confirmed learnings only. The agent must wait for an explicit save signal from you " + dash + " not save while exploring or brainstorming.",
      "> **Checkpoint (rotina):** `remember_fact` \u00e9 s\u00f3 para aprendizados confirmados. O agente deve aguardar um sinal expl\u00edcito de grava\u00e7\u00e3o " + dash + " n\u00e3o gravar durante explora\u00e7\u00e3o ou brainstorming.")
    .replace("| User says (examples) | Agent action |", "| Usu\u00e1rio diz (exemplos) | A\u00e7\u00e3o do agente |")
    .replace("| \"Save this to my MCP memory.\" | Call `remember_fact` |",
      "| \"Grave isso na mem\u00f3ria MCP.\" | Chamar `remember_fact` |")
    .replace("| \"Remember this for next time.\" | Call `remember_fact` |",
      "| \"Lembre disso na pr\u00f3xima vez.\" | Chamar `remember_fact` |")
    .replace("| \"Yes, persist that nuance.\" | Call `remember_fact` |",
      "| \"Sim, persista essa nuance.\" | Chamar `remember_fact` |")
    .replace("| Vague approval during exploration | **Do not** call `remember_fact` |",
      "| Aprova\u00e7\u00e3o vaga durante explora\u00e7\u00e3o | **N\u00e3o** chamar `remember_fact` |")
    .replace("Without a checkpoint phrase, the learning stays in the chat and is lost when the session ends.",
      "Sem frase de checkpoint, o aprendizado fica s\u00f3 no chat e se perde ao encerrar a sess\u00e3o.")
    .replace("## Design principles", "## Princ\u00edpios de design")
    .replace("| Principle | What it means |", "| Princ\u00edpio | O que significa |")
    .replace("| **KISS** | Single SQLite file (\`~/.local_mcp_learning.db\`); no vector DB or heavy background services |",
      "| **KISS** | Um \u00fanico arquivo SQLite (\`~/.local_mcp_learning.db\`); sem vector DB ou servi\u00e7os pesados em background |")
    .replace("| **LLM-delegated indexing** | The agent assigns \`topic\` + \`keywords\` when saving ${dash} no server-side NLP or embeddings |",
      "| **LLM-delegated indexing** | O agente define \`topic\` + \`keywords\` ao gravar ${dash} sem NLP ou embeddings no servidor |")
    .replace("| **Zero cloud cost** | Local storage and recall; private data; no cloud API required for core memory |",
      "| **Zero cloud cost** | Armazenamento e recall locais; dados privados; sem API cloud para a mem\u00f3ria principal |")
    .replace("| **On-idle compaction** | Background consolidator merges redundancy when idle ${dash} keeps recall signal clean over time |",
      "| **On-idle compaction** | Consolidador em background funde redund\u00e2ncias quando ocioso ${dash} mant\u00e9m o recall limpo ao longo do tempo |")
    .replace("Installation &amp; Cursor setup", "Instala\u00e7\u00e3o e configura\u00e7\u00e3o no Cursor")
    .replace("### From npm (recommended)", "### Via npm (recomendado)")
    .replace("### From Git (development)", "### Via Git (desenvolvimento)")
    .replace("Or clone the repo, run `npm install`, and point your MCP client to `dist/index.js`.",
      "Ou clone o reposit\u00f3rio, rode `npm install`, e aponte o MCP para `dist/index.js`.")
    .replace("Consolidator env vars are optional. Without an AI provider, semantic merge is disabled (hash and Jaccard deduplication still work).",
      "Vari\u00e1veis do consolidador s\u00e3o opcionais. Sem provider AI, o merge sem\u00e2ntico fica desabilitado (deduplica\u00e7\u00e3o por hash e Jaccard continuam).")
    .replace("MCP tools", "Ferramentas MCP")
    .replace(`${dash} store a learning`, `${dash} gravar aprendizado`)
    .replace("Stores a persistent learning. Deduplicates automatically via", "Grava um aprendizado persistente. Deduplica automaticamente via")
    .replace("| Parameter | Description |", "| Par\u00e2metro | Descri\u00e7\u00e3o |")
    .replace("Macro context (e.g. `java-legacy`, `mcp-evolution`)", "Contexto macro (ex: `java-legacy`, `mcp-evolucao`)")
    .replace("Comma-separated tags for indexing", "Tags separadas por v\u00edrgula")
    .replace("The fact, rule, or decision", "O fato, regra ou decis\u00e3o")
    .replace("(fundamental concepts) or `detail` (default)", "(conceitos fundamentais) ou `detail` (padr\u00e3o)")
    .replace("(temporary session context)", "(contexto tempor\u00e1rio)")
    .replace(`${dash} free-text search`, `${dash} busca livre`)
    .replace("Search across", "Busca em")
    .replace("Returns up to 10 records; excludes", "Retorna no m\u00e1ximo 10 registros; exclui")
    .replace("Search term", "Termo de busca")
    .replace("(**recommended**)", "(**recomendado**)")
    .replace("Truncates `detail` only; anchors are never cut", "Trunca s\u00f3 `detail`; \u00e2ncoras nunca s\u00e3o cortadas")
    .replace("Max records (default: 10)", "M\u00e1ximo de registros (padr\u00e3o: 10)")
    .replace("If X is null", "Se X for nulo")
    .replace("triggers N+1", "gera N+1")
    .replace(`${dash} structured search`, `${dash} busca por t\u00f3pico`)
    .replace("Exact topic search", "T\u00f3pico exato")
    .replace("less noise than", "menos ru\u00eddo que")
    .replace("Exact topic (case-insensitive)", "T\u00f3pico exato (case-insensitive)")
    .replace("Optional filter within the topic", "Filtro opcional dentro do t\u00f3pico")
    .replace("Same as", "Igual ao")
    .replace("Recommended at session start:", "Recomendado no in\u00edcio da sess\u00e3o:")
    .replace("Database schema", "Schema do banco")
    .replace("Automatic migration on startup", "Migra\u00e7\u00e3o autom\u00e1tica na inicializa\u00e7\u00e3o")
    .replace("existing databases gain new columns without data loss.", "bases antigas ganham colunas novas sem perda de dados.")
    .replace("are hidden from recall.", "ficam ocultos no recall.")
    .replace("On-idle consolidator", "Consolidador on-idle")
    .replace("**Groups**", "**Agrupa**")
    .replace("**Semantic merge**", "**Merge sem\u00e2ntico**")
    .replace("**Writes**", "**Grava**")
    .replace("and marks originals as", "e marca os originais como")
    .replace("On startup, fills", "Na inicializa\u00e7\u00e3o, preenche")
    .replace("for legacy records missing a hash.", "em registros legados sem hash.")
    .replace("is for **deduplication**, not text search.", "serve para **deduplica\u00e7\u00e3o**, n\u00e3o para busca textual.")
    .replace("Environment variables", "Vari\u00e1veis de ambiente")
    .replace("| Variable | Default | Description |", "| Vari\u00e1vel | Padr\u00e3o | Descri\u00e7\u00e3o |")
    .replace("Consolidator interval", "Intervalo do consolidador")
    .replace("Jaccard threshold", "Threshold Jaccard")
    .replace("Cycles before concat fallback", "Ciclos antes do fallback concat")
    .replace("Char limit for LLM merge", "Limite de chars para merge via LLM")
    .replace("Default truncation in", "Truncamento default em")
    .replace("Primary merge host", "Host prim\u00e1rio para merge")
    .replace("Primary model", "Modelo prim\u00e1rio")
    .replace("Fallback model", "Modelo fallback")
    .replace("Fallback provider", "Provider fallback")
    .replace("full legacy deduplication", "deduplica\u00e7\u00e3o completa em bases legadas")
    .replace("ISC License", "Licen\u00e7a ISC")
    .replace("see [LICENSE]", "ver [LICENSE]")
    .replace("`fact_hash` backfill", "Backfill de `fact_hash`")
    .replace("access counters", "contadores de acesso")
    .replace("on-idle consolidator", "consolidador on-idle");
}

const bodyEn = `A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for persistent local memory. Lets agents (Cursor, Claude Desktop, etc.) store and retrieve business-rule nuances, architectural decisions, and domain knowledge without bloating the conversation context.

Built with **Node.js**, **TypeScript**, and **SQLite** \u00b7 Database: \`~/.local_mcp_learning.db\` \u00b7 **Version \`1.4.1\`**

## Quick start

\`\`\`bash
npm install -g my-local-storage-mcp
\`\`\`

Requires **Node.js 20+**. After install, use the \`my-local-storage-mcp\` command in your MCP client.

## Design principles

| Principle | What it means |
|---|---|
| **KISS** | Single SQLite file (\`~/.local_mcp_learning.db\`); no vector DB or heavy background services |
| **LLM-delegated indexing** | The agent assigns \`topic\` + \`keywords\` when saving ${dash} no server-side NLP or embeddings |
| **Zero cloud cost** | Local storage and recall; private data; no cloud API required for core memory |
| **On-idle compaction** | Background consolidator merges redundancy when idle ${dash} keeps recall signal clean over time |

## Prompts that prioritize the MCP

The agent invokes MCP tools only when the request makes the intent clear. Use explicit phrases to maximize recall and avoid missed saves:

| Moment | Example prompt | Tool |
|---|---|---|
| Session start | \`Before we start, recall anchors for topic java-legacy from my local MCP memory (compact).\` | \`recall_by_topic\` |
| Domain lookup | \`Search my local MCP memory for rules about PedidoVenda and N+1.\` | \`recall_facts\` |
| Load project context | \`What do we already have stored in local memory about this repo?\` | \`recall_facts\` / \`recall_by_topic\` |
| **Checkpoint save** | \`Save this to my MCP memory \u2014 confirmed.\` / \`Remember this for future sessions.\` | \`remember_fact\` |

**Suggested routine:** compact recall at session open \u2192 work \u2192 explicit checkpoint phrase when a nuance must persist.

<details>
<summary><strong>Installation &amp; Cursor setup</strong></summary>

### From npm (recommended)

\`\`\`bash
npm install -g my-local-storage-mcp
\`\`\`

### From Git (development)

\`\`\`bash
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
\`\`\`

Or clone the repo, run \`npm install\`, and point your MCP client to \`dist/index.js\`.

### Cursor (\`mcp.json\`)

\`\`\`json
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
\`\`\`

Consolidator env vars are optional. Without an AI provider, semantic merge is disabled (hash and Jaccard deduplication still work).

</details>

<details>
<summary><strong>MCP tools</strong></summary>

<details>
<summary><code>remember_fact</code> ${dash} store a learning</summary>

Stores a persistent learning. Deduplicates automatically via \`fact_hash\` (MD5 of normalized text).

| Parameter | Description |
|---|---|
| \`topic\` | Macro context (e.g. \`java-legacy\`, \`mcp-evolution\`) |
| \`keywords\` | Comma-separated tags for indexing |
| \`fact\` | The fact, rule, or decision |
| \`record_type\` | \`anchor\` (fundamental concepts) or \`detail\` (default) |
| \`priority\` | \`high\` (default) or \`low\` (temporary session context) |

> **Checkpoint (routine):** \`remember_fact\` is for confirmed learnings only. The agent must wait for an explicit save signal from you ${dash} not save while exploring or brainstorming.

| User says (examples) | Agent action |
|---|---|
| "Save this to my MCP memory." | Call \`remember_fact\` |
| "Remember this for next time." | Call \`remember_fact\` |
| "Yes, persist that nuance." | Call \`remember_fact\` |
| Vague approval during exploration | **Do not** call \`remember_fact\` |

Without a checkpoint phrase, the learning stays in the chat and is lost when the session ends.

</details>

<details>
<summary><code>recall_facts</code> ${dash} free-text search</summary>

Search across \`topic\`, \`keywords\`, or \`fact\` (LIKE). Returns up to 10 records; excludes \`merged\` entries.

| Parameter | Description |
|---|---|
| \`query\` | Search term |
| \`type_filter\` | \`all\`, \`anchor\`, or \`detail\` |
| \`format\` | \`full\` (default) or \`compact\` (**recommended**) |
| \`max_chars\` | Truncates \`detail\` only; anchors are never cut |
| \`limit\` | Max records (default: 10) |

\`\`\`
[anchor] java-legacy | hibernate,n+1 -> If X is null, PedidoVenda triggers N+1...
\`\`\`

</details>

<details>
<summary><code>recall_by_topic</code> ${dash} structured search</summary>

Exact topic search ${dash} less noise than \`recall_facts\`.

| Parameter | Description |
|---|---|
| \`topic\` | Exact topic (case-insensitive) |
| \`keyword\` | Optional filter within the topic |
| \`type_filter\`, \`format\`, \`max_chars\`, \`limit\` | Same as \`recall_facts\` |

Recommended at session start:

\`\`\`json
{ "topic": "java-legacy", "type_filter": "anchor", "format": "compact" }
\`\`\`

</details>

</details>

<details>
<summary><strong>Database schema</strong> (<code>local_learning</code>)</summary>

Automatic migration on startup ${dash} existing databases gain new columns without data loss.

\`\`\`sql
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
\`\`\`

Records with \`consolidation_status = 'merged'\` are hidden from recall.

</details>

<details>
<summary><strong>On-idle consolidator</strong></summary>

1. **Groups** records in the same \`topic\` with similar keywords (Jaccard >= threshold)
2. **Semantic merge** via local LLM when available
3. **Fallback** to concatenation after N cycles without a provider
4. **Writes** a consolidated \`anchor\` and marks originals as \`merged\`

</details>

<details>
<summary><strong><code>fact_hash</code> backfill</strong> (v1.4.1)</summary>

On startup, fills \`fact_hash\` for legacy records missing a hash. On collision, the oldest ID stays canonical; duplicates get \`merged\`. Idempotent.

\`fact_hash\` is for **deduplication**, not text search.

</details>

<details>
<summary><strong>Environment variables</strong></summary>

| Variable | Default | Description |
|---|---|---|
| \`MCP_CONSOLIDATION_INTERVAL_MINUTES\` | \`60\` | Consolidator interval |
| \`MCP_CONSOLIDATION_THRESHOLD\` | \`0.25\` | Jaccard threshold |
| \`MCP_CONSOLIDATION_MAX_PENDING_CYCLES\` | \`3\` | Cycles before concat fallback |
| \`MCP_AI_MAX_MERGE_CHARS\` | \`2000\` | Char limit for LLM merge |
| \`MCP_RECALL_DEFAULT_MAX_CHARS\` | \`400\` | Default truncation in \`format=compact\` |
| \`MCP_PRIMARY_HOST\` | ${dash} | Primary merge host |
| \`MCP_PRIMARY_MODEL\` | \`qwen2.5-1.5b\` | Primary model |
| \`MCP_PRIMARY_PROVIDER\` | \`openai\` | \`openai\` or \`ollama\` |
| \`MCP_FALLBACK_HOST\` | ${dash} | Fallback host |
| \`MCP_FALLBACK_MODEL\` | \`qwen2.5:3b\` | Fallback model |
| \`MCP_FALLBACK_PROVIDER\` | \`ollama\` | Fallback provider |

</details>

<details>
<summary><strong>Changelog</strong></summary>

**v1.4.1** ${dash} \`fact_hash\` backfill \u00b7 full legacy deduplication

**v1.4.0** ${dash} \`format=compact\` \u00b7 \`recall_by_topic\` \u00b7 access counters \u00b7 checkpoint

**v1.3.0** ${dash} on-idle consolidator \u00b7 anchor/detail \u00b7 \`fact_hash\`

</details>

---

ISC License ${dash} see [LICENSE](LICENSE).`;

const bodyPt = translateToPt(bodyEn);

const header = `# Local Storage MCP Server
<img width="1280" height="632" alt="my-local-storage-mcp" src="https://github.com/user-attachments/assets/cfeb0571-957a-4e4c-ae75-5f0ee3a9e121" />

[![Build](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/avm-sistemas/my-local-storage-mcp/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/my-local-storage-mcp.svg)](https://www.npmjs.com/package/my-local-storage-mcp)
`;

const readme = `${header}
<details>
<summary><strong>Portugu\u00eas (BR)</strong></summary>

${bodyPt}

</details>

---

## English

${bodyEn}
`;

const readmePath = path.join(root, "README.md");
const ptBrPath   = path.join(root, "README.pt-BR.md");

fs.writeFileSync(readmePath, readme, "utf8");
if (fs.existsSync(ptBrPath)) fs.unlinkSync(ptBrPath);

const content = fs.readFileSync(readmePath, "utf8");
console.log("OK", {
  memoria: content.includes("mem\u00f3ria"),
  ptDetails: content.includes("<summary><strong>Portugu\u00eas (BR)</strong></summary>"),
  enHeading: content.includes("## English"),
  noExternalPt: !fs.existsSync(ptBrPath)
});
