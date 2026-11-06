import { Badge } from "@/components/ui/badge";
import type { BusinessStatus } from "@/types/database";

const STATUS_MAP: Record<
  BusinessStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "טיוטה", variant: "outline" },
  generating: { label: "בבנייה…", variant: "secondary" },
  ready: { label: "מוכן", variant: "default" },
  archived: { label: "בארכיון", variant: "outline" },
};

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const { label, variant } = STATUS_MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
