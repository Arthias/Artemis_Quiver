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
  /** Narrower layout for grid columns (e.g. the Board tab) — stacks the score
   * under the title instead of beside it, since a 1/5-width column doesn't have
   * room for a side-by-side row without truncating the title too aggressively. */
  compact?: boolean;
  /** Show the LLM's "why this matched" summary line, when the job has one. */
  showSummary?: boolean;
  /** Highlights the card as new since the viewer's last visit to this list. */
  isNew?: boolean;
}

export function JobCard({ job, onClick, compact = false, showSummary = false, isNew = false }: JobCardProps) {
  const { t } = useTranslation();
  const reviewed = job.label === "reviewed";

  const scoreBadge = job.score > 0 && (
    <span className={`text-sm font-semibold shrink-0 ${scoreClass(job.score)}`}>
      {Math.round(job.score)}%
    </span>
  );

  const reasonBadge = job.archive_reason && (
    <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground shrink-0">
      {t(`flow.archiveReason_${job.archive_reason}`, job.archive_reason)}
    </span>
  );

  const newBadge = isNew && (
    <span className="text-[11px] rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 shrink-0 font-medium">
      {t("flow.newBadge")}
    </span>
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded border border-border p-2.5 text-left hover:bg-accent/50 transition-colors space-y-1"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {reviewed && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label={t("flow.reviewed")} />
          )}
          <p className="text-sm font-medium truncate flex-1 min-w-0">{job.title}</p>
        </div>
        <p className="text-xs text-muted-foreground truncate">{job.company}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate min-w-0">
            {job.location}
            {job.is_remote ? ` · ${t("flow.remote")}` : ""}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {newBadge}
            {reasonBadge}
            {scoreBadge}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-border p-3 text-left hover:bg-accent/50 transition-colors space-y-1"
    >
      <div className="flex items-center justify-between gap-3">
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
        <div className="flex items-center gap-1.5 shrink-0">
          {newBadge}
          {reasonBadge}
          {scoreBadge}
        </div>
      </div>
      {showSummary && job.summary && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">{job.summary}</p>
      )}
    </button>
  );
}
