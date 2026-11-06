import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The fixed set of semantic tones every CRM status badge picks from — see
 * the `--status-*` tokens in app/globals.css for the underlying (WCAG-AA
 * checked) colors. Domain-specific status→tone maps (lead stage, deal
 * stage, order/return status, ...) live next to the status labels they
 * describe, colocated in each tab component.
 */
export type StatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-status-neutral/10 text-status-neutral dark:bg-status-neutral/20",
  info: "bg-status-info/10 text-status-info dark:bg-status-info/20",
  progress: "bg-status-progress/10 text-status-progress dark:bg-status-progress/20",
  warning: "bg-status-warning/10 text-status-warning dark:bg-status-warning/20",
  success: "bg-status-success/10 text-status-success dark:bg-status-success/20",
  danger: "bg-status-danger/10 text-status-danger dark:bg-status-danger/20",
};

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent text-[10px]", TONE_CLASS[tone], className)}>
      {label}
    </Badge>
  );
}
