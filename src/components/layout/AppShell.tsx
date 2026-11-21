import React, { useState } from 'react';
import { CreateRepositoryModal, CreateWorkspaceModal } from './CreateModals';
import { GlobalHeader } from './GlobalHeader';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [newRepoTenantId, setNewRepoTenantId] = useState<string | undefined>(undefined);
  const [newRepoOpen, setNewRepoOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--fg-default)]">
      <GlobalHeader
        onOpenNewRepo={(tenantId) => {
          setNewRepoTenantId(tenantId);
          setNewRepoOpen(true);
        }}
        onOpenNewWorkspace={() => setNewWorkspaceOpen(true)}
      />
      <main className="flex-1 w-full">{children}</main>

      <CreateRepositoryModal
        open={newRepoOpen}
        defaultTenantId={newRepoTenantId}
        onClose={() => setNewRepoOpen(false)}
      />
      <CreateWorkspaceModal
        open={newWorkspaceOpen}
        onClose={() => setNewWorkspaceOpen(false)}
      />
    </div>
  );
}
