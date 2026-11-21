import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderGit2, Building2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';

export function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { api, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setSlug('');
    setSlugEdited(false);
    setDescription('');
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createOrganization({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenants'] }),
        refreshMe(),
      ]);
      onClose();
      navigate(`/${created.organization.slug}`);
    },
  });

  if (!open) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workspace-title"
    >
      <div className="w-full max-w-lg rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--brand-primary)]" aria-hidden="true" />
            <h2 id="create-workspace-title" className="text-base font-semibold text-[var(--fg-default)]">
              Create team workspace
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
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
          {mutation.error && <ErrorBanner error={mutation.error} />}

          <div>
            <label htmlFor="ws-name" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
              Workspace display name <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="ws-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Detection Engineering"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
          </div>

          <div>
            <label htmlFor="ws-slug" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
              URL namespace slug <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="ws-slug"
              type="text"
              required
              pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]?"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="acme-soc"
              className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Lowercase letters, numbers, and hyphens. Used in Git remote paths and URLs.
            </p>
          </div>

          <div>
            <label htmlFor="ws-desc" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
              Description
            </label>
            <textarea
              id="ws-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Central detection content, field mappings, and SIEM deployment targets"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending || !name.trim() || !slug.trim()}>
              {mutation.isPending ? 'Creating workspace…' : 'Create workspace'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateRepositoryModal({
  open,
  defaultTenantId,
  onClose,
}: {
  open: boolean;
  defaultTenantId?: string;
  onClose: () => void;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: tenantsPage } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants({ limit: 50 }),
    enabled: open,
  });

  const tenants = tenantsPage?.items ?? [];
  const [selectedTenantId, setSelectedTenantId] = useState(defaultTenantId ?? '');

  useEffect(() => {
    if (!open) return;
    if (defaultTenantId) {
      setSelectedTenantId(defaultTenantId);
    } else if (tenants.length > 0 && !selectedTenantId) {
      const teamTenant = tenants.find((t) => t.kind !== 'INDIVIDUAL') ?? tenants[0];
      setSelectedTenantId(teamTenant.id);
    }
  }, [open, defaultTenantId, tenants, selectedTenantId]);

  const { data: orgsPage } = useQuery({
    queryKey: ['organizations', selectedTenantId],
    queryFn: () => api.listOrganizations(selectedTenantId, { limit: 50 }),
    enabled: open && Boolean(selectedTenantId),
  });

  const orgs = orgsPage?.items ?? [];
  const [selectedOrgId, setSelectedOrgId] = useState('');

  useEffect(() => {
    if (orgs.length > 0 && !orgs.some((o) => o.id === selectedOrgId)) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [autoInit, setAutoInit] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setVisibility('PRIVATE');
    setDefaultBranch('main');
    setAutoInit(true);
  }, [open]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  const mutation = useMutation({
    mutationFn: () =>
      api.createRepository(selectedTenantId, selectedOrgId, {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        defaultBranch: defaultBranch.trim() || 'main',
        autoInit,
      }),
    onSuccess: async (repo) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['repositories'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-repos'] }),
      ]);
      onClose();
      navigate(`/${repo.fullName}`);
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-repo-title"
    >
      <div className="w-full max-w-lg rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-[var(--brand-primary)]" aria-hidden="true" />
            <h2 id="create-repo-title" className="text-base font-semibold text-[var(--fg-default)]">
              Create detection repository
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
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
          {mutation.error && (
            <ErrorBanner error={mutation.error} tenantSlug={selectedTenant?.slug} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="repo-tenant" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Owner workspace <span className="text-[var(--danger)]">*</span>
              </label>
              <select
                id="repo-tenant"
                value={selectedTenantId}
                onChange={(e) => {
                  setSelectedTenantId(e.target.value);
                  setSelectedOrgId('');
                }}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.slug} ({t.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="repo-name" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Repository name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="repo-name"
                type="text"
                required
                pattern="[A-Za-z0-9._-]+"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="windows-detections"
                className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              />
            </div>
          </div>

          {orgs.length > 1 && (
            <div>
              <label htmlFor="repo-org" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Organization
              </label>
              <select
                id="repo-org"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.slug} ({o.name})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="repo-desc" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
              Description
            </label>
            <input
              id="repo-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sigma & SEP v1 detection rules for endpoint telemetry"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-medium text-[var(--fg-default)] mb-1.5">Visibility</span>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-sm text-[var(--fg-default)] cursor-pointer">
                  <input
                    type="radio"
                    name="repo-visibility"
                    checked={visibility === 'PRIVATE'}
                    onChange={() => setVisibility('PRIVATE')}
                  />
                  <span>Private</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm text-[var(--fg-default)] cursor-pointer">
                  <input
                    type="radio"
                    name="repo-visibility"
                    checked={visibility === 'PUBLIC'}
                    onChange={() => setVisibility('PUBLIC')}
                  />
                  <span>Public</span>
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="repo-branch" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Default branch
              </label>
              <input
                id="repo-branch"
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--fg-default)] cursor-pointer">
            <input
              type="checkbox"
              checked={autoInit}
              onChange={(e) => setAutoInit(e.target.checked)}
            />
            <span>Initialize repository with a README and initial commit</span>
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || !selectedTenantId || !selectedOrgId || !name.trim()}
            >
              {mutation.isPending ? 'Creating…' : 'Create repository'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
