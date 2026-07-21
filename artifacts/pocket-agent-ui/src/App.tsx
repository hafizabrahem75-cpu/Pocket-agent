import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type Role = 'user' | 'system' | 'error';

interface Message {
  id: string;
  role: Role;
  lines: string[];
}

type AgentStatus = 'active' | 'inactive' | 'paused';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

// ── API helpers ────────────────────────────────────────────────────────────

const API = '/api';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
  return body as T;
}

// ── Message factory ────────────────────────────────────────────────────────

let _id = 0;
const mkId = () => String(++_id);

function msg(role: Role, lines: string[]): Message {
  return { id: mkId(), role, lines };
}

// ── Status badge helpers ───────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, string> = {
  active:   'text-emerald-400',
  inactive: 'text-zinc-400',
  paused:   'text-amber-400',
};

function statusBadge(s: AgentStatus) {
  return `[${s}]`;
}

function formatAgent(a: Agent): string[] {
  const lines = [`  ${a.name}  ${statusBadge(a.status)}  id:${a.id.slice(0, 8)}`];
  if (a.description) lines.push(`  ${a.description}`);
  return lines;
}

// ── Command parser ─────────────────────────────────────────────────────────

function parseFlags(tokens: string[]): { args: string[]; flags: Record<string, string> } {
  const args: string[] = [];
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].startsWith('--')) {
      const key = tokens[i].slice(2);
      flags[key] = tokens[i + 1] ?? '';
      i += 2;
    } else {
      args.push(tokens[i]);
      i += 1;
    }
  }
  return { args, flags };
}

// ── Help text ──────────────────────────────────────────────────────────────

const HELP_LINES = [
  'Available commands:',
  '',
  '  list                          List all agents',
  '  create <name>                 Create an agent',
  '    --desc "…"                  (optional) description',
  '    --status active|inactive|paused',
  '  info <id|name>                Show agent details',
  '  update <id|name>              Update an agent',
  '    --name "…"                  New name',
  '    --desc "…"                  New description',
  '    --status active|inactive|paused',
  '  delete <id|name>              Delete an agent',
  '  clear                         Clear the chat',
  '  help                          Show this message',
];

// ── Welcome ────────────────────────────────────────────────────────────────

const WELCOME_LINES = [
  'Pocket Agent  v0.1',
  '─────────────────────',
  'Manage your agents from this terminal.',
  'Type  help  to see available commands.',
];

// ── Main component ─────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<Message[]>([msg('system', WELCOME_LINES)]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const push = useCallback((m: Message) => {
    setMessages(prev => [...prev, m]);
  }, []);

  // resolve agent by name prefix or id prefix
  async function resolveAgent(query: string): Promise<Agent | null> {
    const agents = await api<Agent[]>('/agents');
    const q = query.toLowerCase();
    return (
      agents.find(a => a.id === query) ??
      agents.find(a => a.id.startsWith(q)) ??
      agents.find(a => a.name.toLowerCase() === q) ??
      agents.find(a => a.name.toLowerCase().startsWith(q)) ??
      null
    );
  }

  const runCommand = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    push(msg('user', [trimmed]));
    setHistory(h => [trimmed, ...h.slice(0, 49)]);
    setHistIdx(-1);

    setBusy(true);
    try {
      const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")/g)?.map(t => t.replace(/^"|"$/g, '')) ?? [];
      const [cmd, ...rest] = tokens;

      switch (cmd?.toLowerCase()) {

        case 'help': {
          push(msg('system', HELP_LINES));
          break;
        }

        case 'clear': {
          setMessages([msg('system', WELCOME_LINES)]);
          break;
        }

        case 'list':
        case 'ls': {
          const agents = await api<Agent[]>('/agents');
          if (agents.length === 0) {
            push(msg('system', ['No agents yet. Use  create <name>  to add one.']));
          } else {
            const lines = [`${agents.length} agent${agents.length !== 1 ? 's' : ''}:`, ''];
            agents.forEach(a => lines.push(...formatAgent(a)));
            push(msg('system', lines));
          }
          break;
        }

        case 'create': {
          const { args, flags } = parseFlags(rest);
          const name = args.join(' ');
          if (!name) {
            push(msg('error', ['Usage: create <name> [--desc "…"] [--status active|inactive|paused]']));
            break;
          }
          const body: Record<string, string> = { name };
          if (flags.desc) body.description = flags.desc;
          if (flags.status) body.status = flags.status;
          const agent = await api<Agent>('/agents', {
            method: 'POST',
            body: JSON.stringify(body),
          });
          push(msg('system', [
            `Agent created:`,
            '',
            ...formatAgent(agent),
          ]));
          break;
        }

        case 'info': {
          const query = rest.join(' ');
          if (!query) { push(msg('error', ['Usage: info <id|name>'])); break; }
          const agent = await resolveAgent(query);
          if (!agent) { push(msg('error', [`No agent found matching "${query}"`])); break; }
          push(msg('system', [
            `Agent details:`,
            '',
            `  Name:        ${agent.name}`,
            `  ID:          ${agent.id}`,
            `  Status:      ${agent.status}`,
            `  Description: ${agent.description ?? '—'}`,
            `  Created:     ${new Date(agent.createdAt).toLocaleString()}`,
            `  Updated:     ${new Date(agent.updatedAt).toLocaleString()}`,
          ]));
          break;
        }

        case 'update': {
          const { args, flags } = parseFlags(rest);
          const query = args.join(' ');
          if (!query) { push(msg('error', ['Usage: update <id|name> [--name "…"] [--desc "…"] [--status …]'])); break; }
          const agent = await resolveAgent(query);
          if (!agent) { push(msg('error', [`No agent found matching "${query}"`])); break; }
          const patch: Record<string, string> = {};
          if (flags.name) patch.name = flags.name;
          if (flags.desc) patch.description = flags.desc;
          if (flags.status) patch.status = flags.status;
          if (Object.keys(patch).length === 0) {
            push(msg('error', ['Specify at least one of: --name, --desc, --status']));
            break;
          }
          const updated = await api<Agent>(`/agents/${agent.id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          });
          push(msg('system', ['Updated:', '', ...formatAgent(updated)]));
          break;
        }

        case 'delete':
        case 'rm': {
          const query = rest.join(' ');
          if (!query) { push(msg('error', ['Usage: delete <id|name>'])); break; }
          const agent = await resolveAgent(query);
          if (!agent) { push(msg('error', [`No agent found matching "${query}"`])); break; }
          await api(`/agents/${agent.id}`, { method: 'DELETE' });
          push(msg('system', [`Deleted agent "${agent.name}" (${agent.id.slice(0, 8)}).`]));
          break;
        }

        default: {
          push(msg('error', [`Unknown command: ${cmd}. Type  help  to see available commands.`]));
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err.message : 'Unknown error';
      push(msg('error', [`Error: ${e}`]));
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [push]);

  const handleSubmit = () => {
    if (!busy && input.trim()) {
      runCommand(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(i => {
        const next = Math.min(i + 1, history.length - 1);
        setInput(history[next] ?? '');
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(i => {
        const next = Math.max(i - 1, -1);
        setInput(next === -1 ? '' : (history[next] ?? ''));
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4">
      {/* Window frame */}
      <div className="w-full max-w-2xl flex flex-col rounded-xl border border-border overflow-hidden shadow-2xl"
           style={{ height: 'calc(100vh - 4rem)' }}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border shrink-0">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <span className="flex-1 text-center text-xs font-mono text-muted-foreground tracking-widest">
            pocket-agent
          </span>
        </div>

        {/* Message list */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3 font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {busy && (
            <div className="text-muted-foreground animate-pulse pl-1">
              working…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center gap-3">
          <span className="text-primary font-mono text-sm select-none">›</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="type a command…"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-40"
          />
        </div>
      </div>
    </div>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary/15 border border-primary/25 px-3 py-2 text-primary">
          {message.lines.map((l, i) => <div key={i}>{l || '\u00a0'}</div>)}
        </div>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-lg bg-destructive/10 border border-destructive/25 px-3 py-2 text-destructive">
          {message.lines.map((l, i) => <div key={i}>{l || '\u00a0'}</div>)}
        </div>
      </div>
    );
  }

  // system
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-lg bg-card border border-border px-3 py-2 text-foreground/90 space-y-0">
        {message.lines.map((l, i) => {
          // Highlight status badges inline
          const statusMatch = l.match(/\[(active|inactive|paused)\]/);
          if (statusMatch) {
            const status = statusMatch[1] as AgentStatus;
            const color = STATUS_COLORS[status];
            const [before, after] = l.split(statusMatch[0]);
            return (
              <div key={i}>
                {before}
                <span className={`font-semibold ${color}`}>{statusMatch[0]}</span>
                {after}
              </div>
            );
          }
          return <div key={i}>{l || '\u00a0'}</div>;
        })}
      </div>
    </div>
  );
}
