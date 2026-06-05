import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { AppError } from "../../utils/errors";

interface BuilderErrorDisplayProps {
  error: string | null;
  retryableError: AppError | null;
  onRetry: () => void;
}

export function BuilderErrorDisplay({ error, retryableError, onRetry }: BuilderErrorDisplayProps) {
  if (!error) return null;

  return (
    <Card className="p-3 mb-4 text-sm border-destructive/50 bg-destructive/5">
      <div className="flex items-start gap-2">
        <pre className="whitespace-pre-wrap font-sans text-destructive flex-1">{error}</pre>
        {retryableError && (
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </div>
    </Card>
  );
}
