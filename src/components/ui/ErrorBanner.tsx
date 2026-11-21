import { AlertCircle, Check, Copy } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SepApiError } from '../../api/client';
import { formatApiErrorCopyText } from '../../utils/rule-helpers';

export function ErrorBanner({
  error,
  tenantSlug,
  className = '',
}: {
  error: unknown;
  tenantSlug?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!error) return null;

  const isSep = error instanceof SepApiError;
  const message = isSep
    ? error.message
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';
  const code = isSep ? error.code : undefined;
  const requestId = isSep ? error.requestId : undefined;
  const details = isSep ? error.details : undefined;
  const isQuotaError = isSep && (error.status === 429 || error.status === 402 || code?.includes('QUOTA') || code?.includes('LIMIT'));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatApiErrorCopyText(error));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      role="alert"
      className={`border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[var(--danger-subtle)] text-[var(--fg-default)] rounded-md p-4 flex flex-col gap-2 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-[var(--danger)]">
              {code ? `${code}: ` : ''}
              {message}
            </div>
            {details && details.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-xs text-[var(--fg-default)] space-y-0.5">
                {details.map((d, i) => (
                  <li key={i}>
                    {d.field ? <span className="font-mono font-medium">{d.field}: </span> : null}
                    {d.message}
                  </li>
                ))}
              </ul>
            )}
            {isQuotaError && tenantSlug && (
              <div className="mt-2 text-xs">
                Workspace quota reached.{' '}
                <Link to={`/${tenantSlug}/settings/billing`} className="underline font-medium text-[var(--brand-primary)]">
                  Review Billing &amp; Usage
                </Link>
              </div>
            )}
          </div>
        </div>
        {requestId && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy error details'}</span>
          </button>
        )}
      </div>
      {requestId && (
        <div className="text-xs font-mono text-[var(--fg-muted)] pl-7">
          Request ID: {requestId}
        </div>
      )}
    </div>
  );
}
