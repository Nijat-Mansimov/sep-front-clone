import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  Clock,
  Rocket,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SepApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SeverityBadge, StatusBadge, ValidationBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CodeViewer } from '../components/ui/CodeViewer';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatRelativeTime } from '../utils/rule-helpers';

export function RuleDetailPage() {
  const { api } = useAuth();
  const params = useParams<{ owner: string; repo: string; ruleId: string }>();
  const navigate = useNavigate();

  const owner = params.owner ?? '';
  const repoName = params.repo ?? '';
  const ruleId = params.ruleId ?? '';

  const [deployOpen, setDeployOpen] = useState(false);

  const { data: repo } = useQuery({
    queryKey: ['repo-by-path', owner, repoName],
    queryFn: () => api.getRepositoryByPath(owner, repoName),
    enabled: Boolean(owner && repoName),
  });

  const { data: rule, isLoading, error } = useQuery({
    queryKey: ['rule-detail', repo?.tenantId, repo?.id, ruleId],
    queryFn: () => api.getRule(repo!.tenantId, repo!.id, ruleId),
    enabled: Boolean(repo && ruleId),
  });

  const { data: versions } = useQuery({
    queryKey: ['rule-versions', repo?.tenantId, repo?.id, ruleId],
    queryFn: () => api.getRuleVersions(repo!.tenantId, repo!.id, ruleId),
    enabled: Boolean(repo && ruleId),
  });

  if (isLoading || !repo) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <ErrorBanner error={error} tenantSlug={owner} />
      </div>
    );
  }

  if (!rule) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="text-xs text-[var(--fg-muted)]">
        <Link to={`/${repo.fullName}/rules`} className="text-[var(--brand-primary)] hover:underline">
          ← Back to {repo.fullName} rules
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-[var(--border-muted)]">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-[var(--fg-default)]">{rule.name}</h1>
            <SeverityBadge severity={rule.severity} />
            <ValidationBadge status={rule.validationStatus} />
            <StatusBadge status={rule.deploymentStatus} />
          </div>
          {rule.description && <p className="text-sm text-[var(--fg-muted)] max-w-3xl">{rule.description}</p>}
          <div className="text-xs font-mono text-[var(--fg-muted)] flex flex-wrap gap-x-4 gap-y-1">
            <span>UID: {rule.ruleUid}</span>
            <span>Path: {rule.path}</span>
            <span>Format: {rule.format}</span>
            <span>Language: {rule.queryLanguage.toUpperCase()}</span>
            {rule.author && <span>Author: {rule.author}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to={`/${owner}/conversions?repositoryId=${encodeURIComponent(repo.id)}&ruleId=${encodeURIComponent(rule.id)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--fg-default)] whitespace-nowrap"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Convert this rule</span>
          </Link>
          <Button variant="primary" size="sm" onClick={() => setDeployOpen(true)}>
            <Rocket className="w-3.5 h-3.5" />
            <span>Deploy rule</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CodeViewer
            code={rule.queryText}
            language={rule.queryLanguage}
            title={`Detection Query (${rule.dialect ?? rule.queryLanguage})`}
          />

          {/* Validation Issues */}
          {rule.validationIssues.length > 0 && (
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold">
                Validation Diagnostics ({rule.validationIssues.length})
              </div>
              <div className="divide-y divide-[var(--border-muted)]">
                {rule.validationIssues.map((issue, i) => (
                  <div key={i} className="p-3.5 flex items-start gap-2.5 text-xs">
                    {issue.severity === 'error' ? (
                      <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-mono font-semibold">{issue.code}: </span>
                      <span>{issue.message}</span>
                      {issue.field && (
                        <div className="text-[var(--fg-muted)] font-mono mt-0.5">Field: {issue.field}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Version History */}
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
              <span>Indexed Versions ({(versions ?? []).length})</span>
            </div>
            <div className="divide-y divide-[var(--border-muted)]">
              {(versions ?? []).map((v) => (
                <div key={v.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 font-mono">
                    <span className="font-semibold text-[var(--fg-default)]">{v.commitSha.slice(0, 7)}</span>
                    <span className="text-[var(--fg-muted)]">{v.path}</span>
                    <ValidationBadge status={v.validationStatus} />
                  </div>
                  <span className="text-[var(--fg-muted)]">{formatRelativeTime(v.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Metadata Sidebar */}
        <div className="space-y-4">
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-[var(--fg-default)]">MITRE ATT&amp;CK</h3>
            <div>
              <div className="text-[var(--fg-muted)] mb-1">Tactics</div>
              <div className="flex flex-wrap gap-1.5">
                {rule.tactics.length === 0 ? (
                  <span className="text-[var(--fg-muted)]">None tagged</span>
                ) : (
                  rule.tactics.map((t) => (
                    <Link
                      key={t}
                      to={`/${owner}/rules?tactic=${encodeURIComponent(t)}`}
                      className="px-2 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-default)] hover:border-[var(--brand-primary)]"
                    >
                      {t}
                    </Link>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="text-[var(--fg-muted)] mb-1">Techniques</div>
              <div className="flex flex-wrap gap-1.5 font-mono">
                {rule.techniques.length === 0 ? (
                  <span className="text-[var(--fg-muted)] font-sans">None tagged</span>
                ) : (
                  rule.techniques.map((t) => (
                    <Link
                      key={t}
                      to={`/${owner}/rules?technique=${encodeURIComponent(t)}`}
                      className="px-2 py-0.5 rounded border border-[var(--border-default)] bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)]"
                    >
                      {t}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-[var(--fg-default)]">Telemetry &amp; Context</h3>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Status</span>
              <span className="font-mono">{rule.status ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Category</span>
              <span className="font-mono">{rule.category ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Platforms</span>
              <span className="font-mono">{rule.platforms.join(', ') || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Data sources</span>
              <span className="font-mono">{rule.dataSources.join(', ') || '—'}</span>
            </div>
            {rule.falsePositives.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-muted)]">
                <div className="text-[var(--fg-muted)] mb-1">False Positives</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {rule.falsePositives.map((fp, idx) => (
                    <li key={idx}>{fp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {deployOpen && (
        <DeployRuleModal
          tenantId={repo.tenantId}
          tenantSlug={owner}
          orgId={repo.organizationId}
          repoId={repo.id}
          ruleId={rule.id}
          ruleName={rule.name}
          ruleDialect={rule.queryLanguage}
          onClose={() => setDeployOpen(false)}
          onDeployed={(depId) => {
            setDeployOpen(false);
            navigate(`/${owner}/deployments/${depId}`);
          }}
        />
      )}
    </div>
  );
}

function DeployRuleModal({
  tenantId,
  tenantSlug,
  orgId,
  repoId,
  ruleId,
  ruleName,
  ruleDialect,
  onClose,
  onDeployed,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  repoId: string;
  ruleId: string;
  ruleName: string;
  ruleDialect: string;
  onClose: () => void;
  onDeployed: (deploymentId: string) => void;
}) {
  const { api } = useAuth();
  const [integrationId, setIntegrationId] = useState('');

  const { data: integrationsPage } = useQuery({
    queryKey: ['integrations', tenantId, orgId],
    queryFn: () => api.listIntegrations(tenantId, orgId, { limit: 50 }),
  });

  const integrations = integrationsPage?.items ?? [];
  useEffect(() => {
    if (integrations.length > 0 && !integrationId) {
      setIntegrationId(integrations[0].id);
    }
  }, [integrations, integrationId]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createDeployment(tenantId, orgId, {
        integrationId,
        repositoryId: repoId,
        ruleId,
        action: 'DEPLOY',
      }),
    onSuccess: (dep) => onDeployed(dep.id),
  });

  const isNotDeployable =
    mutation.error instanceof SepApiError &&
    (mutation.error.status === 422 || mutation.error.code === 'RULE_NOT_DEPLOYABLE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">Deploy Rule to SIEM</h3>
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
          {mutation.error && <ErrorBanner error={mutation.error} tenantSlug={tenantSlug} />}

          {isNotDeployable && (
            <div className="rounded border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-subtle)] p-3 text-xs space-y-2">
              <div className="font-semibold text-[var(--fg-default)]">
                Dialect mismatch or non-deployable rule
              </div>
              <p className="text-[var(--fg-muted)]">
                Convert the rule to the target SIEM dialect, commit it to your repository, then deploy.
              </p>
              <Link
                to={`/${tenantSlug}/conversions?repositoryId=${encodeURIComponent(repoId)}&ruleId=${encodeURIComponent(ruleId)}`}
                className="inline-flex items-center gap-1 text-[var(--brand-primary)] font-medium underline"
              >
                Open Query Converter for this rule →
              </Link>
            </div>
          )}

          <div className="text-xs text-[var(--fg-muted)]">
            Deploying <strong className="text-[var(--fg-default)]">{ruleName}</strong> (dialect:{' '}
            <code className="font-mono">{ruleDialect}</code>)
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Target integration</label>
            <select
              value={integrationId}
              onChange={(e) => setIntegrationId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {integrations.length === 0 ? (
                <option value="">No integrations configured</option>
              ) : (
                integrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.provider} · {i.environment})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending || !integrationId}>
              {mutation.isPending ? 'Requesting…' : 'Request deployment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
