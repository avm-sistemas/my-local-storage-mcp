import { Database } from "sqlite";
import type { RecallFormat, RecallOptions } from "./plugin-types.js";
import { buildScopeSql, parseContextList, parseVisibility, type RecallScopeFilter, type Visibility } from "./contexts.js";

interface RecallRow {
  id:           number;
  topic:        string;
  keywords:     string;
  fact:         string;
  record_type:  string;
  priority:     string;
  context:      string;
  visibility:   string;
  author:       string | null;
  analyst_id:   string | null;
  created_at:   string;
}

let db: Database;
let defaultMaxChars: number;

export function initRecall(database: Database, maxChars: number): void {
  db = database;
  defaultMaxChars = maxChars;
}

function buildTypeClause(typeFilter: string): string {
  if (typeFilter === "anchor") return "AND record_type = 'anchor'";
  if (typeFilter === "detail") return "AND record_type = 'detail'";
  return "";
}

function truncateFact(fact: string, recordType: string, maxChars?: number): string {
  if (!maxChars || recordType === "anchor") return fact;
  if (fact.length <= maxChars) return fact;
  return fact.slice(0, maxChars) + "...";
}

function formatRecallRow(row: RecallRow, format: RecallFormat, maxChars?: number): string {
  const fact = truncateFact(row.fact, row.record_type, maxChars);
  const scope = `${row.context}/${row.visibility}`;
  if (format === "compact") {
    return `[${row.record_type}] ${scope} | ${row.topic} | ${row.keywords} -> ${fact}`;
  }
  const token = row.analyst_id ?? row.author;
  const authorLine = token ? `\n? Analista (token): ${token}` : "";
  return `---\n? Contexto: ${scope}\n? Tópico: ${row.topic} [${row.record_type}]\n? Tags: ${row.keywords}\n? Data: ${row.created_at}${authorLine}\n? Fato: ${fact}`;
}

async function touchAccess(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.run(
    `UPDATE local_learning
     SET access_count = access_count + 1,
         last_accessed = CURRENT_TIMESTAMP
     WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
}

export async function executeRecallWithIds(
  whereClause: string,
  params: unknown[],
  options: RecallOptions
): Promise<{ text: string; ids: number[] }> {
  const {
    type_filter = "all",
    format      = "full",
    max_chars,
    limit       = 10,
    context,
    contexts,
    visibility
  } = options;

  const effectiveMaxChars = max_chars ?? (format === "compact" ? defaultMaxChars : undefined);
  const scopeSql = buildScopeSql({
    context,
    contexts,
    visibility: visibility?.trim()
      ? parseVisibility(visibility, "personal")
      : undefined
  });

  const rows: RecallRow[] = await db.all(
    `SELECT id, topic, keywords, fact, record_type, priority, context, visibility, analyst_id, author, created_at
     FROM local_learning
     WHERE ${whereClause}
       AND consolidation_status != 'merged'
       ${buildTypeClause(type_filter)}
       ${scopeSql.clause}
     ORDER BY
       CASE record_type WHEN 'anchor' THEN 0 ELSE 1 END,
       CASE priority    WHEN 'high'   THEN 0 ELSE 1 END,
       access_count DESC,
       created_at DESC
     LIMIT ?`,
    [...params, ...scopeSql.params, limit]
  );

  if (rows.length === 0) {
    return { text: "Nenhum aprendizado local correspondente foi encontrado.", ids: [] };
  }

  await touchAccess(rows.map(r => r.id));
  return {
    text: rows.map(r => formatRecallRow(r, format, effectiveMaxChars)).join("\n\n"),
    ids: rows.map(r => r.id)
  };
}

export async function executeRecall(
  whereClause: string,
  params: unknown[],
  options: RecallOptions
): Promise<string> {
  return (await executeRecallWithIds(whereClause, params, options)).text;
}

export async function touchGraphHits(factIds: number[]): Promise<void> {
  if (factIds.length === 0) return;
  await db.run(
    `UPDATE local_learning
     SET graph_hit_count = graph_hit_count + 1,
         team_sync_status = CASE
           WHEN COALESCE(visibility, 'personal') = 'team' AND team_sync_status = 'synced' THEN 'pending'
           ELSE team_sync_status
         END
     WHERE id IN (${factIds.map(() => "?").join(",")})`,
    factIds
  );
}
