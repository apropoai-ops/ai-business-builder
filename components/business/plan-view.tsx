"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Lightbulb,
  Boxes,
  Coins,
  UsersRound,
  Tag,
  Rocket,
  Pencil,
  Save,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  updateBusinessNarrativeAction,
  regenerateBusinessPlanAction,
} from "@/lib/actions/business";
import type { BusinessPlan } from "@/lib/ai/schemas/business-plan";
import type { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = { businessId: string; profile: BusinessProfile };

export function PlanView({ businessId, profile }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(profile.executive_summary ?? "");
  const [valueProp, setValueProp] = useState(profile.value_proposition ?? "");
  const [isSaving, startSave] = useTransition();
  const [isRegen, startRegen] = useTransition();

  const businessModel = profile.business_model as BusinessPlan["businessModel"] | null;
  const revenueStreams =
    (profile.revenue_streams as BusinessPlan["revenueStreams"] | null) ?? [];
  const customerSegments =
    (profile.customer_segments as BusinessPlan["customerSegments"] | null) ?? [];
  const pricing = profile.pricing_strategy as BusinessPlan["pricingStrategy"] | null;
  const launchPlan =
    (profile.launch_plan as BusinessPlan["launchPlan"] | null) ?? [];

  function save() {
    startSave(async () => {
      const res = await updateBusinessNarrativeAction(businessId, {
        executive_summary: summary,
        value_proposition: valueProp,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("התוכנית נשמרה");
        setEditing(false);
        router.refresh();
      }
    });
  }

  function cancel() {
    setSummary(profile.executive_summary ?? "");
    setValueProp(profile.value_proposition ?? "");
    setEditing(false);
  }

  function regenerate() {
    startRegen(async () => {
      await regenerateBusinessPlanAction(businessId);
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <>
            <Button variant="ghost" onClick={cancel} disabled={isSaving}>
              <X className="size-4" />
              ביטול
            </Button>
            <Button onClick={save} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              שמירה
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={regenerate}
              disabled={isRegen}
            >
              {isRegen ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              ייצור מחדש
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              עריכה
            </Button>
          </>
        )}
      </div>

      {/* Executive summary */}
      <Section icon={FileText} title="תקציר מנהלים">
        {editing ? (
          <Textarea
            rows={6}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">
            {profile.executive_summary || "—"}
          </p>
        )}
      </Section>

      {/* Value proposition */}
      <Section icon={Lightbulb} title="הצעת ערך">
        {editing ? (
          <Textarea
            rows={4}
            value={valueProp}
            onChange={(e) => setValueProp(e.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">
            {profile.value_proposition || "—"}
          </p>
        )}
      </Section>

      {/* Business model */}
      {businessModel && (
        <Section icon={Boxes} title="מודל עסקי">
          <p className="mb-4 leading-relaxed">{businessModel.description}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <ListBlock title="פעילויות מפתח" items={businessModel.keyActivities} />
            <ListBlock title="משאבי מפתח" items={businessModel.keyResources} />
            <ListBlock title="ערוצים" items={businessModel.channels} />
          </div>
        </Section>
      )}

      {/* Revenue streams */}
      {revenueStreams.length > 0 && (
        <Section icon={Coins} title="מקורות הכנסה">
          <div className="grid gap-3 sm:grid-cols-2">
            {revenueStreams.map((r, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="font-medium">{r.name}</div>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Customer segments */}
      {customerSegments.length > 0 && (
        <Section icon={UsersRound} title="פלחי לקוחות">
          <div className="grid gap-3 sm:grid-cols-2">
            {customerSegments.map((seg, i) => {
              // Backward compat: plans generated before the structured
              // segment schema stored only { name, description }.
              const c = seg as Partial<
                BusinessPlan["customerSegments"][number]
              > & { name: string; description?: string };
              const needs = Array.isArray(c.needs) ? c.needs : [];
              const channels = Array.isArray(c.channels) ? c.channels : [];
              return (
                <div key={i} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{c.name}</div>
                    {c.priority && (
                      <Badge
                        variant={
                          c.priority === "primary" ? "default" : "secondary"
                        }
                      >
                        {c.priority === "primary" ? "פלח ליבה" : "פלח משני"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.profile ?? c.description}
                  </p>
                  {needs.length > 0 && (
                    <div>
                      <div className="text-xs font-medium">צרכים מרכזיים</div>
                      <ul className="list-disc pe-5 text-sm text-muted-foreground">
                        {needs.map((n, j) => (
                          <li key={j}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.size && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">גודל משוער:</span> {c.size}
                    </p>
                  )}
                  {channels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {channels.map((ch, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Pricing */}
      {pricing && (
        <Section icon={Tag} title="אסטרטגיית תמחור">
          <p className="mb-3 text-sm text-muted-foreground">
            גישה: {pricing.model}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {pricing.tiers.map((t, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="font-medium">{t.name}</div>
                <div className="my-1 text-lg font-bold text-primary">
                  {t.price}
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Launch plan */}
      {launchPlan.length > 0 && (
        <Section icon={Rocket} title="תוכנית השקה">
          <ol className="space-y-3">
            {launchPlan.map((p, i) => (
              <li key={i} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary">שלב {i + 1}</Badge>
                  <span className="font-medium">{p.phase}</span>
                  <span className="text-xs text-muted-foreground">
                    · {p.durationWeeks} שבועות
                  </span>
                </div>
                <ul className="list-disc space-y-1 pe-5 text-sm text-muted-foreground">
                  {p.tasks.map((task, j) => (
                    <li key={j}>{task}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-primary" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{title}</div>
      <ul className="list-disc space-y-1 pe-5 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
