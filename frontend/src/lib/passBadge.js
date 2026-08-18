/** Unique compact BGV badge SVG for dashboard + wallet-style preview. */

function byteAt(hex, i) {
  return Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
}

function shortWallet(account) {
  if (!account || !/^0x[a-fA-F0-9]{40}$/i.test(account)) return "0x————";
  return `0x${account.slice(2, 6)}..${account.slice(-4)}`;
}

function expLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `Exp ${mm}/${yy}`;
}

export function passBadgeSvg({ account, tier, jurisdiction, expiresAt } = {}) {
  const hex = String(account || "0x0")
    .toLowerCase()
    .replace(/^0x/, "")
    .padEnd(40, "0");
  const x1 = 28 + (byteAt(hex, 0) % 200);
  const y1 = 18 + (byteAt(hex, 1) % 70);
  const r1 = 42 + (byteAt(hex, 2) % 70);
  const x2 = 160 + (byteAt(hex, 3) % 160);
  const y2 = 210 + (byteAt(hex, 4) % 90);
  const r2 = 28 + (byteAt(hex, 5) % 56);
  const x3 = 24 + (byteAt(hex, 6) % 250);
  const y3 = 268 + (byteAt(hex, 7) % 56);
  const title = String(tier || "Pass");
  const region = String(jurisdiction || "—");
  const extra = expLabel(expiresAt);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360">
  <rect width="360" height="360" rx="32" fill="#8A3FFC"/>
  <circle cx="${x1}" cy="${y1}" r="${r1}" fill="#C4A6FF" opacity="0.38"/>
  <circle cx="${x2}" cy="${y2}" r="${r2}" fill="#5B21B6" opacity="0.28"/>
  <circle cx="${x3}" cy="${y3}" r="18" fill="#FF5A5F" opacity="0.55"/>
  <rect x="26" y="26" width="308" height="308" rx="24" fill="#F7F6F3"/>
  <circle cx="180" cy="132" r="46" fill="#8A3FFC"/>
  <circle cx="180" cy="132" r="26" fill="#F7F6F3"/>
  <path d="M180 116v16l11 7" fill="none" stroke="#8A3FFC" stroke-width="4" stroke-linecap="round"/>
  <text x="180" y="208" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" letter-spacing="2" fill="#8A3FFC">BOTGUARD</text>
  <text x="180" y="244" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#1A1A1A">${title}</text>
  <text x="180" y="270" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#6B6B6B">${region} · BGV</text>
  <text x="180" y="302" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#8A3FFC">${shortWallet(account)}${extra ? ` · ${extra}` : ""}</text>
</svg>`;
}

export function passBadgeDataUrl(opts) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(passBadgeSvg(opts))}`;
}
