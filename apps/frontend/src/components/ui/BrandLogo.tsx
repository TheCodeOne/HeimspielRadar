import * as React from 'react';

export interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = 'h-8 w-8' }: BrandLogoProps) {
  const uid = React.useId();

  const bgId = `brand-bg-${uid}`;
  const sweepId = `brand-sweep-${uid}`;
  const outerRingId = `brand-ring-${uid}`;
  const ballGradId = `brand-ball-${uid}`;
  const ballClipId = `brand-clip-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      data-testid="brand-logo"
      className={className}
    >
      <defs>
        <radialGradient id={bgId} cx="256" cy="256" r="280" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#172554" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={sweepId} x1="256" y1="256" x2="435" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
          <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={outerRingId} x1="60" y1="60" x2="452" y2="452" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={ballGradId} cx="215" cy="205" r="155" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="30%" stopColor="#f97316" />
          <stop offset="80%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>
        <clipPath id={ballClipId}>
          <circle cx="256" cy="256" r="112" />
        </clipPath>
      </defs>

      <rect width="512" height="512" rx="112" fill="#020617" />
      <rect width="512" height="512" rx="112" fill={`url(#${bgId})`} />
      <rect x="8" y="8" width="496" height="496" rx="104" stroke="#1e293b" strokeWidth="6" />

      <circle cx="256" cy="256" r="210" stroke={`url(#${outerRingId})`} strokeWidth="8" />
      <circle
        cx="256"
        cy="256"
        r="168"
        stroke="#38bdf8"
        strokeWidth="6"
        strokeDasharray="12 14"
        opacity="0.6"
      />

      <path d="M 256 256 L 256 46 A 210 210 0 0 1 446 166 Z" fill={`url(#${sweepId})`} />
      <line
        x1="256"
        y1="256"
        x2="446"
        y2="166"
        stroke="#38bdf8"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line
        x1="256"
        y1="256"
        x2="256"
        y2="46"
        stroke="#38bdf8"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.5"
      />

      <path
        d="M 122 180 A 152 152 0 0 1 180 122"
        stroke="#f97316"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M 390 332 A 152 152 0 0 1 332 390"
        stroke="#f97316"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M 180 390 A 152 152 0 0 1 122 332"
        stroke="#38bdf8"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.65"
      />

      <circle cx="256" cy="256" r="112" fill={`url(#${ballGradId})`} />
      <g
        clipPath={`url(#${ballClipId})`}
        stroke="#090d16"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      >
        <line x1="136" y1="256" x2="376" y2="256" />
        <line x1="256" y1="136" x2="256" y2="376" />
        <path d="M 160 160 C 216 200 216 312 160 352" />
        <path d="M 352 160 C 296 200 296 312 352 352" />
      </g>
      <circle cx="256" cy="256" r="112" stroke="#090d16" strokeWidth="12" />
      <circle cx="256" cy="256" r="118" stroke="#fb923c" strokeWidth="4" opacity="0.6" />

      <circle cx="366" cy="144" r="30" fill="#38bdf8" fillOpacity="0.22" />
      <path
        d="M 366 170 C 366 170 340 144 340 127 C 340 112.6 351.6 101 366 101 C 380.4 101 392 112.6 392 127 C 392 144 366 170 366 170 Z"
        fill="#38bdf8"
        stroke="#020617"
        strokeWidth="6"
      />
      <circle cx="366" cy="127" r="10" fill="#ffffff" />
    </svg>
  );
}
