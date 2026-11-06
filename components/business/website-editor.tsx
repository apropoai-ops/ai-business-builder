"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateWebsiteContentAction } from "@/lib/actions/website";
import type { WebsiteData } from "@/lib/ai/schemas/website";
import type { Website } from "@/types/database";

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {rows ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function WebsiteEditor({
  businessId,
  website,
}: {
  businessId: string;
  website: Website;
}) {
  // Defensive defaults, not just a cast: a 'landing' site (lib/jobs/handlers/
  // website.ts) writes ONLY page_home/page_landing/seo_meta and leaves
  // page_about/page_services/page_contact/page_faq as their column default of
  // null — this editor used to be mounted for that mode too (website/page.tsx
  // now skips it there, see the comment on that call site) and crashed the
  // whole tab reading `null.headline`. Kept here as well so a future caller
  // can't reintroduce the same crash.
  const [data, setData] = useState<WebsiteData>(() => ({
    home: (website.page_home as WebsiteData["home"] | null) ?? {
      hero: { headline: "", subheadline: "", cta: { text: "", href: "" } },
      benefits: [],
      socialProof: "",
    },
    about: (website.page_about as WebsiteData["about"] | null) ?? {
      headline: "",
      story: "",
      values: [],
      teamNote: "",
    },
    services: (website.page_services as WebsiteData["services"] | null) ?? {
      headline: "",
      intro: "",
      items: [],
    },
    contact: (website.page_contact as WebsiteData["contact"] | null) ?? {
      headline: "",
      intro: "",
      formFields: [],
      responseTime: "",
    },
    faq: (website.page_faq as WebsiteData["faq"] | null) ?? { headline: "", items: [] },
    seoMeta: (website.seo_meta as WebsiteData["seoMeta"] | null) ?? {
      title: "",
      description: "",
      keywords: [],
    },
  }));
  const [isPending, startTransition] = useTransition();

  // Generic immutable updater: set(path-producing fn)
  function patch(updater: (d: WebsiteData) => WebsiteData) {
    setData((d) => updater(structuredClone(d)));
  }

  function save() {
    startTransition(async () => {
      const res = await updateWebsiteContentAction(businessId, data);
      if (res.error) toast.error(res.error);
      else toast.success("התוכן נשמר — האתר החי התעדכן ✓");
    });
  }

  const d = data;

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="home" dir="rtl">
        <TabsList className="grid w-full grid-cols-5 text-xs">
          <TabsTrigger value="home">בית</TabsTrigger>
          <TabsTrigger value="about">אודות</TabsTrigger>
          <TabsTrigger value="services">שירותים</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        {/* ── Home ── */}
        <TabsContent value="home" className="mt-4">
          <Card><CardContent className="space-y-3 py-4">
            <Field label="כותרת ראשית" value={d.home.hero.headline}
              onChange={(v) => patch((x) => { x.home.hero.headline = v; return x; })} />
            <Field label="תת-כותרת" value={d.home.hero.subheadline} rows={2}
              onChange={(v) => patch((x) => { x.home.hero.subheadline = v; return x; })} />
            <Field label="טקסט כפתור" value={d.home.hero.cta.text}
              onChange={(v) => patch((x) => { x.home.hero.cta.text = v; return x; })} />
            <Field label="משפט אמינות" value={d.home.socialProof} rows={2}
              onChange={(v) => patch((x) => { x.home.socialProof = v; return x; })} />

            <div className="text-sm font-semibold pt-2">יתרונות</div>
            {d.home.benefits.map((b, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input value={b.title} placeholder="כותרת"
                    onChange={(e) => patch((x) => { x.home.benefits[i].title = e.target.value; return x; })} />
                  <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => patch((x) => { x.home.benefits.splice(i, 1); return x; })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Textarea value={b.description} rows={2} placeholder="תיאור"
                  onChange={(e) => patch((x) => { x.home.benefits[i].description = e.target.value; return x; })} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => patch((x) => { x.home.benefits.push({ title: "", description: "" }); return x; })}>
              <Plus className="size-3.5" /> הוסף יתרון
            </Button>
          </CardContent></Card>
        </TabsContent>

        {/* ── About ── */}
        <TabsContent value="about" className="mt-4">
          <Card><CardContent className="space-y-3 py-4">
            <Field label="כותרת" value={d.about.headline}
              onChange={(v) => patch((x) => { x.about.headline = v; return x; })} />
            <Field label="הסיפור שלנו" value={d.about.story} rows={6}
              onChange={(v) => patch((x) => { x.about.story = v; return x; })} />
            <Field label="משפט על הצוות" value={d.about.teamNote} rows={2}
              onChange={(v) => patch((x) => { x.about.teamNote = v; return x; })} />

            <div className="text-sm font-semibold pt-2">ערכים</div>
            {d.about.values.map((val, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input value={val.title} placeholder="ערך"
                    onChange={(e) => patch((x) => { x.about.values[i].title = e.target.value; return x; })} />
                  <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => patch((x) => { x.about.values.splice(i, 1); return x; })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Textarea value={val.description} rows={2} placeholder="תיאור"
                  onChange={(e) => patch((x) => { x.about.values[i].description = e.target.value; return x; })} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => patch((x) => { x.about.values.push({ title: "", description: "" }); return x; })}>
              <Plus className="size-3.5" /> הוסף ערך
            </Button>
          </CardContent></Card>
        </TabsContent>

        {/* ── Services ── */}
        <TabsContent value="services" className="mt-4">
          <Card><CardContent className="space-y-3 py-4">
            <Field label="כותרת" value={d.services.headline}
              onChange={(v) => patch((x) => { x.services.headline = v; return x; })} />
            <Field label="משפט פתיחה" value={d.services.intro} rows={2}
              onChange={(v) => patch((x) => { x.services.intro = v; return x; })} />

            {d.services.items.map((s, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input value={s.name} placeholder="שם השירות"
                    onChange={(e) => patch((x) => { x.services.items[i].name = e.target.value; return x; })} />
                  <Input value={s.price ?? ""} placeholder="מחיר" className="w-32"
                    onChange={(e) => patch((x) => { x.services.items[i].price = e.target.value || null; return x; })} />
                  <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => patch((x) => { x.services.items.splice(i, 1); return x; })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Textarea value={s.description} rows={2} placeholder="תיאור"
                  onChange={(e) => patch((x) => { x.services.items[i].description = e.target.value; return x; })} />
                <Textarea
                  value={s.features.join("\n")}
                  rows={3}
                  placeholder="תכונות — אחת בכל שורה"
                  onChange={(e) =>
                    patch((x) => {
                      x.services.items[i].features = e.target.value.split("\n").filter((f) => f.trim());
                      return x;
                    })
                  }
                />
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => patch((x) => { x.services.items.push({ name: "", description: "", price: null, features: [] }); return x; })}>
              <Plus className="size-3.5" /> הוסף שירות
            </Button>
          </CardContent></Card>
        </TabsContent>

        {/* ── FAQ ── */}
        <TabsContent value="faq" className="mt-4">
          <Card><CardContent className="space-y-3 py-4">
            <Field label="כותרת" value={d.faq.headline}
              onChange={(v) => patch((x) => { x.faq.headline = v; return x; })} />
            {d.faq.items.map((q, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input value={q.question} placeholder="שאלה"
                    onChange={(e) => patch((x) => { x.faq.items[i].question = e.target.value; return x; })} />
                  <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => patch((x) => { x.faq.items.splice(i, 1); return x; })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Textarea value={q.answer} rows={2} placeholder="תשובה"
                  onChange={(e) => patch((x) => { x.faq.items[i].answer = e.target.value; return x; })} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => patch((x) => { x.faq.items.push({ question: "", answer: "" }); return x; })}>
              <Plus className="size-3.5" /> הוסף שאלה
            </Button>
          </CardContent></Card>
        </TabsContent>

        {/* ── SEO ── */}
        <TabsContent value="seo" className="mt-4">
          <Card><CardContent className="space-y-3 py-4">
            <Field label="כותרת SEO (עד 60 תווים)" value={d.seoMeta.title}
              onChange={(v) => patch((x) => { x.seoMeta.title = v; return x; })} />
            <Field label="תיאור מטא (עד 160 תווים)" value={d.seoMeta.description} rows={3}
              onChange={(v) => patch((x) => { x.seoMeta.description = v; return x; })} />
            <Field label="כותרת צור קשר" value={d.contact.headline}
              onChange={(v) => patch((x) => { x.contact.headline = v; return x; })} />
            <Field label="טקסט הזמנה ליצירת קשר" value={d.contact.intro} rows={2}
              onChange={(v) => patch((x) => { x.contact.intro = v; return x; })} />
            <Field label="זמן מענה מובטח" value={d.contact.responseTime}
              onChange={(v) => patch((x) => { x.contact.responseTime = v; return x; })} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Button onClick={save} disabled={isPending} className="gap-2 self-start">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        שמור שינויים (מעדכן את האתר החי)
      </Button>
    </div>
  );
}
