import React from 'react';

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="border border-[var(--border-default)] rounded-md bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center justify-between gap-4 animate-pulse">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 bg-[var(--bg-subtle)] rounded" />
            <div className="h-3 w-72 bg-[var(--bg-subtle)] rounded" />
          </div>
          <div className="h-6 w-20 bg-[var(--bg-subtle)] rounded" />
        </div>
      ))}
    </div>
  );
}
