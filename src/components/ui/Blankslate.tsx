import React from 'react';

export function Blankslate({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-surface)] rounded-md p-8 text-center flex flex-col items-center justify-center gap-3">
      {icon && <div className="text-[var(--fg-muted)]">{icon}</div>}
      <h3 className="text-base font-semibold text-[var(--fg-default)]">{title}</h3>
      <p className="text-sm text-[var(--fg-muted)] max-w-md">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
