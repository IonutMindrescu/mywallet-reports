import { useId } from 'react';

/**
 * Animated MyWallet mark: a wallet tile whose bars grow, a trend line draws itself
 * and ends in a pulsing "live" dot, with a periodic glass shine. Pure SVG + CSS,
 * respects prefers-reduced-motion. Hover lifts the tile and makes the line glow.
 */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (s: string) => `${raw}-${s}`;
  return (
    <svg
      className={`mw-logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="MyWallet Reports"
    >
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('shine')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('line')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <clipPath id={id('clip')}>
          <rect x="2" y="2" width="60" height="60" rx="18" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id('clip')})`}>
        {/* tile: gradient that slowly swirls */}
        <g className="mw-swirl">
          <rect x="-20" y="-20" width="104" height="104" fill={`url(#${id('bg')})`} />
        </g>
        <rect x="2" y="2" width="60" height="60" fill={`url(#${id('glow')})`} />

        {/* bars rising out of the wallet */}
        <rect className="mw-bar mw-bar1" x="13" y="33" width="7" height="14" rx="2.2" fill="#fff" fillOpacity="0.42" />
        <rect className="mw-bar mw-bar2" x="23.5" y="27" width="7" height="20" rx="2.2" fill="#fff" fillOpacity="0.42" />
        <rect className="mw-bar mw-bar3" x="34" y="21" width="7" height="26" rx="2.2" fill="#fff" fillOpacity="0.42" />

        {/* wallet pocket + clasp */}
        <g className="mw-pocket">
          <path d="M7 46 Q7 41 12 41 H52 Q57 41 57 46 V64 H7 Z" fill="#1e1b4b" fillOpacity="0.38" />
          <path d="M7 46 Q7 41 12 41 H52 Q57 41 57 46" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.6" />
          <rect x="41" y="47" width="16" height="10" rx="5" fill="#fff" fillOpacity="0.22" />
          <circle cx="47" cy="52" r="2.4" fill="#fff" fillOpacity="0.9" />
        </g>

        {/* shine sweep */}
        <g transform="rotate(20 32 32)">
          <rect className="mw-shine" x="-40" y="-10" width="22" height="84" fill={`url(#${id('shine')})`} />
        </g>
      </g>

      {/* trend line */}
      <path
        className="mw-line"
        d="M11 33 L21.5 23 L30 28 L46 12"
        pathLength={100}
        fill="none"
        stroke={`url(#${id('line')})`}
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="mw-ring" cx="46" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle className="mw-dot" cx="46" cy="12" r="3.6" fill="#fff" />

      {/* sparkle */}
      <path
        className="mw-spark"
        d="M15 9 Q15.6 12.4 19 13 Q15.6 13.6 15 17 Q14.4 13.6 11 13 Q14.4 12.4 15 9 Z"
        fill="#fff"
      />
    </svg>
  );
}
