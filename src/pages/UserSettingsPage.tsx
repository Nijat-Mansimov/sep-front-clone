import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, KeyRound, ShieldAlert, Terminal, Trash2, User } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { OneTimeSecretModal } from '../components/ui/OneTimeSecretModal';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatRelativeTime } from '../utils/rule-helpers';

const USER_NAV = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'tokens', label: 'Git Tokens & SSH Keys', icon: KeyRound },
  { id: 'sessions', label: 'Sessions', icon: ShieldAlert },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

export function UserSettingsPage() {
  const params = useParams<{ section?: string }>();
  const section = params.section ?? 'profile';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 pb-4 border-b border-[var(--border-muted)]">
        <h1 className="font-display text-2xl font-bold text-[var(--fg-default)]">Personal Settings</h1>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
          Manage Git CLI authentication credentials, active sessions, and notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <aside className="md:col-span-3">
          <nav className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 space-y-0.5">
            {USER_NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <Link
                  key={item.id}
                  to={`/settings/${item.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium whitespace-nowrap ${
                    active
                      ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-semibold'
                      : 'text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="md:col-span-9">
          {section === 'profile' && <ProfileTab />}
          {section === 'tokens' && <GitCredentialsTab />}
          {section === 'sessions' && <SessionsTab />}
          {section === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { me } = useAuth();
  if (!me) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">Identity Profile (Managed by IdP)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-[var(--fg-muted)]">Username</div>
            <div className="font-mono font-semibold text-[var(--fg-default)] mt-0.5">@{me.username}</div>
          </div>
          <div>
            <div className="text-[var(--fg-muted)]">Display Name</div>
            <div className="font-medium text-[var(--fg-default)] mt-0.5">{me.displayName ?? '—'}</div>
          </div>
          <div>
            <div className="text-[var(--fg-muted)]">Email</div>
            <div className="font-mono text-[var(--fg-default)] mt-0.5">{me.email ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold">
          Workspace Memberships ({me.memberships.length})
        </div>
        <div className="divide-y divide-[var(--border-muted)]">
          {me.memberships.map((m) => (
            <div key={m.tenant.id} className="p-4 flex items-center justify-between gap-3 text-xs">
              <div>
                <Link to={`/${m.tenant.slug}`} className="font-semibold text-sm text-[var(--brand-primary)] hover:underline">
                  {m.tenant.name}
                </Link>
                <div className="font-mono text-[var(--fg-muted)] mt-0.5">
                  /{m.tenant.slug} · {m.tenant.kind}
                </div>
              </div>
              <div className="font-mono text-[var(--fg-default)]">{m.roles.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GitCredentialsTab() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [tokenName, setTokenName] = useState('');
  const [readScope, setReadScope] = useState(true);
  const [writeScope, setWriteScope] = useState(true);
  const [expiresDays, setExpiresDays] = useState(90);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [sshTitle, setSshTitle] = useState('');
  const [sshPubKey, setSshPubKey] = useState('');

  const { data: tokens, isLoading: tokensLoading, error: tokensErr } = useQuery({
    queryKey: ['git-tokens'],
    queryFn: () => api.listGitTokens(),
  });

  const { data: sshKeys, isLoading: sshLoading, error: sshErr } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: () => api.listSshKeys(),
  });

  const createTokenMutation = useMutation({
    mutationFn: () => {
      const scopes: Array<'git:read' | 'git:write'> = [];
      if (readScope) scopes.push('git:read');
      if (writeScope) scopes.push('git:write');
      return api.createGitToken({ name: tokenName.trim(), scopes, expiresInDays: expiresDays });
    },
    onSuccess: (created) => {
      setTokenName('');
      queryClient.invalidateQueries({ queryKey: ['git-tokens'] });
      setCreatedSecret(created.token);
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) => api.revokeGitToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['git-tokens'] }),
  });

  const addSshMutation = useMutation({
    mutationFn: () => api.addSshKey({ title: sshTitle.trim(), publicKey: sshPubKey.trim() }),
    onSuccess: () => {
      setSshTitle('');
      setSshPubKey('');
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
    },
  });

  const removeSshMutation = useMutation({
    mutationFn: (id: string) => api.removeSshKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ssh-keys'] }),
  });

  return (
    <div className="space-y-8">
      {/* Git Tokens */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold">Personal Git Tokens</h2>
          <p className="text-xs text-[var(--fg-muted)]">
            Authenticate HTTPS Git clones and pushes without storing passwords.
          </p>
        </div>

        {(tokensErr || createTokenMutation.error) && (
          <ErrorBanner error={tokensErr || createTokenMutation.error} />
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTokenMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Token label</label>
              <input
                type="text"
                required
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Workstation Git CLI"
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Expiration (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 font-mono cursor-pointer">
                <input type="checkbox" checked={readScope} onChange={(e) => setReadScope(e.target.checked)} />
                <span>git:read</span>
              </label>
              <label className="inline-flex items-center gap-1.5 font-mono cursor-pointer">
                <input type="checkbox" checked={writeScope} onChange={(e) => setWriteScope(e.target.checked)} />
                <span>git:write</span>
              </label>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createTokenMutation.isPending || !tokenName.trim() || (!readScope && !writeScope)}
            >
              Generate Git token
            </Button>
          </div>
        </form>

        {tokensLoading ? (
          <SkeletonRows rows={2} />
        ) : (
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
            {(tokens ?? []).length === 0 ? (
              <div className="p-4 text-xs text-[var(--fg-muted)]">No Git tokens created yet.</div>
            ) : (
              (tokens ?? []).map((t) => (
                <div key={t.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t.name}</span>
                      <code className="font-mono text-[var(--fg-muted)]">{t.displayPrefix}…</code>
                    </div>
                    <div className="font-mono text-[var(--fg-muted)] mt-0.5">
                      {t.scopes.join(', ')} · expires {new Date(t.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revokeTokenMutation.mutate(t.id)} className="text-[var(--danger)]">
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* SSH Keys */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold">SSH Keys</h2>
          <p className="text-xs text-[var(--fg-muted)]">Register public keys for SSH Git push/pull operations.</p>
        </div>

        {(sshErr || addSshMutation.error) && <ErrorBanner error={sshErr || addSshMutation.error} />}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSshMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <input
            type="text"
            required
            value={sshTitle}
            onChange={(e) => setSshTitle(e.target.value)}
            placeholder="Key title (e.g. MacBook Pro ed25519)"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <textarea
            rows={2}
            required
            value={sshPubKey}
            onChange={(e) => setSshPubKey(e.target.value)}
            placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
            className="w-full px-3 py-2 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!sshTitle.trim() || !sshPubKey.trim()}>
            Add SSH key
          </Button>
        </form>

        {sshLoading ? (
          <SkeletonRows rows={2} />
        ) : (
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
            {(sshKeys ?? []).length === 0 ? (
              <div className="p-4 text-xs text-[var(--fg-muted)]">No SSH keys registered.</div>
            ) : (
              (sshKeys ?? []).map((k) => (
                <div key={k.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-sm">{k.title}</div>
                    <div className="font-mono text-[var(--fg-muted)] mt-0.5">{k.fingerprint}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeSshMutation.mutate(k.id)} className="text-[var(--danger)]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {createdSecret && (
        <OneTimeSecretModal
          title="Personal Git Token Created"
          secretLabel="Git Access Token"
          secretValue={createdSecret}
          onClose={() => setCreatedSecret(null)}
        />
      )}
    </div>
  );
}

function SessionsTab() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessionsResp, isLoading, error } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: () => api.listSessions(),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => api.revokeAllSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-sessions'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Active Sessions</h2>
          <p className="text-xs text-[var(--fg-muted)]">
            Source: {sessionsResp?.source ?? 'identity-provider'}
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => revokeAllMutation.mutate()}>
          Revoke all sessions
        </Button>
      </div>

      {error && <ErrorBanner error={error} />}

      {isLoading ? (
        <SkeletonRows rows={2} />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(sessionsResp?.items ?? []).map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between text-xs font-mono">
              <div>
                <div className="font-semibold text-[var(--fg-default)]">IP: {s.ipAddress}</div>
                <div className="text-[var(--fg-muted)] mt-0.5">
                  Started {formatRelativeTime(s.startedAt)} · Last access {formatRelativeTime(s.lastAccessAt)}
                </div>
              </div>
              <StatusBadge status="ACTIVE" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsTab() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(true);

  const { data: notifPage, isLoading, error } = useQuery({
    queryKey: ['notifications-list', showAll],
    queryFn: () => api.listNotifications({ limit: 50, all: showAll }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`px-3 py-1 rounded cursor-pointer ${showAll ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] font-medium' : 'text-[var(--fg-muted)]'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={`px-3 py-1 rounded cursor-pointer ${!showAll ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] font-medium' : 'text-[var(--fg-muted)]'}`}
          >
            Unread
          </button>
        </div>

        <Button variant="secondary" size="sm" onClick={() => markAllMutation.mutate()}>
          Mark all read
        </Button>
      </div>

      {error && <ErrorBanner error={error} />}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(notifPage?.items ?? []).length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--fg-muted)]">No notifications to display.</div>
          ) : (
            (notifPage?.items ?? []).map((n) => (
              <div key={n.id} className="p-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--fg-default)]">{n.title}</span>
                    {!n.read && <StatusBadge status="UNREAD" tone="info" />}
                  </div>
                  <p className="text-xs text-[var(--fg-muted)]">{n.body}</p>
                  <div className="text-[11px] font-mono text-[var(--fg-muted)]">{formatRelativeTime(n.createdAt)}</div>
                </div>
                {!n.read && (
                  <Button variant="secondary" size="sm" onClick={() => markReadMutation.mutate(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
