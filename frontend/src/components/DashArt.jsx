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

export function SparkStar({ className = "inline-block h-5 w-5 text-[#FF5A5F]" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 0.6l1.7 6.4L18.4 9 11.7 11 10 17.4 8.3 11 1.6 9l6.7-2Z" />
    </svg>
  );
}

export function ContactlessIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 8.2c2.2 2.2 2.2 5.4 0 7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11.2 5.8c3.6 3.6 3.6 8.8 0 12.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.4 3.4c5 5 5 12.2 0 17.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function BrandRings({ className = "h-8 w-11" }) {
  return (
    <svg viewBox="0 0 44 28" className={className} aria-hidden="true">
      <circle cx="16" cy="14" r="12" fill="#8A3FFC" opacity="0.35" />
      <circle cx="28" cy="14" r="12" fill="#5B21B6" opacity="0.55" />
    </svg>
  );
}

export function SparkUp({ className = "h-6 w-12" }) {
  return (
    <svg viewBox="0 0 48 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 18l10-6 8 4 12-10 14 6" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function SparkDown({ className = "h-6 w-12" }) {
  return (
    <svg viewBox="0 0 48 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 6l10 6 8-3 12 9 14-4" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function MiniBars({ className = "h-8 w-12" }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden="true">
      <rect x="2" y="16" width="7" height="14" rx="2" fill="#C4A6FF" />
      <rect x="14" y="10" width="7" height="20" rx="2" fill="#8A3FFC" />
      <rect x="26" y="4" width="7" height="26" rx="2" fill="#5B21B6" />
      <rect x="38" y="12" width="7" height="18" rx="2" fill="#8A3FFC" opacity="0.55" />
    </svg>
  );
}

export function MiniPie({ className = "h-10 w-10" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="#F3E8FF" />
      <path d="M20 4a16 16 0 0 1 13.8 8L20 20Z" fill="#FF5A5F" />
      <path d="M20 20 L33.8 12 A16 16 0 1 1 20 4Z" fill="#8A3FFC" />
    </svg>
  );
}

export function WavePattern() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 140" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 90c40-28 70 22 120 4s70-40 120-8 70 30 120 8v46H0V90Z" fill="white" opacity="0.08" />
      <path d="M0 108c50-18 80 16 130 2s80-28 130-4 70 20 100 6v28H0v-32Z" fill="white" opacity="0.06" />
    </svg>
  );
}

export function ActMark({ kind = "fee", className = "h-9 w-9" }) {
  const tones = {
    fee: { fill: "#F3E8FF", ink: PURPLE },
    mint: { fill: "#ECFDF5", ink: "#16A34A" },
    nft: { fill: "#FFE8E8", ink: "#FF5A5F" },
    start: { fill: "#F7F6F3", ink: PURPLE },
  };
  const { fill, ink } = tones[kind] || tones.fee;
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="10" fill={fill} />
      {kind === "mint" ? (
        <path
          d="M12 18.2l4.2 4.2 8-8.4"
          stroke={ink}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : kind === "nft" ? (
        <path d="M18 8.5l1.6 5.8L26 16l-6.4 1.8L18 23.5l-1.6-5.7L10 16l6.4-1.7Z" fill={ink} />
      ) : (
        <>
          <rect x="10" y="13" width="16" height="12" rx="2.5" stroke={ink} strokeWidth="1.8" />
          <path d="M13 13.2v-1.4A5 5 0 0 1 23 12v1.2" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function ProgressGauge({ percent = 12, className = "h-[132px] w-full" }) {
  const p = Math.max(0, Math.min(100, percent));
  const r = 70;
  const circ = Math.PI * r;
  const dash = (p / 100) * circ;
  return (
    <svg viewBox="0 0 200 124" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bgPassGauge" x1="20" y1="100" x2="180" y2="100">
          <stop stopColor="#8A3FFC" />
          <stop offset="1" stopColor="#FF5A5F" />
        </linearGradient>
      </defs>
      <path
        d="M 30 108 A 70 70 0 0 1 170 108"
        fill="none"
        stroke="#EEEAF6"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 30 108 A 70 70 0 0 1 170 108"
        fill="none"
        stroke="url(#bgPassGauge)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
      />
    </svg>
  );
}
