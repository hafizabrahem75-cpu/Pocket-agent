import { randomUUID } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatus = "active" | "inactive" | "paused";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
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
  data: Pick<Agent, "name" | "status"> & { description?: string }
): Agent {
  const now = new Date().toISOString();
  const agent: Agent = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
  store.set(agent.id, agent);
  return agent;
}

export function updateAgent(
  id: string,
  patch: Partial<Pick<Agent, "name" | "description" | "status">>
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
