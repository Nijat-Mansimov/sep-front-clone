import React, { useMemo } from 'react';
import { renderSafeMarkdown } from '../../utils/markdown';

export function MarkdownView({ content, className = '' }: { content: string; className?: string }) {
  const sanitizedHtml = useMemo(() => renderSafeMarkdown(content), [content]);
  return (
    <div
      className={`sep-prose text-sm text-[var(--fg-default)] ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
