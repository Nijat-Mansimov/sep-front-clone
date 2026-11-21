import React from 'react';

export function SepShieldMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 2.5L4.5 7.2V15.4C4.5 22.4 9.4 28.4 16 30C22.6 28.4 27.5 22.4 27.5 15.4V7.2L16 2.5Z"
        fill="var(--brand-primary-subtle)"
        stroke="var(--brand-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 15.8L14.6 18.9L20.8 12.2"
        stroke="var(--brand-primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
