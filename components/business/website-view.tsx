"use client";

import { useTransition } from "react";
import {
  Globe, RefreshCw, Loader2,
  Home, Info, Briefcase, Phone, HelpCircle, Search,
  ArrowLeft, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { regenerateWebsiteAction } from "@/lib/actions/website";
import type { WebsiteData } from "@/lib/ai/schemas/website";
import type { Website } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type Props = { businessId: string; website: Website };

export function WebsiteView({ businessId, website }: Props) {
  const [isRegen, startRegen] = useTransition();

  const home = website.page_home as WebsiteData["home"] | null;
  const about = website.page_about as WebsiteData["about"] | null;
  const services = website.page_services as WebsiteData["services"] | null;
  const contact = website.page_contact as WebsiteData["contact"] | null;
  const faq = website.page_faq as WebsiteData["faq"] | null;
  const seo = website.seo_meta as WebsiteData["seoMeta"] | null;

  function regenerate() {
    startRegen(async () => {
      const res = await regenerateWebsiteAction(businessId);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="size-4 text-primary" />
          תוכן האתר נוצר על ידי AI — ניתן לעריכה
        </div>
        <Button variant="outline" size="sm" onClick={regenerate} disabled={isRegen}>
          {isRegen ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          ייצור מחדש
        </Button>
      </div>

      {/* SEO summary strip */}
      {seo && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
              <Search className="size-4" /> SEO
            </div>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">כותרת: </span>{seo.title}</div>
              <div><span className="font-medium">תיאור: </span>{seo.description}</div>
              <div className="flex flex-wrap gap-1 pt-1">
                {seo.keywords.map((k, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pages tabs */}
      <Tabs defaultValue="home" dir="rtl">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="home" className="gap-1.5"><Home className="size-3.5" />בית</TabsTrigger>
          <TabsTrigger value="about" className="gap-1.5"><Info className="size-3.5" />אודות</TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5"><Briefcase className="size-3.5" />שירותים</TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5"><Phone className="size-3.5" />קשר</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="size-3.5" />FAQ</TabsTrigger>
        </TabsList>

        {/* Home */}
        <TabsContent value="home">
          {home && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <PageSection title="Hero">
                  <h2 className="text-2xl font-bold">{home.hero.headline}</h2>
                  <p className="text-muted-foreground">{home.hero.subheadline}</p>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                    {home.hero.cta.text} <ArrowLeft className="size-3.5" />
                  </div>
                </PageSection>
                <Separator />
                <PageSection title="יתרונות">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {home.benefits.map((b, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="font-medium mb-1">{b.title}</div>
                        <p className="text-sm text-muted-foreground">{b.description}</p>
                      </div>
                    ))}
                  </div>
                </PageSection>
                <Separator />
                <PageSection title="אמינות">
                  <p className="text-sm text-muted-foreground italic">&ldquo;{home.socialProof}&rdquo;</p>
                </PageSection>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* About */}
        <TabsContent value="about">
          {about && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <PageSection title="כותרת">
                  <h2 className="text-2xl font-bold">{about.headline}</h2>
                </PageSection>
                <Separator />
                <PageSection title="סיפור העסק">
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{about.story}</p>
                </PageSection>
                <Separator />
                <PageSection title="ערכי ליבה">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {about.values.map((v, i) => (
                      <div key={i} className="rounded-lg border p-4">
                        <div className="font-medium mb-1">{v.title}</div>
                        <p className="text-sm text-muted-foreground">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </PageSection>
                <Separator />
                <PageSection title="הצוות">
                  <p className="text-sm text-muted-foreground">{about.teamNote}</p>
                </PageSection>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Services */}
        <TabsContent value="services">
          {services && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <PageSection title="כותרת">
                  <h2 className="text-2xl font-bold">{services.headline}</h2>
                  <p className="text-muted-foreground">{services.intro}</p>
                </PageSection>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  {services.items.map((s, i) => (
                    <div key={i} className="rounded-lg border p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold">{s.name}</h3>
                        {s.price && (
                          <span className="text-sm font-medium text-primary">{s.price}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{s.description}</p>
                      <ul className="space-y-1">
                        {s.features.map((f, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact">
          {contact && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <PageSection title="כותרת">
                  <h2 className="text-2xl font-bold">{contact.headline}</h2>
                  <p className="text-muted-foreground">{contact.intro}</p>
                </PageSection>
                <Separator />
                <PageSection title="שדות הטופס">
                  <div className="flex flex-wrap gap-2">
                    {(contact.formFields ?? []).map((f, i) => (
                      <Badge key={i} variant="outline">{f}</Badge>
                    ))}
                  </div>
                </PageSection>
                <Separator />
                <PageSection title="זמן מענה">
                  <p className="text-sm text-muted-foreground">{contact.responseTime}</p>
                </PageSection>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq">
          {faq && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h2 className="text-2xl font-bold">{faq.headline}</h2>
                <div className="space-y-3">
                  {faq.items.map((item, i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <div className="font-medium mb-1">{item.question}</div>
                      <p className="text-sm text-muted-foreground">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PageSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
