import { useEffect, useState } from 'react';
import { api, session } from './api';
import { Link, navigate, usePath } from './router';
import type { User } from './types';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { ServersPage } from './pages/ServersPage';
import { KeysPage } from './pages/KeysPage';
import { MembersPage } from './pages/MembersPage';
import { AuditPage } from './pages/AuditPage';
import { ChatPage } from './pages/ChatPage';

const pages = [
  { path: '/', label: 'Servers', adminOnly: false },
  { path: '/chat', label: 'Chat', adminOnly: false },
  { path: '/keys', label: 'API keys', adminOnly: false },
  { path: '/audit', label: 'Audit log', adminOnly: false },
  { path: '/members', label: 'Members', adminOnly: true },
];

export function App() {
  const path = usePath();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => session.get() !== null);

  useEffect(() => {
    const signedOut = () => setUser(null);
    window.addEventListener('session-ended', signedOut);
    if (session.get()) {
      api<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
    }
    return () => window.removeEventListener('session-ended', signedOut);
  }, []);

  const signIn = (token: string, signedIn: User) => {
    session.set(token);
    setUser(signedIn);
    navigate('/');
  };

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    session.clear();
    setUser(null);
  };

  if (path.startsWith('/invite/')) return <AcceptInvitePage token={path.slice('/invite/'.length)} onSignedIn={signIn} />;
  if (checking) return <div className="workspace-state" role="status">Opening your workspace…</div>;
  if (!user) return <LoginPage onSignedIn={signIn} />;

  const visible = pages.filter(page => !page.adminOnly || user.role === 'admin');
  return (
    <div className="layout">
      <header className="masthead">
        <div className="masthead-brand">
          <svg className="brand-symbol" aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="2" y="8" width="9" height="15" rx="4.5" /><rect x="15" y="3" width="9" height="15" rx="4.5" /><path d="m8 16 10-6" />
          </svg>
          <span className="masthead-logo">urumi<span className="masthead-tagline"> / gateway</span></span>
        </div>
        <nav aria-label="Main navigation">
          {visible.map(page => (
            <Link key={page.path} to={page.path} className={page.path === path ? 'active' : undefined}>{page.label}</Link>
          ))}
        </nav>
        <div className="masthead-user">
          <span className="who">{user.name} · {user.role}</span>
          <button type="button" className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main key={path} className={'main-content' + (path === '/chat' ? ' chat-main' : path === '/' ? ' servers-main' : '')}>
        {renderPage(path, user)}
      </main>
    </div>
  );
}

function renderPage(path: string, user: User) {
  switch (path) {
    case '/chat': return <ChatPage />;
    case '/keys': return <KeysPage />;
    case '/audit': return <AuditPage user={user} />;
    case '/members': return user.role === 'admin' ? <MembersPage currentUser={user} /> : <NotFound />;
    case '/': return <ServersPage user={user} />;
    default: return <NotFound />;
  }
}

function NotFound() {
  return <p>Page not found. <Link to="/">Go to servers</Link>.</p>;
}
