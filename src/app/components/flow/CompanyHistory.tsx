import { useTranslation } from "react-i18next";
import type { FlowCompanyApplication } from "../../services/flowBridge";

const day = (iso: string) => new Date(iso).toLocaleDateString();

/** Earlier applications to a job's company (Flow, newest first). Information
 * only: Flow never blocks a job because of them (Profile-Management-Spec P11).
 * `compact` is one line of plain text, for use inside clickable cards. */
export function CompanyHistory({
  company,
  history,
  compact = false,
}: {
  company: string;
  history?: FlowCompanyApplication[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!history?.length) return null;
  const [latest] = history;
  if (compact) {
    return (
      <p className="text-[11px] text-amber-700 dark:text-amber-400 truncate">
        {t("flow.appliedOn", { company, date: day(latest!.applied_at) })}
        {history.length > 1 ? ` (+${history.length - 1})` : ""}
      </p>
    );
  }
  return (
    <ul className="text-xs space-y-0.5 text-amber-700 dark:text-amber-400">
      {history.map((a, i) => (
        <li key={`${a.applied_at}-${i}`}>
          {t("flow.appliedOn", { company, date: day(a.applied_at) })}
          {" · "}
          {a.job_url ? (
            <a href={a.job_url} target="_blank" rel="noreferrer" className="underline">{a.title}</a>
          ) : (
            a.title
          )}
          {a.outcome && a.outcome !== "pending" ? ` · ${t(`flow.outcome_${a.outcome}`, a.outcome)}` : ""}
        </li>
      ))}
    </ul>
  );
}
