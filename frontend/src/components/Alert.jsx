import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Alert({ type = "error", children }) {
  if (!children) return null;
  const ok = type === "success";
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-btn border px-3 py-2.5 text-sm ${
        ok
          ? "border-ok/40 bg-ok/10 text-ok"
          : "border-danger/40 bg-danger/10 text-red-300"
      }`}
      role="alert"
    >
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
