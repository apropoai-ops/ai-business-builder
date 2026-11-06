import { Lock, Sparkles } from "lucide-react";

import { PLANS, type FeatureKey } from "@/lib/plans";
import { featureLabel, minTierFor } from "@/lib/entitlements";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * RTL Hebrew "upgrade required" card — drop this in place of a gated page's
 * content (or a section of it) when the business owner's plan doesn't
 * include the feature. Pass either a FeatureKey (looks up label + min tier
 * from lib/entitlements.ts) or explicit title/description for a custom copy.
 */
export function UpgradeGate({
  feature,
  title,
  description,
}: {
  feature: FeatureKey;
  title?: string;
  description?: string;
}) {
  const plan = PLANS[minTierFor(feature)];
  const label = featureLabel(feature);

  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardHeader className="items-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-5" />
        </div>
        <CardTitle className="mt-2 text-base">{title ?? label}</CardTitle>
        <CardDescription>
          {description ?? `התכונה הזו זמינה בחבילה ${plan.name} ומעלה.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        שדרגו את התוכנית כדי לפתוח את {label} ועוד יכולות מתקדמות.
      </CardContent>
      <CardFooter className="justify-center">
        <ButtonLink href="/pricing">
          <Sparkles className="size-3.5" />
          לשדרוג התוכנית
        </ButtonLink>
      </CardFooter>
    </Card>
  );
}
