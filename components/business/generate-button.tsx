"use client";

import { useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { regenerateBusinessPlanAction } from "@/lib/actions/business";
import { Button } from "@/components/ui/button";

export function GenerateButton({ businessId }: { businessId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await regenerateBusinessPlanAction(businessId);
        })
      }
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      בנו תוכנית עסקית
    </Button>
  );
}
