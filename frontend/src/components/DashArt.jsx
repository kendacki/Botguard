const PURPLE = "#8A3FFC";
const LILAC = "#C4A6FF";
const PAGE = "#F7F6F3";
const INK = "#1A1A1A";

function Frame({ children, className = "" }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function ArtIdle({ className = "h-full w-full" }) {
  return (
    <Frame className={className}>
      <rect x="18" y="28" width="124" height="108" rx="28" fill={PURPLE} opacity="0.08" />
      <rect x="36" y="44" width="88" height="76" rx="22" fill={PURPLE} opacity="0.14" />
      <circle cx="80" cy="78" r="34" fill={PURPLE} />
      <circle cx="80" cy="78" r="22" fill={PAGE} />
      <path d="M80 62v16l10 6" stroke={PURPLE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="122" cy="46" r="8" fill={LILAC} />
      <circle cx="38" cy="112" r="5" fill={LILAC} />
    </Frame>
  );
}

export function ArtLive({ className = "h-full w-full" }) {
  return (
    <Frame className={className}>
      <rect x="22" y="22" width="116" height="116" rx="32" fill="white" opacity="0.16" />
      <rect x="38" y="38" width="84" height="84" rx="22" fill="white" opacity="0.22" />
      <path
        d="M56 80.5l14 14 34-36"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function ArtStatus({ className = "h-[88px] w-[88px]" }) {
  return (
    <Frame className={className}>
      <rect x="20" y="24" width="120" height="112" rx="26" fill={PURPLE} opacity="0.1" />
      <rect x="36" y="40" width="88" height="18" rx="9" fill={PURPLE} opacity="0.2" />
      <rect x="36" y="68" width="64" height="14" rx="7" fill={PURPLE} opacity="0.16" />
      <rect x="36" y="90" width="76" height="14" rx="7" fill={PURPLE} opacity="0.12" />
      <circle cx="116" cy="47" r="8" fill={PURPLE} />
      <path d="M112.5 47.2l3 3 6-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </Frame>
  );
}

export function ArtHelp({ className = "h-[88px] w-[88px]" }) {
  return (
    <Frame className={className}>
      <circle cx="80" cy="80" r="54" fill={PURPLE} opacity="0.1" />
      <circle cx="80" cy="80" r="36" fill={PURPLE} />
      <path
        d="M68 72c0-8 6-14 12-14s12 5 12 12c0 7-6 9-9 12-2 2-3 4-3 8"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="80" cy="108" r="4" fill="white" />
    </Frame>
  );
}

export function ArtShieldMini({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill={PURPLE} opacity="0.12" />
      <path
        d="M16 6.5l8 3.2v6.4c0 5.2-3.4 9.8-8 11.4-4.6-1.6-8-6.2-8-11.4V9.7L16 6.5Z"
        fill={PURPLE}
      />
      <path d="M12.5 16.1l2.6 2.6 4.8-5.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
