import { describe, expect, it } from "vitest";

import { isHospitality } from "@/lib/business-type";

describe("isHospitality (feature routing by business type)", () => {
  it("matches accommodation businesses", () => {
    expect(isHospitality({ industry: "צימרים", description: "" })).toBe(true);
    expect(isHospitality({ description: "וילת אירוח ונופש בצפון" })).toBe(true);
    expect(isHospitality({ name: "Sea View B&B", industry: "hotel" })).toBe(true);
    expect(isHospitality({ description: "vacation rental cabin" })).toBe(true);
  });

  it("does NOT match non-hospitality businesses", () => {
    expect(isHospitality({ industry: "אופנה", description: "חנות בגדים אונליין" })).toBe(false);
    expect(isHospitality({ industry: "מסעדה", description: "אוכל איטלקי" })).toBe(false);
    expect(isHospitality({ description: "" })).toBe(false);
  });
});
