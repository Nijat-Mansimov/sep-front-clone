import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  CreditCard,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SepApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { OneTimeSecretModal } from '../components/ui/OneTimeSecretModal';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatBytes, formatRelativeTime } from '../utils/rule-helpers';

const SETTINGS_NAV = [
  { id: 'general', label: 'General', icon: Shield },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'roles', label: 'Roles & Assignments', icon: Lock },
  { id: 'service-accounts', label: 'Service Accounts', icon: Bot },
  { id: 'security', label: 'Security & SAML SSO', icon: KeyRound },
  { id: 'scim', label: 'SCIM Provisioning', icon: Users },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
  { id: 'audit', label: 'Audit Log', icon: Activity },
] as const;

export function WorkspaceSettingsPage({
  tenantId,
  tenantSlug,
  tenantName,
  tenantKind,
  orgId,
  orgName,
  orgDescription,
}: {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantKind: string;
  orgId: string;
  orgName: string;
  orgDescription: string | null;
}) {
  const params = useParams<{ section?: string }>();
  const section = params.section ?? 'general';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3">
        <nav className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 space-y-0.5">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <Link
                key={item.id}
                to={`/${tenantSlug}/settings/${item.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition-colors ${
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

      <div className="lg:col-span-9 space-y-6">
        {section === 'general' && (
          <GeneralSettingsSection
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            tenantName={tenantName}
            tenantKind={tenantKind}
            orgId={orgId}
            orgName={orgName}
            orgDescription={orgDescription}
          />
        )}
        {section === 'members' && <MembersSection tenantId={tenantId} tenantSlug={tenantSlug} />}
        {section === 'teams' && <TeamsSection tenantId={tenantId} tenantSlug={tenantSlug} orgId={orgId} />}
        {section === 'roles' && <RolesSection tenantId={tenantId} tenantSlug={tenantSlug} orgId={orgId} />}
        {section === 'service-accounts' && <ServiceAccountsSection tenantId={tenantId} tenantSlug={tenantSlug} />}
        {section === 'security' && <SecuritySsoSection tenantId={tenantId} tenantSlug={tenantSlug} />}
        {section === 'scim' && <ScimSection tenantId={tenantId} tenantSlug={tenantSlug} />}
        {section === 'webhooks' && <WebhooksSection tenantId={tenantId} tenantSlug={tenantSlug} orgId={orgId} />}
        {section === 'billing' && <BillingSection tenantId={tenantId} tenantSlug={tenantSlug} />}
        {section === 'audit' && <AuditLogSection tenantId={tenantId} tenantSlug={tenantSlug} />}
      </div>
    </div>
  );
}

function GeneralSettingsSection({
  tenantId,
  tenantSlug,
  tenantName,
  tenantKind,
  orgId,
  orgName,
  orgDescription,
}: {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantKind: string;
  orgId: string;
  orgName: string;
  orgDescription: string | null;
}) {
  const { api, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [tName, setTName] = useState(tenantName);
  const [oName, setOName] = useState(orgName);
  const [oDesc, setODesc] = useState(orgDescription ?? '');
  const [newSlug, setNewSlug] = useState(tenantSlug);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setTName(tenantName);
    setOName(orgName);
    setODesc(orgDescription ?? '');
    setNewSlug(tenantSlug);
  }, [tenantName, orgName, orgDescription, tenantSlug]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.updateTenant(tenantId, { name: tName.trim() });
      await api.updateOrganization(tenantId, orgId, {
        name: oName.trim(),
        description: oDesc.trim() || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-resolve'] }),
        refreshMe(),
      ]);
      setSavedMsg('Workspace details updated.');
    },
  });

  const renameMutation = useMutation({
    mutationFn: () => api.renameOrganization(tenantId, orgId, { slug: newSlug.trim() }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenants'] }),
        refreshMe(),
      ]);
      navigate(`/${updated.slug}/settings/general`);
    },
  });

  return (
    <div className="space-y-6">
      {(updateMutation.error || renameMutation.error) && (
        <ErrorBanner error={updateMutation.error || renameMutation.error} tenantSlug={tenantSlug} />
      )}
      {savedMsg && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] px-4 py-2.5 text-xs text-[var(--success)] font-medium">
          {savedMsg}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">Workspace Profile</h3>
          <span className="text-xs font-mono text-[var(--fg-muted)]">{tenantKind}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Tenant name</label>
            <input
              type="text"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Organization name</label>
            <input
              type="text"
              value={oName}
              onChange={(e) => setOName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Description</label>
          <textarea
            rows={2}
            value={oDesc}
            onChange={(e) => setODesc(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>

        <Button type="submit" variant="primary" size="sm" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          renameMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-3"
      >
        <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">Rename URL Namespace</h3>
        <p className="text-xs text-[var(--fg-muted)]">
          Updates the organization URL slug used in all repository paths and Git clone URLs.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]?"
            className="flex-1 px-3 py-2 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={renameMutation.isPending || newSlug.trim() === tenantSlug}
          >
            Rename slug
          </Button>
        </div>
      </form>
    </div>
  );
}

export function MembersSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { api, rolesCatalog } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [roleKey, setRoleKey] = useState('tenant.member');

  const { data: membersPage, isLoading, error } = useQuery({
    queryKey: ['members', tenantId],
    queryFn: () => api.listMembers(tenantId, { limit: 100 }),
  });

  const addMutation = useMutation({
    mutationFn: () => api.addMember(tenantId, { username: username.trim(), roleKey }),
    onSuccess: () => {
      setUsername('');
      queryClient.invalidateQueries({ queryKey: ['members', tenantId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(tenantId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', tenantId] });
    },
  });

  const tenantRoles = rolesCatalog.filter((r) => r.scope === 'TENANT');

  return (
    <div className="space-y-4">
      {(error || addMutation.error || removeMutation.error) && (
        <ErrorBanner error={error || addMutation.error || removeMutation.error} tenantSlug={tenantSlug} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row gap-3 items-end"
      >
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Add member by username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="exmember-138c23c5"
            className="w-full px-3 py-2 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Initial role</label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            {tenantRoles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name} ({r.key})
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={addMutation.isPending || !username.trim()}>
          Add member
        </Button>
      </form>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(membersPage?.items ?? []).map((m) => (
            <div key={m.user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm text-[var(--fg-default)]">
                  {m.user.displayName || m.user.username}
                </div>
                <div className="text-xs font-mono text-[var(--fg-muted)]">
                  @{m.user.username} · {m.roles.map((r) => r.roleKey).join(', ')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMutation.mutate(m.user.id)}
                  className="text-[var(--danger)]"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamsSection({ tenantId, tenantSlug, orgId }: { tenantId: string; tenantSlug: string; orgId: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [memberUsername, setMemberUsername] = useState('');

  const { data: teamsPage, isLoading, error } = useQuery({
    queryKey: ['teams', tenantId, orgId],
    queryFn: () => api.listTeams(tenantId, orgId, { limit: 50 }),
  });

  const { data: teamMembersPage } = useQuery({
    queryKey: ['team-members', tenantId, orgId, selectedTeamId],
    queryFn: () => api.listTeamMembers(tenantId, orgId, selectedTeamId!, { limit: 50 }),
    enabled: Boolean(selectedTeamId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTeam(tenantId, orgId, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setName('');
      setSlug('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['teams', tenantId, orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => api.deleteTeam(tenantId, orgId, teamId),
    onSuccess: () => {
      setSelectedTeamId(null);
      queryClient.invalidateQueries({ queryKey: ['teams', tenantId, orgId] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: () => api.addTeamMember(tenantId, orgId, selectedTeamId!, { username: memberUsername.trim() }),
    onSuccess: () => {
      setMemberUsername('');
      queryClient.invalidateQueries({ queryKey: ['team-members', tenantId, orgId, selectedTeamId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeTeamMember(tenantId, orgId, selectedTeamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', tenantId, orgId, selectedTeamId] });
    },
  });

  return (
    <div className="space-y-4">
      {(error || createMutation.error || addMemberMutation.error) && (
        <ErrorBanner error={error || createMutation.error || addMemberMutation.error} tenantSlug={tenantSlug} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Team name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            }}
            placeholder="Incident Response"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Slug</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="incident-response"
            className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional summary"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={createMutation.isPending || !name.trim()}>
          Create team
        </Button>
      </form>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <div className="space-y-3">
          {(teamsPage?.items ?? []).map((team) => {
            const expanded = selectedTeamId === team.id;
            return (
              <div key={team.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-[var(--fg-default)]">{team.name}</div>
                    <div className="text-xs font-mono text-[var(--fg-muted)]">
                      {team.slug} {team.description ? `· ${team.description}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedTeamId(expanded ? null : team.id)}>
                      {expanded ? 'Hide members' : 'Members'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(team.id)}
                      className="text-[var(--danger)]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4 space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addMemberMutation.mutate();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        required
                        value={memberUsername}
                        onChange={(e) => setMemberUsername(e.target.value)}
                        placeholder="Username to add to team"
                        className="flex-1 px-3 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                      />
                      <Button type="submit" variant="secondary" size="sm" disabled={!memberUsername.trim()}>
                        Add to team
                      </Button>
                    </form>
                    <div className="divide-y divide-[var(--border-muted)] rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
                      {(teamMembersPage?.items ?? []).map((tm) => (
                        <div key={tm.user.id} className="px-3 py-2 flex items-center justify-between text-xs">
                          <span className="font-mono">@{tm.user.username}</span>
                          <button
                            type="button"
                            onClick={() => removeMemberMutation.mutate(tm.user.id)}
                            className="text-[var(--danger)] hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RolesSection({ tenantId, tenantSlug, orgId }: { tenantId: string; tenantSlug: string; orgId: string }) {
  const { api, rolesCatalog } = useAuth();
  const queryClient = useQueryClient();

  const { data: membersPage } = useQuery({
    queryKey: ['members', tenantId],
    queryFn: () => api.listMembers(tenantId, { limit: 100 }),
  });

  const { data: assignmentsPage, error } = useQuery({
    queryKey: ['role-assignments', tenantId],
    queryFn: () => api.listRoleAssignments(tenantId, { limit: 100 }),
  });

  const [roleKey, setRoleKey] = useState(rolesCatalog[0]?.key ?? 'organization.deployment_approver');
  const [principalId, setPrincipalId] = useState('');
  const [scopeType, setScopeType] = useState('ORGANIZATION');

  const members = membersPage?.items ?? [];
  useEffect(() => {
    if (members.length > 0 && !principalId) {
      setPrincipalId(members[0].user.id);
    }
  }, [members, principalId]);

  const assignMutation = useMutation({
    mutationFn: () =>
      api.createRoleAssignment(tenantId, {
        roleKey,
        principalType: 'user',
        principalId,
        scopeType,
        scopeId: scopeType === 'ORGANIZATION' ? orgId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['members', tenantId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.deleteRoleAssignment(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['members', tenantId] });
    },
  });

  return (
    <div className="space-y-6">
      {(error || assignMutation.error) && (
        <ErrorBanner error={error || assignMutation.error} tenantSlug={tenantSlug} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          assignMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Member</label>
          <select
            value={principalId}
            onChange={(e) => setPrincipalId(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.username}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Role</label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            {rolesCatalog.map((r) => (
              <option key={r.key} value={r.key}>
                {r.key}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Scope</label>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <option value="TENANT">TENANT</option>
            <option value="ORGANIZATION">ORGANIZATION</option>
          </select>
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={assignMutation.isPending || !principalId}>
          Assign role
        </Button>
      </form>

      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[var(--bg-subtle)] text-[var(--fg-muted)] border-b border-[var(--border-muted)]">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Principal</th>
              <th className="text-left px-4 py-2.5 font-semibold">Role</th>
              <th className="text-left px-4 py-2.5 font-semibold">Scope</th>
              <th className="text-right px-4 py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-muted)] font-mono">
            {(assignmentsPage?.items ?? []).map((a) => {
              const m = members.find((x) => x.user.id === a.principalId);
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2.5">{m?.user.username ?? a.principalId}</td>
                  <td className="px-4 py-2.5 text-[var(--brand-primary)]">{a.roleKey}</td>
                  <td className="px-4 py-2.5">{a.scope}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => revokeMutation.mutate(a.id)}
                      className="text-[var(--danger)] hover:underline cursor-pointer"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceAccountsSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [saName, setSaName] = useState('');
  const [saDesc, setSaDesc] = useState('');
  const [selectedSaId, setSelectedSaId] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [secretModal, setSecretModal] = useState<{ title: string; value: string } | null>(null);

  const { data: saResp, error } = useQuery({
    queryKey: ['service-accounts', tenantId],
    queryFn: () => api.listServiceAccounts(tenantId),
  });

  const { data: keysResp } = useQuery({
    queryKey: ['sa-api-keys', tenantId, selectedSaId],
    queryFn: () => api.listApiKeys(tenantId, selectedSaId!),
    enabled: Boolean(selectedSaId),
  });

  const createSaMutation = useMutation({
    mutationFn: () => api.createServiceAccount(tenantId, { name: saName.trim(), description: saDesc.trim() || undefined }),
    onSuccess: (created) => {
      setSaName('');
      setSaDesc('');
      setSelectedSaId(created.id);
      queryClient.invalidateQueries({ queryKey: ['service-accounts', tenantId] });
    },
  });

  const deleteSaMutation = useMutation({
    mutationFn: (id: string) => api.deleteServiceAccount(tenantId, id),
    onSuccess: () => {
      setSelectedSaId(null);
      queryClient.invalidateQueries({ queryKey: ['service-accounts', tenantId] });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: () => api.createApiKey(tenantId, selectedSaId!, { name: keyName.trim(), expiresInDays: 90 }),
    onSuccess: (created) => {
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['sa-api-keys', tenantId, selectedSaId] });
      if (created.key) {
        setSecretModal({ title: `API Key Created · ${created.name}`, value: created.key });
      }
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.rotateApiKey(tenantId, selectedSaId!, keyId, 24),
    onSuccess: (rotated) => {
      queryClient.invalidateQueries({ queryKey: ['sa-api-keys', tenantId, selectedSaId] });
      if (rotated.key) {
        setSecretModal({ title: `Rotated API Key · ${rotated.name} (24h grace)`, value: rotated.key });
      }
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.revokeApiKey(tenantId, selectedSaId!, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa-api-keys', tenantId, selectedSaId] });
    },
  });

  return (
    <div className="space-y-4">
      {(error || createSaMutation.error || createKeyMutation.error) && (
        <ErrorBanner error={error || createSaMutation.error || createKeyMutation.error} tenantSlug={tenantSlug} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createSaMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row gap-3 items-end"
      >
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Service account name</label>
          <input
            type="text"
            required
            value={saName}
            onChange={(e) => setSaName(e.target.value)}
            placeholder="ci-rule-publisher"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Description</label>
          <input
            type="text"
            value={saDesc}
            onChange={(e) => setSaDesc(e.target.value)}
            placeholder="Automated detection pipeline"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={createSaMutation.isPending || !saName.trim()}>
          Create service account
        </Button>
      </form>

      <div className="space-y-3">
        {(saResp?.items ?? []).map((sa) => {
          const open = selectedSaId === sa.id;
          return (
            <div key={sa.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{sa.name}</span>
                    <StatusBadge status={sa.status} />
                  </div>
                  <div className="text-xs font-mono text-[var(--fg-muted)]">{sa.username}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedSaId(open ? null : sa.id)}>
                    {open ? 'Hide API keys' : 'API keys'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSaMutation.mutate(sa.id)} className="text-[var(--danger)]">
                    Delete
                  </Button>
                </div>
              </div>

              {open && (
                <div className="border-t border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4 space-y-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createKeyMutation.mutate();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      required
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="New API key label"
                      className="flex-1 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                    />
                    <Button type="submit" variant="primary" size="sm" disabled={!keyName.trim()}>
                      Issue key
                    </Button>
                  </form>

                  <div className="divide-y divide-[var(--border-muted)] rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
                    {(keysResp?.items ?? []).length === 0 ? (
                      <div className="p-3 text-xs text-[var(--fg-muted)]">No API keys issued yet.</div>
                    ) : (
                      (keysResp?.items ?? []).map((k) => (
                        <div key={k.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{k.name}</span>
                              <code className="font-mono text-[var(--fg-muted)]">{k.displayPrefix}…</code>
                              <StatusBadge status={k.status} />
                            </div>
                          </div>
                          {k.status !== 'REVOKED' && (
                            <div className="flex items-center gap-2">
                              <Button variant="secondary" size="sm" onClick={() => rotateKeyMutation.mutate(k.id)}>
                                Rotate
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeKeyMutation.mutate(k.id)}
                                className="text-[var(--danger)]"
                              >
                                Revoke
                              </Button>
                            </div>
                          )}
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

      {secretModal && (
        <OneTimeSecretModal
          title={secretModal.title}
          secretLabel="Service Account API Key"
          secretValue={secretModal.value}
          onClose={() => setSecretModal(null)}
        />
      )}
    </div>
  );
}

function SecuritySsoSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: policy } = useQuery({
    queryKey: ['security-policy', tenantId],
    queryFn: () => api.getSecurityPolicy(tenantId),
  });

  const { data: sso } = useQuery({
    queryKey: ['sso-connection', tenantId],
    queryFn: async () => {
      try {
        return await api.getSsoConnection(tenantId);
      } catch (err) {
        if (err instanceof SepApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  const [requireMfa, setRequireMfa] = useState(false);
  const [acceptedAcr, setAcceptedAcr] = useState('urn:mfa');

  const [displayName, setDisplayName] = useState('Okta SAML');
  const [idpEntityId, setIdpEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [signingCertificate, setSigningCertificate] = useState('');
  const [enforced, setEnforced] = useState(false);

  useEffect(() => {
    if (policy) {
      setRequireMfa(policy.requireMfa);
      setAcceptedAcr(policy.acceptedAcr.join(', '));
    }
  }, [policy]);

  useEffect(() => {
    if (sso) {
      setDisplayName(sso.displayName);
      setIdpEntityId(sso.idpEntityId);
      setSsoUrl(sso.ssoUrl);
      setSigningCertificate(sso.signingCertificate);
      setEnforced(sso.enforced);
    }
  }, [sso]);

  const policyMutation = useMutation({
    mutationFn: () =>
      api.putSecurityPolicy(tenantId, {
        requireMfa,
        acceptedAcr: acceptedAcr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-policy', tenantId] }),
  });

  const ssoMutation = useMutation({
    mutationFn: () =>
      api.putSsoConnection(tenantId, {
        displayName: displayName.trim(),
        idpEntityId: idpEntityId.trim(),
        ssoUrl: ssoUrl.trim(),
        signingCertificate: signingCertificate.trim(),
        enforced,
        ownerBypass: true,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sso-connection', tenantId] }),
  });

  const deleteSsoMutation = useMutation({
    mutationFn: () => api.deleteSsoConnection(tenantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sso-connection', tenantId] }),
  });

  return (
    <div className="space-y-6">
      {(policyMutation.error || ssoMutation.error) && (
        <ErrorBanner error={policyMutation.error || ssoMutation.error} tenantSlug={tenantSlug} />
      )}

      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
        <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">Security Policy</h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={requireMfa} onChange={(e) => setRequireMfa(e.target.checked)} />
          <span>Require multi-factor authentication (MFA) for workspace access</span>
        </label>
        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Accepted ACR values (comma-separated)</label>
          <input
            type="text"
            value={acceptedAcr}
            onChange={(e) => setAcceptedAcr(e.target.value)}
            className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <Button variant="primary" size="sm" disabled={policyMutation.isPending} onClick={() => policyMutation.mutate()}>
          Save security policy
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ssoMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-[var(--fg-default)]">SAML 2.0 Single Sign-On</h3>
          <StatusBadge status={sso ? (sso.enforced ? 'ACTIVE' : 'PENDING') : 'NOT_CONFIGURED'} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Display name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">IdP Entity ID</label>
            <input
              type="text"
              required
              value={idpEntityId}
              onChange={(e) => setIdpEntityId(e.target.value)}
              placeholder="https://idp.example.com/app/metadata"
              className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">IdP SSO URL</label>
          <input
            type="url"
            required
            value={ssoUrl}
            onChange={(e) => setSsoUrl(e.target.value)}
            placeholder="https://idp.example.com/sso/saml"
            className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">X.509 Signing Certificate (PEM)</label>
          <textarea
            rows={4}
            required
            value={signingCertificate}
            onChange={(e) => setSigningCertificate(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----..."
            className="w-full px-3 py-2 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={enforced} onChange={(e) => setEnforced(e.target.checked)} />
          <span>Enforce SAML SSO for all non-owner members</span>
        </label>

        <div className="flex items-center justify-between">
          {sso ? (
            <Button variant="danger" size="sm" onClick={() => deleteSsoMutation.mutate()}>
              Remove SSO
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" variant="primary" size="sm" disabled={ssoMutation.isPending}>
            Save SAML configuration
          </Button>
        </div>
      </form>
    </div>
  );
}

function ScimSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [secretVal, setSecretVal] = useState<string | null>(null);

  const { data: scimResp, error } = useQuery({
    queryKey: ['scim-tokens', tenantId],
    queryFn: () => api.listScimTokens(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createScimToken(tenantId, { name: name.trim(), expiresInDays: 365 }),
    onSuccess: (created) => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['scim-tokens', tenantId] });
      if (created.token) setSecretVal(created.token);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeScimToken(tenantId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scim-tokens', tenantId] }),
  });

  const scimEndpoint = `${window.location.origin}/api/v1/scim/v2`;

  return (
    <div className="space-y-4">
      {(error || createMutation.error) && (
        <ErrorBanner error={error || createMutation.error} tenantSlug={tenantSlug} />
      )}

      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2 text-xs">
        <div className="font-semibold text-[var(--fg-default)]">SCIM 2.0 Base Endpoint</div>
        <code className="block p-2 rounded border border-[var(--border-muted)] bg-[var(--bg-subtle)] font-mono">
          {scimEndpoint}
        </code>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex gap-3 items-end"
      >
        <div className="flex-1">
          <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Token label</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Okta SCIM Connector"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
          Generate SCIM token
        </Button>
      </form>

      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
        {(scimResp?.items ?? []).length === 0 ? (
          <div className="p-4 text-xs text-[var(--fg-muted)]">No SCIM provisioning tokens created yet.</div>
        ) : (
          (scimResp?.items ?? []).map((t) => (
            <div key={t.id} className="p-3.5 flex items-center justify-between text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.name}</span>
                  <code className="font-mono text-[var(--fg-muted)]">{t.displayPrefix}…</code>
                  <StatusBadge status={t.status} />
                </div>
              </div>
              {t.status === 'ACTIVE' && (
                <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(t.id)} className="text-[var(--danger)]">
                  Revoke
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {secretVal && (
        <OneTimeSecretModal
          title="SCIM Bearer Token Created"
          secretLabel="SCIM Token"
          secretValue={secretVal}
          onClose={() => setSecretVal(null)}
        />
      )}
    </div>
  );
}

const WEBHOOK_EVENTS = [
  'rule.indexed',
  'rule.validation_failed',
  'deployment.requested',
  'deployment.approved',
  'deployment.succeeded',
  'deployment.failed',
  'pull_request.opened',
  'pull_request.merged',
];

function WebhooksSection({ tenantId, tenantSlug, orgId }: { tenantId: string; tenantSlug: string; orgId: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<string[]>(['deployment.succeeded', 'rule.indexed']);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [secretModal, setSecretModal] = useState<string | null>(null);

  const { data: hooksPage, error } = useQuery({
    queryKey: ['webhooks', tenantId, orgId],
    queryFn: () => api.listWebhooks(tenantId, orgId, { limit: 50 }),
  });

  const { data: deliveriesPage } = useQuery({
    queryKey: ['webhook-deliveries', tenantId, orgId, selectedWebhookId],
    queryFn: () => api.listWebhookDeliveries(tenantId, orgId, selectedWebhookId!, { limit: 20 }),
    enabled: Boolean(selectedWebhookId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createWebhook(tenantId, orgId, {
        url: url.trim(),
        description: description.trim() || undefined,
        events,
      }),
    onSuccess: (created) => {
      setUrl('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['webhooks', tenantId, orgId] });
      if (created.secret) setSecretModal(created.secret);
    },
  });

  const pingMutation = useMutation({
    mutationFn: (id: string) => api.pingWebhook(tenantId, orgId, id),
    onSuccess: () => {
      if (selectedWebhookId) {
        queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', tenantId, orgId, selectedWebhookId] });
      }
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.rotateWebhookSecret(tenantId, orgId, id),
    onSuccess: (res) => setSecretModal(res.secret),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWebhook(tenantId, orgId, id),
    onSuccess: () => {
      setSelectedWebhookId(null);
      queryClient.invalidateQueries({ queryKey: ['webhooks', tenantId, orgId] });
    },
  });

  return (
    <div className="space-y-4">
      {(error || createMutation.error) && (
        <ErrorBanner error={error || createMutation.error} tenantSlug={tenantSlug} />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Payload URL</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://soc.example.com/webhooks/sep"
              className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="SOAR deployment feed"
              className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="inline-flex items-center gap-1.5 font-mono cursor-pointer">
              <input
                type="checkbox"
                checked={events.includes(ev)}
                onChange={(e) =>
                  setEvents((prev) => (e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)))
                }
              />
              <span>{ev}</span>
            </label>
          ))}
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={!url.trim() || events.length === 0}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add webhook</span>
        </Button>
      </form>

      <div className="space-y-3">
        {(hooksPage?.items ?? []).map((hook) => {
          const open = selectedWebhookId === hook.id;
          return (
            <div key={hook.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{hook.url}</span>
                    <StatusBadge status={hook.status} />
                  </div>
                  <div className="text-xs text-[var(--fg-muted)] mt-0.5 font-mono">
                    {hook.events.join(', ')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => pingMutation.mutate(hook.id)}>
                    Ping
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => rotateMutation.mutate(hook.id)}>
                    Rotate secret
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedWebhookId(open ? null : hook.id)}>
                    Deliveries
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(hook.id)} className="text-[var(--danger)]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {open && (
                <div className="border-t border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4">
                  <h4 className="text-xs font-semibold mb-2">Recent Deliveries</h4>
                  {(deliveriesPage?.items ?? []).length === 0 ? (
                    <div className="text-xs text-[var(--fg-muted)]">No deliveries recorded.</div>
                  ) : (
                    <div className="space-y-1.5 text-xs font-mono">
                      {(deliveriesPage?.items ?? []).map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
                          <span>{d.eventType}</span>
                          <span>HTTP {d.responseStatus ?? '—'} · {d.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {secretModal && (
        <OneTimeSecretModal
          title="Webhook Signing Secret"
          secretLabel="HMAC Signing Secret"
          secretValue={secretModal}
          onClose={() => setSecretModal(null)}
        />
      )}
    </div>
  );
}

function BillingSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: sub, error: subError } = useQuery({
    queryKey: ['subscription', tenantId],
    queryFn: () => api.getSubscription(tenantId),
  });

  const { data: usage } = useQuery({
    queryKey: ['usage', tenantId],
    queryFn: () => api.getUsage(tenantId),
  });

  const { data: plansResp } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.listPlans(),
  });

  const changePlanMutation = useMutation({
    mutationFn: (planKey: string) => api.changePlan(tenantId, planKey),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['usage', tenantId] });
      if (res.checkoutUrl && res.checkoutUrl.startsWith('http')) {
        window.location.assign(res.checkoutUrl);
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelSubscription(tenantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription', tenantId] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeSubscription(tenantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription', tenantId] }),
  });

  return (
    <div className="space-y-6">
      {(subError || changePlanMutation.error || cancelMutation.error) && (
        <ErrorBanner error={subError || changePlanMutation.error || cancelMutation.error} tenantSlug={tenantSlug} />
      )}

      {sub && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-[var(--fg-default)]">
                Current Plan: {sub.effectivePlan.name}
              </h3>
              <StatusBadge status={sub.subscription.status} />
            </div>
            <div className="text-xs text-[var(--fg-muted)]">
              Billing period ends {new Date(sub.subscription.currentPeriodEnd).toLocaleDateString()} · Provider: {sub.provider}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sub.subscription.cancelAtPeriodEnd ? (
              <Button variant="primary" size="sm" onClick={() => resumeMutation.mutate()}>
                Resume subscription
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => cancelMutation.mutate()}>
                Cancel at period end
              </Button>
            )}
          </div>
        </div>
      )}

      {usage && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-[var(--fg-default)]">Workspace Usage Meters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {usage.items.map((item) => {
              const unlimited = item.limit < 0;
              const pct = unlimited || item.limit === 0 ? 0 : Math.min(100, Math.round((item.used / item.limit) * 100));
              const usedLabel = item.unit === 'bytes' ? formatBytes(item.used) : String(item.used);
              const limitLabel = item.unit === 'bytes' ? formatBytes(item.limit) : unlimited ? 'Unlimited' : String(item.limit);
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--fg-default)]">{item.description}</span>
                    <span className="font-mono tabular-nums text-[var(--fg-muted)]">
                      {usedLabel} / {limitLabel}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--brand-primary)] transition-all"
                      style={{ width: `${unlimited ? 15 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(plansResp?.items ?? []).map((plan) => {
          const isCurrent = sub?.effectivePlan.key === plan.key;
          return (
            <div
              key={plan.key}
              className={`rounded-md border p-4 flex flex-col justify-between gap-4 ${
                isCurrent
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="space-y-2">
                <div className="font-display font-bold text-base">{plan.name}</div>
                <div className="font-display text-2xl font-bold tabular-nums">
                  ${Math.round(plan.priceMonthlyCents / 100)}
                  <span className="text-xs font-normal text-[var(--fg-muted)]"> / mo</span>
                </div>
                <p className="text-xs text-[var(--fg-muted)]">{plan.description}</p>
              </div>
              <Button
                variant={isCurrent ? 'secondary' : 'primary'}
                size="sm"
                disabled={isCurrent || changePlanMutation.isPending}
                onClick={() => changePlanMutation.mutate(plan.key)}
              >
                {isCurrent ? 'Current plan' : `Switch to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditLogSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { api } = useAuth();
  const { data: logsPage, isLoading, error } = useQuery({
    queryKey: ['audit-logs', tenantId],
    queryFn: () => api.listAuditLogs(tenantId, { limit: 50 }),
    retry: false,
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  if (error) {
    if (error instanceof SepApiError && error.status === 403) {
      return (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--fg-muted)]">
          Audit logs require the <code className="font-mono">audit.read</code> permission (workspace owners and administrators).
        </div>
      );
    }
    return <ErrorBanner error={error} tenantSlug={tenantSlug} />;
  }

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-[var(--bg-subtle)] text-[var(--fg-muted)] border-b border-[var(--border-muted)]">
          <tr>
            <th className="text-left px-4 py-2.5 font-semibold">Action</th>
            <th className="text-left px-4 py-2.5 font-semibold">Target</th>
            <th className="text-left px-4 py-2.5 font-semibold">Request ID</th>
            <th className="text-right px-4 py-2.5 font-semibold">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-muted)] font-mono">
          {(logsPage?.items ?? []).map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2.5 text-[var(--fg-default)] font-semibold">{entry.action}</td>
              <td className="px-4 py-2.5 text-[var(--fg-muted)]">
                {entry.targetType}:{entry.targetId.slice(0, 12)}
              </td>
              <td className="px-4 py-2.5 text-[var(--fg-muted)]">{entry.requestId.slice(0, 12)}</td>
              <td className="px-4 py-2.5 text-right text-[var(--fg-muted)]">
                {formatRelativeTime(entry.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
