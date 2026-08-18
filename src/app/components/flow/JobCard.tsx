import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import type { FlowJobSummary } from "../../services/flowBridge";

export function scoreClass(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

interface JobCardProps {
  job: FlowJobSummary;
  onClick: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const { t } = useTranslation();
  const reviewed = job.label === "reviewed";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded border border-border p-3 text-left hover:bg-accent/50 transition-colors"
    >
      <div className="min-w-0 flex items-center gap-2">
        {reviewed && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label={t("flow.reviewed")} />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{job.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {job.company} · {job.location}
            {job.is_remote ? ` · ${t("flow.remote")}` : ""}
          </p>
        </div>
      </div>
      {job.score > 0 && (
        <span className={`text-sm font-semibold shrink-0 ${scoreClass(job.score)}`}>
          {Math.round(job.score)}%
        </span>
      )}
    </button>
  );
}
