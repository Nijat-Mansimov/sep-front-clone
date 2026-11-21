import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Bell,
  Building2,
  FolderGit2,
  GitBranch,
  Grid3X3,
  Plus,
  Rocket,
  ShieldAlert,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { ConversionDto, DeploymentDto, OrganizationDto, RepositoryDto, TenantDto } from '../api/types';
import { CreateRepositoryModal, CreateWorkspaceModal } from '../components/layout/CreateModals';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatRelativeTime } from '../utils/rule-helpers';

interface WorkspaceOverviewItem {
  tenant: TenantDto;
  orgs: OrganizationDto[];
  repos: RepositoryDto[];
  pendingDeployments: DeploymentDto[];
  recentConversions: ConversionDto[];
}

export function DashboardPage() {
  const { api, me } = useAuth();
  const [newRepoOpen, setNewRepoOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);

  const {
    data: overview,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dashboard-overview', me?.id],
    queryFn: async () => {
      const tenantsPage = await api.listTenants({ limit: 50 });
      const results: WorkspaceOverviewItem[] = await Promise.all(
        tenantsPage.items.map(async (tenant) => {
          const orgsPage = await api.listOrganizations(tenant.id, { limit: 20 });
          const orgs = orgsPage.items;
          const repoPages = await Promise.all(
            orgs.map((o) => api.listRepositories(tenant.id, o.id, { limit: 20 })),
          );
          const repos = repoPages.flatMap((p) => p.items);
          const primaryOrg = orgs[0];
          let pendingDeployments: DeploymentDto[] = [];
          let recentConversions: ConversionDto[] = [];
          if (primaryOrg) {
            try {
              const depPage = await api.listDeployments(tenant.id, primaryOrg.id, {
                limit: 10,
                status: 'PENDING_APPROVAL',
              });
              pendingDeployments = depPage.items;
            } catch {
              pendingDeployments = [];
            }
            try {
              const convPage = await api.listConversions(tenant.id, primaryOrg.id, { limit: 5 });
              recentConversions = convPage.items;
            } catch {
              recentConversions = [];
            }
          }
          return { tenant, orgs, repos, pendingDeployments, recentConversions };
        }),
      );
      return results;
    },
    enabled: Boolean(me),
  });

  const { data: notificationsPage } = useQuery({
    queryKey: ['notifications-dashboard'],
    queryFn: () => api.listNotifications({ limit: 6, all: true }),
    enabled: Boolean(me),
  });

  const allRepos = (overview ?? []).flatMap((w) => w.repos);
  const allPendingDeployments = (overview ?? []).flatMap((w) =>
    w.pendingDeployments.map((d) => ({ ...d, tenantSlug: w.tenant.slug })),
  );
  const allConversions = (overview ?? []).flatMap((w) =>
    w.recentConversions.map((c) => ({ ...c, tenantSlug: w.tenant.slug })),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-muted)]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-default)]">
            Detection Engineering Dashboard
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5">
            Signed in as <span className="font-mono text-[var(--fg-default)]">{me?.username}</span> ·{' '}
            {overview?.length ?? 0} active {(overview?.length ?? 0) === 1 ? 'workspace' : 'workspaces'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setNewWorkspaceOpen(true)}>
            <Building2 className="w-3.5 h-3.5" />
            <span>New workspace</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setNewRepoOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>New repository</span>
          </Button>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deployments awaiting approval */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[var(--fg-default)] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[var(--warning)]" />
                  <span>Deployments awaiting approval ({allPendingDeployments.length})</span>
                </h2>
              </div>

              {allPendingDeployments.length === 0 ? (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--fg-muted)]">
                  No deployments currently require review.
                </div>
              ) : (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
                  {allPendingDeployments.map((dep) => (
                    <Link
                      key={dep.id}
                      to={`/${dep.tenantSlug}/deployments/${dep.id}`}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[var(--fg-default)] truncate">
                            {dep.rule.name}
                          </span>
                          <SeverityBadge severity={dep.rule.severity} />
                          <StatusBadge status={dep.status} />
                        </div>
                        <div className="text-xs text-[var(--fg-muted)] font-mono">
                          {dep.tenantSlug} · {dep.environment} · {dep.rule.dialect.toUpperCase()} · requested{' '}
                          {formatRelativeTime(dep.createdAt)}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[var(--brand-primary)] whitespace-nowrap shrink-0">
                        Review deployment →
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Repositories */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[var(--fg-default)] flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-[var(--brand-primary)]" />
                  <span>Repositories ({allRepos.length})</span>
                </h2>
              </div>

              {allRepos.length === 0 ? (
                <Blankslate
                  icon={<FolderGit2 className="w-8 h-8" />}
                  title="No detection repositories yet"
                  description="Create your first Git repository to store Sigma and SEP Detection v1 rules."
                  action={
                    <Button variant="primary" size="sm" onClick={() => setNewRepoOpen(true)}>
                      Create repository
                    </Button>
                  }
                />
              ) : (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
                  {allRepos.map((repo) => (
                    <div key={repo.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/${repo.fullName}`}
                            className="font-semibold text-sm text-[var(--info)] hover:underline truncate"
                          >
                            {repo.fullName}
                          </Link>
                          <span className="px-2 py-0.5 text-[11px] rounded-full border border-[var(--border-default)] text-[var(--fg-muted)]">
                            {repo.visibility.toLowerCase()}
                          </span>
                          {repo.status === 'ARCHIVED' && <StatusBadge status="ARCHIVED" tone="warning" />}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-[var(--fg-muted)] line-clamp-1">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[var(--info)]" aria-hidden="true" />
                            <span>YAML</span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <GitBranch className="w-3 h-3" />
                            {repo.defaultBranch}
                          </span>
                          <span>Updated {formatRelativeTime(repo.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/${repo.fullName}/rules`}
                          className="px-2.5 py-1 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--border-muted)] text-[var(--fg-default)] whitespace-nowrap"
                        >
                          Rules
                        </Link>
                        <Link
                          to={`/${repo.fullName}/pulls`}
                          className="px-2.5 py-1 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--border-muted)] text-[var(--fg-default)] whitespace-nowrap"
                        >
                          Pull requests
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Conversions */}
            <section className="space-y-3">
              <h2 className="font-display text-base font-semibold text-[var(--fg-default)] flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>Recent query conversions</span>
              </h2>
              {allConversions.length === 0 ? (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--fg-muted)]">
                  No conversions run yet.
                </div>
              ) : (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
                  {allConversions.slice(0, 5).map((conv) => (
                    <Link
                      key={conv.id}
                      to={`/${conv.tenantSlug}/conversions`}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 hover:bg-[var(--bg-subtle)]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2 text-xs font-mono text-[var(--fg-default)]">
                          <span>{conv.sourceDialect.toUpperCase()}</span>
                          <span>→</span>
                          <span>{conv.targetDialect.toUpperCase()}</span>
                          <StatusBadge status={conv.status} />
                        </div>
                        <div className="text-xs text-[var(--fg-muted)] truncate mt-1 font-mono">
                          {conv.sourceQuery}
                        </div>
                      </div>
                      <span className="text-xs text-[var(--fg-muted)] shrink-0">
                        {formatRelativeTime(conv.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar: Workspaces & Notifications */}
          <div className="space-y-6">
            <section className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-default)]">
                  Your Workspaces
                </h2>
                <button
                  type="button"
                  onClick={() => setNewWorkspaceOpen(true)}
                  className="text-xs font-medium text-[var(--brand-primary)] hover:underline cursor-pointer"
                >
                  + New
                </button>
              </div>
              <div className="divide-y divide-[var(--border-muted)]">
                {(overview ?? []).map(({ tenant, repos }) => (
                  <div key={tenant.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/${tenant.slug}`}
                        className="font-semibold text-sm text-[var(--fg-default)] hover:text-[var(--brand-primary)] truncate"
                      >
                        {tenant.name}
                      </Link>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--fg-muted)]">
                        {tenant.kind}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
                      <span className="font-mono">/{tenant.slug}</span>
                      <span className="tabular-nums">
                        {repos.length} {repos.length === 1 ? 'repo' : 'repos'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      <Link to={`/${tenant.slug}/coverage`} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline">
                        <Grid3X3 className="w-3 h-3" /> Coverage
                      </Link>
                      <Link to={`/${tenant.slug}/conversions`} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline">
                        <ArrowLeftRight className="w-3 h-3" /> Convert
                      </Link>
                      <Link to={`/${tenant.slug}/deployments`} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline">
                        <Rocket className="w-3 h-3" /> Deployments
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-default)] flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Recent Activity</span>
                </h2>
                <Link to="/settings/notifications" className="text-xs text-[var(--brand-primary)] hover:underline">
                  All
                </Link>
              </div>
              <div className="divide-y divide-[var(--border-muted)]">
                {(notificationsPage?.items ?? []).length === 0 ? (
                  <div className="p-4 text-xs text-[var(--fg-muted)]">No notifications yet.</div>
                ) : (
                  (notificationsPage?.items ?? []).map((n) => (
                    <div key={n.id} className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--fg-default)]">{n.title}</span>
                        {!n.read && (
                          <span className="text-[10px] font-mono text-[var(--brand-primary)]">Unread</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--fg-muted)]">{n.body}</p>
                      <div className="text-[11px] text-[var(--fg-muted)]">{formatRelativeTime(n.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <CreateRepositoryModal open={newRepoOpen} onClose={() => setNewRepoOpen(false)} />
      <CreateWorkspaceModal open={newWorkspaceOpen} onClose={() => setNewWorkspaceOpen(false)} />
    </div>
  );
}
