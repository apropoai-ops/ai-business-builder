import { describe, it, expect } from "vitest";

import { computeBusinessScore, scoreBand, type ScoreMetrics } from "@/lib/business-score";

const empty: ScoreMetrics = {
  customers: 0,
  wonValue: 0,
  ordersConfirmed: 0,
  acceptedQuotes: 0,
  contentCount: 0,
  socialProfiles: 0,
  adsCampaigns: 0,
  visits30d: 0,
  revenue: 0,
  pipelineValue: 0,
  hasPaymentLink: false,
  tasksDone: 0,
  tasksOpen: 0,
  bookings: 0,
  sitePublished: false,
  reviewsCount: 0,
  avgRating: 0,
  whatsappReplies: 0,
  leadsTotal: 0,
  leadsConverted: 0,
};

describe("computeBusinessScore", () => {
  it("scores an empty business at 0 across all dimensions", () => {
    const r = computeBusinessScore(empty);
    expect(r.overall).toBe(0);
    expect(r.dimensions).toHaveLength(5);
    for (const d of r.dimensions) expect(d.score).toBe(0);
  });

  it("scores a thriving business near the top", () => {
    const strong: ScoreMetrics = {
      customers: 20,
      wonValue: 50000,
      ordersConfirmed: 10,
      acceptedQuotes: 10,
      contentCount: 20,
      socialProfiles: 4,
      adsCampaigns: 3,
      visits30d: 500,
      revenue: 60000,
      pipelineValue: 15000,
      hasPaymentLink: true,
      tasksDone: 18,
      tasksOpen: 2,
      bookings: 20,
      sitePublished: true,
      reviewsCount: 12,
      avgRating: 4.8,
      whatsappReplies: 40,
      leadsTotal: 20,
      leadsConverted: 16,
    };
    const r = computeBusinessScore(strong);
    expect(r.overall).toBeGreaterThanOrEqual(90);
    for (const d of r.dimensions) expect(d.score).toBeGreaterThanOrEqual(80);
  });

  it("keeps every dimension within 0–100", () => {
    const r = computeBusinessScore({
      ...empty,
      customers: 9999,
      wonValue: 1e9,
      visits30d: 1e6,
      revenue: 1e9,
    });
    for (const d of r.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it("rewards task completion rate", () => {
    const low = computeBusinessScore({ ...empty, tasksDone: 1, tasksOpen: 9 });
    const high = computeBusinessScore({ ...empty, tasksDone: 9, tasksOpen: 1 });
    const ops = (r: ReturnType<typeof computeBusinessScore>) =>
      r.dimensions.find((d) => d.key === "operations")!.score;
    expect(ops(high)).toBeGreaterThan(ops(low));
  });

  it("maps overall to a Hebrew band", () => {
    expect(scoreBand(95)).toBe("מצוין");
    expect(scoreBand(65)).toBe("טוב");
    expect(scoreBand(45)).toBe("בינוני");
    expect(scoreBand(10)).toBe("דורש תשומת לב");
  });
});
