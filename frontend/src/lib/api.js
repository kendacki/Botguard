const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export const DEMO_API_KEY = "demo-issuer-key";

export async function api(path, options = {}) {
  const { headers, ...rest } = options;
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
    });
  } catch {
    throw new Error("API unreachable. Start the BOTGUARD server on port 8080.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function checkWalletStatus({ wallet, minTier = "RETAIL", jurisdiction, apiBaseUrl = API }) {
  if (!wallet) throw new Error("wallet is required");
  const params = new URLSearchParams({ minTier });
  if (jurisdiction) params.set("jurisdiction", jurisdiction);
  const response = await fetch(`${apiBaseUrl}/status/${wallet}?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Verification status check failed (${response.status})`);
  }
  return data;
}

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
