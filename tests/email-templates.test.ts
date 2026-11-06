import { describe, it, expect } from "vitest";

import { buildPlanWelcomeEmail, emailShell } from "@/lib/email-templates";
import { PLANS } from "@/lib/plans";

describe("emailShell", () => {
  it("wraps content in an RTL Hebrew shell with the title and body", () => {
    const html = emailShell("כותרת", "<p>גוף ההודעה</p>");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
    expect(html).toContain("כותרת");
    expect(html).toContain("<p>גוף ההודעה</p>");
    expect(html).toContain("AI Business Builder");
  });
});

describe("buildPlanWelcomeEmail", () => {
  it("builds a welcome email for each paid plan with its name and every feature", () => {
    for (const tier of ["starter", "pro", "business"] as const) {
      const mail = buildPlanWelcomeEmail(tier);
      expect(mail).not.toBeNull();
      const plan = PLANS[tier];
      // Subject + body reference the plan's display name (BASIC/PRO/Business).
      expect(mail!.subject).toContain(plan.name);
      expect(mail!.html).toContain(plan.name);
      // Every feature the plan advertises is listed so the subscriber sees it.
      for (const feature of plan.features) {
        expect(mail!.html).toContain(feature);
      }
      // It uses the branded RTL shell.
      expect(mail!.html).toContain('dir="rtl"');
    }
  });

  it("includes a Hebrew welcome headline", () => {
    const mail = buildPlanWelcomeEmail("starter");
    expect(mail!.html).toContain("ברוכים הבאים");
  });
});
