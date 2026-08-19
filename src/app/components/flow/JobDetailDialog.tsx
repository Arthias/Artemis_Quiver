import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  getJob,
  updateJobStatus,
  updateJobLabel,
  type FlowJobDetail,
} from "../../services/flowBridge";
import { scoreClass } from "./JobCard";

const STATUS_OPTIONS = ["new", "applied", "interviewing", "offer", "rejected", "archived"] as const;

interface JobDetailDialogProps {
  jobId: string | null;
  flowBaseUrl: string;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

function formatSalary(job: FlowJobDetail): string {
  if (job.salary_min == null && job.salary_max == null) return "—";
  const c = job.salary_currency || "$";
  const r = job.salary_rate ? `/${job.salary_rate}` : "";
  if (job.salary_min && job.salary_max) return `${c}${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}${r}`;
  return `${c}${(job.salary_min ?? job.salary_max)?.toLocaleString()}${r}`;
}

export function JobDetailDialog({ jobId, flowBaseUrl, onOpenChange, onChanged }: JobDetailDialogProps) {
  const { t } = useTranslation();
  const [job, setJob] = useState<FlowJobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [labelUpdating, setLabelUpdating] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    setLoading(true);
    setError(null);
    getJob(flowBaseUrl, jobId)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [jobId, flowBaseUrl]);

  async function handleStatusChange(status: string) {
    if (!job || status === job.status) return;
    setStatusUpdating(true);
    try {
      await updateJobStatus(flowBaseUrl, job.id, status);
      setJob({ ...job, status });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleToggleReviewed() {
    if (!job) return;
    const nextLabel = job.label === "reviewed" ? "" : "reviewed";
    setLabelUpdating(true);
    try {
      await updateJobLabel(flowBaseUrl, job.id, nextLabel);
      setJob({ ...job, label: nextLabel });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLabelUpdating(false);
    }
  }

  let alternateSources: { board?: string; url?: string }[] = [];
  if (job?.alternate_sources) {
    try {
      alternateSources = JSON.parse(job.alternate_sources);
    } catch {
      alternateSources = [];
    }
  }

  return (
    <Dialog open={jobId !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job?.title || t("flow.jobDetail")}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {job && !loading && (
          <div className="space-y-4 text-sm">
            {job.status === "archived" && (
              <div className="flex items-center justify-between gap-3 rounded border border-border bg-muted/40 p-3">
                <div>
                  <p className="text-xs font-medium">
                    {t("flow.archived")}
                    {job.archive_reason && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {t(`flow.archiveReason_${job.archive_reason}`, job.archive_reason)}
                      </span>
                    )}
                  </p>
                  {job.archived_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.archived_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange("new")} disabled={statusUpdating}>
                  {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  {t("flow.restore")}
                </Button>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("flow.status")}</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={s === job.status ? "default" : "outline"}
                    disabled={statusUpdating || s === job.status}
                    onClick={() => handleStatusChange(s)}
                    className="capitalize"
                  >
                    {t(`flow.status_${s}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Button
                type="button"
                size="sm"
                variant={job.label === "reviewed" ? "default" : "outline"}
                onClick={handleToggleReviewed}
                disabled={labelUpdating}
              >
                {labelUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {job.label === "reviewed" ? t("flow.markUnreviewed") : t("flow.markReviewed")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded border border-border p-3">
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.company")}</span>
                <p>{job.company || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.location")}</span>
                <p>{job.location || "—"} {job.is_remote ? `(${t("flow.remote")})` : ""}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.source")}</span>
                <p>{job.source}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.jobType")}</span>
                <p>{job.job_type || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.salary")}</span>
                <p>{formatSalary(job)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.score")}</span>
                <p className={job.score > 0 ? scoreClass(job.score) : ""}>{job.score > 0 ? Math.round(job.score) : "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.posted")}</span>
                <p>{job.date_posted || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("flow.ingested")}</span>
                <p>{job.ingested_at || "—"}</p>
              </div>
            </div>

            {(job.fit_reasoning || job.summary) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("flow.scoreRationale")}</p>
                <div className="rounded bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                  {job.summary || job.fit_reasoning}
                </div>
                {job.rejection_category !== "NONE" && (
                  <p className="text-xs text-muted-foreground mt-1">{t("flow.rejectionCategory")}: {job.rejection_category}</p>
                )}
              </div>
            )}

            {job.job_url && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("flow.jobUrl")}</p>
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center gap-1"
                >
                  {job.job_url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("flow.description")}</p>
              <div className="rounded bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[320px] overflow-y-auto">
                {job.description || t("flow.noDescription")}
              </div>
            </div>

            {alternateSources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("flow.alsoSeenOn")}</p>
                <ul className="space-y-1">
                  {alternateSources.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      {s.board || t("flow.unknownBoard")}
                      {s.url && (
                        <>
                          {" — "}
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                            {s.url}
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
