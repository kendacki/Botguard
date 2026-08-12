require("dotenv").config();

const API_URL = process.env.API_URL || "http://localhost:8080";
const MONITOR_TOKEN = process.env.MONITOR_TOKEN || "demo-monitor-token";
const POLL_MS = Number(process.env.MONITOR_POLL_MS || 5000);

async function postFlag(flag) {
  const res = await fetch(`${API_URL}/monitor/flags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Monitor-Token": MONITOR_TOKEN,
    },
    body: JSON.stringify(flag),
  });
  const body = await res.json();
  console.log("[monitor] flag result", body.action, flag.ruleId, flag.holderAddress);
  return body;
}

async function evaluateSynthetic() {
  // Demo loop: quiet by default. Set MONITOR_DEMO=1 to emit sample anomalies.
  if (process.env.MONITOR_DEMO !== "1") return;
  const holder = process.env.MONITOR_DEMO_HOLDER || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  await postFlag({
    holderAddress: holder,
    ruleId: "VELOCITY_ANOMALY",
    severity: "HIGH",
    detail: { amount_usd: 300000, window_seconds: 90 },
  });
  await postFlag({
    holderAddress: holder,
    ruleId: "SANCTION_HIT",
    severity: "HIGH",
    detail: { list: "demo" },
  });
}

async function loop() {
  console.log("[monitor] agent online");
  while (true) {
    try {
      await evaluateSynthetic();
    } catch (err) {
      console.error("[monitor] error", err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop();
