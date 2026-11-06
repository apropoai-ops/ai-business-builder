import { notFound } from "next/navigation";
import { Eye, Palette, PencilLine, Wand2 } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getBrandAssets } from "@/lib/services/branding.service";
import { getWebsite } from "@/lib/services/website.service";
import { listGallery } from "@/lib/services/gallery.service";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebsiteView } from "@/components/business/website-view";
import { WebsiteWatcher } from "@/components/business/website-watcher";
import { WebsitePublishCard } from "@/components/business/website-publish-card";
import { WebsiteEditor } from "@/components/business/website-editor";
import { SiteModeCard } from "@/components/business/site-mode-card";
import { LandingSettingsManager } from "@/components/business/landing-settings-manager";
import { BrandingView } from "@/components/business/branding-view";
import { BrandingWatcher } from "@/components/business/branding-watcher";
import { BrandingEditor } from "@/components/business/branding-editor";
import { DesignStudio } from "@/components/business/design-studio";
import { BusinessGalleryCard } from "@/components/business/business-gallery-card";
import { HeroStylePicker } from "@/components/business/hero-style-picker";
import { HeroParticlesToggle } from "@/components/business/hero-particles-toggle";
import { SiteThemePicker } from "@/components/business/site-theme-picker";
import { DesignDirectorCard } from "@/components/business/design-director-card";
import { LayoutPicker } from "@/components/business/layout-picker";
import { resolveSiteMode } from "@/lib/site-mode";
import { getPlanForBusiness } from "@/lib/quota";
import { parseLandingSettings } from "@/lib/ai/schemas/landing";
import { pickBrandColor, type Palette as BrandPalette } from "@/lib/storefront-brand";

export const metadata = { title: "אתר ומיתוג" };

// The design studio renders AI hero images from a server action (~1 min at
// high quality) — inherited from the old branding page, which this screen
// absorbed. Without it the request is killed mid-generation.
export const maxDuration = 180;

/**
 * "אתר ומיתוג" — the merged screen.
 *
 * These used to be two separate nav items, which forced the owner to bounce
 * between them for one job: the hero style lived under מיתוג while the page it
 * restyles lived under אתר, and the logo was two clicks away from the site it
 * appears on. They are one workflow, so they are now one screen.
 */
export default async function WebsitePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const [website, assets, plan, gallery] = await Promise.all([
    getWebsite(businessId),
    getBrandAssets(businessId),
    getPlanForBusiness(businessId),
    listGallery(businessId),
  ]);

  // Branding is generated before the website in the pipeline, so it gates first.
  if (!assets?.generated_at) return <BrandingWatcher businessId={businessId} />;
  if (!website?.generated_at) return <WebsiteWatcher businessId={businessId} />;

  const brandHex = pickBrandColor(
    (assets.color_palette as BrandPalette | null) ?? null,
  );

  return (
    <div className="flex flex-col gap-4">
      <SiteModeCard siteMode={business.site_mode} planTier={plan.tier} />
      <WebsitePublishCard
        businessId={businessId}
        slug={website.slug}
        published={website.published}
      />
      {/* Countdown/video/gallery only exist on the landing renderer. */}
      {resolveSiteMode(business.site_mode) === "landing" && (
        <LandingSettingsManager
          businessId={businessId}
          settings={parseLandingSettings(website.landing_settings)}
        />
      )}

      <Tabs defaultValue="view" dir="rtl">
        <TabsList>
          <TabsTrigger value="view" className="gap-1.5">
            <Eye className="size-3.5" />
            תצוגה
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5">
            <PencilLine className="size-3.5" />
            תוכן
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-1.5">
            <Wand2 className="size-3.5" />
            עיצוב
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-1.5">
            <Palette className="size-3.5" />
            מיתוג
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="mt-4">
          <WebsiteView businessId={businessId} website={website} />
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          {/* A landing page has ONE fixed-section page (page_landing) —
              page_about/services/contact/faq are never populated for this
              mode (lib/jobs/handlers/website.ts) and never rendered
              (lib/site-mode.ts: landing has no extra routes). Editing and
              "saving" them here would write to columns nothing reads and used
              to crash this tab outright on the null story/services/etc — same
              landing-mode carve-out the design tab below already makes for
              SiteThemePicker. There is no field-level editor for page_landing
              itself yet, so the only lever here is the "יצירה מחדש" action on
              the תצוגה tab (components/business/website-view.tsx). */}
          {resolveSiteMode(business.site_mode) === "landing" ? (
            <p className="text-sm text-muted-foreground">
              דף הנחיתה הוא עמוד אחד קבוע. כדי לשנות את התוכן שלו — כותרת, טקסט
              ופרטים — עברו לכרטיסיית &quot;תצוגה&quot; ולחצו על &quot;יצירה מחדש&quot;.
            </p>
          ) : (
            <WebsiteEditor
              key={website.updated_at}
              businessId={businessId}
              website={website}
            />
          )}
        </TabsContent>

        <TabsContent value="design" className="mt-4 flex flex-col gap-4">
          {/* First, because it decides everything the cards below let you
              override one at a time. */}
          <DesignDirectorCard businessId={businessId} />
          <DesignStudio
            businessId={businessId}
            logoUrl={assets.logo_url}
            heroUrl={website.hero_image_url ?? null}
            brandHex={brandHex}
            defaultName={assets.brand_name ?? business.name ?? ""}
            defaultIndustry={business.industry ?? business.type ?? ""}
          />
          <BusinessGalleryCard
            businessId={businessId}
            images={gallery.map((item) => item.image_url)}
          />
          {/* Colour scheme — the ground the whole site paints on. Hidden in
              landing mode on purpose: a landing page renders its own white
              layout with no data-tier, so the scheme would change nothing and
              the control would be a dead end. */}
          {resolveSiteMode(business.site_mode) !== "landing" && (
            <SiteThemePicker
              businessId={businessId}
              brandHex={brandHex}
              current={website.theme}
            />
          )}
          <HeroStylePicker
            businessId={businessId}
            brandHex={brandHex}
            current={website.hero_style}
          />
          <HeroParticlesToggle
            businessId={businessId}
            enabled={website.hero_particles_enabled}
          />
          <LayoutPicker
            businessId={businessId}
            brandHex={brandHex}
            current={website.layout_style ?? "flow"}
          />
        </TabsContent>

        <TabsContent value="brand" className="mt-4 flex flex-col gap-4">
          <BrandingView businessId={businessId} assets={assets} />
          <BrandingEditor
            key={assets.updated_at}
            businessId={businessId}
            assets={assets}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
