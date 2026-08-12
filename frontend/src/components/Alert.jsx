import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Alert({ type = "error", children }) {
  if (!children) return null;
  const ok = type === "success";
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-btn border px-3 py-2.5 text-sm backdrop-blur-md ${
        ok
          ? "border-ok/30 bg-ok/10 text-ok"
          : "border-danger/30 bg-danger/10 text-danger"
      }`}
      role="alert"
    >
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
