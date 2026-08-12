import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Alert({ type = "error", children }) {
  if (!children) return null;
  const ok = type === "success";
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs leading-snug ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      role="alert"
    >
      {ok ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}
