import type { MeDto, RoleAssignmentDto, RoleDto } from '../api/types';

export interface EffectivePermissionContext {
  me: MeDto | null;
  rolesCatalog: RoleDto[];
  tenantId?: string;
  organizationId?: string;
  repositoryId?: string;
  assignments?: RoleAssignmentDto[];
}

export function resolveUserRoleKeys(ctx: EffectivePermissionContext): Set<string> {
  const keys = new Set<string>();
  if (!ctx.me || !ctx.tenantId) return keys;

  const membership = ctx.me.memberships.find((m) => m.tenant.id === ctx.tenantId);
  if (membership) {
    for (const r of membership.roles) {
      keys.add(r);
    }
  }

  if (ctx.assignments) {
    for (const a of ctx.assignments) {
      if (a.principalType === 'user' && a.principalId === ctx.me.id) {
        if (a.scope === 'TENANT') keys.add(a.roleKey);
        if (a.scope === 'ORGANIZATION' && ctx.organizationId && a.organizationId === ctx.organizationId) {
          keys.add(a.roleKey);
        }
        if (a.scope === 'REPOSITORY' && ctx.repositoryId && a.repositoryId === ctx.repositoryId) {
          keys.add(a.roleKey);
        }
      }
    }
  }
  return keys;
}

export function resolvePermissions(ctx: EffectivePermissionContext): Set<string> {
  const roleKeys = resolveUserRoleKeys(ctx);
  const perms = new Set<string>();
  const byKey = new Map(ctx.rolesCatalog.map((r) => [r.key, r]));

  for (const key of roleKeys) {
    if (key === 'tenant.owner') {
      perms.add('*');
      continue;
    }
    const role = byKey.get(key);
    if (role) {
      for (const p of role.permissions) perms.add(p);
    }
  }
  return perms;
}

export function hasPermission(ctx: EffectivePermissionContext, permission: string): boolean {
  const perms = resolvePermissions(ctx);
  return perms.has('*') || perms.has(permission);
}

export function hasAnyRole(ctx: EffectivePermissionContext, allowedRoles: string[]): boolean {
  const roleKeys = resolveUserRoleKeys(ctx);
  if (roleKeys.has('tenant.owner')) return true;
  return allowedRoles.some((r) => roleKeys.has(r));
}

export function canManageWorkspaceSettings(ctx: EffectivePermissionContext): boolean {
  return hasAnyRole(ctx, ['tenant.owner', 'tenant.admin', 'organization.admin']) ||
    hasPermission(ctx, 'tenant.manage');
}

export function canApproveDeployments(ctx: EffectivePermissionContext): boolean {
  return hasAnyRole(ctx, ['tenant.owner', 'tenant.admin', 'organization.admin', 'organization.deployment_approver']) ||
    hasPermission(ctx, 'deployment.approve');
}

export function canManageIntegrations(ctx: EffectivePermissionContext): boolean {
  return hasAnyRole(ctx, ['tenant.owner', 'tenant.admin', 'organization.admin']) ||
    hasPermission(ctx, 'connector.manage');
}
