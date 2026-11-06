/**
 * Deterministic Business Score (0–100) across five dimensions:
 * Sales, Marketing, Finance, Operations, Customer Service.
 * Pure & testable — the service feeds it metrics gathered from the DB.
 */

export type ScoreMetrics = {
  // Sales
  customers: number;
  wonValue: number;
  ordersConfirmed: number;
  acceptedQuotes: number;
  // Marketing
  contentCount: number;
  socialProfiles: number;
  adsCampaigns: number;
  visits30d: number;
  // Finance
  revenue: number;
  pipelineValue: number;
  hasPaymentLink: boolean;
  // Operations
  tasksDone: number;
  tasksOpen: number;
  bookings: number;
  sitePublished: boolean;
  // Customer service
  reviewsCount: number;
  avgRating: number; // 0–5
  whatsappReplies: number;
  leadsTotal: number;
  leadsConverted: number;
};

export type DimensionKey = "sales" | "marketing" | "finance" | "operations" | "service";

export type DimensionScore = {
  key: DimensionKey;
  label: string;
  score: number; // 0–100
};

export type BusinessScore = {
  overall: number; // 0–100
  dimensions: DimensionScore[];
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  sales: "מכירות",
  marketing: "שיווק",
  finance: "כספים",
  operations: "תפעול",
  service: "שירות לקוחות",
};

/** Awards up to `max` points, reaching the full amount at `target`. */
function ramp(value: number, target: number, max: number): number {
  if (target <= 0) return 0;
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  return Math.min(v / target, 1) * max;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeBusinessScore(m: ScoreMetrics): BusinessScore {
  const sales = clamp100(
    ramp(m.customers, 10, 30) +
      ramp(m.wonValue, 10000, 30) +
      ramp(m.ordersConfirmed, 5, 20) +
      ramp(m.acceptedQuotes, 5, 20),
  );

  const marketing = clamp100(
    ramp(m.contentCount, 10, 30) +
      (m.socialProfiles > 0 ? 20 : 0) +
      (m.adsCampaigns > 0 ? 20 : 0) +
      ramp(m.visits30d, 100, 30),
  );

  const finance = clamp100(
    ramp(m.revenue, 20000, 50) +
      (m.pipelineValue > 0 ? 25 : 0) +
      (m.hasPaymentLink ? 25 : 0),
  );

  const totalTasks = m.tasksDone + m.tasksOpen;
  const completion = totalTasks > 0 ? m.tasksDone / totalTasks : 0;
  const operations = clamp100(
    completion * 40 + ramp(m.bookings, 10, 30) + (m.sitePublished ? 30 : 0),
  );

  const conversion = m.leadsTotal > 0 ? m.leadsConverted / m.leadsTotal : 0;
  const service = clamp100(
    ramp(m.reviewsCount, 5, 25) +
      ramp(m.avgRating, 5, 25) +
      ramp(m.whatsappReplies, 20, 25) +
      conversion * 25,
  );

  const dimensions: DimensionScore[] = [
    { key: "sales", label: DIMENSION_LABELS.sales, score: sales },
    { key: "marketing", label: DIMENSION_LABELS.marketing, score: marketing },
    { key: "finance", label: DIMENSION_LABELS.finance, score: finance },
    { key: "operations", label: DIMENSION_LABELS.operations, score: operations },
    { key: "service", label: DIMENSION_LABELS.service, score: service },
  ];

  const overall = clamp100(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );

  return { overall, dimensions };
}

/** A short Hebrew label for an overall score band. */
export function scoreBand(overall: number): string {
  if (overall >= 80) return "מצוין";
  if (overall >= 60) return "טוב";
  if (overall >= 40) return "בינוני";
  if (overall >= 20) return "בתחילת הדרך";
  return "דורש תשומת לב";
}

/** A single point on the score-history sparkline (see business_score_snapshots). */
export type ScoreHistoryPoint = { date: string; total: number };

/** value ÷ target, capped at 1 — mirrors the `ramp()` weighting above. */
const ratio = (value: number, target: number) => Math.min(Math.max(value, 0) / target, 1);

/** Returns the label paired with the smallest ratio (ties keep the first). */
function pickWeakest(candidates: [number, string][]): string {
  let best = candidates[0];
  for (const c of candidates) {
    if (c[0] < best[0]) best = c;
  }
  return best[1];
}

/**
 * Picks the single weakest concrete metric behind a dimension's score, as a
 * short Hebrew hint ("מה מוריד את הציון"). Each candidate is normalized to
 * the same 0–1 scale (value ÷ its scoring target) so metrics on very
 * different scales — e.g. customer count vs. revenue — compare fairly.
 * Pure & deterministic.
 */
export function weakestMetricHint(dimension: DimensionKey, m: ScoreMetrics): string {
  switch (dimension) {
    case "sales": {
      const candidates: [number, string][] = [
        [ratio(m.customers, 10), "מעט לקוחות רשומים במערכת"],
        [ratio(m.wonValue, 10000), "אין עדיין מספיק עסקאות שנסגרו"],
        [ratio(m.ordersConfirmed, 5), "מעט הזמנות שהושלמו"],
        [ratio(m.acceptedQuotes, 5), "מעט הצעות מחיר שאושרו"],
      ];
      return pickWeakest(candidates);
    }
    case "marketing": {
      const candidates: [number, string][] = [
        [ratio(m.contentCount, 10), "מעט תוכן פורסם עדיין"],
        [m.socialProfiles > 0 ? 1 : 0, "אין רשתות חברתיות מחוברות"],
        [m.adsCampaigns > 0 ? 1 : 0, "אין קמפיין פרסום פעיל"],
        [ratio(m.visits30d, 100), "מעט ביקורים באתר ב-30 הימים האחרונים"],
      ];
      return pickWeakest(candidates);
    }
    case "finance": {
      const candidates: [number, string][] = [
        [ratio(m.revenue, 20000), "הכנסות נמוכות עד כה"],
        [m.pipelineValue > 0 ? 1 : 0, "אין עסקאות פתוחות בצנרת"],
        [m.hasPaymentLink ? 1 : 0, "לא הוגדר קישור תשלום"],
      ];
      return pickWeakest(candidates);
    }
    case "operations": {
      const completion = m.tasksDone + m.tasksOpen > 0 ? m.tasksDone / (m.tasksDone + m.tasksOpen) : 0;
      const candidates: [number, string][] = [
        [completion, "שיעור השלמת משימות נמוך"],
        [ratio(m.bookings, 10), "מעט תורים/הזמנות נקבעו"],
        [m.sitePublished ? 1 : 0, "האתר טרם פורסם"],
      ];
      return pickWeakest(candidates);
    }
    case "service": {
      const conversion = m.leadsTotal > 0 ? m.leadsConverted / m.leadsTotal : 0;
      const candidates: [number, string][] = [
        [ratio(m.reviewsCount, 5), "מעט ביקורות מאושרות"],
        [ratio(m.avgRating, 5), "דירוג ממוצע נמוך"],
        [ratio(m.whatsappReplies, 20), "מעט תגובות סוכן וואטסאפ"],
        [conversion, "שיעור המרת לידים נמוך"],
      ];
      return pickWeakest(candidates);
    }
    default:
      return "";
  }
}
