import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Rocket,
  RotateCcw,
  Settings2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { CodeViewer } from '../components/ui/CodeViewer';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';
import { canApproveDeployments, canManageWorkspaceSettings } from '../utils/rbac';
import { formatRelativeTime, isDeploymentTerminal } from '../utils/rule-helpers';

export function DeploymentsView({
  tenantId,
  tenantSlug,
  orgId,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
}) {
  const { api, me, rolesCatalog } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const { data: roleAssignmentsPage } = useQuery({
    queryKey: ['role-assignments', tenantId, me?.id],
    queryFn: () => api.listRoleAssignments(tenantId, { limit: 100 }),
    enabled: Boolean(tenantId && me),
  });

  const canManagePolicy = canManageWorkspaceSettings({
    me,
    rolesCatalog,
    tenantId,
    organizationId: orgId,
    assignments: roleAssignmentsPage?.items,
  });

  const {
    data: deploymentsPage,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['deployments', tenantId, orgId, statusFilter],
    queryFn: () =>
      api.listDeployments(tenantId, orgId, {
        limit: 30,
        status: statusFilter || undefined,
      }),
    refetchInterval: (q) => {
      const items = q.state.data?.items ?? [];
      return items.some((d) => !isDeploymentTerminal(d.status)) ? 2500 : false;
    },
  });

  const { data: integrationsPage } = useQuery({
    queryKey: ['integrations', tenantId, orgId],
    queryFn: () => api.listIntegrations(tenantId, orgId, { limit: 50 }),
  });

  const { data: reposPage } = useQuery({
    queryKey: ['repositories', tenantId, orgId],
    queryFn: () => api.listRepositories(tenantId, orgId, { limit: 50 }),
  });

  const deployments = deploymentsPage?.items ?? [];
  const integrations = integrationsPage?.items ?? [];
  const repos = reposPage?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">Deployments</h2>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">
            Track detection rollouts, peer approvals, and execution logs across SIEM and XDR integrations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter deployments by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
          >
            <option value="">All statuses</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {canManagePolicy && (
            <Button variant="secondary" size="sm" onClick={() => setPolicyOpen((v) => !v)}>
              <Settings2 className="w-3.5 h-3.5" />
              <span>Deployment policy</span>
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setRequestOpen(true)}>
            <Rocket className="w-3.5 h-3.5" />
            <span>Request deployment</span>
          </Button>
        </div>
      </div>

      {error && <ErrorBanner error={error} tenantSlug={tenantSlug} />}

      {policyOpen && (
        <DeploymentPolicyPanel
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          orgId={orgId}
          onClose={() => setPolicyOpen(false)}
        />
      )}

      {requestOpen && (
        <RequestDeploymentModal
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          orgId={orgId}
          integrations={integrations}
          repos={repos}
          onClose={() => setRequestOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['deployments', tenantId, orgId] });
            setRequestOpen(false);
          }}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : deployments.length === 0 ? (
        <Blankslate
          icon={<Rocket className="w-8 h-8" />}
          title="No deployments found"
          description="Request a rule deployment to an active integration target to start the approval and rollout workflow."
          action={
            <Button variant="primary" size="sm" onClick={() => setRequestOpen(true)}>
              Request deployment
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {deployments.map((d) => {
            const integration = integrations.find((i) => i.id === d.integrationId);
            return (
              <Link
                key={d.id}
                to={`/${tenantSlug}/deployments/${d.id}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--fg-default)]">{d.rule.name}</span>
                    <SeverityBadge severity={d.rule.severity} />
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="text-xs text-[var(--fg-muted)] font-mono flex flex-wrap gap-x-3 gap-y-1">
                    <span>{d.action}</span>
                    <span>{d.environment}</span>
                    <span>{integration?.name ?? d.integrationId.slice(0, 8)}</span>
                    <span>{d.rule.dialect.toUpperCase()}</span>
                    <span>
                      Approvals: {d.approvals.filter((a) => a.decision === 'APPROVE').length}/{d.requiredApprovals}
                    </span>
                    <span>{formatRelativeTime(d.createdAt)}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-[var(--brand-primary)] whitespace-nowrap shrink-0">
                  Inspect →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeploymentPolicyPanel({
  tenantId,
  tenantSlug,
  orgId,
  onClose,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  onClose: () => void;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: policy } = useQuery({
    queryKey: ['deployment-policy', tenantId, orgId],
    queryFn: () => api.getDeploymentPolicy(tenantId, orgId),
  });

  const [prodApprovals, setProdApprovals] = useState(1);
  const [nonProdApprovals, setNonProdApprovals] = useState(0);
  const [allowSelfNonProd, setAllowSelfNonProd] = useState(false);
  const [allowWarningRules, setAllowWarningRules] = useState(false);
  const [deploymentsEnabled, setDeploymentsEnabled] = useState(true);

  useEffect(() => {
    if (policy) {
      setProdApprovals(policy.productionApprovals);
      setNonProdApprovals(policy.nonProductionApprovals);
      setAllowSelfNonProd(policy.allowSelfApprovalNonProduction);
      setAllowWarningRules(policy.allowWarningRules);
      setDeploymentsEnabled(policy.deploymentsEnabled);
    }
  }, [policy]);

  const mutation = useMutation({
    mutationFn: () =>
      api.upsertDeploymentPolicy(tenantId, orgId, {
        version: policy?.version,
        productionApprovals: prodApprovals,
        nonProductionApprovals: nonProdApprovals,
        allowSelfApprovalNonProduction: allowSelfNonProd,
        allowWarningRules,
        deploymentsEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-policy', tenantId, orgId] });
      onClose();
    },
  });

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-[var(--fg-default)]">
          Organization Deployment Policy {policy ? `(v${policy.version})` : ''}
        </h3>
        <button type="button" onClick={onClose} aria-label="Close policy panel" className="text-[var(--fg-muted)] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {mutation.error && <ErrorBanner error={mutation.error} tenantSlug={tenantSlug} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">
            Required production approvals
          </label>
          <input
            type="number"
            min={0}
            max={10}
            value={prodApprovals}
            onChange={(e) => setProdApprovals(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">
            Required non-production approvals
          </label>
          <input
            type="number"
            min={0}
            max={10}
            value={nonProdApprovals}
            onChange={(e) => setNonProdApprovals(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
      </div>

      <div className="space-y-2 text-xs text-[var(--fg-default)]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={deploymentsEnabled} onChange={(e) => setDeploymentsEnabled(e.target.checked)} />
          <span>Deployments enabled for this organization</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={allowSelfNonProd} onChange={(e) => setAllowSelfNonProd(e.target.checked)} />
          <span>Allow self-approval for Staging / Development targets</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={allowWarningRules} onChange={(e) => setAllowWarningRules(e.target.checked)} />
          <span>Allow deploying rules with validation warnings</span>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save policy'}
        </Button>
      </div>
    </div>
  );
}

function RequestDeploymentModal({
  tenantId,
  tenantSlug,
  orgId,
  integrations,
  repos,
  onClose,
  onCreated,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  integrations: Array<{ id: string; name: string; provider: string; environment: string }>;
  repos: Array<{ id: string; fullName: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { api } = useAuth();
  const [integrationId, setIntegrationId] = useState(integrations[0]?.id ?? '');
  const [repoId, setRepoId] = useState(repos[0]?.id ?? '');
  const [ruleId, setRuleId] = useState('');
  const [action, setAction] = useState<'DEPLOY' | 'UNDEPLOY'>('DEPLOY');

  const { data: rulesPage } = useQuery({
    queryKey: ['repo-rules-for-deploy', tenantId, repoId],
    queryFn: () => api.listRepoRules(tenantId, repoId, { limit: 50 }),
    enabled: Boolean(repoId),
  });

  const rules = rulesPage?.items ?? [];

  useEffect(() => {
    if (rules.length > 0 && !rules.some((r) => r.id === ruleId)) {
      setRuleId(rules[0].id);
    }
  }, [rules, ruleId]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createDeployment(tenantId, orgId, {
        integrationId,
        repositoryId: repoId,
        ruleId,
        action,
      }),
    onSuccess: onCreated,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">Request Rule Deployment</h3>
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

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Target integration</label>
            <select
              value={integrationId}
              onChange={(e) => setIntegrationId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.provider} · {i.environment})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Repository</label>
            <select
              value={repoId}
              onChange={(e) => {
                setRepoId(e.target.value);
                setRuleId('');
              }}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Detection rule</label>
            <select
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.queryLanguage}) — {r.validationStatus}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'DEPLOY' | 'UNDEPLOY')}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <option value="DEPLOY">DEPLOY</option>
              <option value="UNDEPLOY">UNDEPLOY</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || !integrationId || !repoId || !ruleId}
            >
              {mutation.isPending ? 'Submitting…' : 'Submit deployment request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DeploymentDetailPage({
  tenantId,
  tenantSlug,
  orgId,
  deploymentId,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  deploymentId: string;
}) {
  const { api, me, rolesCatalog } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: deployment, isLoading, error } = useQuery({
    queryKey: ['deployment-detail', tenantId, orgId, deploymentId],
    queryFn: () => api.getDeployment(tenantId, orgId, deploymentId),
    refetchInterval: (q) => (isDeploymentTerminal(q.state.data?.status) ? false : 1500),
  });

  const { data: logsPage } = useQuery({
    queryKey: ['deployment-logs', tenantId, orgId, deploymentId],
    queryFn: () => api.listDeploymentLogs(tenantId, orgId, deploymentId, { limit: 50 }),
    refetchInterval: isDeploymentTerminal(deployment?.status) ? false : 1500,
  });

  const { data: roleAssignmentsPage } = useQuery({
    queryKey: ['role-assignments', tenantId, me?.id],
    queryFn: () => api.listRoleAssignments(tenantId, { limit: 100 }),
    enabled: Boolean(tenantId && me),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.approveDeployment(tenantId, orgId, deploymentId, comment.trim() || undefined),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['deployment-detail', tenantId, orgId, deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['deployment-logs', tenantId, orgId, deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectDeployment(tenantId, orgId, deploymentId, comment.trim() || undefined),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['deployment-detail', tenantId, orgId, deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['deployment-logs', tenantId, orgId, deploymentId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelDeployment(tenantId, orgId, deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-detail', tenantId, orgId, deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['deployment-logs', tenantId, orgId, deploymentId] });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => api.rollbackDeployment(tenantId, orgId, deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  if (error) return <ErrorBanner error={error} tenantSlug={tenantSlug} />;
  if (!deployment) return null;

  const canApprove = canApproveDeployments({
    me,
    rolesCatalog,
    tenantId,
    organizationId: orgId,
    assignments: roleAssignmentsPage?.items,
  });
  const logs = logsPage?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-[var(--fg-muted)]">
            <Link to={`/${tenantSlug}/deployments`} className="text-[var(--brand-primary)] hover:underline">
              ← Back to deployments
            </Link>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display text-xl font-bold text-[var(--fg-default)]">
              {deployment.rule.name}
            </h2>
            <SeverityBadge severity={deployment.rule.severity} />
            <StatusBadge status={deployment.status} />
          </div>
          <div className="text-xs font-mono text-[var(--fg-muted)]">
            {deployment.action} · {deployment.environment} · {deployment.executionMode} · {deployment.rule.dialect.toUpperCase()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(deployment.status === 'PENDING_APPROVAL' || deployment.status === 'QUEUED') && (
            <Button
              variant="secondary"
              size="sm"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Cancel deployment
            </Button>
          )}
          {deployment.status === 'SUCCEEDED' && (
            <Button
              variant="secondary"
              size="sm"
              disabled={rollbackMutation.isPending}
              onClick={() => rollbackMutation.mutate()}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rollback</span>
            </Button>
          )}
        </div>
      </div>

      {(approveMutation.error || rejectMutation.error || cancelMutation.error || rollbackMutation.error) && (
        <ErrorBanner
          error={approveMutation.error || rejectMutation.error || cancelMutation.error || rollbackMutation.error}
          tenantSlug={tenantSlug}
        />
      )}

      {/* Status timeline strip */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-[var(--fg-muted)]">Requested</div>
          <div className="font-medium text-[var(--fg-default)] mt-0.5">{formatRelativeTime(deployment.createdAt)}</div>
        </div>
        <div>
          <div className="text-[var(--fg-muted)]">Approved</div>
          <div className="font-medium text-[var(--fg-default)] mt-0.5">{formatRelativeTime(deployment.approvedAt)}</div>
        </div>
        <div>
          <div className="text-[var(--fg-muted)]">Started</div>
          <div className="font-medium text-[var(--fg-default)] mt-0.5">{formatRelativeTime(deployment.startedAt)}</div>
        </div>
        <div>
          <div className="text-[var(--fg-muted)]">Completed</div>
          <div className="font-medium text-[var(--fg-default)] mt-0.5">{formatRelativeTime(deployment.completedAt)}</div>
        </div>
      </div>

      {/* Approval Panel */}
      {deployment.status === 'PENDING_APPROVAL' && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--brand-primary)]" />
              <h3 className="font-display text-sm font-semibold text-[var(--fg-default)]">
                Approval Gate ({deployment.approvals.filter((a) => a.decision === 'APPROVE').length} / {deployment.requiredApprovals} required)
              </h3>
            </div>
            {!deployment.allowSelfApproval && deployment.requestedByUserId === me?.id && (
              <span className="text-xs text-[var(--warning)] font-medium">
                Self-approval disabled by policy (switch to peer approver)
              </span>
            )}
          </div>

          <div className="space-y-3">
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional review comment (e.g., Validated query efficiency and false-positive rate)"
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={approveMutation.isPending || !canApprove}
                onClick={() => approveMutation.mutate()}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{approveMutation.isPending ? 'Approving…' : 'Approve & Queue'}</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={rejectMutation.isPending || !canApprove}
                onClick={() => rejectMutation.mutate()}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Frozen Query & Rule Metadata */}
      <CodeViewer
        code={deployment.rule.query}
        language={deployment.rule.dialect}
        title={`Rule Snapshot · commit ${deployment.rule.commitSha.slice(0, 7)}`}
      />

      {/* Approvals history */}
      {deployment.approvals.length > 0 && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--fg-default)]">
            Approval Decisions
          </div>
          <div className="divide-y divide-[var(--border-muted)]">
            {deployment.approvals.map((a, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-semibold text-[var(--fg-default)]">
                    {a.username ?? a.userId}
                  </span>{' '}
                  <StatusBadge status={a.decision} />
                  {a.comment && <p className="text-[var(--fg-muted)] mt-1">{a.comment}</p>}
                </div>
                <span className="text-[var(--fg-muted)]">{formatRelativeTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Logs */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--fg-default)] flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
          <span>Execution Logs</span>
        </div>
        <div className="divide-y divide-[var(--border-muted)] font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-[var(--fg-muted)]">No execution log entries yet.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-3 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--brand-primary)] font-semibold">{log.event}</span>
                    <span className="text-[var(--fg-default)]">{log.message}</span>
                  </div>
                </div>
                <span className="text-[var(--fg-muted)] shrink-0">{formatRelativeTime(log.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
