import React from 'react';
import { cn } from "@/lib/utils"; // Renamed className to cn, standard shadcn convention
type ScoreBadgeProps = {
  score: number; // 0 to 100
};

/**
 * Displays the job match score with visual feedback.
 */
const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score }) => {
  let colorClass = 'text-muted-foreground';
  if (score > 90) {
    colorClass = 'text-green-500'; // Excellent fit
  } else if (score >= 70) {
    colorClass = 'text-yellow-500'; // Good fit
  } else if (score >= 40) {
    colorClass = 'text-orange-500'; // Marginal fit
  }

  return (
    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${cn("bg-secondary/70", "border-secondary")}`}>
      <span className={`${colorClass} mr-2`}>●</span>
      {Math.round(score)}%
    </div>
  );
};

export default ScoreBadge;

