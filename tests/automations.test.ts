import { describe, it, expect } from "vitest";

import { interpolate, conditionsPass } from "@/lib/services/automations.service";

describe("automations agorot/ILS unit consistency", () => {
  it("interpolates {{total}} (stored in agorot) to the correct ILS amount", () => {
    // A ₪250 order fed through fireAutomations as agorot (order.total * 100).
    const payload = { total: 25000, customerName: "דנה" };
    expect(interpolate("הזמנה בסך {{total}}", payload)).toBe(
      `הזמנה בסך ₪${(25000 / 100).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
  });

  it("passes a min_total condition (stored in agorot) for a real order above the ILS threshold", () => {
    // Owner set "only if order total > ₪200" -> buildConditions stores min_total = 20000 agorot.
    const conditions = { min_total: 20000 };
    // A real ₪250 order, converted to agorot the same way finalizePaidStoreOrder does.
    const payload = { total: Math.round(250 * 100) };
    expect(conditionsPass("order_paid", conditions, payload)).toBe(true);
  });

  it("blocks a real order below the ILS threshold", () => {
    const conditions = { min_total: 20000 }; // ₪200
    const payload = { total: Math.round(150 * 100) }; // ₪150
    expect(conditionsPass("order_paid", conditions, payload)).toBe(false);
  });
});
