import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAction, useLoad } from '../hooks';
import { CopyButton, ErrorText, StateBadge, formatTime } from '../components';
import type { Upstream, User } from '../types';
import { UpstreamForm } from './UpstreamForm';

export function ServersPage({ user }: { user: User }) {
  const { data, error, reload } = useLoad(() => api<Upstream[]>('/upstreams'), 10_000);
  const [editing, setEditing] = useState<Upstream | 'new' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isAdmin = user.role === 'admin';
  const upstreams = data ?? [];
  const selected = upstreams.find(server => server.id === selectedId) ?? upstreams[0];
  const connected = upstreams.filter(server => server.state === 'connected').length;

  return (
    <section className="servers-page" aria-labelledby="servers-heading">
      <div className="page-header">
        <div>
          <p className="eyebrow">Your connections</p>
          <h1 id="servers-heading">Servers</h1>
          <p className="page-description">One gateway. All your tools, together.</p>
        </div>
        {isAdmin && !editing && (
          <button type="button" onClick={() => setEditing('new')}><span aria-hidden="true">＋</span> Add server</button>
        )}
      </div>

      {editing && (
        <ServerEditor key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? undefined : editing}
          onSaved={() => { setEditing(null); void reload(); }} onClose={() => setEditing(null)} />
      )}

      {data === null ? (
        <div className="workspace-state" role="status">
          <h2>{error ? 'Could not load servers' : 'Loading your connections…'}</h2>
          <p className="muted">{error ?? 'Getting the latest server status and tools.'}</p>
          {error && <button type="button" className="secondary" onClick={() => void reload()}>Try again</button>}
        </div>
      ) : upstreams.length === 0 ? (
        <div className="workspace-state">
          <h2>Your first connection starts here</h2>
          <p className="muted">Add an MCP server to make its tools available through your gateway.</p>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : (
        <>
          <div className="workspace-summary">
            <span>{upstreams.length} server{upstreams.length === 1 ? '' : 's'}<span className="summary-separator" aria-hidden="true">/</span>{connected} connected</span>
            <span className="muted">Status refreshes automatically</span>
          </div>
          {error && <ErrorText>Could not refresh: {error}. Showing the last loaded connections.</ErrorText>}
          <div className="servers-workspace">
            <label className="mobile-server-select">Server
              <select aria-label="Server" value={selected?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>
                {upstreams.map(server => <option key={server.id} value={server.id}>{server.name} · {server.state}</option>)}
              </select>
            </label>
            <aside className="servers-sidebar" aria-label="Server directory">
              <div className="sidebar-header"><span className="sidebar-title">Connections</span></div>
              <div className="servers-list">
                {upstreams.map(server => (
                  <button type="button" key={server.id}
                    aria-pressed={server.id === selected?.id}
                    onClick={() => setSelectedId(server.id)}
                    className={'server-item' + (server.id === selected?.id ? ' is-selected' : '')}>
                    <span className="server-item-top">
                      <span className="server-item-name">{server.name}</span>
                      <span className="server-selection-arrow" aria-hidden="true">↗</span>
                    </span>
                    <span className="server-item-bottom">
                      <StateBadge state={server.state} />
                      <span className="server-item-stats">{server.tools.length} tools</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="directory-note">Tools are routed through your gateway. Upstream credentials stay private.</p>
            </aside>
            {selected && (
              <ServerInspector key={selected.id} upstream={selected} isAdmin={isAdmin}
                onEdit={() => setEditing(selected)} onChanged={reload} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ServerEditor({ existing, onSaved, onClose }: {
  existing?: Upstream; onSaved: () => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog className="server-editor" ref={dialogRef} aria-label={existing ? 'Edit server' : 'Add server'}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <UpstreamForm existing={existing} onSaved={onSaved} onCancel={onClose} />
    </dialog>
  );
}

function ServerInspector({ upstream, isAdmin, onEdit, onChanged }: {
  upstream: Upstream; isAdmin: boolean; onEdit: () => void; onChanged: () => void;
}) {
  const { busy, error, run } = useAction();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const directoryRef = useRef<HTMLUListElement>(null);
  const pageSize = 8;
  const tools = upstream.tools.filter(tool =>
    (tool.name + ' ' + tool.description).toLowerCase().includes(query.trim().toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(tools.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleTools = tools.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  useEffect(() => {
    if (directoryRef.current) directoryRef.current.scrollTop = 0;
  }, [currentPage, query]);
  const act = async (action: () => Promise<unknown>) => {
    await run(action);
    await onChanged();
  };
  const toggle = () => {
    if (upstream.enabled && !confirm('Disable ' + upstream.name + '? Its tools will be unavailable to everyone until re-enabled.')) return;
    void act(() => api('/upstreams/' + upstream.id, { method: 'PATCH', body: { enabled: !upstream.enabled } }));
  };
  const remove = () => {
    if (confirm('Remove ' + upstream.name + '? Its tools will disappear for everyone.')) {
      void act(() => api('/upstreams/' + upstream.id, { method: 'DELETE' }));
    }
  };

  return (
    <article className="server-inspector" aria-labelledby="selected-server-heading" aria-busy={busy}>
      <div className="inspector-header">
        <div className="inspector-heading">
          <span className="eyebrow">Server details</span>
          <h2 id="selected-server-heading">{upstream.name}</h2>
          <StateBadge state={upstream.state} />
        </div>
        {isAdmin && (
          <div className="inspector-actions">
            <button type="button" className="secondary" disabled={busy}
              onClick={() => void act(() => api('/upstreams/' + upstream.id + '/refresh', { method: 'POST' }))}>
              {busy ? 'Updating…' : 'Refresh'}
            </button>
            <details className="action-menu" onKeyDown={event => {
              if (event.key === 'Escape') {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }
            }} onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
            }}>
              <summary aria-label="More actions for this server">•••</summary>
              <div className="action-menu-content">
                <button type="button" disabled={busy} onClick={onEdit}>Edit server</button>
                <button type="button" disabled={busy} onClick={toggle}>{upstream.enabled ? 'Disable server' : 'Enable server'}</button>
                <button type="button" className="danger" disabled={busy} onClick={remove}>Remove server</button>
              </div>
            </details>
          </div>
        )}
      </div>

      <ErrorText>{error ?? upstream.error}</ErrorText>
      <details className="connection-details">
      <summary>Connection details</summary>
      <dl className="server-facts">
        <div><dt>Authentication</dt><dd>{upstream.authType === 'none' ? 'None' : upstream.authType === 'bearer' ? 'Bearer token' : 'Custom header'}</dd></div>
        <div><dt>Discovery time</dt><dd>{upstream.latencyMs === null ? 'Not available' : upstream.latencyMs + ' ms'}</dd></div>
        <div><dt>Last checked</dt><dd>{upstream.checkedAt ? <time dateTime={upstream.checkedAt}>{formatTime(upstream.checkedAt)}</time> : 'Not yet checked'}</dd></div>
      </dl>

        <div className="endpoint-row"><code>{upstream.url}</code><CopyButton text={upstream.url} /></div>
        <p className="muted">Tool prefix <code>{upstream.slug}__</code>{upstream.authHeaderName && ' · Header: ' + upstream.authHeaderName}</p>
      </details>

      <section className="inspector-tools-section" aria-label="Exposed tools">
        <div className="tools-heading">
          <h3>Tools <span className="count-label">{upstream.tools.length}</span></h3>
          <label className="tool-search"><span className="sr-only">Search this server's tools</span>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
            <input type="search" placeholder="Search all tools…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
          </label>
        </div>
        {upstream.skippedTools.length > 0 && (
          <details className="skipped-tools"><summary>{upstream.skippedTools.length} tools hidden due to unsupported names</summary>
            <p className="muted">{upstream.skippedTools.join(', ')}</p>
          </details>
        )}
        {query.trim() && <p className="search-results" role="status">{tools.length} of {upstream.tools.length} tools match</p>}
        {tools.length === 0 ? (
          <div className="tools-empty">
            <p>{query.trim() ? 'No matching tools' : upstream.state === 'disabled' ? 'This server is disabled' : upstream.state === 'unreachable' ? 'Tools are unavailable while the server is unreachable' : 'No tools reported yet'}</p>
            {query.trim() && <button type="button" className="text-button" onClick={() => { setQuery(''); setPage(0); }}>Clear search</button>}
          </div>
        ) : (
          <ul className="tool-directory" ref={directoryRef} tabIndex={0} aria-label={'Tools for ' + upstream.name}>
            {visibleTools.map(tool => (
              <li className="tool-entry" key={tool.name}>
                <details>
                <summary className="tool-summary">
                <span className="tool-entry-heading">
                  <code>{tool.name}</code>
                  <span className="tool-row-controls">
                    {tool.readOnly !== null && <span className={'tool-hint' + (tool.readOnly ? ' is-readonly' : '')}
                      title="Reported by the upstream; this annotation is not an enforced permission.">
                      {tool.readOnly ? 'Read-only' : 'May write'}
                    </span>}
                    <span className="tool-expand" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M3 8h10" /><path className="expand-vertical" d="M8 3v10" />
                      </svg>
                    </span>
                  </span>
                </span>
                <span className="tool-preview">{tool.description || 'No description provided.'}</span>
                </summary>
                <p>{tool.description || 'No description provided.'}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
        {tools.length > 0 && (
          <div className="tool-pagination">
            <span role="status">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, tools.length)} of {tools.length} tools</span>
            {pageCount > 1 && <nav aria-label="Tool pages">
              <button type="button" className="secondary" aria-label="Previous tool page" disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}>Previous</button>
              <span>{currentPage + 1} / {pageCount}</span>
              <button type="button" className="secondary" aria-label="Next tool page" disabled={currentPage === pageCount - 1}
                onClick={() => setPage(currentPage + 1)}>Next</button>
            </nav>}
          </div>
        )}
      </section>
    </article>
  );
}
