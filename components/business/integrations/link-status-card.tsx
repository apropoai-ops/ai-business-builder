import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { IntegrationCard, StatusBadge } from "@/components/business/integrations/integration-card";

/**
 * Read-only status card for integrations that are configured on another page
 * (סליקה → /store, WhatsApp → /whatsapp) or are server-side-only (פוש,
 * CAPTCHA — "built in" once the relevant env vars are set, no per-business
 * UI needed) or explanatory (יומן — points at an existing feature).
 */
export function LinkStatusCard({
  icon,
  title,
  subtitle,
  status,
  hint,
  href,
  linkLabel,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  status: "connected" | "not-connected" | "builtin";
  hint?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <IntegrationCard
      icon={icon}
      title={title}
      subtitle={subtitle}
      status={<StatusBadge status={status} />}
    >
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {href && (
        <ButtonLink href={href} variant="outline" size="sm" className="w-fit gap-1.5">
          {linkLabel ?? "מעבר להגדרה"}
          <ArrowLeft className="size-3.5" />
        </ButtonLink>
      )}
    </IntegrationCard>
  );
}
