import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import React from 'react';
import type { RuleSeverity, ValidationStatus } from '../../api/types';

export function SeverityBadge({ severity }: { severity: RuleSeverity | null | undefined }) {
  if (!severity) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-[var(--border-default)] text-[var(--fg-muted)] whitespace-nowrap">
        Unspecified
      </span>
    );
  }
  const colorVar =
    severity === 'CRITICAL'
      ? 'var(--sev-critical)'
      : severity === 'HIGH'
        ? 'var(--sev-high)'
        : severity === 'MEDIUM'
          ? 'var(--sev-medium)'
          : severity === 'LOW'
            ? 'var(--sev-low)'
            : 'var(--sev-info)';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded border whitespace-nowrap"
      style={{
        color: colorVar,
        borderColor: `color-mix(in srgb, ${colorVar} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
      }}
    >
      <span>{severity}</span>
    </span>
  );
}

export function ValidationBadge({ status }: { status: ValidationStatus }) {
  if (status === 'VALID') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] text-[var(--success)] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Valid</span>
      </span>
    );
  }
  if (status === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] text-[var(--warning)] whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Warning</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] text-[var(--danger)] whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Invalid</span>
    </span>
  );
}

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  const resolvedTone =
    tone ??
    (/^(SUCCEEDED|ACTIVE|HEALTHY|ONLINE|INDEXED|DEPLOYED|APPROVED|OPEN|VALID)$/i.test(status)
      ? 'success'
      : /^(PENDING|PENDING_APPROVAL|QUEUED|RUNNING|INDEXING|WARNING|TRIALING|DEGRADED|SUCCEEDED_WITH_WARNINGS|TEST)$/i.test(status)
        ? 'warning'
        : /^(FAILED|REJECTED|REVOKED|UNHEALTHY|OFFLINE|INVALID|CANCELED|CANCELLED|PAST_DUE|EXPIRED|REQUEST_CHANGES)$/i.test(status)
          ? 'danger'
          : /^(MERGED|STABLE|DEPLOY)$/i.test(status)
            ? 'info'
            : 'neutral');

  const styles: Record<string, string> = {
    success: 'border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] text-[var(--success)]',
    warning: 'border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] text-[var(--warning)]',
    danger: 'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] text-[var(--danger)]',
    info: 'border-[color-mix(in_srgb,var(--info)_35%,transparent)] bg-[var(--info-subtle)] text-[var(--info)]',
    neutral: 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-muted)]',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${styles[resolvedTone]}`}>
      {resolvedTone === 'warning' && <Clock className="w-3 h-3" aria-hidden="true" />}
      {resolvedTone === 'success' && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
      {resolvedTone === 'danger' && <XCircle className="w-3 h-3" aria-hidden="true" />}
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
}
