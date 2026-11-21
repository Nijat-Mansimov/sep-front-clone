import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Server, Terminal } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';

export function PlatformConsolePage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [lookupSlug, setLookupSlug] = useState('ex-181748');
  const [searchedSlug, setSearchedSlug] = useState('ex-181748');
  const [overrideFeature, setOverrideFeature] = useState('repositories.max');
  const [overrideVal, setOverrideVal] = useState('50');
  const [overrideReason, setOverrideReason] = useState('Enterprise pilot expansion');
  const [assignInstance, setAssignInstance] = useState('primary');

  const [instName, setInstName] = useState('');
  const [instUrl, setInstUrl] = useState('');
  const [instAdmin, setInstAdmin] = useState('sep-admin');

  const { data: plansResp, isLoading, error } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => api.listPlatformPlans(),
    retry: false,
  });

  const { data: gitInstancesResp } = useQuery({
    queryKey: ['platform-git-instances'],
    queryFn: () => api.listPlatformGitInstances(),
    enabled: Boolean(plansResp),
  });

  const { data: tenantData, error: lookupError } = useQuery({
    queryKey: ['platform-tenant-lookup', searchedSlug],
    queryFn: () => api.lookupPlatformTenant(searchedSlug),
    enabled: Boolean(searchedSlug && plansResp),
    retry: false,
  });

  const { data: tenantSub } = useQuery({
    queryKey: ['platform-tenant-sub', tenantData?.id],
    queryFn: () => api.getPlatformTenantSubscription(tenantData!.id),
    enabled: Boolean(tenantData?.id),
  });

  const setSubMutation = useMutation({
    mutationFn: (planKey: string) =>
      api.setPlatformTenantSubscription(tenantData!.id, { planKey, periodDays: 30, status: 'ACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-sub', tenantData?.id] }),
  });

  const overrideMutation = useMutation({
    mutationFn: () =>
      api.setPlatformOverride(tenantData!.id, overrideFeature.trim(), {
        value: Number(overrideVal),
        reason: overrideReason.trim(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-sub', tenantData?.id] }),
  });

  const assignGitMutation = useMutation({
    mutationFn: () => api.assignPlatformTenantGitInstance(tenantData!.id, assignInstance),
  });

  const registerGitMutation = useMutation({
    mutationFn: () =>
      api.registerPlatformGitInstance({
        name: instName.trim(),
        baseUrl: instUrl.trim(),
        adminUsername: instAdmin.trim(),
      }),
    onSuccess: () => {
      setInstName('');
      setInstUrl('');
      queryClient.invalidateQueries({ queryKey: ['platform-git-instances'] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <ErrorBanner error={error} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div className="pb-4 border-b border-[var(--border-muted)] flex items-center gap-3">
        <Terminal className="w-6 h-6 text-[var(--brand-primary)]" />
        <div>
          <h1 className="font-display text-2xl font-bold">Platform Operator Console</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            Manage plan catalogues, tenant subscriptions, entitlement overrides, and Forgejo Git cluster assignments.
          </p>
        </div>
      </div>

      {/* Tenant Lookup & Overrides */}
      <section className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
        <h2 className="font-display text-base font-semibold">Tenant Lookup &amp; Overrides</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchedSlug(lookupSlug.trim());
          }}
          className="flex gap-2 max-w-md"
        >
          <input
            type="text"
            value={lookupSlug}
            onChange={(e) => setLookupSlug(e.target.value)}
            placeholder="Tenant slug (e.g. ex-181748)"
            className="flex-1 px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <Button type="submit" variant="primary" size="sm">
            Lookup tenant
          </Button>
        </form>

        {lookupError && <ErrorBanner error={lookupError} />}

        {tenantData && (
          <div className="space-y-4 pt-2 border-t border-[var(--border-muted)]">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-sm">{tenantData.name}</span>{' '}
                <code className="font-mono text-[var(--fg-muted)]">({tenantData.slug} · {tenantData.id})</code>
              </div>
              {tenantSub && (
                <div className="flex items-center gap-2">
                  <span>Plan: <strong>{tenantSub.effectivePlan.key}</strong></span>
                  {(['community', 'team', 'enterprise'] as const).map((pk) => (
                    <Button key={pk} variant="secondary" size="sm" onClick={() => setSubMutation.mutate(pk)}>
                      Set {pk}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  overrideMutation.mutate();
                }}
                className="p-3.5 rounded border border-[var(--border-default)] bg-[var(--bg-canvas)] space-y-2.5 text-xs"
              >
                <div className="font-semibold">Set Entitlement Override</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={overrideFeature}
                    onChange={(e) => setOverrideFeature(e.target.value)}
                    placeholder="Feature key"
                    className="px-2.5 py-1.5 font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  />
                  <input
                    type="number"
                    value={overrideVal}
                    onChange={(e) => setOverrideVal(e.target.value)}
                    placeholder="Value"
                    className="px-2.5 py-1.5 font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  />
                </div>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Contract reference / reason"
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Apply override
                </Button>
              </form>

              <div className="p-3.5 rounded border border-[var(--border-default)] bg-[var(--bg-canvas)] space-y-2.5 text-xs">
                <div className="font-semibold">Assign Git Instance</div>
                <div className="flex gap-2">
                  <select
                    value={assignInstance}
                    onChange={(e) => setAssignInstance(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  >
                    {(gitInstancesResp?.items ?? []).map((gi) => (
                      <option key={gi.name} value={gi.name}>
                        {gi.name} ({gi.baseUrl})
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" size="sm" onClick={() => assignGitMutation.mutate()}>
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Plans catalogue */}
      <section className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">Platform Plans Catalogue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {(plansResp?.items ?? []).map((p) => (
            <div key={p.key} className="rounded border border-[var(--border-default)] bg-[var(--bg-canvas)] p-3.5 space-y-2">
              <div className="font-semibold text-sm">{p.name} ({p.key})</div>
              <div className="font-mono text-[var(--fg-muted)] space-y-1">
                {Object.entries(p.entitlements).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Forgejo Instances Registry */}
      <section className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
        <h2 className="font-display text-base font-semibold flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--brand-primary)]" />
          <span>Forgejo Git Instances</span>
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            registerGitMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <input
            type="text"
            required
            value={instName}
            onChange={(e) => setInstName(e.target.value)}
            placeholder="Instance name (eu-west-1)"
            className="px-3 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <input
            type="url"
            required
            value={instUrl}
            onChange={(e) => setInstUrl(e.target.value)}
            placeholder="https://git-eu.sep.internal"
            className="px-3 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <input
            type="text"
            required
            value={instAdmin}
            onChange={(e) => setInstAdmin(e.target.value)}
            placeholder="Admin username"
            className="px-3 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <Button type="submit" variant="primary" size="sm">
            Register instance
          </Button>
        </form>

        <div className="divide-y divide-[var(--border-muted)] rounded border border-[var(--border-default)]">
          {(gitInstancesResp?.items ?? []).map((gi) => (
            <div key={gi.name} className="p-3 flex items-center justify-between text-xs font-mono">
              <span className="font-semibold">{gi.name}</span>
              <span className="text-[var(--fg-muted)]">{gi.baseUrl}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
