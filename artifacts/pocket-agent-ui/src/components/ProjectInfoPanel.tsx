import { useEffect, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PanelAgent {
  id: string;
  name: string;
  workspacePath?: string;
}

interface ProjectInfo {
  previewUrl: string | null;
  buildCommand: string | null;
  runCommand: string | null;
  deploySupported: boolean;
}

interface GitHubInfo {
  remoteUrl: string | null;
  githubUrl: string | null;
  status: 'connected' | 'not_github' | 'not_configured';
  branch: string | null;
  clean: boolean;
  details: string[];
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

// ── API ─────────────────────────────────────────────────────────────────────

async function fetchProjectInfo(agentId: string): Promise<ProjectInfo> {
  const [build, run, deploy, preview] = await Promise.all([
    fetch(`/api/build/${agentId}`,   { method: 'POST' }).then(r => r.json()),
    fetch(`/api/run/${agentId}`,     { method: 'POST' }).then(r => r.json()),
    fetch(`/api/deploy/${agentId}`,  { method: 'POST' }).then(r => r.json()),
    fetch(`/api/preview/${agentId}`).then(r => r.json()),
  ]);

  return {
    previewUrl:     preview.previewUrl   ?? deploy.previewUrl ?? null,
    buildCommand:   build.command        ?? null,
    runCommand:     run.command          ?? null,
    deploySupported: deploy.deploySupported ?? false,
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground uppercase tracking-widest select-none">
        {label}
      </div>
      <div className="font-mono text-sm text-foreground/90 break-all">
        {children}
      </div>
    </div>
  );
}

function StatusDot({ on, labelOn, labelOff }: { on: boolean; labelOn: string; labelOff: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${on ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
      <span className={on ? 'text-emerald-400' : 'text-zinc-400'}>
        {on ? labelOn : labelOff}
      </span>
    </span>
  );
}

function Skeleton() {
  return <span className="inline-block h-3 w-32 rounded bg-muted/60 animate-pulse" />;
}

async function fetchGitHubInfo(): Promise<GitHubInfo> {
  const response = await fetch('/api/github');
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Failed to load GitHub status');
  return body;
}

function GitHubSection() {
  const [info, setInfo] = useState<GitHubInfo | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [pulling, setPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  const load = () => {
    setState('loading');
    fetchGitHubInfo()
      .then(data => {
        setInfo(data);
        setState('loaded');
      })
      .catch(() => setState('error'));
  };

  useEffect(() => { load(); }, []);

  const handlePull = async () => {
    setPulling(true);
    setPullMessage(null);
    try {
      const response = await fetch('/api/github/pull', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Git pull failed');
      setPullMessage(body.message);
      load();
    } catch (err) {
      setPullMessage(err instanceof Error ? err.message : 'Git pull failed');
    } finally {
      setPulling(false);
    }
  };

  const statusLabel = state === 'loading'
    ? 'Checking…'
    : state === 'error'
      ? 'Unavailable'
      : info?.status === 'connected'
        ? (info.clean ? 'Connected · clean' : 'Connected · changes')
        : info?.status === 'not_github'
          ? 'Remote is not GitHub'
          : 'No GitHub remote';

  return (
    <section className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-primary/60 font-mono text-xs select-none">◉</span>
        <span className="flex-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          GitHub
        </span>
        {state === 'loaded' && (
          <span className={`text-xs font-mono ${info?.status === 'connected' ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {statusLabel}
          </span>
        )}
      </div>

      {state === 'loading' && <Skeleton />}
      {state === 'error' && <p className="font-mono text-xs text-destructive">Failed to read repository status.</p>}
      {state === 'loaded' && info && (
        <>
          <Row label="Repository">
            {info.githubUrl
              ? <a href={info.githubUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{info.githubUrl}</a>
              : <span className="text-muted-foreground">{info.remoteUrl ?? '—'}</span>}
          </Row>
          <Row label="Branch">{info.branch ?? '—'}</Row>
          <button
            type="button"
            onClick={handlePull}
            disabled={pulling || info.status !== 'connected'}
            className="w-full rounded-md border border-border px-3 py-2 text-xs font-mono text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pulling ? 'pulling…' : 'pull from GitHub'}
          </button>
          {pullMessage && <p className="font-mono text-xs text-muted-foreground break-words">{pullMessage}</p>}
        </>
      )}
    </section>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProjectInfoPanel({
  agent,
  onPreviewUrlChange,
}: {
  agent: PanelAgent | null;
  onPreviewUrlChange: (previewUrl: string | null) => void;
}) {
  const [info, setInfo]   = useState<ProjectInfo | null>(null);
  const [state, setState] = useState<LoadState>('idle');

  useEffect(() => {
    if (!agent) {
      setInfo(null);
      setState('idle');
      onPreviewUrlChange(null);
      return;
    }

    let cancelled = false;
    setState('loading');
    setInfo(null);
    onPreviewUrlChange(null);

    fetchProjectInfo(agent.id)
      .then(data => {
        if (!cancelled) {
          setInfo(data);
          setState('loaded');
          onPreviewUrlChange(data.previewUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
          onPreviewUrlChange(null);
        }
      });

    return () => { cancelled = true; };
  }, [agent?.id, onPreviewUrlChange]);

  return (
    <div className="w-72 shrink-0 flex flex-col rounded-xl border border-border overflow-hidden shadow-2xl">

      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border shrink-0">
        <span className="text-primary/60 font-mono text-xs select-none">⬡</span>
        <span className="flex-1 text-xs font-mono text-muted-foreground tracking-widest">
          project info
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-background space-y-5">
        <GitHubSection />

        {/* ── Idle ── */}
        {state === 'idle' && (
          <div className="space-y-2 pt-2">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              No agent selected.
            </p>
            <p className="font-mono text-xs text-muted-foreground/60 leading-relaxed">
              Type{' '}
              <span className="text-primary/80">info &lt;name&gt;</span>
              {' '}in the terminal to load project details.
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {state === 'error' && (
          <p className="font-mono text-xs text-destructive pt-2">
            Failed to load project info.
          </p>
        )}

        {/* ── Agent header (loading or loaded) ── */}
        {(state === 'loading' || state === 'loaded') && agent && (
          <>
            <div className="space-y-0.5">
              <div className="font-mono text-sm font-semibold text-foreground">{agent.name}</div>
              <div className="font-mono text-xs text-muted-foreground">id:{agent.id.slice(0, 8)}</div>
            </div>

            <div className="border-t border-border" />

            {/* Preview URL */}
            <Row label="Preview URL">
              {state === 'loading' ? <Skeleton /> : (
                info?.previewUrl
                  ? <a href={info.previewUrl} target="_blank" rel="noreferrer"
                       className="text-primary hover:underline truncate block">
                      {info.previewUrl}
                    </a>
                  : <span className="text-muted-foreground">—</span>
              )}
            </Row>

            {/* Build Command */}
            <Row label="Build Command">
              {state === 'loading' ? <Skeleton /> : (
                info?.buildCommand
                  ? <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">{info.buildCommand}</span>
                  : <span className="text-muted-foreground">—</span>
              )}
            </Row>

            {/* Run Command */}
            <Row label="Run Command">
              {state === 'loading' ? <Skeleton /> : (
                info?.runCommand
                  ? <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">{info.runCommand}</span>
                  : <span className="text-muted-foreground">—</span>
              )}
            </Row>

            <div className="border-t border-border" />

            {/* Deploy Status */}
            <Row label="Deploy">
              {state === 'loading' ? <Skeleton /> : (
                <StatusDot
                  on={info?.deploySupported ?? false}
                  labelOn="Supported"
                  labelOff="Not supported"
                />
              )}
            </Row>

            {/* Secrets Status */}
            <Row label="Secrets">
              <StatusDot on={true} labelOn="Available" labelOff="Unavailable" />
            </Row>

            {/* Terminal Status */}
            <Row label="Terminal">
              <StatusDot on={true} labelOn="Available" labelOff="Unavailable" />
            </Row>
          </>
        )}
      </div>
    </div>
  );
}
