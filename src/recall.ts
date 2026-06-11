import { Database } from "sqlite";
import type { RecallFormat, RecallOptions } from "./plugin-types.js";

interface RecallRow {
  id:           number;
  topic:        string;
  keywords:     string;
  fact:         string;
  record_type:  string;
  priority:     string;
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
  if (format === "compact") {
    return `[${row.record_type}] ${row.topic} | ${row.keywords} -> ${fact}`;
  }
  return `---\n? Tópico: ${row.topic} [${row.record_type}]\n? Tags: ${row.keywords}\n? Data: ${row.created_at}\n? Fato: ${fact}`;
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

export async function executeRecall(
  whereClause: string,
  params: unknown[],
  options: RecallOptions
): Promise<string> {
  const {
    type_filter = "all",
    format      = "full",
    max_chars,
    limit       = 10
  } = options;

  const effectiveMaxChars = max_chars ?? (format === "compact" ? defaultMaxChars : undefined);

  const rows: RecallRow[] = await db.all(
    `SELECT id, topic, keywords, fact, record_type, priority, created_at
     FROM local_learning
     WHERE ${whereClause}
       AND consolidation_status != 'merged'
       ${buildTypeClause(type_filter)}
     ORDER BY
       CASE record_type WHEN 'anchor' THEN 0 ELSE 1 END,
       CASE priority    WHEN 'high'   THEN 0 ELSE 1 END,
       access_count DESC,
       created_at DESC
     LIMIT ?`,
    [...params, limit]
  );

  if (rows.length === 0) {
    return "Nenhum aprendizado local correspondente foi encontrado.";
  }

  await touchAccess(rows.map(r => r.id));
  return rows.map(r => formatRecallRow(r, format, effectiveMaxChars)).join("\n\n");
}
