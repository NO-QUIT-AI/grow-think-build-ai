// Server-only helper. Import only inside server-function handlers.
function requireApiKey() {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("GitHub connection service is not configured.");
  return key;
}
export async function authorizeAppUserOAuth(params: { gatewayBaseUrl: string; connectorId: string; appUserId: string; clientAPIKey: string; returnUrl: string; credentialsConfiguration?: Record<string, unknown> }) {
  const response = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, { method: "POST", headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json", "X-Client-Api-Key": params.clientAPIKey }, body: JSON.stringify({ connector_id: params.connectorId, app_user_id: params.appUserId, return_url: params.returnUrl, credentials_configuration: params.credentialsConfiguration }) });
  if (!response.ok) throw new Error(`GitHub consent failed (${response.status}).`);
  const body = await response.json() as { authorization_url?: string; session_id?: string };
  if (!body.authorization_url) throw new Error("GitHub consent link missing.");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}
export async function exchangeAppUserOAuthCode(gatewayBaseUrl: string, code: string) {
  const response = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, { method: "POST", headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
  if (!response.ok) throw new Error(`GitHub connection failed (${response.status}).`);
  const body = await response.json() as { api_key?: string; connector_id?: string };
  if (!body.api_key || !body.connector_id) throw new Error("GitHub connection incomplete.");
  return { connectionAPIKey: body.api_key, connectorId: body.connector_id };
}
export async function callAsAppUser(params: { gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string; path: string; init?: RequestInit; requiredScopes?: string[] }) {
  const headers = new Headers(params.init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", params.connectionAPIKey);
  if (params.requiredScopes?.length) headers.set("X-Lovable-Required-Scopes", params.requiredScopes.join(" "));
  return fetch(`${params.gatewayBaseUrl}/${params.connectorId}/${params.path.replace(/^\//, "")}`, { ...params.init, headers });
}
export async function appUserReconnectRequired(response: Response) {
  if (response.status !== 401) return false;
  const body = await response.clone().json().catch(() => null) as { type?: string } | null;
  return typeof body?.type === "string" && body.type.startsWith("credential_");
}
export async function disconnectAppUser(params: { gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string }) {
  const response = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/connection`, { method: "DELETE", headers: { Authorization: `Bearer ${requireApiKey()}`, "X-Connection-Api-Key": params.connectionAPIKey, "Content-Type": "application/json" }, body: JSON.stringify({ connector_id: params.connectorId }) });
  if (!response.ok) throw new Error(`GitHub disconnect failed (${response.status}).`);
}