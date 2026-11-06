/**
 * The storefront hero-style registry, plus the deterministic picker that maps a
 * business's industry/type/description onto one of them.
 *
 * Lives in lib/ (pure, no React, no server imports) because four different
 * layers need the same list and used to keep their own copies: the dispatcher
 * (components/public/heroes/store-hero.tsx), the owner-facing picker (a client
 * component), the server action that validates a chosen key, and the AI
 * suggester's enum. One source of truth here, imported by all of them.
 *
 * The picker itself is fast, free and deterministic — same intent as the AI
 * picker, run at website-generation time so every new site is born with a
 * fitting style. The owner can always override it, or run the AI picker for a
 * nuanced choice.
 */
export type HeroStyleKey =
  | "orbit"
  | "spotlight"
  | "vanguard"
  | "aurora"
  | "horizon"
  | "nova"
  | "soda"
  | "denim";

export const HERO_STYLES: { key: HeroStyleKey; label: string; desc: string }[] = [
  { key: "orbit", label: "Orbit — דינמי טכנולוגי", desc: "רקע כהה עם מעגלים מסתובבים, מונה חי וכפתור עם מסגרת זוהרת" },
  { key: "spotlight", label: "Spotlight — קולנועי", desc: "תמונה כהה במסך מלא עם זרקור שחושף צבע סביב העכבר" },
  { key: "vanguard", label: "Vanguard — סוכנות", desc: "כותרת ענקית ממורכזת עם טוויסט קווי-מתאר, רקע קולנועי עם זום איטי" },
  { key: "aurora", label: "Aurora — זכוכית נוזלית", desc: "התמונה שלכם במסך מלא עם תנועה איטית, פאנלים מזכוכית מטושטשת והטקסט בפינה התחתונה" },
  { key: "horizon", label: "Horizon — עורכי", desc: "התמונה שלכם ללא הכהיה, כותרת שנבנית אות-אחר-אות ותגית זכוכית בקצה" },
  { key: "nova", label: "Nova — הצהרתי", desc: "כותרת ענקית עם מילה בגרדיאנט המותג, התמונה שלכם נושמת ברקע ופס אמון רץ בתחתית" },
  { key: "soda", label: "Soda — מוצר תוסס", desc: "רקע גרדיאנט כהה עם בועות עולות, כדורי זכוכית שנדחפים מהעכבר והתמונה שלכם צפה במרכז" },
  { key: "denim", label: "Denim — מסחרי וחד", desc: "שחור מלא, כותרת הלווטיקה ענקית והתמונה שלכם בכרטיס מעוגל עם תגית מחיר — בלי אנימציות" },
];

export const HERO_STYLE_KEYS: HeroStyleKey[] = HERO_STYLES.map((s) => s.key);

export function isHeroStyleKey(v: string): v is HeroStyleKey {
  return (HERO_STYLE_KEYS as string[]).includes(v);
}

/**
 * Order matters — first match wins. The three video-led styles are appended
 * AFTER the original three on purpose: they only claim businesses that used to
 * fall through to the `spotlight` default, so adding them changes no existing
 * site's automatic pick.
 */
const RULES: { style: HeroStyleKey; kw: string[] }[] = [
  // Luxury / beauty / wellness / visual arts → dramatic, cinematic.
  { style: "spotlight", kw: ["יופי", "אסתטיק", "קוסמטיק", "טיפוח", "ספא", "spa", "beauty", "cosmetic", "skincare", "wellness", "וולנס", "יוגה", "yoga", "מדיטצי", "פילאטיס", "pilates", "קליניק", "clinic", "salon", "מספר", "יוקרה", "luxury", "פרימיום", "premium", "צלם", "צילום", "photograph", "אדריכל", "architect", "גלרי", "galler", "שף", "chef", "קפה", "בית קפה", "מאפי", "קונדיטור", "ילדים", "צעצוע", "חיות מחמד", "וטרינר", "cafe", "coffee", "bakery", "pastry", "kids", "children", "toy", "pet", "vet", "candy", "ממתק"] },
  // Tech / fintech / security / B2B → dark, dynamic, technical.
  { style: "orbit", kw: ["טכנולוג", "תוכנה", "סייבר", "אבטח", "פינטק", "סטארטאפ", "בינה מלאכות", "קריפטו", "בלוקצ", "tech", "software", "saas", "fintech", "cyber", "security", "startup", "ai ", " ai", "crypto", "blockchain", "data", "devops", "b2b", "platform"] },
  // Fashion / brands / agencies / creative → bold centered editorial.
  { style: "vanguard", kw: ["אופנ", "בגד", "לייפסטייל", "נעלי", "תכשיט", "אקססו", "מותג", "fashion", "clothing", "apparel", "lifestyle", "retail", "boutique", "jewel", "accessor", "shoes", "brand", "סוכנ", "שיווק", "יחסי ציבור", "דיגיטל", "agency", "marketing", "digital", "creative", "אירועים", "הפקה", "event", "פורטפוליו", "portfolio", "עיצוב", "design", "סטודיו", "studio"] },
  // Health / therapy / coaching / education → calm, glass-over-video.
  { style: "aurora", kw: ["רפוא", "רופא", "בריאות", "מרפא", "תזונ", "דיאט", "פיזיותרפ", "כירופרק", "פסיכולוג", "מטפל", "טיפול", "רגש", "קואצ", "אימון אישי", "כושר", "חדר כושר", "שיניים", "אופטומטר", "health", "medical", "dental", "therap", "psycholog", "nutrition", "diet", "coach", "fitness", "gym", "rehab", "חינוך", "הוראה", "מורה", "קורס", "הכשר", "education", "tutor", "academy", "אקדמי"] },
  // Money / property / law / professional services → editorial, undimmed.
  { style: "horizon", kw: ["השקע", "invest", "venture", "הון", "capital", "פיננס", "finance", "בנק", "bank", "ביטוח", "insurance", "פנסי", "משכנת", "mortgage", "נדל", "real estate", "realestate", "property", "תיווך", "יזמות", "בנייה", "בניה", "קבלן", "שיפוצ", "construction", "משפט", "עורך דין", "עורכת דין", "עורכי דין", "עו\"ד", "law", "legal", "attorney", "רואה חשבון", "רו\"ח", "accounting", "הנהלת חשבונות", "ייעוץ עסקי", "consult"] },
  // Industry / logistics / energy / operations → big statement + trust band.
  { style: "nova", kw: ["אוטומצ", "אינטגרצ", "מערכות מידע", "ענן", "cloud", "automation", "crm", "erp", "api", "אפליקצ", "logistic", "לוגיסטי", "שילוח", "הובל", "תעשי", "industrial", "ייצור", "manufactur", "מפעל", "factory", "אנרגי", "energy", "סולאר", "solar", "חשמל", "מיזוג", "תשתיות", "infrastructure", "רכב", "automotive", "מוסך", "טלקום", "telecom", "תקשורת"] },
  // Beverages / consumer goods / supplements → playful, product-in-the-centre.
  // LAST on purpose, for the same reason the video-led three sit above it: from
  // here it can only claim businesses that used to fall through to `spotlight`,
  // so no existing site's automatic pick moves. Deliberately narrow — cafés,
  // bakeries and plain "מסעדה" keep the style they already had.
  // No bare "יין" here on purpose: it is a substring of "בניין" and
  // "מעוניינים", which would hand a builder's site a soda hero.
  { style: "soda", kw: ["משקא", "בירה", "מבשלת", "יקב", "מיץ", "סמוזי", "שייק", "גלידה", "גלידרי", "סודה", "קוקטייל", "beverage", "drink", "soda", "juice", "smoothie", "brewery", "beer", "wine", "winery", "cocktail", "ice cream", "gelato", "kombucha", "קומבוצ", "תוספ", "supplement", "ויטמין", "vitamin", "cpg"] },
  // Hard retail — denim, furniture, sports gear, marketplaces. Last, so like
  // soda above it can only take businesses that fell through to `spotlight`.
  // Menswear itself is NOT here: "אופנ"/"בגד" belong to vanguard and stay
  // there. No bare English "sport" either — it is a substring of "transport".
  { style: "denim", kw: ["ג'ינס", "גינס", "jeans", "denim", "חליפ", "ריהוט", "רהיט", "furniture", "מזרן", "מזרונ", "כלי בית", "כלי עבודה", "hardware", "ספורט", "מרקטפלייס", "marketplace", "e-commerce", "ecommerce"] },
];

export function pickHeroStyle(b: {
  industry?: string | null;
  type?: string | null;
  description?: string | null;
  name?: string | null;
}): HeroStyleKey {
  const hay = [b.industry, b.type, b.description, b.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const rule of RULES) {
    if (rule.kw.some((k) => hay.includes(k))) return rule.style;
  }
  // Spotlight is the default: least industry-specific of them all.
  return "spotlight";
}
