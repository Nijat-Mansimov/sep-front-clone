import assert from 'node:assert/strict';
import test from 'node:test';
import type { MeDto, RoleDto } from '../api/types';
import { canApproveDeployments, canManageWorkspaceSettings, hasPermission } from './rbac';

const rolesCatalog: RoleDto[] = [
  {
    key: 'organization.deployment_approver',
    name: 'Deployment approver',
    description: 'Approves deployments',
    scope: 'ORGANIZATION',
    permissions: ['connector.read', 'deployment.approve'],
  },
  {
    key: 'tenant.member',
    name: 'Member',
    description: 'Standard member',
    scope: 'TENANT',
    permissions: ['repository.read'],
  },
];

const ownerUser: MeDto = {
  id: 'u-1',
  username: 'owner',
  email: 'owner@test.local',
  displayName: 'Owner',
  memberships: [
    {
      tenant: { id: 't-1', slug: 'soc', name: 'SOC', kind: 'TEAM', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' },
      roles: ['tenant.owner'],
    },
  ],
};

const memberUser: MeDto = {
  id: 'u-2',
  username: 'member',
  email: 'member@test.local',
  displayName: 'Member',
  memberships: [
    {
      tenant: { id: 't-1', slug: 'soc', name: 'SOC', kind: 'TEAM', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' },
      roles: ['tenant.member'],
    },
  ],
};

test('tenant.owner grants wildcard permissions and workspace settings access', () => {
  const ctx = { me: ownerUser, rolesCatalog, tenantId: 't-1' };
  assert.equal(hasPermission(ctx, 'deployment.approve'), true);
  assert.equal(canManageWorkspaceSettings(ctx), true);
});

test('tenant.member without approver assignment cannot approve or manage settings', () => {
  const ctx = { me: memberUser, rolesCatalog, tenantId: 't-1', organizationId: 'o-1', assignments: [] };
  assert.equal(canApproveDeployments(ctx), false);
  assert.equal(canManageWorkspaceSettings(ctx), false);
  assert.equal(hasPermission(ctx, 'repository.read'), true);
});

test('organization assignment grants deployment.approve', () => {
  const ctx = {
    me: memberUser,
    rolesCatalog,
    tenantId: 't-1',
    organizationId: 'o-1',
    assignments: [
      {
        id: 'a-1',
        roleKey: 'organization.deployment_approver',
        scope: 'ORGANIZATION' as const,
        principalType: 'user' as const,
        principalId: 'u-2',
        organizationId: 'o-1',
        teamId: null,
        repositoryId: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  };
  assert.equal(canApproveDeployments(ctx), true);
  assert.equal(canManageWorkspaceSettings(ctx), false);
});
