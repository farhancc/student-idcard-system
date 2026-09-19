import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, HardDrive, Trash2, Search, RefreshCw, ChevronRight } from 'lucide-react';

interface StorageObject {
  key: string;
  size: number;
  lastModified: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function StorageTab() {
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [prefixInput, setPrefixInput] = useState('');
  const [activePrefix, setActivePrefix] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  // Running total across pages actually loaded in this session — not the
  // whole bucket, since R2 has no cheap way to total an arbitrary prefix.
  const [loadedBytes, setLoadedBytes] = useState(0);

  const fetchPage = useCallback(async (prefix: string, cursorParam: string | null, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (prefix) params.set('prefix', prefix);
      if (cursorParam) params.set('cursor', cursorParam);
      const res = await fetch(`/api/superadmin/storage?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load storage objects');

      setObjects(prev => append ? [...prev, ...data.objects] : data.objects);
      setLoadedBytes(prev => (append ? prev : 0) + data.objects.reduce((sum: number, o: StorageObject) => sum + o.size, 0));
      setIsTruncated(!!data.isTruncated);
      setCursor(data.nextCursor);
    } catch (err: any) {
      setError(err.message || 'Failed to load storage objects');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(activePrefix, null, false);
  }, [activePrefix, fetchPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePrefix(prefixInput.trim());
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Permanently delete "${key}" from R2? This cannot be undone.`)) return;
    setDeletingKey(key);
    try {
      const res = await fetch('/api/superadmin/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete object');
      setObjects(prev => prev.filter(o => o.key !== key));
    } catch (err: any) {
      alert(err.message || 'Failed to delete object');
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="glass-panel">
      <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HardDrive size={18} color="var(--primary)" />
        R2 Storage Browser
      </h3>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            value={prefixInput}
            onChange={(e) => setPrefixInput(e.target.value)}
            placeholder="Filter by key prefix, e.g. press_12/photos/ or releases/"
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: '#fff' }}
          />
        </div>
        <button type="submit" className="btn btn-secondary">Filter</button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fetchPage(activePrefix, null, false)}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </form>

      {activePrefix && (
        <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Showing keys under <code>{activePrefix}</code>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: '10px', padding: '2px 10px', fontSize: '0.75rem' }}
            onClick={() => { setPrefixInput(''); setActivePrefix(''); }}
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
          <Loader2 size={36} className="spinner" />
          <p>Loading storage objects...</p>
        </div>
      ) : objects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
          No objects found{activePrefix ? ` under "${activePrefix}"` : ''}.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--muted)' }}>
            {objects.length} object{objects.length === 1 ? '' : 's'} loaded · {formatBytes(loadedBytes)}
            {isTruncated ? ' so far (more available below)' : ' total for this filter'}
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Size</th>
                  <th>Last Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj) => (
                  <tr key={obj.key}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', maxWidth: '420px' }}>
                      {obj.key}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatBytes(obj.size)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {obj.lastModified ? new Date(obj.lastModified).toLocaleString() : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleDelete(obj.key)}
                        disabled={deletingKey === obj.key}
                      >
                        {deletingKey === obj.key ? <Loader2 size={14} className="spinner" /> : <Trash2 size={14} />}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isTruncated && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => fetchPage(activePrefix, cursor, true)}
                disabled={loadingMore}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {loadingMore ? <Loader2 size={16} className="spinner" /> : <ChevronRight size={16} />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
