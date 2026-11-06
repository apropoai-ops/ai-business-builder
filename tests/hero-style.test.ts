import { describe, it, expect } from "vitest";

import { HERO_STYLES, isHeroStyleKey, pickHeroStyle } from "@/lib/hero-style";

describe("pickHeroStyle", () => {
  it("maps fashion/retail/agencies → vanguard", () => {
    expect(pickHeroStyle({ industry: "אופנה", description: "חנות בגדים אונליין" })).toBe("vanguard");
    expect(pickHeroStyle({ industry: "Fashion retail" })).toBe("vanguard");
    expect(pickHeroStyle({ industry: "סוכנות שיווק דיגיטלי" })).toBe("vanguard");
  });

  it("maps tech/fintech/security → orbit", () => {
    expect(pickHeroStyle({ industry: "אבטחת סייבר B2B" })).toBe("orbit");
    expect(pickHeroStyle({ industry: "Fintech SaaS platform" })).toBe("orbit");
  });

  it("maps beauty/wellness/luxury/visual-arts → spotlight", () => {
    expect(pickHeroStyle({ industry: "קליניקת יופי ואסתטיקה" })).toBe("spotlight");
    expect(pickHeroStyle({ description: "yoga and meditation studio" })).toBe("spotlight");
    expect(pickHeroStyle({ industry: "צלם אירועים" })).toBe("spotlight");
  });

  // "cozy" was retired; its warm/family audience folded into spotlight, which
  // is also photo-led. Migration 0080 remapped the stored values.
  it("maps warm family businesses → spotlight", () => {
    expect(pickHeroStyle({ industry: "בית קפה שכונתי" })).toBe("spotlight");
    expect(pickHeroStyle({ description: "artisan bakery and pastry shop" })).toBe("spotlight");
  });

  it("falls back to spotlight — the least industry-specific of them all", () => {
    expect(pickHeroStyle({ industry: "מסעדה", description: "מסעדה עונתית" })).toBe("spotlight");
    expect(pickHeroStyle({})).toBe("spotlight");
  });

  // The three video-led styles were appended AFTER the original rules, so they
  // only claim businesses that previously fell through to the default.
  it("maps health/therapy/coaching/education → aurora", () => {
    expect(pickHeroStyle({ industry: "מרפאת שיניים" })).toBe("aurora");
    expect(pickHeroStyle({ industry: "תזונה", description: "ליווי דיאטני אישי" })).toBe("aurora");
    expect(pickHeroStyle({ description: "personal fitness coach" })).toBe("aurora");
  });

  it("maps money/property/law → horizon", () => {
    expect(pickHeroStyle({ industry: "נדל\"ן", description: "תיווך דירות" })).toBe("horizon");
    expect(pickHeroStyle({ industry: "משרד עורכי דין" })).toBe("horizon");
    expect(pickHeroStyle({ description: "investment and capital advisory" })).toBe("horizon");
  });

  it("maps industry/logistics/energy → nova", () => {
    expect(pickHeroStyle({ industry: "לוגיסטיקה", description: "שילוח בינלאומי" })).toBe("nova");
    expect(pickHeroStyle({ industry: "אנרגיה סולארית" })).toBe("nova");
    expect(pickHeroStyle({ description: "industrial manufacturing" })).toBe("nova");
  });

  // Soda sits last in the rule list, so it may only claim businesses that used
  // to fall through to spotlight — never one an earlier rule already owns.
  it("maps beverages/consumer goods → soda", () => {
    expect(pickHeroStyle({ industry: "מבשלת בירה" })).toBe("soda");
    expect(pickHeroStyle({ industry: "גלידריה", description: "גלידה איטלקית" })).toBe("soda");
    expect(pickHeroStyle({ description: "cold pressed juice and smoothie bar" })).toBe("soda");
    expect(pickHeroStyle({ description: "חנות ויטמינים ותוספי ספורט" })).toBe("soda");
  });

  it("does not let soda steal a business an earlier rule already owns", () => {
    // "תזונה" is aurora's — a supplements shop that calls itself that stays there.
    expect(pickHeroStyle({ industry: "תוספי תזונה" })).toBe("aurora");
    expect(pickHeroStyle({ industry: "בית קפה", description: "מיץ טרי" })).toBe("spotlight");
    // "יין" is a substring of "בניין"; the rule must not fire on a builder.
    expect(pickHeroStyle({ industry: "חברת בניין ושיפוצים" })).toBe("horizon");
  });

  // Denim is last of all, so the same containment rule applies to it.
  it("maps hard retail → denim", () => {
    expect(pickHeroStyle({ industry: "ג'ינס וביגוד" })).toBe("denim");
    expect(pickHeroStyle({ industry: "ריהוט", description: "רהיטים לבית" })).toBe("denim");
    expect(pickHeroStyle({ description: "online marketplace for tools" })).toBe("denim");
  });

  it("does not let denim steal fashion from vanguard", () => {
    expect(pickHeroStyle({ industry: "חנות בגדים לגברים" })).toBe("vanguard");
    expect(pickHeroStyle({ industry: "אופנה", description: "ג'ינסים" })).toBe("vanguard");
    // "sport" is a substring of "transport"; the rule must not fire on it.
    expect(pickHeroStyle({ description: "international transport company" })).toBe("spotlight");
  });

  it("never returns a key the dispatcher and the picker don't both know", () => {
    const keys = HERO_STYLES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(isHeroStyleKey(k)).toBe(true);
    expect(isHeroStyleKey("classic")).toBe(false);
  });
});
