import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Cable,
  KeyRound,
  Plug,
  Plus,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { ConnectorDto, IntegrationDto, IntegrationEnvironment, ExecutionMode } from '../api/types';
import { StatusBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { OneTimeSecretModal } from '../components/ui/OneTimeSecretModal';
import { SchemaConfigForm } from '../components/ui/SchemaConfigForm';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatRelativeTime } from '../utils/rule-helpers';
import { buildDefaultConfig, validateSchemaConfig } from '../utils/schema-form';

export function IntegrationsView({
  tenantId,
  tenantSlug,
  orgId,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [credTarget, setCredTarget] = useState<IntegrationDto | null>(null);
  const [eventsTargetId, setEventsTargetId] = useState<string | null>(null);

  const { data: providersResp } = useQuery({
    queryKey: ['integration-providers'],
    queryFn: () => api.listProviders(),
  });

  const { data: integrationsPage, isLoading, error } = useQuery({
    queryKey: ['integrations', tenantId, orgId],
    queryFn: () => api.listIntegrations(tenantId, orgId, { limit: 50 }),
  });

  const { data: connectorsPage } = useQuery({
    queryKey: ['connectors', tenantId, orgId],
    queryFn: () => api.listConnectors(tenantId, orgId, { limit: 50 }),
  });

  const { data: eventsPage } = useQuery({
    queryKey: ['integration-events', tenantId, orgId, eventsTargetId],
    queryFn: () => api.listIntegrationEvents(tenantId, orgId, eventsTargetId!, { limit: 25 }),
    enabled: Boolean(eventsTargetId),
  });

  const healthCheckMutation = useMutation({
    mutationFn: (id: string) => api.healthCheckIntegration(tenantId, orgId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', tenantId, orgId] });
      if (eventsTargetId) {
        queryClient.invalidateQueries({ queryKey: ['integration-events', tenantId, orgId, eventsTargetId] });
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (item: IntegrationDto) =>
      api.updateIntegration(tenantId, orgId, item.id, {
        version: item.version,
        status: item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', tenantId, orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteIntegration(tenantId, orgId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', tenantId, orgId] });
      if (eventsTargetId) setEventsTargetId(null);
    },
  });

  const providers = providersResp?.items ?? [];
  const integrations = integrationsPage?.items ?? [];
  const connectors = connectorsPage?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">SIEM &amp; XDR Integrations</h2>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">
            Configure target environments, dynamic provider settings, write-only credentials, and connectivity checks.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add integration</span>
        </Button>
      </div>

      {(error || healthCheckMutation.error || toggleStatusMutation.error || deleteMutation.error) && (
        <ErrorBanner
          error={error || healthCheckMutation.error || toggleStatusMutation.error || deleteMutation.error}
          tenantSlug={tenantSlug}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : integrations.length === 0 ? (
        <Blankslate
          icon={<Plug className="w-8 h-8" />}
          title="No SIEM integrations configured"
          description="Connect Palo Alto Cortex XSIAM, Splunk Cloud, or Microsoft Sentinel to deploy approved rules."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              Add integration
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {integrations.map((item) => {
            const provider = providers.find((p) => p.key === item.provider);
            const showEvents = eventsTargetId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden"
              >
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--fg-default)]">{item.name}</span>
                      <StatusBadge status={item.status} />
                      <StatusBadge status={String(item.health)} />
                      <span className="px-1.5 py-0.5 text-[11px] font-mono rounded border border-[var(--border-default)] text-[var(--fg-muted)]">
                        {item.environment}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--fg-muted)] font-mono flex flex-wrap gap-x-4 gap-y-1">
                      <span>Provider: {provider?.name ?? item.provider}</span>
                      <span>Mode: {item.executionMode}</span>
                      <span>
                        Credential:{' '}
                        {item.credential
                          ? `${item.credential.kind} (rotated ${formatRelativeTime(item.credential.rotatedAt)})`
                          : 'Not configured'}
                      </span>
                      {item.healthCheckedAt && <span>Checked {formatRelativeTime(item.healthCheckedAt)}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={healthCheckMutation.isPending}
                      onClick={() => healthCheckMutation.mutate(item.id)}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Health check</span>
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setCredTarget(item)}>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{item.credential ? 'Rotate credential' : 'Set credential'}</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEventsTargetId(showEvents ? null : item.id)}
                    >
                      {showEvents ? 'Hide events' : 'Events'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatusMutation.mutate(item)}
                    >
                      {item.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-[var(--danger)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {showEvents && (
                  <div className="border-t border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4">
                    <h4 className="text-xs font-semibold text-[var(--fg-default)] mb-2">Integration Event Timeline</h4>
                    <div className="space-y-1.5 text-xs font-mono">
                      {(eventsPage?.items ?? []).length === 0 ? (
                        <div className="text-[var(--fg-muted)]">No events recorded.</div>
                      ) : (
                        (eventsPage?.items ?? []).map((ev) => (
                          <div key={ev.id} className="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-muted)] last:border-b-0">
                            <span className="text-[var(--fg-default)]">{ev.type}</span>
                            <span className="text-[var(--fg-muted)]">{formatRelativeTime(ev.createdAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateIntegrationModal
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          orgId={orgId}
          providers={providers}
          connectors={connectors}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['integrations', tenantId, orgId] });
            setCreateOpen(false);
          }}
        />
      )}

      {credTarget && (
        <CredentialModal
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          orgId={orgId}
          integration={credTarget}
          provider={providers.find((p) => p.key === credTarget.provider)}
          onClose={() => setCredTarget(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['integrations', tenantId, orgId] });
            setCredTarget(null);
          }}
        />
      )}
    </div>
  );
}

function CreateIntegrationModal({
  tenantId,
  tenantSlug,
  orgId,
  providers,
  connectors,
  onClose,
  onCreated,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  providers: Array<{
    key: string;
    name: string;
    executionModes: ExecutionMode[];
    configSchema: any;
  }>;
  connectors: ConnectorDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { api } = useAuth();
  const [name, setName] = useState('');
  const [providerKey, setProviderKey] = useState(providers[0]?.key ?? '');
  const [environment, setEnvironment] = useState<IntegrationEnvironment>('PRODUCTION');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('DIRECT');
  const [connectorId, setConnectorId] = useState(connectors[0]?.id ?? '');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});

  const activeProvider = providers.find((p) => p.key === providerKey) ?? providers[0];

  useEffect(() => {
    if (activeProvider) {
      setConfigValues(buildDefaultConfig(activeProvider.configSchema));
      setConfigErrors({});
      if (!activeProvider.executionModes.includes(executionMode)) {
        setExecutionMode(activeProvider.executionModes[0] ?? 'DIRECT');
      }
    }
  }, [activeProvider?.key]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createIntegration(tenantId, orgId, {
        name: name.trim(),
        provider: providerKey,
        environment,
        executionMode,
        connectorId: executionMode === 'CONNECTOR' ? connectorId || undefined : undefined,
        config: configValues,
      }),
    onSuccess: onCreated,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateSchemaConfig(activeProvider?.configSchema, configValues);
    setConfigErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">Add SIEM Integration</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--fg-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {mutation.error && <ErrorBanner error={mutation.error} tenantSlug={tenantSlug} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Integration name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cortex XSIAM Prod"
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Provider</label>
              <select
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                {providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as IntegrationEnvironment)}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="STAGING">STAGING</option>
                <option value="DEVELOPMENT">DEVELOPMENT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Execution mode</label>
              <select
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                {(activeProvider?.executionModes ?? ['DIRECT', 'CONNECTOR']).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {executionMode === 'CONNECTOR' && (
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Connector</label>
              <select
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                {connectors.length === 0 ? (
                  <option value="">No connectors available</option>
                ) : (
                  connectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.health})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="border-t border-[var(--border-muted)] pt-3">
            <h4 className="text-xs font-semibold text-[var(--fg-default)] mb-2">Provider Configuration</h4>
            <SchemaConfigForm
              schema={activeProvider?.configSchema}
              values={configValues}
              errors={configErrors}
              onChange={(key, val) => setConfigValues((prev) => ({ ...prev, [key]: val }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? 'Creating…' : 'Create integration'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialModal({
  tenantId,
  tenantSlug,
  orgId,
  integration,
  provider,
  onClose,
  onSaved,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  integration: IntegrationDto;
  provider?: { credentialKinds: Array<{ kind: string; description: string }> };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useAuth();
  const kinds = provider?.credentialKinds ?? [{ kind: 'bearer_token', description: 'API Bearer token' }];
  const [kind, setKind] = useState(integration.credential?.kind ?? kinds[0].kind);
  const [secret, setSecret] = useState('');

  const saveMutation = useMutation({
    mutationFn: () => api.setIntegrationCredential(tenantId, orgId, integration.id, { kind, secret }),
    onSuccess: onSaved,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteIntegrationCredential(tenantId, orgId, integration.id),
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">
            Set Credential · {integration.name}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--fg-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="p-5 space-y-4"
        >
          {(saveMutation.error || deleteMutation.error) && (
            <ErrorBanner error={saveMutation.error || deleteMutation.error} tenantSlug={tenantSlug} />
          )}

          <p className="text-xs text-[var(--fg-muted)]">
            Credentials are write-only and encrypted at rest. Existing secrets are never returned by the API.
          </p>

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Credential kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.kind} — {k.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Secret / Token</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter new credential secret"
              className="w-full px-3 py-2 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {integration.credential ? (
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Delete credential
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saveMutation.isPending || !secret.trim()}>
                Save credential
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ConnectorsView({
  tenantId,
  tenantSlug,
  orgId,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [enrollmentSecret, setEnrollmentSecret] = useState<{
    token: string;
    gatewayUrl: string;
    connectorName: string;
  } | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);

  const { data: connectorsPage, isLoading, error } = useQuery({
    queryKey: ['connectors', tenantId, orgId],
    queryFn: () => api.listConnectors(tenantId, orgId, { limit: 50 }),
  });

  const { data: connectorDetail } = useQuery({
    queryKey: ['connector-detail', tenantId, orgId, selectedConnectorId],
    queryFn: () => api.getConnector(tenantId, orgId, selectedConnectorId!),
    enabled: Boolean(selectedConnectorId),
  });

  const { data: jobsPage } = useQuery({
    queryKey: ['connector-jobs', tenantId, orgId, selectedConnectorId],
    queryFn: () => api.listConnectorJobs(tenantId, orgId, selectedConnectorId!, { limit: 20 }),
    enabled: Boolean(selectedConnectorId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createConnector(tenantId, orgId, {
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setName('');
      setDescription('');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId, orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConnector(tenantId, orgId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors', tenantId, orgId] });
      setSelectedConnectorId(null);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (c: ConnectorDto) => {
      const res = await api.createEnrollmentToken(tenantId, orgId, c.id, 30);
      return { ...res, connectorName: c.name };
    },
    onSuccess: (res) => {
      setEnrollmentSecret({
        token: res.token,
        gatewayUrl: res.gatewayUrl,
        connectorName: res.connectorName,
      });
    },
  });

  const revokeInstanceMutation = useMutation({
    mutationFn: ({ connectorId, instanceId }: { connectorId: string; instanceId: string }) =>
      api.revokeConnectorInstance(tenantId, orgId, connectorId, instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connector-detail', tenantId, orgId, selectedConnectorId] });
    },
  });

  const connectors = connectorsPage?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">Private-Network Connectors</h2>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">
            Run outbound-only connector agents inside private networks to bridge deployments to on-prem SIEMs.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen((v) => !v)}>
          <Plus className="w-3.5 h-3.5" />
          <span>New connector</span>
        </Button>
      </div>

      {(error || createMutation.error || enrollMutation.error || deleteMutation.error) && (
        <ErrorBanner
          error={error || createMutation.error || enrollMutation.error || deleteMutation.error}
          tenantSlug={tenantSlug}
        />
      )}

      {createOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Connector name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="corp-dc-connector"
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="US-East private SIEM enclave"
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={createMutation.isPending || !name.trim()}>
              Create connector
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : connectors.length === 0 ? (
        <Blankslate
          icon={<Cable className="w-8 h-8" />}
          title="No connectors registered"
          description="Create a connector and generate a one-time enrollment token to pair an on-prem agent."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              New connector
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {connectors.map((c) => {
            const expanded = selectedConnectorId === c.id;
            return (
              <div key={c.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--fg-default)]">{c.name}</span>
                      <StatusBadge status={c.health} />
                      <StatusBadge status={c.status} />
                    </div>
                    {c.description && <p className="text-xs text-[var(--fg-muted)]">{c.description}</p>}
                    <div className="text-xs font-mono text-[var(--fg-muted)]">
                      Last seen: {formatRelativeTime(c.lastSeenAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={enrollMutation.isPending}
                      onClick={() => enrollMutation.mutate(c)}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Generate enrollment token</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedConnectorId(expanded ? null : c.id)}
                    >
                      {expanded ? 'Hide details' : 'Instances & jobs'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="text-[var(--danger)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {expanded && connectorDetail && (
                  <div className="border-t border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[var(--fg-default)] flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5" />
                        <span>Registered Instances</span>
                      </h4>
                      {(connectorDetail.instances ?? []).length === 0 ? (
                        <div className="text-xs text-[var(--fg-muted)]">No active instances paired yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {(connectorDetail.instances ?? []).map((inst) => (
                            <div
                              key={inst.id}
                              className="p-2.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-mono font-medium">{inst.hostname ?? inst.id}</div>
                                <div className="text-[var(--fg-muted)]">
                                  {inst.status} · seen {formatRelativeTime(inst.lastSeenAt)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  revokeInstanceMutation.mutate({ connectorId: c.id, instanceId: inst.id })
                                }
                                className="text-[var(--danger)]"
                              >
                                Revoke
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[var(--fg-default)]">Recent Connector Jobs</h4>
                      {(jobsPage?.items ?? []).length === 0 ? (
                        <div className="text-xs text-[var(--fg-muted)]">No jobs dispatched.</div>
                      ) : (
                        <div className="space-y-1.5 text-xs font-mono">
                          {(jobsPage?.items ?? []).map((job) => (
                            <div
                              key={job.id}
                              className="p-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-between"
                            >
                              <span>{job.type}</span>
                              <StatusBadge status={job.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {enrollmentSecret && (
        <OneTimeSecretModal
          title={`Connector Enrollment Token · ${enrollmentSecret.connectorName}`}
          secretLabel="Enrollment Token"
          secretValue={enrollmentSecret.token}
          extraInfo={
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-medium text-[var(--fg-muted)]">Gateway URL: </span>
                <code className="font-mono text-[var(--fg-default)]">{enrollmentSecret.gatewayUrl}</code>
              </div>
              <div>
                <div className="font-medium text-[var(--fg-muted)] mb-1">Agent Registration Command:</div>
                <pre className="p-2.5 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] font-mono text-[11px] overflow-x-auto">{`docker run -d --name sep-connector \\
  -e SEP_GATEWAY_URL="${enrollmentSecret.gatewayUrl}" \\
  -e SEP_ENROLLMENT_TOKEN="${enrollmentSecret.token}" \\
  ghcr.io/sep/connector-agent:latest`}</pre>
              </div>
            </div>
          }
          onClose={() => setEnrollmentSecret(null)}
        />
      )}
    </div>
  );
}
