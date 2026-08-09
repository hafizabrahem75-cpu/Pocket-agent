import { useEffect, useState } from 'react';
import { FileCode2, Loader2, Save } from 'lucide-react';

interface FileContentResponse {
  path: string;
  content: string;
}

interface WriteResponse {
  path: string;
  size: number;
}

interface CodeEditorProps {
  path: string;
}

export function CodeEditor({ path }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSaving(false);
    setError(null);
    setContent('');
    setSavedContent('');

    fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`, {
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`);
        return body as FileContentResponse;
      })
      .then(file => {
        if (!controller.signal.aborted) {
          setContent(file.content);
          setSavedContent(file.content);
          setLoading(false);
        }
      })
      .catch(fetchError => {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to read file');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [path]);

  const isDirty = content !== savedContent;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/workspace/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`);
      const result = body as WriteResponse;
      setSavedContent(content);
      if (result.path !== path) throw new Error('The saved file path did not match the opened file');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save file');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2 shrink-0">
        <FileCode2 className="h-3.5 w-3.5 text-primary/70" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{path}</span>
        <span className={`font-mono text-xs ${isDirty ? 'text-amber-400' : 'text-emerald-400'}`}>
          {isDirty ? 'Unsaved' : 'Saved'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || !isDirty}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-xs text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-3 font-mono text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          loading…
        </div>
      )}
      {error && !loading && (
        <div className="px-4 py-3 font-mono text-xs text-destructive break-all">{error}</div>
      )}
      {!loading && !error && (
        <textarea
          value={content}
          onChange={event => setContent(event.target.value)}
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
              event.preventDefault();
              if (isDirty && !saving) void save();
            }
          }}
          spellCheck={false}
          aria-label={`Editing ${path}`}
          className="min-h-0 flex-1 resize-none bg-background px-4 py-3 font-mono text-xs leading-5 text-foreground outline-none"
        />
      )}
    </section>
  );
}