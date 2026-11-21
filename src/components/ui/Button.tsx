import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs min-h-[32px]',
    md: 'px-4 py-2 text-sm min-h-[38px]',
  };

  const variants = {
    primary:
      'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--fg-on-emphasis)] border-[color-mix(in_srgb,var(--fg-default)_12%,transparent)]',
    secondary:
      'bg-[var(--bg-subtle)] hover:bg-[var(--border-muted)] text-[var(--fg-default)] border-[var(--border-default)]',
    danger:
      'bg-[var(--danger)] hover:opacity-90 text-white border-transparent',
    ghost:
      'bg-transparent hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg-default)] border-transparent',
  };

  return (
    <button
      type={props.type ?? 'button'}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
