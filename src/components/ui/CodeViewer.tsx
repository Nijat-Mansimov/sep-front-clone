import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';

export function CodeViewer({
  code,
  language,
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = (code || '').split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="border border-[var(--border-default)] rounded-md bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-muted)] text-xs text-[var(--fg-muted)]">
        <div className="flex items-center gap-2 font-mono">
          {title && <span className="font-medium text-[var(--fg-default)]">{title}</span>}
          {language && <span>{language}</span>}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-3 text-xs font-mono leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx}>
                <td className="select-none pr-4 text-right text-[var(--fg-muted)] w-8 align-top tabular-nums">
                  {idx + 1}
                </td>
                <td className="text-[var(--fg-default)] whitespace-pre">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
