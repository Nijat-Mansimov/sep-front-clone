import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDot,
  Code2,
  Copy,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitPullRequest,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RepositoryDto } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { SeverityBadge, StatusBadge, ValidationBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';
import { canManageWorkspaceSettings } from '../utils/rbac';
import { formatRelativeTime, isIndexTerminal } from '../utils/rule-helpers';
import { IssuesTab, PullRequestsTab, ReleasesTab, WikiTab } from './RepositoryCollaboration';

export function RepositoryPage({
  forcedTab,
}: {
  forcedTab?: 'code' | 'rules' | 'pulls' | 'issues' | 'releases' | 'wiki' | 'settings';
}) {
  const { api, me, rolesCatalog } = useAuth();
  const params = useParams<{ owner: string; repo: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const owner = params.owner ?? '';
  const repoName = params.repo ?? '';
  const activeTab = forcedTab ?? 'code';

  const [forkOpen, setForkOpen] = useState(false);

  const { data: repo, isLoading, error } = useQuery({
    queryKey: ['repo-by-path', owner, repoName],
    queryFn: () => api.getRepositoryByPath(owner, repoName),
    enabled: Boolean(owner && repoName),
  });

  const { data: starStatus } = useQuery({
    queryKey: ['repo-star', repo?.tenantId, repo?.id],
    queryFn: () => api.getStarStatus(repo!.tenantId, repo!.id),
    enabled: Boolean(repo),
  });

  const { data: stargazersPage } = useQuery({
    queryKey: ['repo-stargazers', repo?.tenantId, repo?.id],
    queryFn: () => api.listStargazers(repo!.tenantId, repo!.id),
    enabled: Boolean(repo),
  });

  const { data: watchStatus } = useQuery({
    queryKey: ['repo-watch', repo?.tenantId, repo?.id],
    queryFn: () => api.getWatchStatus(repo!.tenantId, repo!.id),
    enabled: Boolean(repo),
  });

  const { data: watchersPage } = useQuery({
    queryKey: ['repo-watchers', repo?.tenantId, repo?.id],
    queryFn: () => api.listWatchers(repo!.tenantId, repo!.id),
    enabled: Boolean(repo),
  });

  const starMutation = useMutation({
    mutationFn: () =>
      starStatus?.starred
        ? api.unstarRepo(repo!.tenantId, repo!.id)
        : api.starRepo(repo!.tenantId, repo!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repo-star', repo?.tenantId, repo?.id] });
      queryClient.invalidateQueries({ queryKey: ['repo-stargazers', repo?.tenantId, repo?.id] });
    },
  });

  const watchMutation = useMutation({
    mutationFn: () =>
      watchStatus?.watching
        ? api.unwatchRepo(repo!.tenantId, repo!.id)
        : api.watchRepo(repo!.tenantId, repo!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repo-watch', repo?.tenantId, repo?.id] });
      queryClient.invalidateQueries({ queryKey: ['repo-watchers', repo?.tenantId, repo?.id] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <ErrorBanner error={error ?? new Error('Repository not found')} tenantSlug={owner} />
      </div>
    );
  }

  const canAdmin = canManageWorkspaceSettings({
    me,
    rolesCatalog,
    tenantId: repo.tenantId,
    organizationId: repo.organizationId,
    repositoryId: repo.id,
  });

  const tabs = [
    { id: 'code', label: 'Code', to: `/${repo.fullName}`, icon: Code2 },
    { id: 'rules', label: 'Rules', to: `/${repo.fullName}/rules`, icon: ShieldAlert },
    { id: 'pulls', label: 'Pull requests', to: `/${repo.fullName}/pulls`, icon: GitPullRequest },
    { id: 'issues', label: 'Issues', to: `/${repo.fullName}/issues`, icon: CircleDot },
    { id: 'releases', label: 'Releases', to: `/${repo.fullName}/releases`, icon: Tag },
    { id: 'wiki', label: 'Wiki', to: `/${repo.fullName}/wiki`, icon: BookOpen },
    ...(canAdmin ? [{ id: 'settings', label: 'Settings', to: `/${repo.fullName}/settings`, icon: Settings }] : []),
  ];

  return (
    <div className="w-full">
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/${repo.owner}`} className="text-base font-medium text-[var(--brand-primary)] hover:underline">
                  {repo.owner}
                </Link>
                <span className="text-[var(--fg-muted)]">/</span>
                <Link to={`/${repo.fullName}`} className="font-display text-lg font-bold text-[var(--fg-default)] hover:underline">
                  {repo.name}
                </Link>
                <span className="px-2 py-0.5 text-[11px] rounded border border-[var(--border-default)] text-[var(--fg-muted)]">
                  {repo.visibility.toLowerCase()}
                </span>
                {repo.status === 'ARCHIVED' && <StatusBadge status="ARCHIVED" tone="warning" />}
              </div>
              {repo.description && <p className="text-xs text-[var(--fg-muted)]">{repo.description}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => watchMutation.mutate()}>
                <Eye className="w-3.5 h-3.5" />
                <span>{watchStatus?.watching ? 'Unwatch' : 'Watch'}</span>
                <span className="font-mono text-[var(--fg-muted)] tabular-nums">
                  {watchersPage?.items.length ?? 0}
                </span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setForkOpen(true)}>
                <GitFork className="w-3.5 h-3.5" />
                <span>Fork</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => starMutation.mutate()}>
                <Star className={`w-3.5 h-3.5 ${starStatus?.starred ? 'text-[var(--accent)] fill-current' : ''}`} />
                <span>{starStatus?.starred ? 'Starred' : 'Star'}</span>
                <span className="font-mono text-[var(--fg-muted)] tabular-nums">
                  {stargazersPage?.items.length ?? 0}
                </span>
              </Button>
            </div>
          </div>

          <nav aria-label="Repository navigation" className="flex items-center gap-1 overflow-x-auto -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'border-[var(--brand-primary)] text-[var(--fg-default)] font-semibold'
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'code' && <RepoCodeOverviewTab repo={repo} />}
        {activeTab === 'rules' && <RepoRulesTab repo={repo} />}
        {activeTab === 'pulls' && <PullRequestsTab repo={repo} />}
        {activeTab === 'issues' && <IssuesTab repo={repo} />}
        {activeTab === 'releases' && <ReleasesTab repo={repo} />}
        {activeTab === 'wiki' && <WikiTab repo={repo} />}
        {activeTab === 'settings' && (
          <RepoSettingsTab
            repo={repo}
            onDeleted={() => navigate(`/${repo.owner}`)}
            onRenamed={(fullName) => navigate(`/${fullName}`)}
          />
        )}
      </div>

      {forkOpen && (
        <ForkModal
          repo={repo}
          onClose={() => setForkOpen(false)}
          onForked={(forked) => {
            setForkOpen(false);
            navigate(`/${forked.fullName}`);
          }}
        />
      )}
    </div>
  );
}

function RepoCodeOverviewTab({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [selectedBranch, setSelectedBranch] = useState(repo.defaultBranch);
  const [cloneProto, setCloneProto] = useState<'https' | 'ssh'>('https');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchModalOpen, setBranchModalOpen] = useState(false);

  const { data: branchesPage } = useQuery({
    queryKey: ['repo-branches', repo.tenantId, repo.id],
    queryFn: () => api.listBranches(repo.tenantId, repo.id, { limit: 50 }),
  });

  const { data: commitsPage, isLoading: commitsLoading } = useQuery({
    queryKey: ['repo-commits', repo.tenantId, repo.id, selectedBranch],
    queryFn: () => api.listCommits(repo.tenantId, repo.id, { limit: 15, ref: selectedBranch }),
  });

  const { data: indexStatus } = useQuery({
    queryKey: ['repo-index-status', repo.tenantId, repo.id],
    queryFn: () => api.getRuleIndexStatus(repo.tenantId, repo.id),
    refetchInterval: (q) => (isIndexTerminal(q.state.data?.status) ? false : 1500),
  });

  const { data: rulesPage } = useQuery({
    queryKey: ['repo-rules-summary', repo.tenantId, repo.id],
    queryFn: () => api.listRepoRules(repo.tenantId, repo.id, { limit: 10 }),
  });

  const reindexMutation = useMutation({
    mutationFn: () => api.reindexRules(repo.tenantId, repo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repo-index-status', repo.tenantId, repo.id] });
      queryClient.invalidateQueries({ queryKey: ['repo-rules-summary', repo.tenantId, repo.id] });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: () =>
      api.createBranch(repo.tenantId, repo.id, {
        name: newBranchName.trim(),
        from: selectedBranch,
      }),
    onSuccess: (created) => {
      setNewBranchName('');
      setBranchModalOpen(false);
      setSelectedBranch(created.name);
      queryClient.invalidateQueries({ queryKey: ['repo-branches', repo.tenantId, repo.id] });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (name: string) => api.deleteBranch(repo.tenantId, repo.id, name),
    onSuccess: () => {
      setSelectedBranch(repo.defaultBranch);
      queryClient.invalidateQueries({ queryKey: ['repo-branches', repo.tenantId, repo.id] });
    },
  });

  const cloneUrl = cloneProto === 'https' ? repo.cloneUrls.https : repo.cloneUrls.ssh;
  const copyCloneUrl = async () => {
    try {
      await navigator.clipboard.writeText(cloneUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // ignore
    }
  };

  const branches = branchesPage?.items ?? [];
  const commits = commitsPage?.items ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">
        {/* Branch switcher + Clone box */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[var(--fg-muted)]" />
            <select
              aria-label="Select branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.protected ? '(protected)' : ''}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={() => setBranchModalOpen((v) => !v)}>
              New branch
            </Button>
            {selectedBranch !== repo.defaultBranch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteBranchMutation.mutate(selectedBranch)}
                className="text-[var(--danger)]"
              >
                Delete branch
              </Button>
            )}
          </div>
        </div>

        {(createBranchMutation.error || deleteBranchMutation.error || reindexMutation.error) && (
          <ErrorBanner
            error={createBranchMutation.error || deleteBranchMutation.error || reindexMutation.error}
            tenantSlug={repo.owner}
          />
        )}

        {branchModalOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createBranchMutation.mutate();
            }}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 flex gap-2 items-center"
          >
            <input
              type="text"
              required
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder={`Branch name from ${selectedBranch}`}
              className="flex-1 px-3 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!newBranchName.trim()}>
              Create
            </Button>
          </form>
        )}

        {/* Git Clone URL Card */}
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--fg-default)]">Clone over Git</span>
            <div className="inline-flex rounded border border-[var(--border-default)] overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={() => setCloneProto('https')}
                className={`px-2.5 py-1 cursor-pointer ${
                  cloneProto === 'https'
                    ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] font-semibold'
                    : 'bg-[var(--bg-surface)] text-[var(--fg-muted)]'
                }`}
              >
                HTTPS
              </button>
              <button
                type="button"
                onClick={() => setCloneProto('ssh')}
                className={`px-2.5 py-1 cursor-pointer ${
                  cloneProto === 'ssh'
                    ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] font-semibold'
                    : 'bg-[var(--bg-surface)] text-[var(--fg-muted)]'
                }`}
              >
                SSH
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-mono text-[var(--fg-default)] truncate select-all">
              {cloneUrl}
            </code>
            <Button variant="secondary" size="sm" onClick={copyCloneUrl}>
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <p className="text-xs text-[var(--fg-muted)]">
            Push and pull detection YAML files with your local Git CLI. Need credentials?{' '}
            <Link to="/settings/tokens" className="text-[var(--brand-primary)] hover:underline">
              Create a Git token
            </Link>{' '}
            or register an SSH key.
          </p>
        </div>

        {/* Commit History */}
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold flex items-center justify-between">
            <span>Recent Commits on {selectedBranch}</span>
            <span className="font-mono text-[var(--fg-muted)] tabular-nums">{commits.length} shown</span>
          </div>
          {commitsLoading ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className="divide-y divide-[var(--border-muted)]">
              {commits.map((c) => (
                <div key={c.sha} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-medium text-[var(--fg-default)] truncate">{c.message}</div>
                    <div className="text-xs text-[var(--fg-muted)]">
                      {c.authorName} · committed {formatRelativeTime(c.authoredAt)}
                    </div>
                  </div>
                  <code className="px-2 py-0.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-default)] shrink-0">
                    {c.sha.slice(0, 7)}
                  </code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Summary Sidebar */}
      <div className="space-y-4">
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-default)]">
              Rule Indexer
            </h3>
            {indexStatus && <StatusBadge status={indexStatus.status} />}
          </div>
          {indexStatus?.report && (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Indexed rules</span>
                <span className="font-mono font-semibold tabular-nums">{indexStatus.report.rules}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Invalid files</span>
                <span className="font-mono tabular-nums">{indexStatus.report.invalidFiles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Commit</span>
                <span className="font-mono">{indexStatus.commitSha?.slice(0, 7) ?? '—'}</span>
              </div>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={reindexMutation.isPending}
            onClick={() => reindexMutation.mutate()}
            className="w-full"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reindexMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Re-index repository</span>
          </Button>
        </div>

        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-default)]">
              Indexed Rules
            </h3>
            <Link to={`/${repo.fullName}/rules`} className="text-xs text-[var(--brand-primary)] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-[var(--border-muted)]">
            {(rulesPage?.items ?? []).slice(0, 5).map((r) => (
              <Link
                key={r.id}
                to={`/${repo.fullName}/rules/${r.id}`}
                className="py-2 flex items-center justify-between gap-2 text-xs hover:text-[var(--brand-primary)]"
              >
                <span className="truncate font-medium">{r.name}</span>
                <span className="font-mono text-[var(--fg-muted)] shrink-0">{r.queryLanguage.toUpperCase()}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RepoRulesTab({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState('');
  const [validationStatus, setValidationStatus] = useState('');
  const [validateOpen, setValidateOpen] = useState(false);
  const [yamlText, setYamlText] = useState(
    `id: 8b2c4e1a-7f1b-4c6e-9a4b-2d1a00000099\nname: Sample Detection Rule\nseverity: medium\nstatus: test\nquery:\n  language: kql\n  text: |\n    DeviceProcessEvents | where FileName =~ "cmd.exe"\nmitre:\n  tactics: [Execution]\n  techniques: [T1059.003]`,
  );

  const { data: rulesPage, isLoading, error } = useQuery({
    queryKey: ['repo-rules', repo.tenantId, repo.id, q, severity, validationStatus],
    queryFn: () =>
      api.listRepoRules(repo.tenantId, repo.id, {
        limit: 50,
        q: q.trim() || undefined,
        severity: severity ? [severity] : undefined,
        validationStatus: validationStatus || undefined,
      }),
  });

  const { data: valReport } = useQuery({
    queryKey: ['repo-validation-report', repo.tenantId, repo.id],
    queryFn: () => api.getRuleValidationReport(repo.tenantId, repo.id),
  });

  const validateYamlMutation = useMutation({
    mutationFn: () => api.validateRuleYaml(repo.tenantId, repo.id, yamlText),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter rules…"
            className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="px-2.5 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={validationStatus}
            onChange={(e) => setValidationStatus(e.target.value)}
            className="px-2.5 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="">Any validation</option>
            <option value="VALID">Valid</option>
            <option value="WARNING">Warning</option>
            <option value="INVALID">Invalid</option>
          </select>
        </div>

        <Button variant="secondary" size="sm" onClick={() => setValidateOpen((v) => !v)}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Validate YAML</span>
        </Button>
      </div>

      {valReport && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 tabular-nums">
            <span className="font-semibold text-[var(--fg-default)]">
              Validation Report ({valReport.commitSha.slice(0, 7)})
            </span>
            <span className="text-[var(--success)]">{valReport.summary.valid} valid</span>
            <span className="text-[var(--warning)]">{valReport.summary.warning} warnings</span>
            <span className="text-[var(--danger)]">{valReport.summary.invalid} invalid</span>
          </div>
        </div>
      )}

      {validateOpen && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--fg-default)]">Dry-run SEP / Sigma YAML Validation</h3>
            <button type="button" onClick={() => setValidateOpen(false)} className="text-[var(--fg-muted)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            rows={8}
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            className="w-full p-3 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-canvas)]"
          />
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="primary"
              size="sm"
              disabled={validateYamlMutation.isPending}
              onClick={() => validateYamlMutation.mutate()}
            >
              Run validator
            </Button>
            {validateYamlMutation.data && (
              <div className="flex items-center gap-2 text-xs">
                <ValidationBadge status={validateYamlMutation.data.validationStatus} />
                <span className="text-[var(--fg-muted)]">
                  {validateYamlMutation.data.issues.length} diagnostics
                </span>
              </div>
            )}
          </div>
          {validateYamlMutation.data && validateYamlMutation.data.issues.length > 0 && (
            <ul className="text-xs space-y-1 text-[var(--danger)] font-mono">
              {validateYamlMutation.data.issues.map((i, idx) => (
                <li key={idx}>
                  [{i.severity}] {i.code}: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <ErrorBanner error={error} tenantSlug={repo.owner} />}

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (rulesPage?.items ?? []).length === 0 ? (
        <Blankslate
          icon={<ShieldAlert className="w-8 h-8" />}
          title="No detection rules indexed"
          description="Push Sigma or SEP Detection v1 YAML files over Git and re-index this repository."
        />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(rulesPage?.items ?? []).map((rule) => (
            <Link
              key={rule.id}
              to={`/${repo.fullName}/rules/${rule.id}`}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[var(--fg-default)]">{rule.name}</span>
                  <SeverityBadge severity={rule.severity} />
                  <ValidationBadge status={rule.validationStatus} />
                  <StatusBadge status={rule.deploymentStatus} />
                </div>
                <div className="text-xs font-mono text-[var(--fg-muted)] flex flex-wrap gap-x-3 gap-y-1">
                  <span>{rule.path}</span>
                  <span>{rule.queryLanguage.toUpperCase()}</span>
                  {rule.techniques.length > 0 && <span>{rule.techniques.join(', ')}</span>}
                </div>
              </div>
              <span className="text-xs font-medium text-[var(--brand-primary)] shrink-0">Inspect →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RepoSettingsTab({
  repo,
  onDeleted,
  onRenamed,
}: {
  repo: RepositoryDto;
  onDeleted: () => void;
  onRenamed: (fullName: string) => void;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(repo.name);
  const [description, setDescription] = useState(repo.description ?? '');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>(repo.visibility);
  const [defaultBranch, setDefaultBranch] = useState(repo.defaultBranch);

  const [pattern, setPattern] = useState(repo.defaultBranch);
  const [requiredApprovals, setRequiredApprovals] = useState(1);
  const [allowDirectPush, setAllowDirectPush] = useState(false);

  const { data: protections } = useQuery({
    queryKey: ['branch-protections', repo.tenantId, repo.id],
    queryFn: () => api.listBranchProtections(repo.tenantId, repo.id),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateRepository(repo.tenantId, repo.id, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        defaultBranch: defaultBranch.trim(),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['repo-by-path'] });
      if (updated.fullName !== repo.fullName) {
        onRenamed(updated.fullName);
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      repo.status === 'ARCHIVED'
        ? api.unarchiveRepository(repo.tenantId, repo.id)
        : api.archiveRepository(repo.tenantId, repo.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repo-by-path', repo.owner, repo.name] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRepository(repo.tenantId, repo.id),
    onSuccess: onDeleted,
  });

  const putProtectionMutation = useMutation({
    mutationFn: () =>
      api.putBranchProtection(repo.tenantId, repo.id, {
        pattern: pattern.trim(),
        requiredApprovals,
        allowDirectPush,
        blockOnRejectedReviews: true,
        dismissStaleApprovals: true,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branch-protections', repo.tenantId, repo.id] }),
  });

  const deleteProtectionMutation = useMutation({
    mutationFn: (pat: string) => api.deleteBranchProtection(repo.tenantId, repo.id, pat),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branch-protections', repo.tenantId, repo.id] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {(updateMutation.error || putProtectionMutation.error || deleteMutation.error) && (
        <ErrorBanner
          error={updateMutation.error || putProtectionMutation.error || deleteMutation.error}
          tenantSlug={repo.owner}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4"
      >
        <h3 className="font-display text-base font-semibold">General Repository Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Repository name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Default branch</label>
            <input
              type="text"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'PUBLIC')}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="PRIVATE">PRIVATE</option>
            <option value="PUBLIC">PUBLIC</option>
          </select>
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={updateMutation.isPending}>
          Save settings
        </Button>
      </form>

      {/* Branch Protections */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4 text-[var(--brand-primary)]" />
          <span>Branch Protection Rules</span>
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            putProtectionMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Branch pattern</label>
            <input
              type="text"
              required
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Required approvals</label>
            <input
              type="number"
              min={0}
              max={10}
              value={requiredApprovals}
              onChange={(e) => setRequiredApprovals(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowDirectPush}
              onChange={(e) => setAllowDirectPush(e.target.checked)}
            />
            <span>Allow direct push</span>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Add / Update rule
          </Button>
        </form>

        <div className="divide-y divide-[var(--border-muted)] rounded border border-[var(--border-default)]">
          {(protections ?? []).length === 0 ? (
            <div className="p-3 text-xs text-[var(--fg-muted)]">No branch protection rules configured.</div>
          ) : (
            (protections ?? []).map((bp) => (
              <div key={bp.pattern} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-semibold">{bp.pattern}</span>
                  <span className="text-[var(--fg-muted)] ml-2">
                    {bp.requiredApprovals} approvals · direct push {bp.allowDirectPush ? 'allowed' : 'blocked'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteProtectionMutation.mutate(bp.pattern)}
                  className="text-[var(--danger)] hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-md border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[var(--bg-surface)] p-5 space-y-3">
        <h3 className="font-display text-base font-semibold text-[var(--danger)]">Danger Zone</h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-[var(--border-muted)]">
          <div className="text-xs">
            <div className="font-semibold text-[var(--fg-default)]">
              {repo.status === 'ARCHIVED' ? 'Unarchive repository' : 'Archive this repository'}
            </div>
            <div className="text-[var(--fg-muted)]">Mark repository read-only without deleting history.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => archiveMutation.mutate()}>
            <Archive className="w-3.5 h-3.5" />
            <span>{repo.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}</span>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="text-xs">
            <div className="font-semibold text-[var(--fg-default)]">Delete this repository</div>
            <div className="text-[var(--fg-muted)]">Permanently removes Git history, rules, PRs, and issues.</div>
          </div>
          <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate()}>
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete repository</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ForkModal({
  repo,
  onClose,
  onForked,
}: {
  repo: RepositoryDto;
  onClose: () => void;
  onForked: (forked: RepositoryDto) => void;
}) {
  const { api } = useAuth();
  const { data: tenantsPage } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants({ limit: 50 }),
  });
  const tenants = tenantsPage?.items ?? [];
  const [targetTenantId, setTargetTenantId] = useState(repo.tenantId);

  const { data: orgsPage } = useQuery({
    queryKey: ['organizations', targetTenantId],
    queryFn: () => api.listOrganizations(targetTenantId, { limit: 20 }),
    enabled: Boolean(targetTenantId),
  });
  const targetOrgId = orgsPage?.items[0]?.id ?? '';
  const [forkName, setForkName] = useState(`${repo.name}-fork`);

  const mutation = useMutation({
    mutationFn: () =>
      api.forkRepository(repo.tenantId, repo.id, {
        tenantId: targetTenantId,
        organizationId: targetOrgId,
        name: forkName.trim() || undefined,
      }),
    onSuccess: onForked,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <h3 className="font-display text-base font-semibold">Fork {repo.fullName}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--fg-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4"
        >
          {mutation.error && <ErrorBanner error={mutation.error} tenantSlug={repo.owner} />}
          <div>
            <label className="block text-xs font-medium mb-1">Destination workspace</label>
            <select
              value={targetTenantId}
              onChange={(e) => setTargetTenantId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Repository name</label>
            <input
              type="text"
              required
              value={forkName}
              onChange={(e) => setForkName(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending || !targetOrgId}>
              Create fork
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
