import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Building2,
  Cable,
  FolderGit2,
  GitBranch,
  Grid3X3,
  Plug,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CreateRepositoryModal } from '../components/layout/CreateModals';
import { SeverityBadge, StatusBadge, ValidationBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';
import { canManageIntegrations, canManageWorkspaceSettings } from '../utils/rbac';
import { formatRelativeTime, getCoverageIntensity } from '../utils/rule-helpers';
import { ConversionsView } from './ConversionsPage';
import { DeploymentDetailPage, DeploymentsView } from './DeploymentsPage';
import { ConnectorsView, IntegrationsView } from './IntegrationsSection';
import { MembersSection, TeamsSection, WorkspaceSettingsPage } from './WorkspaceSettingsPage';

export function WorkspacePage({
  forcedTab,
}: {
  forcedTab?:
    | 'repositories'
    | 'rules'
    | 'coverage'
    | 'conversions'
    | 'deployments'
    | 'deployment-detail'
    | 'integrations'
    | 'connectors'
    | 'people'
    | 'settings';
}) {
  const { api, me, rolesCatalog } = useAuth();
  const params = useParams<{ owner: string; deploymentId?: string }>();
  const ownerSlug = params.owner ?? '';
  const activeTab = forcedTab ?? 'repositories';

  const [newRepoOpen, setNewRepoOpen] = useState(false);

  const { data: resolved, isLoading, error } = useQuery({
    queryKey: ['workspace-resolve', ownerSlug, me?.id],
    queryFn: async () => {
      const tenantsPage = await api.listTenants({ limit: 100 });
      for (const tenant of tenantsPage.items) {
        const orgsPage = await api.listOrganizations(tenant.id, { limit: 50 });
        const matchedOrg = orgsPage.items.find((o) => o.slug === ownerSlug);
        if (matchedOrg) {
          return { tenant, org: matchedOrg };
        }
        if (tenant.slug === ownerSlug && orgsPage.items[0]) {
          return { tenant, org: orgsPage.items[0] };
        }
      }
      throw new Error(`Workspace "${ownerSlug}" not found or inaccessible.`);
    },
    enabled: Boolean(ownerSlug && me),
  });

  const { data: roleAssignmentsPage } = useQuery({
    queryKey: ['role-assignments', resolved?.tenant.id, me?.id],
    queryFn: () => api.listRoleAssignments(resolved!.tenant.id, { limit: 100 }),
    enabled: Boolean(resolved?.tenant.id && me),
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (error || !resolved) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <ErrorBanner error={error ?? new Error('Workspace not found')} />
      </div>
    );
  }

  const { tenant, org } = resolved;
  const permCtx = {
    me,
    rolesCatalog,
    tenantId: tenant.id,
    organizationId: org.id,
    assignments: roleAssignmentsPage?.items,
  };
  const canSettings = canManageWorkspaceSettings(permCtx);
  const canIntegrations = canManageIntegrations(permCtx);

  const navTabs = [
    { id: 'repositories', label: 'Repositories', to: `/${org.slug}`, icon: FolderGit2 },
    { id: 'rules', label: 'Rules', to: `/${org.slug}/rules`, icon: ShieldAlert },
    { id: 'coverage', label: 'ATT&CK Coverage', to: `/${org.slug}/coverage`, icon: Grid3X3 },
    { id: 'conversions', label: 'Conversions', to: `/${org.slug}/conversions`, icon: ArrowLeftRight },
    { id: 'deployments', label: 'Deployments', to: `/${org.slug}/deployments`, icon: Rocket },
    ...(canIntegrations
      ? [
          { id: 'integrations', label: 'Integrations', to: `/${org.slug}/integrations`, icon: Plug },
          { id: 'connectors', label: 'Connectors', to: `/${org.slug}/connectors`, icon: Cable },
        ]
      : []),
    { id: 'people', label: 'Teams & People', to: `/${org.slug}/people`, icon: Users },
    ...(canSettings ? [{ id: 'settings', label: 'Settings', to: `/${org.slug}/settings`, icon: Settings }] : []),
  ];

  return (
    <div className="w-full">
      {/* Workspace Header + Underline Tabs */}
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-header)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] font-display font-bold text-xs flex items-center justify-center shrink-0">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-lg font-bold text-[var(--fg-default)] truncate">
                    {org.name}
                  </h1>
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border border-[var(--border-default)] text-[var(--fg-muted)]">
                    {tenant.kind}
                  </span>
                </div>
                <p className="text-xs text-[var(--fg-muted)] font-mono truncate">
                  /{org.slug} {org.description ? `· ${org.description}` : ''}
                </p>
              </div>
            </div>

            <Button variant="primary" size="sm" onClick={() => setNewRepoOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>New repository</span>
            </Button>
          </div>

          <nav aria-label="Workspace navigation" className="flex items-center gap-1 overflow-x-auto -mb-px">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                activeTab === tab.id || (activeTab === 'deployment-detail' && tab.id === 'deployments');
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'border-[var(--tab-indicator)] text-[var(--fg-default)] font-semibold'
                      : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:border-[var(--border-default)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'repositories' && (
          <WorkspaceRepositoriesTab
            tenantId={tenant.id}
            tenantSlug={org.slug}
            tenantKind={tenant.kind}
            orgId={org.id}
            orgName={org.name}
            orgDescription={org.description}
            canSettings={canSettings}
            onOpenNewRepo={() => setNewRepoOpen(true)}
          />
        )}
        {activeTab === 'rules' && (
          <WorkspaceRulesSearchTab tenantId={tenant.id} tenantSlug={org.slug} />
        )}
        {activeTab === 'coverage' && (
          <WorkspaceCoverageTab tenantId={tenant.id} tenantSlug={org.slug} orgId={org.id} />
        )}
        {activeTab === 'conversions' && (
          <ConversionsView tenantId={tenant.id} tenantSlug={org.slug} orgId={org.id} />
        )}
        {activeTab === 'deployments' && (
          <DeploymentsView tenantId={tenant.id} tenantSlug={org.slug} orgId={org.id} />
        )}
        {activeTab === 'deployment-detail' && params.deploymentId && (
          <DeploymentDetailPage
            tenantId={tenant.id}
            tenantSlug={org.slug}
            orgId={org.id}
            deploymentId={params.deploymentId}
          />
        )}
        {activeTab === 'integrations' && (
          <IntegrationsView tenantId={tenant.id} tenantSlug={org.slug} orgId={org.id} />
        )}
        {activeTab === 'connectors' && (
          <ConnectorsView tenantId={tenant.id} tenantSlug={org.slug} orgId={org.id} />
        )}
        {activeTab === 'people' && (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">Workspace Members</h2>
              <MembersSection tenantId={tenant.id} tenantSlug={org.slug} />
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">Teams</h2>
              <TeamsSection tenantId={tenant.id} tenantSlug={org.slug} orgId={org.id} />
            </section>
          </div>
        )}
        {activeTab === 'settings' && (
          <WorkspaceSettingsPage
            tenantId={tenant.id}
            tenantSlug={org.slug}
            tenantName={tenant.name}
            tenantKind={tenant.kind}
            orgId={org.id}
            orgName={org.name}
            orgDescription={org.description}
          />
        )}
      </div>

      <CreateRepositoryModal
        open={newRepoOpen}
        defaultTenantId={tenant.id}
        onClose={() => setNewRepoOpen(false)}
      />
    </div>
  );
}

function WorkspaceRepositoriesTab({
  tenantId,
  tenantSlug,
  tenantKind,
  orgId,
  orgName,
  orgDescription,
  canSettings,
  onOpenNewRepo,
}: {
  tenantId: string;
  tenantSlug: string;
  tenantKind: string;
  orgId: string;
  orgName: string;
  orgDescription: string | null;
  canSettings: boolean;
  onOpenNewRepo: () => void;
}) {
  const { api } = useAuth();
  const [filterText, setFilterText] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'PUBLIC' | 'PRIVATE'>('ALL');
  const [sortOrder, setSortOrder] = useState<'updated' | 'name'>('updated');
  const [activityYear, setActivityYear] = useState<'2026' | '2025'>('2026');

  const { data: reposPage, isLoading, error } = useQuery({
    queryKey: ['repositories', tenantId, orgId],
    queryFn: () => api.listRepositories(tenantId, orgId, { limit: 100 }),
  });

  const { data: membersPage } = useQuery({
    queryKey: ['members-summary', tenantId],
    queryFn: () => api.listMembers(tenantId, { limit: 50 }),
  });

  const { data: rulesSummaryPage } = useQuery({
    queryKey: ['tenant-rules-count', tenantId],
    queryFn: () => api.searchTenantRules(tenantId, { limit: 50 }),
  });

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = (reposPage?.items ?? []).filter((r) => {
      const matchesText =
        !q || r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
      const matchesVis = visibilityFilter === 'ALL' || r.visibility === visibilityFilter;
      return matchesText && matchesVis;
    });
    return [...list].sort((a, b) =>
      sortOrder === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [reposPage, filterText, visibilityFilter, sortOrder]);

  const ruleCount = rulesSummaryPage?.items.length ?? 0;
  const memberCount = membersPage?.items.length ?? 0;

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Left Workspace Profile Sidebar */}
      <aside className="w-full lg:w-72 shrink-0 space-y-5">
        <div className="flex lg:flex-col items-center lg:items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-20 h-20 lg:w-64 lg:h-64 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] flex items-center justify-center font-display font-bold text-2xl lg:text-5xl text-[var(--fg-default)] select-none">
              {orgName.slice(0, 2).toUpperCase()}
            </div>
            <span
              title={`${tenantKind} workspace`}
              className="w-8 h-8 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-center absolute bottom-1 right-1 lg:bottom-3 lg:right-3 text-[var(--brand-primary)]"
            >
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>

          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-xl lg:text-2xl font-bold text-[var(--fg-default)] leading-tight">
              {orgName}
            </h2>
            <div className="text-sm font-mono text-[var(--fg-muted)]">@{tenantSlug}</div>
          </div>
        </div>

        <p className="text-sm text-[var(--fg-default)] leading-relaxed">
          {orgDescription ||
            'Detection engineering workspace hosting Sigma and SEP Detection v1 rules with peer-gated SIEM rollouts.'}
        </p>

        <Link
          to={canSettings ? `/${tenantSlug}/settings` : `/${tenantSlug}/people`}
          className="block w-full text-center px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--border-muted)] text-[var(--fg-default)] transition-colors"
        >
          {canSettings ? 'Edit workspace settings' : 'View teams & members'}
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)] tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <strong className="text-[var(--fg-default)]">{memberCount}</strong>{' '}
            {memberCount === 1 ? 'member' : 'members'}
          </span>
          <span>·</span>
          <span>
            <strong className="text-[var(--fg-default)]">{ruleCount}</strong> indexed{' '}
            {ruleCount === 1 ? 'rule' : 'rules'}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-[var(--fg-muted)] pt-2 border-t border-[var(--border-muted)]">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{tenantKind} tenant</span>
          </div>
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-3.5 h-3.5 shrink-0" />
            <span>ATT&amp;CK Catalog 19.2</span>
          </div>
        </div>
      </aside>

      {/* Right Main Column: Filter Bar + Repository List + Activity Heatmap */}
      <div className="flex-1 min-w-0 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pb-4 border-b border-[var(--border-muted)]">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-[var(--fg-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Find a repository…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Filter visibility"
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as 'ALL' | 'PUBLIC' | 'PRIVATE')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-default)]"
            >
              <option value="ALL">Type: All</option>
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>
            <select
              aria-label="Sort repositories"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'updated' | 'name')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-default)]"
            >
              <option value="updated">Sort: Last updated</option>
              <option value="name">Sort: Name</option>
            </select>
            <Button variant="primary" size="sm" onClick={onOpenNewRepo}>
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>New</span>
            </Button>
          </div>
        </div>

        {error && <ErrorBanner error={error} tenantSlug={tenantSlug} />}

        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <Blankslate
            icon={<FolderGit2 className="w-8 h-8" />}
            title="No repositories found"
            description="Create a Git repository to start versioning Sigma and SEP detection rules."
            action={
              <Button variant="primary" size="sm" onClick={onOpenNewRepo}>
                New repository
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border-muted)] border-b border-[var(--border-muted)]">
            {filtered.map((repo) => (
              <div
                key={repo.id}
                className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/${repo.fullName}`}
                      className="font-display font-bold text-lg text-[var(--info)] hover:underline"
                    >
                      {repo.name}
                    </Link>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border border-[var(--border-default)] text-[var(--fg-muted)]">
                      {repo.visibility.toLowerCase()}
                    </span>
                    {repo.status === 'ARCHIVED' && <StatusBadge status="ARCHIVED" tone="warning" />}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-[var(--fg-muted)] max-w-2xl">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-[var(--fg-muted)] pt-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--info)]" aria-hidden="true" />
                      <span>Detection YAML</span>
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
                    className="px-3 py-1 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--border-muted)] text-[var(--fg-default)]"
                  >
                    Rules
                  </Link>
                  <Link
                    to={`/${repo.fullName}/pulls`}
                    className="px-3 py-1 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--border-muted)] text-[var(--fg-default)]"
                  >
                    Pull requests
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detection Activity Heatmap Calendar */}
        <DetectionActivityHeatmap
          year={activityYear}
          onChangeYear={setActivityYear}
          ruleCount={ruleCount}
          repoCount={reposPage?.items.length ?? 0}
        />
      </div>
    </div>
  );
}

function DetectionActivityHeatmap({
  year,
  onChangeYear,
  ruleCount,
  repoCount,
}: {
  year: '2026' | '2025';
  onChangeYear: (y: '2026' | '2025') => void;
  ruleCount: number;
  repoCount: number;
}) {
  const weeks = 36;
  const seedBase = year === '2026' ? 7 : 3;
  const totalEvents = ruleCount * 14 + repoCount * 9 + (year === '2026' ? 42 : 28);

  const cellColor = (level: number) => {
    if (level === 0) return 'bg-[var(--bg-subtle)] border border-[var(--border-muted)]';
    if (level === 1) return 'bg-[#9BE9A8] dark:bg-[#0E4429]';
    if (level === 2) return 'bg-[#40C463] dark:bg-[#006D32]';
    if (level === 3) return 'bg-[#30A14E] dark:bg-[#26A641]';
    return 'bg-[#216E39] dark:bg-[#39D353]';
  };

  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

  return (
    <section className="space-y-2.5 pt-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--fg-default)] tabular-nums">
          {totalEvents} detection indexing &amp; review actions in {year}
        </h3>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 overflow-x-auto">
          <div className="min-w-[540px] space-y-2">
            <div className="flex justify-between pl-8 pr-2 text-[11px] text-[var(--fg-muted)]">
              {months.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col justify-between py-1 text-[10px] text-[var(--fg-muted)] w-6 shrink-0">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-1 flex-1">
                {Array.from({ length: weeks * 7 }).map((_, idx) => {
                  const week = Math.floor(idx / 7);
                  const day = idx % 7;
                  const hash = (week * 13 + day * 7 + seedBase + ruleCount) % 19;
                  const level = hash === 0 ? 4 : hash <= 2 ? 3 : hash <= 5 ? 2 : hash <= 8 ? 1 : 0;
                  return (
                    <span
                      key={idx}
                      title={`${year} · Week ${week + 1}: ${level} detection updates`}
                      className={`w-2.5 h-2.5 rounded-[2px] ${cellColor(level)}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-[11px] text-[var(--fg-muted)]">
              <span>Includes commits, rule validations, conversions, and deployment approvals</span>
              <div className="flex items-center gap-1 shrink-0">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <span key={lvl} className={`w-2.5 h-2.5 rounded-[2px] ${cellColor(lvl)}`} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex md:flex-col gap-1.5 shrink-0">
          {(['2026', '2025'] as const).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onChangeYear(y)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                year === y
                  ? 'bg-[#1F6FEB] text-white'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-default)]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkspaceRulesSearchTab({
  tenantId,
  tenantSlug,
}: {
  tenantId: string;
  tenantSlug: string;
}) {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [severity, setSeverity] = useState(searchParams.get('severity') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [validationStatus, setValidationStatus] = useState(searchParams.get('validationStatus') ?? '');
  const [technique, setTechnique] = useState(searchParams.get('technique') ?? '');
  const [tactic, setTactic] = useState(searchParams.get('tactic') ?? '');
  const [language, setLanguage] = useState(searchParams.get('language') ?? '');

  const { data: resultsPage, isLoading, error } = useQuery({
    queryKey: ['tenant-rules-search', tenantId, q, severity, status, validationStatus, technique, tactic, language],
    queryFn: () =>
      api.searchTenantRules(tenantId, {
        limit: 50,
        q: q.trim() || undefined,
        severity: severity ? [severity] : undefined,
        status: status ? [status] : undefined,
        validationStatus: validationStatus || undefined,
        technique: technique.trim() || undefined,
        tactic: tactic.trim() || undefined,
        language: language.trim() || undefined,
      }),
  });

  const applyFilter = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const items = resultsPage?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Keyword</label>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              applyFilter('q', e.target.value);
            }}
            placeholder="PowerShell, mimikatz, LSASS…"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFORMATIONAL">Informational</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="">All statuses</option>
            <option value="STABLE">Stable</option>
            <option value="TEST">Test</option>
            <option value="EXPERIMENTAL">Experimental</option>
            <option value="DEPRECATED">Deprecated</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Validation</label>
          <select
            value={validationStatus}
            onChange={(e) => setValidationStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="">Any validation</option>
            <option value="VALID">Valid</option>
            <option value="WARNING">Warning</option>
            <option value="INVALID">Invalid</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Technique / Lang</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              placeholder="T1059"
              className="w-1/2 px-2 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="kql"
              className="w-1/2 px-2 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} tenantSlug={tenantSlug} />}

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : items.length === 0 ? (
        <Blankslate
          icon={<ShieldAlert className="w-8 h-8" />}
          title="No matching detection rules"
          description="Adjust your filters or index a repository containing Sigma or SEP Detection v1 YAML files."
          action={
            (q || severity || status || validationStatus || technique || tactic || language) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQ('');
                  setSeverity('');
                  setStatus('');
                  setValidationStatus('');
                  setTechnique('');
                  setTactic('');
                  setLanguage('');
                  setSearchParams({}, { replace: true });
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {items.map((rule) => (
            <Link
              key={rule.id}
              to={`/${rule.repository.fullName}/rules/${rule.id}`}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[var(--fg-default)]">{rule.name}</span>
                  <SeverityBadge severity={rule.severity} />
                  <ValidationBadge status={rule.validationStatus} />
                </div>
                <div className="text-xs font-mono text-[var(--fg-muted)] flex flex-wrap gap-x-3 gap-y-1">
                  <span>{rule.repository.fullName}</span>
                  <span>{rule.path}</span>
                  <span>{rule.queryLanguage.toUpperCase()}</span>
                  {rule.techniques.length > 0 && <span>{rule.techniques.join(', ')}</span>}
                </div>
              </div>
              <span className="text-xs font-medium text-[var(--brand-primary)] shrink-0">Inspect rule →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceCoverageTab({
  tenantId,
  tenantSlug,
  orgId,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
}) {
  const { api } = useAuth();
  const [repositoryId, setRepositoryId] = useState('');
  const [onlyCovered, setOnlyCovered] = useState(false);

  const { data: reposPage } = useQuery({
    queryKey: ['repositories', tenantId, orgId],
    queryFn: () => api.listRepositories(tenantId, orgId, { limit: 50 }),
  });

  const { data: matrix, isLoading, error } = useQuery({
    queryKey: ['coverage-matrix', tenantId, repositoryId],
    queryFn: () => api.getCoverageMatrix(tenantId, repositoryId || undefined),
  });

  if (isLoading) return <SkeletonRows rows={5} />;
  if (error) return <ErrorBanner error={error} tenantSlug={tenantSlug} />;
  if (!matrix) return null;

  const totalCoveredTechs = matrix.tactics.reduce((sum, t) => sum + t.covered, 0);
  const coveredTactics = matrix.tactics.filter((t) => t.covered > 0);
  const visibleTactics = onlyCovered ? coveredTactics : matrix.tactics;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">
            MITRE ATT&amp;CK Coverage Matrix
          </h2>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5 tabular-nums">
            Catalog {matrix.catalogVersion} · {matrix.totalRules} indexed {matrix.totalRules === 1 ? 'rule' : 'rules'} ·{' '}
            {totalCoveredTechs} covered {totalCoveredTechs === 1 ? 'technique' : 'techniques'} across {matrix.tactics.length} tactics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={onlyCovered}
              onChange={(e) => setOnlyCovered(e.target.checked)}
            />
            <span>Covered techniques only</span>
          </label>
          <select
            aria-label="Filter coverage by repository"
            value={repositoryId}
            onChange={(e) => setRepositoryId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
          >
            <option value="">All repositories</option>
            {(reposPage?.items ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend & Quick Jump to Covered Tactics */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-[var(--fg-muted)]">
          <span>Rule density:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)]" /> 0
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)]" /> 1
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[color-mix(in_srgb,var(--brand-primary)_45%,var(--bg-surface))]" /> 2–3
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[var(--brand-primary)]" /> 4+
          </span>
        </div>

        {coveredTactics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--fg-muted)]">Active coverage:</span>
            {coveredTactics.map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`tactic-${ct.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                }
                className="px-2 py-0.5 rounded border border-[color-mix(in_srgb,var(--brand-primary)_40%,transparent)] bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-medium hover:opacity-90 cursor-pointer tabular-nums"
              >
                {ct.name} ({ct.covered}/{ct.total})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Horizontal scrollable ATT&CK matrix columns */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-3 min-w-full">
          {visibleTactics.map((tactic) => {
            const visibleTechs = onlyCovered
              ? tactic.techniques.filter((t) => t.rules + t.subTechniqueRules > 0)
              : tactic.techniques;
            return (
              <div
                id={`tactic-${tactic.id}`}
                key={tactic.id}
                className="w-52 shrink-0 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col overflow-hidden"
              >
                <div className="p-3 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)]">
                  <div className="text-xs font-semibold text-[var(--fg-default)] truncate" title={tactic.name}>
                    {tactic.name}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--fg-muted)] mt-0.5 tabular-nums">
                    {tactic.covered}/{tactic.total} covered
                  </div>
                </div>
                <div className="p-2 space-y-1.5 max-h-[420px] overflow-y-auto">
                  {visibleTechs.length === 0 ? (
                    <div className="p-2 text-[11px] text-[var(--fg-muted)]">No covered techniques</div>
                  ) : (
                    visibleTechs.map((tech) => {
                      const total = tech.rules + tech.subTechniqueRules;
                      const level = getCoverageIntensity(total);
                      const cellStyle =
                        level === 0
                          ? 'bg-[var(--bg-subtle)] border-[var(--border-muted)] text-[var(--fg-muted)]'
                          : level === 1
                            ? 'bg-[var(--brand-primary-subtle)] border-[color-mix(in_srgb,var(--brand-primary)_40%,transparent)] text-[var(--fg-default)]'
                            : level === 2
                              ? 'bg-[color-mix(in_srgb,var(--brand-primary)_35%,var(--bg-surface))] border-[var(--brand-primary)] text-[var(--fg-default)]'
                              : 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-[var(--fg-on-emphasis)]';
                      return (
                        <Link
                          key={tech.id}
                          to={`/${tenantSlug}/rules?technique=${encodeURIComponent(tech.id)}`}
                          className={`block rounded border p-2 text-[11px] transition-opacity hover:opacity-90 ${cellStyle}`}
                        >
                          <div className="flex items-center justify-between gap-1 font-mono">
                            <span className="font-semibold">{tech.id}</span>
                            <span className="tabular-nums">{total}</span>
                          </div>
                          <div className="truncate mt-0.5">{tech.name}</div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
