export type Visibility = "personal" | "team";

export interface RememberFields {
  context: string;
  visibility: Visibility;
  /** Token UUID do analista (coluna SQLite `analyst_id`; licenciamento teams). */
  analystId: string | null;
}

/** UUID (GUID) ? token de licença / identidade do analista no produto teams. */
const ANALYST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeAnalystId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !ANALYST_ID_UUID_RE.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function warnInvalidMcpAnalystId(env: NodeJS.ProcessEnv): void {
  const raw = env.MCP_ANALYST_ID?.trim();
  if (!raw) {
    return;
  }
  const normalized = normalizeAnalystId(raw);
  if (!normalized) {
    console.error(
      `[Contextos] MCP_ANALYST_ID ignorado: deve ser UUID (token de licença/analista), recebido: ${raw.slice(0, 36)}`
    );
    return;
  }
  console.error(`[Contextos] MCP_ANALYST_ID: ${normalized.slice(0, 8)}?`);
}

export interface RecallScopeFilter {
  /** Filtro opcional da tool (um projeto). */
  context?: string;
  /** Filtro opcional da tool (vários projetos, ex.: logone + lab num spike). */
  contexts?: string[];
  /** Filtro opcional: personal | team */
  visibility?: Visibility;
}

const VISIBILITY_VALUES: Visibility[] = ["personal", "team"];

export function normalizeContext(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

export function parseVisibility(value: string | undefined, fallback: Visibility): Visibility {
  const v = (value ?? fallback).toLowerCase().trim();
  if (VISIBILITY_VALUES.includes(v as Visibility)) {
    return v as Visibility;
  }
  return fallback;
}

export function parseContextList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return [...new Set(
    raw.split(",")
      .map(normalizeContext)
      .filter(Boolean)
  )];
}

export interface ResolveRememberResult {
  fields: RememberFields;
  /** Valor informado em analyst_id/author que não passou na validação UUID. */
  invalidAnalystId?: string;
}

/**
 * Campos de escopo no remember: sempre decididos pela IA por registro.
 * Env só complementa analystId (token UUID), nunca trava projeto/visibilidade.
 */
export function resolveRememberFields(
  args: { context?: string; visibility?: string; analyst_id?: string; author?: string },
  env: NodeJS.ProcessEnv
): ResolveRememberResult {
  const context = args.context?.trim()
    ? normalizeContext(args.context)
    : "default";

  const visibility = args.visibility?.trim()
    ? parseVisibility(args.visibility, "personal")
    : "personal";

  const rawAnalyst =
    args.analyst_id?.trim()
    || args.author?.trim()
    || env.MCP_ANALYST_ID?.trim()
    || "";

  if (!rawAnalyst) {
    return { fields: { context, visibility, analystId: null } };
  }

  const analystId = normalizeAnalystId(rawAnalyst);
  if (!analystId) {
    return {
      fields: { context, visibility, analystId: null },
      invalidAnalystId: rawAnalyst
    };
  }

  return { fields: { context, visibility, analystId } };
}

export function recallScopeFromArgs(args: {
  context?: string;
  contexts?: string;
  visibility?: string;
}): RecallScopeFilter {
  const fromList = parseContextList(args.contexts);
  const visibilityRaw = args.visibility?.trim().toLowerCase();
  const visibility =
    visibilityRaw === "personal" || visibilityRaw === "team"
      ? (visibilityRaw as Visibility)
      : undefined;

  if (fromList.length > 0) {
    return { contexts: fromList, visibility };
  }
  if (args.context?.trim()) {
    return { context: args.context, visibility };
  }
  return { visibility };
}

export function buildScopeSql(filter: RecallScopeFilter): { clause: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];

  const ctxList = filter.contexts?.length
    ? filter.contexts
    : filter.context?.trim()
      ? [normalizeContext(filter.context)]
      : [];

  if (ctxList.length === 1) {
    parts.push("AND context = ?");
    params.push(ctxList[0]);
  } else if (ctxList.length > 1) {
    parts.push(`AND context IN (${ctxList.map(() => "?").join(", ")})`);
    params.push(...ctxList);
  }

  if (filter.visibility) {
    parts.push("AND visibility = ?");
    params.push(filter.visibility);
  }

  return { clause: parts.join(" "), params };
}
