import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  File,
  Search,
  X,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
}

interface AnalyzeResponse {
  structure: FileNode;
}

// ── API helpers ──────────────────────────────────────────────────────────────

/**
 * Calls POST /api/analyze (list_workspace equivalent).
 * Returns the immediate children of the requested directory.
 */
async function listDir(dirPath: string): Promise<FileNode[]> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // maxDepth: 2 — root + one level of children
    body: JSON.stringify({ path: dirPath, maxDepth: 2 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: AnalyzeResponse = await res.json();
  return data.structure.children ?? [];
}

/**
 * Calls POST /api/analyze with a deep scan, then flattens the tree and
 * filters by name (search_files equivalent).
 */
async function searchFiles(query: string): Promise<FileNode[]> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.', maxDepth: 5 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: AnalyzeResponse = await res.json();

  const q = query.toLowerCase();
  const results: FileNode[] = [];

  function flatten(node: FileNode) {
    for (const child of node.children ?? []) {
      if (child.name.toLowerCase().includes(q)) results.push(child);
      if (child.type === 'directory') flatten(child);
    }
  }
  flatten(data.structure);

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// ── Path helpers ─────────────────────────────────────────────────────────────

function parentOf(p: string): string {
  if (p === '.' || !p.includes('/')) return '.';
  return p.substring(0, p.lastIndexOf('/'));
}

function displayPath(p: string): string {
  return p === '.' ? 'workspace' : p;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EntryRow({
  node,
  onNavigate,
  onOpenFile,
}: {
  node: FileNode;
  onNavigate: (n: FileNode) => void;
  onOpenFile: (path: string) => void;
}) {
  const isDir = node.type === 'directory';
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors
        hover:bg-muted/40 ${isDir ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={() => { if (isDir) onNavigate(node); else onOpenFile(node.relativePath); }}
    >
      {isDir
        ? <Folder className="w-3.5 h-3.5 text-primary/70 shrink-0" />
        : <File   className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <span className="font-mono text-xs text-foreground truncate">{node.name}</span>
    </button>
  );
}

function SearchRow({
  node,
  onNavigate,
  onOpenFile,
}: {
  node: FileNode;
  onNavigate: (n: FileNode) => void;
  onOpenFile: (path: string) => void;
}) {
  const isDir = node.type === 'directory';
  return (
    <button
      className={`w-full flex flex-col px-3 py-1.5 text-left transition-colors
        hover:bg-muted/40 ${isDir ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={() => { if (isDir) onNavigate(node); else onOpenFile(node.relativePath); }}
    >
      <div className="flex items-center gap-2">
        {isDir
          ? <Folder className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          : <File   className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        <span className="font-mono text-xs text-foreground truncate">{node.name}</span>
      </div>
      <div className="pl-[1.375rem] font-mono text-xs text-muted-foreground/60 truncate leading-none mt-0.5">
        {node.relativePath}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FileExplorer({ onOpenFile }: { onOpenFile: (path: string) => void }) {
  const [currentPath, setCurrentPath] = useState('.');
  const [entries,     setEntries]     = useState<FileNode[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileNode[]>([]);
  const [searching,   setSearching]   = useState(false);

  // ── Directory listing (list_workspace) ─────────────────────────────────────
  useEffect(() => {
    if (searchQuery.trim()) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    listDir(currentPath)
      .then(items => {
        if (!cancelled) { setEntries(items); setLoading(false); }
      })
      .catch(e => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [currentPath, searchQuery]);

  // ── Search (search_files) — debounced 300ms ─────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchFiles(q)
        .then(results => {
          if (!cancelled) { setSearchResults(results); setSearching(false); }
        })
        .catch(() => { if (!cancelled) setSearching(false); });
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useCallback((node: FileNode) => {
    if (node.type === 'directory') {
      setCurrentPath(node.relativePath);
      setSearchQuery('');
    }
  }, []);

  const goUp = useCallback(() => {
    setCurrentPath(p => parentOf(p));
  }, []);

  // ── Sorted entries: dirs first, then files ──────────────────────────────────
  const sorted = entries.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const isSearchMode = searchQuery.trim().length > 0;
  const isRoot       = currentPath === '.';

  return (
    <div className="w-56 shrink-0 flex flex-col rounded-xl border border-border overflow-hidden shadow-2xl">

      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-3 bg-card border-b border-border shrink-0">
        <span className="text-primary/60 font-mono text-xs select-none">⊞</span>
        <span className="flex-1 text-xs font-mono text-muted-foreground tracking-widest">
          files
        </span>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="search files…"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Path breadcrumb (browse mode only) */}
      {!isSearchMode && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/20 shrink-0 min-w-0">
          {!isRoot && (
            <button
              onClick={goUp}
              className="text-muted-foreground hover:text-foreground shrink-0"
              title="Go up"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="font-mono text-xs text-muted-foreground truncate">
            {displayPath(currentPath)}
          </span>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-background">

        {/* Loading */}
        {(loading || searching) && (
          <div className="flex items-center gap-2 px-3 py-3 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span className="font-mono text-xs">loading…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="px-3 py-3 font-mono text-xs text-destructive break-all">
            {error}
          </div>
        )}

        {/* Search results */}
        {isSearchMode && !searching && !error && (
          searchResults.length === 0
            ? <div className="px-3 py-3 font-mono text-xs text-muted-foreground">No matches.</div>
            : searchResults.map(node => (
                <SearchRow key={node.relativePath} node={node} onNavigate={navigate} onOpenFile={onOpenFile} />
              ))
        )}

        {/* Directory listing */}
        {!isSearchMode && !loading && !error && (
          sorted.length === 0
            ? <div className="px-3 py-3 font-mono text-xs text-muted-foreground">Empty.</div>
            : sorted.map(node => (
                <EntryRow key={node.relativePath} node={node} onNavigate={navigate} onOpenFile={onOpenFile} />
              ))
        )}

      </div>
    </div>
  );
}
