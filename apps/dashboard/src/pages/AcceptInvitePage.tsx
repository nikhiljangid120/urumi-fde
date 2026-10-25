import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAction } from '../hooks';
import { ErrorText } from '../components';
import type { User } from '../types';

export function AcceptInvitePage({ token, onSignedIn }: { token: string; onSignedIn: (token: string, user: User) => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run(() => api<{ token: string; user: User }>('/auth/accept-invite', { method: 'POST', body: { token, name, password } }));
    if (result) onSignedIn(result.token, result.user);
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          MCP Gateway Invitation
        </div>
        <h1>Join the Team</h1>
        <p className="muted" style={{ margin: '0.25rem 0' }}>Choose your display name and password to activate your gateway seat.</p>
      </div>
      <label>Full name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="Alex Morgan" /></label>
      <label>Password<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} /></label>
      <small style={{ color: 'var(--text-muted)' }}>At least 12 characters required.</small>
      <ErrorText>{error}</ErrorText>
      <button disabled={busy} style={{ marginTop: '0.5rem' }}>Create Account</button>
    </form>
  );
}
