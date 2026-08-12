/**
 * JS port of monitoring/rules.py
 * AUTO_REVOKE requires two independent high-severity (severity >= 4) flags.
 */

function decideActionFromFlags(flags) {
  const list = Array.isArray(flags) ? flags : [];
  if (!list.length) return "NONE";

  const highSeverity = list.filter((f) => Number(f.severity) >= 4);
  if (highSeverity.length >= 2) return "AUTO_REVOKE";
  if (list.some((f) => f.recommendedAction === "ESCALATE")) return "ESCALATE";
  if (list.some((f) => f.recommendedAction === "HOLD")) return "HOLD";
  return "NONE";
}

module.exports = { decideActionFromFlags };
