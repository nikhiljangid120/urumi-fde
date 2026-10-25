import { useState, type ReactNode } from 'react';
import type { UpstreamState } from './types';

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="error" role="alert">{children}</p> : null;
}

const stateLabels: Record<UpstreamState, string> = {
  connected: 'Connected',
  unreachable: 'Unreachable',
  disabled: 'Disabled',
  checking: 'Checking',
};

export function StateBadge({ state }: { state: UpstreamState }) {
  return <span className={`badge badge-${state}`}>{stateLabels[state]}</span>;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setTimeout(() => { setCopied(false); setFailed(false); }, 2000);
  };
  return <button type="button" className="secondary" onClick={copy} aria-live="polite">{failed ? 'Copy failed' : copied ? 'Copied' : 'Copy'}</button>;
}

/** Shows a secret that the server will never return again. */
export function OneTimeSecret({ label, value, onDone, children }: { label: string; value: string; onDone: () => void; children?: ReactNode }) {
  return (
    <div className="notice">
      <p><strong>{label}</strong> Copy it now. It will not be shown again.</p>
      <div className="secret">
        <code>{value}</code>
        <CopyButton text={value} />
      </div>
      {children}
      <button type="button" className="secondary" onClick={onDone}>Done</button>
    </div>
  );
}

export function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}
