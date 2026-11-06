import { getBusiness } from "@/lib/services/business.service";
import { getBrandAssets } from "@/lib/services/branding.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";
import { uploadSiteAsset } from "@/lib/services/image-gen";
import { buildBrandHeroSvg, buildLogoSuite } from "@/lib/services/svg-design";
import { designLogoSpec } from "@/lib/ai/agents/logo-design";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string };

/**
 * The logo + hero a new site is born with. Zero image-API cost.
 *
 * This used to ask the model to hand-write raw SVG code, which is a bad job
 * for a language model: the output quality swung wildly run to run, roughly
 * anything could come back inside <svg>, and a malformed result fell through
 * to a plain wordmark — so the "designed" logo was a coin flip. Now the model
 * only picks the direction (see lib/ai/agents/logo-design.ts) and we draw it,
 * which also means the site's starting logo is the same first proposal the
 * owner sees in the design studio rather than an unrelated design.
 */
export async function runSiteDesignJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  const existing = await getLatestJob(businessId, "site_design");
  if (existing?.status === "running") return { status: "running" };

  const job = await createJob(businessId, "site_design");
  await setJobStatus(job.id, "running");

  try {
    const brand = await getBrandAssets(businessId);
    const palette =
      (brand?.color_palette as { hex: string }[] | null)
        ?.map((c) => c.hex)
        .filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)) ?? [];
    const brandHex = palette.find((h) => !isNearWhite(h)) ?? "#2563EB";
    const name = brand?.brand_name ?? business.name ?? "עסק";

    // One design direction drives both assets, so the logo and the hero share
    // a palette instead of arriving as two unrelated decisions.
    const spec = await designLogoSpec({
      businessId,
      name,
      industry: business.industry ?? business.type ?? "כללי",
      description: business.description,
      palette: palette.length ? palette : [brandHex],
      slogan: brand?.slogan ?? null,
    });

    const logoSvg = buildLogoSuite(spec)[0].svg;
    const heroSvg = buildBrandHeroSvg(spec.brandHex, businessId, name, spec.latin);

    const [logoUrl, heroUrl] = await Promise.all([
      uploadSiteAsset(`${businessId}/logo.svg`, logoSvg, "image/svg+xml"),
      uploadSiteAsset(`${businessId}/hero.svg`, heroSvg, "image/svg+xml"),
    ]);

    const supabase = createServiceRoleClient();
    await Promise.all([
      supabase.from("brand_assets").update({ logo_url: logoUrl }).eq("business_id", businessId),
      supabase.from("websites").update({ hero_image_url: heroUrl }).eq("business_id", businessId),
    ]);

    await setJobStatus(job.id, "succeeded");
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(job.id, "failed", { error: message });
    return { status: "failed", error: message };
  }
}

function isNearWhite(hex: string): boolean {
  const m = hex.replace("#", "");
  return (
    parseInt(m.slice(0, 2), 16) +
      parseInt(m.slice(2, 4), 16) +
      parseInt(m.slice(4, 6), 16) >
    660
  );
}

