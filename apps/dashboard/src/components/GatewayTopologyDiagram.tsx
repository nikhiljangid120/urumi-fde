import type { Upstream } from '../types';

interface TopologyDiagramProps {
  upstreams: Upstream[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function GatewayTopologyDiagram({
  upstreams,
  selectedId,
  onSelect,
}: TopologyDiagramProps) {
  const connectedCount = upstreams.filter(u => u.state === 'connected').length;

  return (
    <div className="pipeline-card">
      <div className="pipeline-flow">
        {/* Step 1: Client */}
        <div className="pipeline-node">
          <span className="pipeline-tag">Client</span>
          <span className="pipeline-title">Claude Desktop / SDK</span>
        </div>

        <div className="pipeline-divider">
          <span className="pipeline-arrow">→</span>
        </div>

        {/* Step 2: Gateway */}
        <div className="pipeline-node">
          <span className="pipeline-tag">Gateway</span>
          <span className="pipeline-title">MCP Router (:3000)</span>
        </div>

        <div className="pipeline-divider">
          <span className="pipeline-arrow">→</span>
        </div>

        {/* Step 3: Upstreams */}
        <div className="pipeline-node pipeline-node-upstreams">
          <div className="row spread" style={{ marginBottom: '0.35rem' }}>
            <span className="pipeline-tag">Configured Upstreams ({upstreams.length})</span>
            <span className="muted" style={{ fontSize: '0.75rem' }}>{connectedCount} online</span>
          </div>

          <div className="pipeline-pills-row">
            {upstreams.length === 0 ? (
              <span className="muted" style={{ fontSize: '0.8rem' }}>No upstreams configured</span>
            ) : (
              upstreams.map(up => {
                const isSelected = up.id === selectedId;
                return (
                  <button
                    type="button"
                    key={up.id}
                    onClick={() => onSelect(up.id)}
                    className={`pipeline-pill state-${up.state} ${isSelected ? 'is-selected' : ''}`}
                    title={`${up.name} (${up.slug}) — ${up.state}`}
                  >
                    <span className={`status-dot dot-${up.state}`} />
                    <span className="pill-name">{up.name}</span>
                    {up.latencyMs !== null ? (
                      <span className="pill-latency">{up.latencyMs}ms</span>
                    ) : (
                      <span className="pill-latency muted">{up.state === 'unreachable' ? 'offline' : '—'}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
