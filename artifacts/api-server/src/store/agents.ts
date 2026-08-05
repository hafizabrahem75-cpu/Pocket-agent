import { randomUUID } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatus = "active" | "inactive" | "paused";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  /** Workspace-relative path this agent operates on (e.g. "artifacts/pocket-agent-ui"). */
  workspacePath?: string;
  /** Explicit preview URL for this agent's dev server. Auto-detected when omitted. */
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ── In-memory store ───────────────────────────────────────────────────────────

const store = new Map<string, Agent>();

// ── Store operations ──────────────────────────────────────────────────────────

export function getAllAgents(): Agent[] {
  return [...store.values()];
}

export function getAgent(id: string): Agent | undefined {
  return store.get(id);
}

export function createAgent(
  data: Pick<Agent, "name" | "status"> & { description?: string; workspacePath?: string; previewUrl?: string }
): Agent {
  const now = new Date().toISOString();
  const agent: Agent = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
  store.set(agent.id, agent);
  return agent;
}

export function updateAgent(
  id: string,
  patch: Partial<Pick<Agent, "name" | "description" | "status" | "workspacePath" | "previewUrl">>
): Agent | null {
  const agent = store.get(id);
  if (!agent) return null;
  const updated: Agent = { ...agent, ...patch, updatedAt: new Date().toISOString() };
  store.set(id, updated);
  return updated;
}

export function deleteAgent(id: string): boolean {
  return store.delete(id);
}
