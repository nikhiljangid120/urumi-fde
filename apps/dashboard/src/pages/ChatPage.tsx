import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api';
import { useAction, useLoad } from '../hooks';
import { ErrorText } from '../components';
import type { ChatMessage, ToolTrace } from '../types';

interface ChatInfo {
  configured: boolean;
  model: string | null;
  tools: { name: string; upstreamName: string }[];
}

export function ChatPage() {
  const { data: info, error: infoError, reload: reloadInfo } = useLoad(() => api<ChatInfo>('/chat/tools'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const { busy, error, run } = useAction();
  const stream = useRef<HTMLDivElement>(null);
  const followingLatest = useRef(true);
  const [showLatest, setShowLatest] = useState(false);

  useEffect(() => {
    const transcript = stream.current;
    if (!transcript) return;
    if (messages.length === 0) {
      transcript.scrollTop = 0;
      followingLatest.current = true;
      setShowLatest(false);
    } else if (followingLatest.current) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [messages, busy]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || !info?.configured) return;
    const history = [...messages, { role: 'user' as const, content: text }];
    followingLatest.current = true;
    setShowLatest(false);
    setMessages(history);
    setDraft('');

    const response = await run(() => api<{ reply: string; toolCalls: ToolTrace[] }>('/chat', {
      method: 'POST',
      body: { messages: history.map(({ role, content }) => ({ role, content })) },
    }));

    if (response) {
      setMessages([...history, { role: 'assistant', content: response.reply, toolCalls: response.toolCalls }]);
    } else {
      setMessages(history.slice(0, -1));
      setDraft(text);
    }
  };

  return (
    <section className="execution-notebook">
      {/* Notebook Header */}
      <div className="notebook-header">
        <div>
          <h1>Chat</h1>
          <p className="muted" style={{ margin: '0.25rem 0' }}>
            Ask a question. See the tools behind the answer.
          </p>
        </div>

        <div className="row">
          {info && (
            <span className="tag" style={{ fontFamily: 'var(--font-mono)' }}>
              {info.configured ? `Model: ${info.model ?? 'default'}` : 'Gateway Model Not Configured'} · {info.tools.length} tools
            </span>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => setMessages([])}
            disabled={busy || messages.length === 0}
          >
            Clear chat
          </button>
        </div>
      </div>

      {/* Tool steps are returned with the response, not streamed live. */}
      <div className="notebook-stream" ref={stream} tabIndex={0} role="region" aria-label="Conversation" aria-busy={busy}
        onScroll={event => {
          const transcript = event.currentTarget;
          const nearBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 80;
          followingLatest.current = nearBottom;
          setShowLatest(!nearBottom && messages.length > 0);
        }}>
        <ErrorText>{infoError}</ErrorText>
        {infoError && <button type="button" className="secondary" onClick={() => void reloadInfo()}>Retry connection</button>}
        {info && !info.configured && <p className="error" role="status">Chat is not configured yet. Configure a model provider in the gateway to get started.</p>}
        {!info && !infoError && <p className="muted" role="status">Checking chat availability…</p>}
        {info?.configured && messages.length === 0 && (
          <div className="chat-welcome">
            <h2>A little help from your tools.</h2>
            <p className="muted">
              Explore your store or ask about an order. After each response, inspect which tools ran and what they returned.
            </p>
            <div className="row" style={{ justifyContent: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft('What tools are available in the store?')}
              >
                Explore available tools
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft('Show me recent orders.')}
              >
                Find recent orders
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className="notebook-entry">
            {message.role === 'user' ? (
              <div className="notebook-user-card">
                <div className="notebook-user-meta">User</div>
                <div className="notebook-user-text">{message.content}</div>
              </div>
            ) : (
              <div className="notebook-assistant-card">
                <div className="notebook-assistant-meta">
                  <span>Assistant</span>
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <span>{message.toolCalls.length} tool step{message.toolCalls.length === 1 ? '' : 's'} recorded</span>
                  )}
                </div>

                {/* Numbered Tool Execution Steps */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <details className="execution-trace">
                    <summary>{message.toolCalls.length} tool call{message.toolCalls.length === 1 ? '' : 's'}
                      {message.toolCalls.some(call => !call.ok) ? ' · includes errors' : ' · completed'}
                    </summary>
                    <NumberedExecutionSteps calls={message.toolCalls} />
                  </details>
                )}

                {/* Clean formatted response without raw * symbols */}
                <div className="notebook-answer-text">
                  {formatAiResponse(message.content)}
                </div>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="notebook-assistant-card" style={{ opacity: 0.85 }}>
            <div className="notebook-assistant-meta">
              <span role="status">Waiting for the gateway…</span>
            </div>
            <p className="muted" style={{ fontStyle: 'italic' }}>
              The model is preparing a response. Any tool steps will appear when it finishes.
            </p>
          </div>
        )}

      </div>

      {/* Comfortable Composer */}
      <div className="notebook-composer-area">
        {showLatest && <button type="button" className="jump-to-latest secondary" onClick={() => {
          followingLatest.current = true;
          if (stream.current) stream.current.scrollTop = stream.current.scrollHeight;
          setShowLatest(false);
        }}>Jump to latest ↓</button>}
        <ErrorText>{error}</ErrorText>
        <form className="composer-form" onSubmit={send}>
          <textarea
            aria-label="Message"
            rows={2}
            className="composer-input"
            placeholder="Ask about your store, orders, or available tools…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={busy || !info?.configured}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={8000}
          />
          <button type="submit" disabled={busy || !info?.configured || !draft.trim()}>
            {busy ? 'Waiting…' : 'Send'}
          </button>
        </form>

        <div className="composer-hints">
          <span>Tool calls run with your account.</span>
          <span>Enter to send · Shift + Enter for a new line</span>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   FORMAT AI RESPONSE (Avoid raw * symbols)
   ========================================================================== */

function formatAiResponse(content: string): ReactNode {
  if (!content) return null;
  const lines = content.split('\n');

  return lines.map((line, lineIdx) => {
    // Replace bullet points starting with * with a clean round bullet
    let cleanedLine = line.replace(/^\s*\*\s+/, '• ');

    // Parse **bold** and *italic* markdown while removing all raw * symbols
    const segments: ReactNode[] = [];
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleanedLine)) !== null) {
      if (match.index > lastIndex) {
        const plain = cleanedLine.slice(lastIndex, match.index).replace(/\*/g, '');
        if (plain) segments.push(plain);
      }
      if (match[2]) {
        // Bold segment without asterisks
        segments.push(<strong key={`${lineIdx}-${match.index}`}>{match[2].replace(/\*/g, '')}</strong>);
      } else if (match[3]) {
        // Italic segment without asterisks
        segments.push(<em key={`${lineIdx}-${match.index}`}>{match[3].replace(/\*/g, '')}</em>);
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < cleanedLine.length) {
      const remaining = cleanedLine.slice(lastIndex).replace(/\*/g, '');
      if (remaining) segments.push(remaining);
    }

    return (
      <p key={lineIdx} style={{ margin: '0.35rem 0' }}>
        {segments.length > 0 ? segments : '\u00A0'}
      </p>
    );
  });
}

/* ==========================================================================
   NUMBERED TOOL EXECUTION STEPS
   ========================================================================== */

function NumberedExecutionSteps({ calls }: { calls: ToolTrace[] }) {
  return (
    <div className="execution-steps-container">
      {calls.map((call, index) => {
        const parts = call.tool.split('__');
        const upstreamSource = parts.length > 1 ? parts[0] : 'gateway';

        return (
          <details key={index} className="execution-step-item">
            <summary className="execution-step-summary">
              <div className="execution-step-left">
                <span className="step-number-chip">STEP {index + 1}</span>
                <span className="step-tool-name">{call.tool}</span>
                <span className="step-source-label">Source: {upstreamSource}</span>
              </div>
              <div className="row" style={{ gap: '0.65rem' }}>
                <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                  {call.durationMs} ms
                </span>
                <span className={`step-outcome-pill ${call.ok ? 'step-outcome-ok' : 'step-outcome-fail'}`}>
                  {call.ok ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
            </summary>

            <div className="step-details-body">
              <div className="step-block-label">Invocation Arguments:</div>
              <pre>{JSON.stringify(call.arguments, null, 2)}</pre>

              <div className="step-block-label" style={{ marginTop: '0.65rem' }}>
                Execution Result:
              </div>
              <pre>{call.preview}</pre>
            </div>
          </details>
        );
      })}
    </div>
  );
}
