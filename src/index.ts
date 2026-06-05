#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { createHash } from "crypto";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Configuração via variáveis de ambiente
// ---------------------------------------------------------------------------
const dbPath = path.join(os.homedir(), ".local_mcp_learning.db");

interface AiProvider {
  host:     string;
  model:    string;
  provider: "ollama" | "openai";
  label:    string;
}

// Monta a lista de providers na ordem de preferência: primário → fallback
// Se uma variável não estiver definida, o provider é ignorado silenciosamente
function buildProviders(): AiProvider[] {
  const providers: AiProvider[] = [];

  if (process.env.MCP_PRIMARY_HOST) {
    providers.push({
      host:     process.env.MCP_PRIMARY_HOST,
      model:    process.env.MCP_PRIMARY_MODEL    ?? "qwen2.5-1.5b",
      provider: (process.env.MCP_PRIMARY_PROVIDER ?? "openai") as "ollama" | "openai",
      label:    "primário"
    });
  }

  if (process.env.MCP_FALLBACK_HOST) {
    providers.push({
      host:     process.env.MCP_FALLBACK_HOST,
      model:    process.env.MCP_FALLBACK_MODEL    ?? "qwen2.5:3b",
      provider: (process.env.MCP_FALLBACK_PROVIDER ?? "ollama") as "ollama" | "openai",
      label:    "fallback"
    });
  }

  return providers;
}

const AI_PROVIDERS            = buildProviders();
const INTERVAL_MS             = (parseInt(process.env.MCP_CONSOLIDATION_INTERVAL_MINUTES ?? "60")) * 60_000;
const JACCARD_THRESHOLD       = parseFloat(process.env.MCP_CONSOLIDATION_THRESHOLD ?? "0.25");
const MAX_PENDING_CYCLES      = parseInt(process.env.MCP_CONSOLIDATION_MAX_PENDING_CYCLES ?? "3");
const MAX_MERGE_CHARS         = parseInt(process.env.MCP_AI_MAX_MERGE_CHARS ?? "2000");

// ---------------------------------------------------------------------------
// Banco de dados
// ---------------------------------------------------------------------------
let db: Database;

async function initDb() {
  db = await open({ filename: dbPath, driver: sqlite3.Database });

  // PASSO 1: garante que a tabela base existe (colunas originais apenas)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS local_learning (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      topic      TEXT    NOT NULL,
      keywords   TEXT    NOT NULL,
      fact       TEXT    NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // PASSO 2: migração segura — adiciona colunas novas em bases existentes
  // Precisa rodar ANTES de criar índices que dependem dessas colunas
  const cols     = await db.all(`PRAGMA table_info(local_learning)`);
  const colNames = cols.map((c: any) => c.name);
  if (!colNames.includes("fact_hash"))            await db.run(`ALTER TABLE local_learning ADD COLUMN fact_hash            TEXT`);
  if (!colNames.includes("record_type"))          await db.run(`ALTER TABLE local_learning ADD COLUMN record_type          TEXT NOT NULL DEFAULT 'detail'`);
  if (!colNames.includes("priority"))             await db.run(`ALTER TABLE local_learning ADD COLUMN priority             TEXT NOT NULL DEFAULT 'high'`);
  if (!colNames.includes("consolidation_status")) await db.run(`ALTER TABLE local_learning ADD COLUMN consolidation_status TEXT NOT NULL DEFAULT 'ok'`);
  if (!colNames.includes("pending_cycles"))       await db.run(`ALTER TABLE local_learning ADD COLUMN pending_cycles       INTEGER NOT NULL DEFAULT 0`);

  // PASSO 3: índices — agora todas as colunas já existem com certeza
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_learning_lookup
      ON local_learning(topic, keywords);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_hash
      ON local_learning(fact_hash)
      WHERE fact_hash IS NOT NULL;
  `);
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function factHash(fact: string): string {
  const normalized = fact.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("md5").update(normalized).digest("hex");
}

function keywordSet(keywords: string): Set<string> {
  return new Set(
    keywords.toLowerCase().split(",")
      .map(k => k.trim())
      .filter(Boolean)
  );
}

function jaccardScore(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union        = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ---------------------------------------------------------------------------
// AI: health check e merge com fallback automático
// ---------------------------------------------------------------------------

async function isProviderAvailable(p: AiProvider): Promise<boolean> {
  const endpoint = p.provider === "openai"
    ? `${p.host}/v1/models`   // LocalAI e compatíveis OpenAI
    : `${p.host}/api/tags`;   // Ollama nativo
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function mergeWithProvider(p: AiProvider, facts: string[]): Promise<string | null> {
  const totalChars = facts.reduce((sum, f) => sum + f.length, 0);
  if (totalChars > MAX_MERGE_CHARS) {
    // Conteúdo muito grande para o modelo — cai para concatenação no chamador
    console.error(`[Consolidador][${p.label}] Grupo grande demais (${totalChars} chars > ${MAX_MERGE_CHARS}). Usando concatenação.`);
    return null;
  }

  const numbered   = facts.map((f, i) => `REGISTRO ${i + 1}:\n${f}`).join("\n\n");
  const systemText = [
    "Você é um assistente técnico consolidando uma base de conhecimento de software.",
    "Regras: não perca informação técnica, elimine apenas repetições literais,",
    "mantenha nomes de classes, tabelas, arquivos e FKs exatos.",
    "Responda APENAS com o texto consolidado, sem preâmbulo."
  ].join(" ");

  try {
    let endpoint: string;
    let body: object;

    if (p.provider === "openai") {
      endpoint = `${p.host}/v1/chat/completions`;
      body = {
        model:    p.model,
        messages: [
          { role: "system", content: systemText },
          { role: "user",   content: numbered }
        ],
        stream: false
      };
    } else {
      endpoint = `${p.host}/api/generate`;
      body = {
        model:  p.model,
        prompt: `${systemText}\n\n${numbered}`,
        stream: false
      };
    }

    const res = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(60_000)
    });

    if (!res.ok) return null;
    const data: any = await res.json();

    return p.provider === "openai"
      ? data.choices?.[0]?.message?.content?.trim() ?? null
      : data.response?.trim() ?? null;

  } catch {
    return null;
  }
}

// Tenta cada provider na ordem. Retorna o resultado do primeiro que responder
// e o label do provider usado (para log). Retorna null se todos falharem.
async function aiMerge(facts: string[]): Promise<{ result: string; label: string } | null> {
  for (const provider of AI_PROVIDERS) {
    const available = await isProviderAvailable(provider);
    if (!available) {
      console.error(`[Consolidador] Provider ${provider.label} (${provider.host}) indisponível. Tentando próximo.`);
      continue;
    }

    const result = await mergeWithProvider(provider, facts);
    if (result) {
      return { result, label: provider.label };
    }

    console.error(`[Consolidador] Provider ${provider.label} disponível mas merge falhou. Tentando próximo.`);
  }

  return null; // todos os providers falharam
}

// ---------------------------------------------------------------------------
// Consolidador — roda no idle do event loop
// ---------------------------------------------------------------------------

async function runConsolidation(): Promise<void> {
  try {
    const rows: any[] = await db.all(
      `SELECT id, topic, keywords, fact, pending_cycles, consolidation_status
       FROM local_learning
       WHERE consolidation_status != 'merged'
       ORDER BY topic, created_at`
    );

    if (rows.length < 2) return;

    // --- FASE 1: Detecção de grupos por Jaccard ---
    const groups:  number[][] = [];
    const assigned            = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      if (assigned.has(rows[i].id)) continue;

      const group = [rows[i].id];
      const kwI   = keywordSet(rows[i].keywords);

      for (let j = i + 1; j < rows.length; j++) {
        if (assigned.has(rows[j].id))           continue;
        if (rows[j].topic !== rows[i].topic)    continue;

        const score = jaccardScore(kwI, keywordSet(rows[j].keywords));
        if (score >= JACCARD_THRESHOLD) {
          group.push(rows[j].id);
          assigned.add(rows[j].id);
        }
      }

      if (group.length > 1) {
        assigned.add(rows[i].id);
        groups.push(group);
      }
    }

    if (groups.length === 0) return;

    console.error(`[Consolidador] ${groups.length} grupo(s) detectado(s) para consolidação.`);

    // --- FASE 2: Merge por grupo ---
    for (const group of groups) {
      const members: any[] = rows.filter(r => group.includes(r.id));
      const maxPending     = Math.max(...members.map(r => r.pending_cycles));
      const forceFallback  = maxPending >= MAX_PENDING_CYCLES;

      let mergedFact: string | null  = null;
      let mergeLabel: string         = "concatenação";

      if (!forceFallback && AI_PROVIDERS.length > 0) {
        // Tenta merge semântico — primário primeiro, depois fallback
        const merged = await aiMerge(members.map(r => r.fact));
        if (merged) {
          mergedFact = merged.result;
          mergeLabel = `semântico via ${merged.label}`;
        }
      }

      if (!mergedFact && forceFallback) {
        // Todos os providers falharam por MAX_PENDING_CYCLES ciclos consecutivos
        // Concatenação estruturada como último recurso — nunca perde informação
        mergedFact = members.map((r, i) => `[Fonte ${i + 1}] ${r.fact}`).join("\n\n");
        mergeLabel = "concatenação (fallback forçado)";
      }

      if (!mergedFact) {
        // Ainda há esperança de um provider voltar — marca pendente e aguarda
        const ids = members.map(r => r.id);
        await db.run(
          `UPDATE local_learning
           SET consolidation_status = 'pending_merge',
               pending_cycles       = pending_cycles + 1
           WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids
        );
        console.error(`[Consolidador] Grupo [${ids.join(",")}] marcado como pending_merge (ciclo ${maxPending + 1}/${MAX_PENDING_CYCLES}).`);
        continue;
      }

      // --- FASE 3: Gravação atômica ---
      const anchor = members[0];
      const allKw  = [...new Set(
        members.flatMap(r => r.keywords.split(",").map((k: string) => k.trim()))
      )].join(", ");
      const hash   = factHash(mergedFact);

      await db.run("BEGIN TRANSACTION");
      try {
        await db.run(
          `INSERT INTO local_learning
             (topic, keywords, fact, fact_hash, record_type, priority, consolidation_status)
           VALUES (?, ?, ?, ?, 'anchor', 'high', 'ok')`,
          [anchor.topic, allKw, mergedFact, hash]
        );

        const ids = members.map(r => r.id);
        await db.run(
          `UPDATE local_learning
           SET consolidation_status = 'merged'
           WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids
        );

        await db.run("COMMIT");
        console.error(`[Consolidador] Grupo [${ids.join(",")}] consolidado (${mergeLabel}).`);
      } catch (err) {
        await db.run("ROLLBACK");
        throw err;
      }
    }
  } catch (err: any) {
    console.error("[Consolidador] Erro no ciclo:", err.message);
  }
}

function scheduleConsolidation() {
  setTimeout(async () => {
    await runConsolidation();
    scheduleConsolidation();
  }, INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "my-local-storage-mcp", version: "1.3.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "remember_fact",
        description: "Armazena um aprendizado, insight, decisão arquitetural ou preferência técnica de forma persistente. Evita duplicatas automaticamente.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "O assunto/contexto macro (ex: 'dotnet', 'infraestrutura', 'java-legacy')"
            },
            keywords: {
              type: "string",
              description: "Palavras-chave relevantes para indexação, separadas por vírgula (ex: 'dapper, performance, mpc, garbage-collector')"
            },
            fact: {
              type: "string",
              description: "O fato objetivo, código, regra ou decisão que precisa ser memorizada."
            },
            record_type: {
              type: "string",
              enum: ["anchor", "detail"],
              description: "Use 'anchor' para conceitos fundamentais, fluxos de negócio, índices de arquitetura e diagramas — registros que sobem primeiro em qualquer busca. Use 'detail' (padrão) para hbm.xml específicos, campos, FKs e análises pontuais."
            },
            priority: {
              type: "string",
              enum: ["high", "low"],
              description: "Use 'high' (padrão) para decisões duráveis. Use 'low' para contexto temporário de sessão."
            }
          },
          required: ["topic", "keywords", "fact"]
        }
      },
      {
        name: "recall_facts",
        description: "Busca na memória local por fatos aprendidos anteriormente. Retorna no máximo 10 registros, priorizando âncoras e alta prioridade. Registros já consolidados não aparecem.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "O termo, palavra-chave ou conceito que deseja resgatar da memória."
            },
            type_filter: {
              type: "string",
              enum: ["all", "anchor", "detail"],
              description: "Filtra por tipo. Use 'anchor' no início de uma sessão para carregar só o contexto de alto nível (economiza tokens). Padrão: 'all'."
            }
          },
          required: ["query"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "remember_fact") {
      const {
        topic,
        keywords,
        fact,
        record_type = "detail",
        priority    = "high"
      } = args as { topic: string; keywords: string; fact: string; record_type?: string; priority?: string };

      const sanitizedTopic    = topic.toLowerCase().trim();
      const sanitizedKeywords = keywords.toLowerCase().trim();
      const hash              = factHash(fact);

      const existing = await db.get(
        "SELECT id FROM local_learning WHERE fact_hash = ?",
        [hash]
      );

      if (existing) {
        await db.run(
          "UPDATE local_learning SET created_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existing.id]
        );
        return {
          content: [{ type: "text", text: `[Memória Local]: Fato já registrado (ID ${existing.id}). Relevância atualizada.` }]
        };
      }

      await db.run(
        `INSERT INTO local_learning
           (topic, keywords, fact, fact_hash, record_type, priority)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sanitizedTopic, sanitizedKeywords, fact, hash, record_type, priority]
      );

      return {
        content: [{ type: "text", text: `[Memória Local]: Fato indexado sob '${sanitizedTopic}' [${record_type}/${priority}].` }]
      };
    }

    if (name === "recall_facts") {
      const {
        query,
        type_filter = "all"
      } = args as { query: string; type_filter?: string };

      const searchPattern = `%${query.toLowerCase().trim()}%`;
      const typeClause    = type_filter !== "all"
        ? `AND record_type = '${type_filter === "anchor" ? "anchor" : "detail"}'`
        : "";

      const rows = await db.all(
        `SELECT topic, keywords, fact, record_type, priority, created_at
         FROM local_learning
         WHERE (topic LIKE ? OR keywords LIKE ? OR fact LIKE ?)
           AND consolidation_status != 'merged'
           ${typeClause}
         ORDER BY
           CASE record_type WHEN 'anchor' THEN 0 ELSE 1 END,
           CASE priority    WHEN 'high'   THEN 0 ELSE 1 END,
           created_at DESC
         LIMIT 10`,
        [searchPattern, searchPattern, searchPattern]
      );

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "Nenhum aprendizado local correspondente foi encontrado." }] };
      }

      const formattedResult = rows.map(r =>
        `---\n• Tópico: ${r.topic} [${r.record_type}]\n• Tags: ${r.keywords}\n• Data: ${r.created_at}\n• Fato: ${r.fact}`
      ).join("\n\n");

      return { content: [{ type: "text", text: formattedResult }] };
    }

    throw new Error(`Tool interna '${name}' não implementada.`);

  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Erro interno no servidor MCP: ${error.message}` }]
    };
  }
});

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

async function main() {
  await initDb();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (AI_PROVIDERS.length > 0) {
    const summary = AI_PROVIDERS.map(p => `${p.label}: ${p.host} (${p.model}/${p.provider})`).join(" | ");
    console.error(`[Consolidador] Providers configurados → ${summary}`);
    console.error(`[Consolidador] Intervalo: ${INTERVAL_MS / 60_000} min | Threshold Jaccard: ${JACCARD_THRESHOLD} | Max pending: ${MAX_PENDING_CYCLES}`);
    scheduleConsolidation();
  } else {
    console.error("[Consolidador] Nenhum provider AI configurado. Merge semântico desabilitado.");
  }
}

main().catch((err) => {
  console.error("Falha crítica ao iniciar o servidor MCP:", err);
  process.exit(1);
});
