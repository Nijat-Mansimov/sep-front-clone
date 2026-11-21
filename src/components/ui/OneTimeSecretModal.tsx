import { AlertTriangle, Check, Copy, KeyRound, X } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button';

export function OneTimeSecretModal({
  title,
  secretLabel,
  secretValue,
  warning,
  extraInfo,
  onClose,
}: {
  title: string;
  secretLabel: string;
  secretValue: string;
  warning?: string;
  extraInfo?: React.ReactNode;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secretValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="secret-modal-title">
      <div className="w-full max-w-lg rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-muted)]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[var(--brand-primary)]" aria-hidden="true" />
            <h2 id="secret-modal-title" className="text-base font-semibold text-[var(--fg-default)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close secret dialog"
            className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2.5 rounded-md border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-subtle)] p-3 text-xs text-[var(--fg-default)]">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {warning ?? 'This secret is displayed only once. Copy and store it securely now—you will not be able to retrieve it again.'}
            </span>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1.5">{secretLabel}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-mono text-[var(--fg-default)] break-all select-all">
                {secretValue}
              </code>
              <Button variant="primary" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>
          {extraInfo}
        </div>
        <div className="px-5 py-3 bg-[var(--bg-subtle)] border-t border-[var(--border-muted)] flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            I have saved this secret
          </Button>
        </div>
      </div>
    </div>
  );
}
