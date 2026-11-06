import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listGallery } from "@/lib/services/gallery.service";
import { listTeam } from "@/lib/services/team.service";
import { listPricing } from "@/lib/services/pricing.service";
import { listEvents } from "@/lib/services/events.service";
import { listMenu } from "@/lib/services/menu.service";
import { listJobs } from "@/lib/services/jobs.service";
import { listBlog } from "@/lib/services/blog.service";
import { listFaqs } from "@/lib/services/faqs.service";
import { listTestimonials } from "@/lib/services/testimonials.service";
import { listGiftCards } from "@/lib/services/gift-cards.service";
import { listMemberships } from "@/lib/services/memberships.service";
import { listCourses } from "@/lib/services/courses.service";
import { listDownloads } from "@/lib/services/downloads.service";
import { listDonations } from "@/lib/services/donations.service";
import { listBranches } from "@/lib/services/branches.service";
import { listPartners } from "@/lib/services/partners.service";
import { listStats } from "@/lib/services/stats.service";
import { listBeforeAfter } from "@/lib/services/before-after.service";
import { listProcessSteps } from "@/lib/services/process-steps.service";
import { listCertifications } from "@/lib/services/certifications.service";
import { GalleryManager } from "@/components/business/gallery-manager";
import { TeamManager } from "@/components/business/team-manager";
import { PricingManager } from "@/components/business/pricing-manager";
import { EventsManager } from "@/components/business/events-manager";
import { MenuManager } from "@/components/business/menu-manager";
import { JobsManager } from "@/components/business/jobs-manager";
import { BlogManager } from "@/components/business/blog-manager";
import { FaqsManager } from "@/components/business/faqs-manager";
import { TestimonialsManager } from "@/components/business/testimonials-manager";
import { GiftCardsManager } from "@/components/business/gift-cards-manager";
import { MembershipsManager } from "@/components/business/memberships-manager";
import { CoursesManager } from "@/components/business/courses-manager";
import { DownloadsManager } from "@/components/business/downloads-manager";
import { DonationsManager } from "@/components/business/donations-manager";
import { BranchesManager } from "@/components/business/branches-manager";
import { PartnersManager } from "@/components/business/partners-manager";
import { StatsManager } from "@/components/business/stats-manager";
import { BeforeAfterManager } from "@/components/business/before-after-manager";
import { ProcessStepsManager } from "@/components/business/process-steps-manager";
import { CertificationsManager } from "@/components/business/certifications-manager";
import { ModulesPicker } from "@/components/business/modules-picker";
import { resolveModules, type ModuleKey } from "@/lib/modules";
import { modeAllowsModule } from "@/lib/site-mode";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "מודולים לאתר" };

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "sections");

  const [gallery, team, pricing, events, menu, jobs, blog, faqs, testimonials, giftCards] =
    await Promise.all([
      listGallery(businessId),
      listTeam(businessId),
      listPricing(businessId),
      listEvents(businessId),
      listMenu(businessId),
      listJobs(businessId),
      listBlog(businessId),
      listFaqs(businessId),
      listTestimonials(businessId),
      listGiftCards(businessId),
    ]);
  const [memberships, courses, downloads, donations, branches, partners, stats, beforeAfter, processSteps, certifications] =
    await Promise.all([
      listMemberships(businessId),
      listCourses(businessId),
      listDownloads(businessId),
      listDonations(businessId),
      listBranches(businessId),
      listPartners(businessId),
      listStats(businessId),
      listBeforeAfter(businessId),
      listProcessSteps(businessId),
      listCertifications(businessId),
    ]);

  // Each manager keyed by module key so we can render in the owner's chosen order.
  const managerByKey: Record<ModuleKey, ReactNode> = {
    testimonials: <TestimonialsManager businessId={businessId} items={testimonials} />,
    gallery: <GalleryManager businessId={businessId} items={gallery} />,
    menu: <MenuManager businessId={businessId} items={menu} />,
    pricing: <PricingManager businessId={businessId} items={pricing} />,
    team: <TeamManager businessId={businessId} items={team} />,
    events: <EventsManager businessId={businessId} items={events} />,
    blog: <BlogManager businessId={businessId} items={blog} />,
    faqs: <FaqsManager businessId={businessId} items={faqs} />,
    jobs: <JobsManager businessId={businessId} items={jobs} />,
    gift_cards: <GiftCardsManager businessId={businessId} items={giftCards} />,
    process_steps: <ProcessStepsManager businessId={businessId} items={processSteps} />,
    stats: <StatsManager businessId={businessId} items={stats} />,
    before_after: <BeforeAfterManager businessId={businessId} items={beforeAfter} />,
    courses: <CoursesManager businessId={businessId} items={courses} />,
    memberships: <MembershipsManager businessId={businessId} items={memberships} />,
    downloads: <DownloadsManager businessId={businessId} items={downloads} />,
    donations: <DonationsManager businessId={businessId} items={donations} />,
    branches: <BranchesManager businessId={businessId} items={branches} />,
    certifications: <CertificationsManager businessId={businessId} items={certifications} />,
    partners: <PartnersManager businessId={businessId} items={partners} />,
    // The closing lead form has no content manager here — its texts are edited
    // in the website editor ("אתר" → עמוד צור קשר); the picker toggle is what
    // shows/hides it on the live site.
    contact: (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        טופס &quot;צור קשר&quot; בתחתית האתר — הפעלה/כיבוי מתבצעים בבורר המודולים
        למעלה, ואת הכותרת והטקסטים עורכים בעמוד <b>אתר</b> ← עמוד צור קשר.
      </div>
    ),
    // Storefront returns/exchanges form — no content manager; the picker toggle
    // above is its on/off switch (shown only when the store has products).
    returns: (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        טופס &quot;החזרות והחלפות&quot; מוצג בחנות ליד מעקב ההזמנה — הפעלה/כיבוי
        מתבצעים בבורר המודולים למעלה. הבקשות מגיעות לטאב &quot;החזרות&quot; בדשבורד.
      </div>
    ),
    // Storefront self-service order lookup — no content manager; the picker
    // toggle above is its on/off switch (shown only when the store has products).
    order_tracking: (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        טופס &quot;מעקב הזמנות&quot; (חיפוש הזמנה לפי מספר + טלפון) מוצג בחנות —
        הפעלה/כיבוי מתבצעים בבורר המודולים למעלה.
      </div>
    ),
  };

  const counts: Record<string, number> = {
    testimonials: testimonials.length,
    gallery: gallery.length,
    menu: menu.length,
    pricing: pricing.length,
    team: team.length,
    events: events.length,
    blog: blog.length,
    faqs: faqs.length,
    jobs: jobs.length,
    gift_cards: giftCards.length,
    process_steps: processSteps.length,
    stats: stats.length,
    before_after: beforeAfter.length,
    courses: courses.length,
    memberships: memberships.length,
    downloads: downloads.length,
    donations: donations.length,
    branches: branches.length,
    certifications: certifications.length,
    partners: partners.length,
  };

  // What gets a content form below the picker:
  //   1. the module must be renderable in this build mode (a brochure site has
  //      no returns desk or order lookup), and
  //   2. the owner must have it turned ON.
  // (2) is the point of the picker: filling in content for a module that isn't
  // enabled is wasted work, and twenty always-open forms buried the handful the
  // owner actually uses. Turning a module back on brings its form — and any
  // content already saved — straight back; nothing is deleted by toggling.
  const order = resolveModules(business.module_config).filter(
    (m) => modeAllowsModule(business.site_mode, m.key) && m.enabled,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LayoutGrid className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">מודולים לאתר</h1>
          <p className="text-sm text-muted-foreground">
            הפעילו רק את מה שרלוונטי לעסק — טפסי המילוי למטה מוצגים רק למודולים
            שהפעלתם, ובאותו סדר
          </p>
        </div>
      </div>

      <ModulesPicker
        businessId={businessId}
        config={business.module_config}
        counts={counts}
        siteMode={business.site_mode}
      />

      {order.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          לא הפעלתם עדיין אף מודול. הפעילו מודול בבורר למעלה, וטופס המילוי שלו יופיע כאן.
        </div>
      ) : (
        order.map(({ key }) => <div key={key}>{managerByKey[key]}</div>)
      )}
    </div>
  );
}
