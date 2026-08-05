// ── Secrets Manager ───────────────────────────────────────────────────────────
//
// In-memory per-agent secret store.
// Values are kept in memory only and never returned in list responses.
// No database backing — data is lost on server restart.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SecretEntry {
  name: string;
  /** ISO 8601 timestamp of when this secret was last written. */
  updatedAt: string;
}

export interface SecretCreateInput {
  name: string;
  value: string;
}

export type SecretUpdateInput = SecretCreateInput;

export type SecretsError =
  | { code: "not_found"; message: string }
  | { code: "already_exists"; message: string }
  | { code: "validation_error"; message: string };

// ── Internal store ────────────────────────────────────────────────────────────

// Outer map: agentId → (secretName → secretValue)
const store = new Map<string, Map<string, string>>();

function agentMap(agentId: string): Map<string, string> {
  let map = store.get(agentId);
  if (!map) {
    map = new Map();
    store.set(agentId, map);
  }
  return map;
}

// ── Operations ────────────────────────────────────────────────────────────────

/**
 * List the names (not values) of all secrets for an agent.
 * Returns an empty array if the agent has no secrets.
 */
export function listSecretNames(agentId: string): SecretEntry[] {
  const map = store.get(agentId);
  if (!map) return [];
  return Array.from(map.keys())
    .sort()
    .map((name) => ({ name, updatedAt: "" })); // values deliberately omitted
}

/**
 * Create a new secret for an agent. Fails if the name already exists.
 */
export function createSecret(
  agentId: string,
  input: SecretCreateInput
): SecretEntry | SecretsError {
  const { name, value } = input;

  if (!name.trim()) {
    return { code: "validation_error", message: "Secret name must not be empty" };
  }

  const map = agentMap(agentId);
  if (map.has(name)) {
    return { code: "already_exists", message: `Secret "${name}" already exists for this agent` };
  }

  map.set(name, value);
  return { name, updatedAt: new Date().toISOString() };
}

/**
 * Update an existing secret's value. Fails if the name does not exist.
 */
export function updateSecret(
  agentId: string,
  input: SecretUpdateInput
): SecretEntry | SecretsError {
  const { name, value } = input;

  const map = store.get(agentId);
  if (!map || !map.has(name)) {
    return { code: "not_found", message: `Secret "${name}" not found for this agent` };
  }

  map.set(name, value);
  return { name, updatedAt: new Date().toISOString() };
}

/**
 * Delete a secret by name. Fails if the name does not exist.
 */
export function deleteSecret(
  agentId: string,
  name: string
): { deleted: true; name: string } | SecretsError {
  const map = store.get(agentId);
  if (!map || !map.has(name)) {
    return { code: "not_found", message: `Secret "${name}" not found for this agent` };
  }

  map.delete(name);
  return { deleted: true, name };
}

/** Type guard: narrows a result to a SecretsError. */
export function isSecretsError(v: unknown): v is SecretsError {
  return (
    typeof v === "object" &&
    v !== null &&
    "code" in v &&
    "message" in v
  );
}
