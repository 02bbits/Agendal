/** A stack of requests waiting behind an hourglass: flat, in the theme's greys (UX-43). */
export function RateLimitIllustration() {
  return (
    <svg
      viewBox="0 0 240 168"
      width="200"
      height="140"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="120" cy="90" r="72" fill="var(--color-fill)" />
      <circle cx="30" cy="40" r="3" fill="var(--color-ink-tertiary)" />
      <circle cx="212" cy="32" r="4" fill="var(--color-ink-tertiary)" />
      <circle cx="222" cy="142" r="3" fill="var(--color-ink-tertiary)" />
      <circle cx="22" cy="134" r="4" fill="var(--color-ink-tertiary)" />

      {/* The requests, piled up */}
      <g fill="var(--color-surface-elevated)" strokeWidth="2">
        <rect
          x="46"
          y="62"
          width="92"
          height="64"
          rx="10"
          stroke="var(--color-separator)"
          transform="rotate(-9 92 94)"
        />
        <rect
          x="52"
          y="56"
          width="92"
          height="64"
          rx="10"
          stroke="var(--color-separator)"
          transform="rotate(-4 98 88)"
        />
        <rect
          x="58"
          y="50"
          width="92"
          height="64"
          rx="10"
          stroke="var(--color-ink-tertiary)"
        />
      </g>
      <path
        d="M72 70h52M72 84h64M72 98h40"
        stroke="var(--color-ink-tertiary)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* The hourglass, in front */}
      <rect
        x="146"
        y="58"
        width="52"
        height="8"
        rx="4"
        fill="var(--color-ink)"
      />
      <rect
        x="146"
        y="134"
        width="52"
        height="8"
        rx="4"
        fill="var(--color-ink)"
      />
      <path
        d="M154 66h36c0 18-12 24-14 34 2 10 14 16 14 34h-36c0-18 12-24 14-34-2-10-14-16-14-34z"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M160 74h24c-2 9-8 13-12 18-4-5-10-9-12-18z"
        fill="var(--color-ink-secondary)"
      />
      <path
        d="M172 100v20"
        stroke="var(--color-ink-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M158 132c2-8 8-12 14-12s12 4 14 12z"
        fill="var(--color-ink-secondary)"
      />
    </svg>
  );
}
