export interface TeamsHealthResponse {
  ok: boolean;
  service: string;
  version: string;
}

export interface AnalystLicenseResponse {
  valid: true;
  analyst_id: string;
  member_id: string;
  org_id: string;
  org_slug: string;
  plan: string;
  display_name: string;
  role: string;
}

export interface AnalystLicenseConfig {
  apiUrl: string;
  accessKey: string;
  enabled: boolean;
}

export function teamsLicenseConfigFromEnv(env: NodeJS.ProcessEnv): AnalystLicenseConfig | null {
  const apiUrl = env.MCP_TEAMS_API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) {
    return null;
  }
  const accessKey = env.MCP_TEAMS_ACCESS_KEY?.trim() ?? "";
  const enabled = env.MCP_TEAMS_LICENSE_VALIDATE !== "0";
  return { apiUrl, accessKey, enabled };
}

export async function checkTeamsApiHealth(apiUrl: string): Promise<TeamsHealthResponse | null> {
  try {
    const res = await fetch(`${apiUrl}/health`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      return null;
    }
    return await res.json() as TeamsHealthResponse;
  } catch {
    return null;
  }
}

export type AnalystLicenseFailure =
  | { kind: "config"; message: string }
  | { kind: "network"; message: string }
  | { kind: "unauthorized"; message: string }
  | { kind: "invalid"; error: string; message: string };

export async function validateAnalystLicenseRemote(
  cfg: AnalystLicenseConfig,
  analystId: string
): Promise<{ ok: true; license: AnalystLicenseResponse } | { ok: false; failure: AnalystLicenseFailure }> {
  if (!cfg.accessKey) {
    return {
      ok: false,
      failure: {
        kind: "config",
        message: "MCP_TEAMS_ACCESS_KEY não configurada ? necessária para validar licença team."
      }
    };
  }

  const params = new URLSearchParams({ analyst_id: analystId });
  let res: Response;
  try {
    res = await fetch(`${cfg.apiUrl}/licenses/validate?${params}`, {
      headers: {
        Authorization: `Bearer ${cfg.accessKey}`,
        Accept: "application/json",
        "X-Analyst-Id": analystId
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      failure: {
        kind: "network",
        message: `teams-memory-api indisponível (${cfg.apiUrl}): ${msg}`
      }
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      failure: {
        kind: "unauthorized",
        message: "MCP_TEAMS_ACCESS_KEY rejeitada pela teams-memory-api."
      }
    };
  }

  const body = await res.json() as Partial<AnalystLicenseResponse> & { valid?: boolean; error?: string };

  if (res.ok && body.analyst_id) {
    return { ok: true, license: body as AnalystLicenseResponse };
  }

  const error = body.error ?? "analyst_not_licensed";
  const messages: Record<string, string> = {
    analyst_id_required: "analyst_id obrigatório para visibility=team.",
    analyst_id_invalid_format: "analyst_id deve ser UUID (token de licença).",
    analyst_not_licensed: "Token de analista não cadastrado ou inativo nesta organização."
  };

  return {
    ok: false,
    failure: {
      kind: "invalid",
      error,
      message: messages[error] ?? `Licença inválida: ${error}`
    }
  };
}

export async function probeTeamsLicenseAtStartup(env: NodeJS.ProcessEnv): Promise<void> {
  const cfg = teamsLicenseConfigFromEnv(env);
  if (!cfg) {
    return;
  }

  const health = await checkTeamsApiHealth(cfg.apiUrl);
  if (!health?.ok) {
    console.error(`[Teams] Health falhou em ${cfg.apiUrl}/health ? validação de licença team pode falhar.`);
    return;
  }

  console.error(
    `[Teams] ${health.service} ${health.version} ok em ${cfg.apiUrl}/health`
    + (cfg.enabled ? "" : " (MCP_TEAMS_LICENSE_VALIDATE=0 ? remota desligada)")
  );
}
