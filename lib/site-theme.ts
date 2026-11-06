/**
 * Site COLOUR SCHEMES — the ground a storefront paints itself on.
 *
 * Until now the (only reachable) "professional" tier hard-coded a pure-black
 * page: `#000` ground, `#0b0b0d` bands, `#111214` cards, a `#d4af6a` gold
 * accent. Beautiful once, identical on every site we ship — a spa, a law firm
 * and a jeans shop all came out the same black. This registry turns those
 * literals into a named token set so the ground can be navy, forest, wine,
 * espresso or a light porcelain/sand page, while the tier's LAYOUT, type scale
 * and motion stay exactly what they were.
 *
 * Same shape as the sibling registries — `lib/hero-style.ts` (opening area)
 * and `lib/site-layout.ts` (section order) — and for the same reason: four
 * layers need the same list (the renderer, the owner's picker, the server
 * action that validates a choice, and the AI suggester's enum), so it lives
 * once in lib/, pure and dependency-free.
 *
 * `midnight` reproduces today's palette value-for-value and is the default, so
 * every site that existed before this file renders byte-identically until
 * somebody deliberately picks otherwise.
 */

export type SiteThemeKey =
  | "midnight"
  | "graphite"
  | "navy"
  | "forest"
  | "wine"
  | "espresso"
  | "porcelain"
  | "sand";

export type SiteTheme = {
  key: SiteThemeKey;
  label: string;
  desc: string;
  /** Drives ink DIRECTION everywhere: dark grounds lift colours toward white,
   *  light grounds darken them. Also gates the Tailwind-utility remap block,
   *  which only exists to rescue light-first markup on a dark page. */
  mode: "dark" | "light";

  /** The page itself and every [data-el="module-section"]. */
  ground: string;
  /** `data-band="raised"` strips and the mobile menu panel — one step off the
   *  ground, so a long page has rhythm instead of one endless column. */
  raised: string;
  /** What `.bg-white` / `.bg-zinc-50` inside a section becomes. */
  panel: string;
  /** Product cards. */
  card: string;
  /** The sticky header fill — semi-transparent, it sits over the ground with
   *  a blur behind it, so this is rgba(), not a hex. */
  headerBg: string;

  /** The hex the brand colour is mixed with to make the tier's accent (what
   *  used to be the literal `--gold`). Pick a partner that flatters the
   *  ground: metallic on black, silver on graphite, deep slate on a light
   *  page — the mix has to survive being read as text. */
  accent: string;

  /** Headings, body copy, and muted/meta text. */
  ink: string;
  inkSoft: string;
  inkDim: string;

  /** Hairline borders — the quiet one and the one that has to be seen. */
  hair: string;
  hairStrong: string;

  /** Tail stop of the hero headline's metal gradient (ink → accent → this). */
  heroFade: string;

  /**
   * The surface a brand-derived INK has to stay readable on — i.e. the
   * hardest one for this scheme's ink direction. On a dark scheme that's the
   * LIGHTEST surface (light ink loses contrast as the ground lifts); on a
   * light scheme it's the DARKEST one. Everything else in the stack is then
   * safe by construction. `midnight` keeps the `#1d1d1f` that
   * `lib/storefront-brand.ts` measured against before this existed.
   */
  inkMeasure: string;
};

export const SITE_THEMES: SiteTheme[] = [
  {
    key: "midnight",
    label: "חצות — שחור קלאסי",
    desc: "שחור מלא עם מבטא זהב. קולנועי, יוקרתי, הכי ניטרלי.",
    mode: "dark",
    ground: "#000000",
    raised: "#0b0b0d",
    panel: "#121214",
    card: "#111214",
    headerBg: "rgba(0,0,0,.72)",
    accent: "#d4af6a",
    ink: "#ffffff",
    inkSoft: "#c9c9c9",
    inkDim: "#b0b0b0",
    hair: "rgba(255,255,255,.08)",
    hairStrong: "rgba(255,255,255,.14)",
    heroFade: "#8a8a8a",
    inkMeasure: "#1d1d1f",
  },
  {
    key: "graphite",
    label: "גרפיט — אפור טכני",
    desc: "אפור פחם קריר עם מבטא כסוף. נקי, מודרני, פחות דרמטי משחור.",
    mode: "dark",
    ground: "#131417",
    raised: "#1a1c20",
    panel: "#202329",
    card: "#1d2025",
    headerBg: "rgba(19,20,23,.78)",
    accent: "#cbd5e1",
    ink: "#f7f8fa",
    inkSoft: "#cfd4dc",
    inkDim: "#b6bcc7",
    hair: "rgba(255,255,255,.09)",
    hairStrong: "rgba(255,255,255,.16)",
    heroFade: "#94a3b8",
    inkMeasure: "#202329",
  },
  {
    key: "navy",
    label: "כחול לילה",
    desc: "כחול עמוק ורגוע עם מבטא תכלת. משדר אמינות ויציבות.",
    mode: "dark",
    ground: "#060b1c",
    raised: "#0b1327",
    panel: "#101a33",
    card: "#0e1730",
    headerBg: "rgba(6,11,28,.78)",
    accent: "#8ab4f8",
    ink: "#f2f6ff",
    inkSoft: "#c6d1e6",
    inkDim: "#adbad4",
    hair: "rgba(160,190,255,.12)",
    hairStrong: "rgba(160,190,255,.22)",
    heroFade: "#8296c0",
    inkMeasure: "#101a33",
  },
  {
    key: "forest",
    label: "יער",
    desc: "ירוק עמוק וטבעי עם מבטא מרווה. אורגני, שקט, מרגיע.",
    mode: "dark",
    ground: "#04120c",
    raised: "#071a12",
    panel: "#0b2419",
    card: "#0a2016",
    headerBg: "rgba(4,18,12,.78)",
    accent: "#9fd8b4",
    ink: "#f1fbf5",
    inkSoft: "#c3d9cb",
    inkDim: "#a9c5b4",
    hair: "rgba(160,255,200,.12)",
    hairStrong: "rgba(160,255,200,.22)",
    heroFade: "#82a68f",
    inkMeasure: "#0b2419",
  },
  {
    key: "wine",
    label: "יין",
    desc: "בורדו כהה עם מבטא ורדרד. חם, קולינרי, רומנטי.",
    mode: "dark",
    ground: "#150609",
    raised: "#1e090f",
    panel: "#290d15",
    card: "#240b12",
    headerBg: "rgba(21,6,9,.78)",
    accent: "#e7a9b4",
    ink: "#fdf3f5",
    inkSoft: "#dfc5cb",
    inkDim: "#c9abb2",
    hair: "rgba(255,190,205,.12)",
    hairStrong: "rgba(255,190,205,.22)",
    heroFade: "#ab8c92",
    inkMeasure: "#290d15",
  },
  {
    key: "espresso",
    label: "אספרסו",
    desc: "חום קפה עמוק עם מבטא קרמל. מלאכת יד, בוטיק, ביתי-יוקרתי.",
    mode: "dark",
    ground: "#120c08",
    raised: "#1b120b",
    panel: "#251a11",
    card: "#21170f",
    headerBg: "rgba(18,12,8,.78)",
    accent: "#e0b98c",
    ink: "#fbf5ee",
    inkSoft: "#dccbb8",
    inkDim: "#c5b39f",
    hair: "rgba(255,220,180,.12)",
    hairStrong: "rgba(255,220,180,.22)",
    heroFade: "#a38d73",
    inkMeasure: "#251a11",
  },
  {
    key: "porcelain",
    label: "פורצלן — בהיר",
    desc: "עמוד לבן-בהיר עם טקסט כהה. אוורירי, קליני, קל לקריאה.",
    mode: "light",
    ground: "#fbfbfd",
    raised: "#f1f2f6",
    panel: "#ffffff",
    card: "#ffffff",
    headerBg: "rgba(255,255,255,.82)",
    accent: "#4b5563",
    ink: "#0f1115",
    inkSoft: "#3f4550",
    inkDim: "#5c6270",
    hair: "rgba(15,17,21,.1)",
    hairStrong: "rgba(15,17,21,.18)",
    heroFade: "#6b7280",
    inkMeasure: "#f1f2f6",
  },
  {
    key: "sand",
    label: "חול — בהיר וחם",
    desc: "בז' חמים עם טקסט כהה. רך, מזמין, ים-תיכוני.",
    mode: "light",
    ground: "#faf6ef",
    raised: "#f2ebdf",
    panel: "#fffdf9",
    card: "#fffdf9",
    headerBg: "rgba(250,246,239,.85)",
    accent: "#7c6a52",
    ink: "#17130d",
    inkSoft: "#4a4034",
    inkDim: "#6b5f4e",
    hair: "rgba(40,30,15,.12)",
    hairStrong: "rgba(40,30,15,.2)",
    heroFade: "#8a7a63",
    inkMeasure: "#f2ebdf",
  },
];

export const SITE_THEME_KEYS: SiteThemeKey[] = SITE_THEMES.map((t) => t.key);

/** The scheme every site had before this registry existed. */
export const DEFAULT_SITE_THEME: SiteThemeKey = "midnight";

export function isSiteThemeKey(v: string): v is SiteThemeKey {
  return (SITE_THEME_KEYS as string[]).includes(v);
}

/**
 * Stored value → theme. Never throws and never returns undefined: a null,
 * empty or stale key (a scheme we retired) falls back to `midnight`, so a bad
 * row can't take a customer's live site down.
 */
export function resolveSiteTheme(value: string | null | undefined): SiteTheme {
  const key = typeof value === "string" && isSiteThemeKey(value.trim())
    ? (value.trim() as SiteThemeKey)
    : DEFAULT_SITE_THEME;
  return SITE_THEMES.find((t) => t.key === key)!;
}

/**
 * Order matters — first match wins. Same free/deterministic/instant picker as
 * `pickHeroStyle`, run at website-generation time so a new site is born in a
 * scheme that fits its trade instead of defaulting to black. The owner can
 * always override it, or run the AI picker for a nuanced read.
 *
 * `midnight` is the fall-through, which is also what every site got before —
 * so a business this table has no opinion about lands exactly where it used to.
 */
const RULES: { theme: SiteThemeKey; kw: string[] }[] = [
  // Nature / hosting / wellness / animals → deep green.
  {
    theme: "forest",
    kw: ["צימר", "אירוח", "מלונ", "אכסני", "נופש", "קמפינג", "טבע", "אורגני", "טבעוני", "צמח", "גינ", "גן ", "נוף", "חקלא", "משתל", "פרח", "יוגה", "מדיטצ", "וולנס", "ספא", "טיפול טבעי", "נטורופת", "הרבליסט", "חיות מחמד", "וטרינר", "כלב", "אקולוג", "קיימות", "מיחזור",
      "zimmer", "cabin", "lodge", "resort", "camping", "nature", "organic", "vegan", "garden", "farm", "florist", "plant", "yoga", "wellness", "spa", "eco", "sustain", "vet", "pet"],
  },
  // Money / law / property / security / B2B tech → deep blue.
  {
    theme: "navy",
    kw: ["השקע", "פיננס", "בנק", "ביטוח", "פנסי", "משכנת", "הון", "רואה חשבון", "רו\"ח", "הנהלת חשבונות", "מיסוי", "נדל", "תיווך", "משפט", "עורך דין", "עורכת דין", "עורכי דין", "עו\"ד", "נוטריון", "ייעוץ עסקי", "אסטרטג", "סייבר", "אבטח", "טכנולוג", "תוכנה", "פינטק", "סטארטאפ", "ענן", "בינה מלאכות",
      "invest", "finance", "bank", "insurance", "mortgage", "capital", "account", "tax", "real estate", "realestate", "property", "legal", "law", "attorney", "consult", "cyber", "security", "fintech", "saas", "software", "startup", "cloud", "b2b"],
  },
  // Food, drink, romance, flowers-as-gifts → burgundy.
  {
    theme: "wine",
    kw: ["מסעד", "ביסטרו", "בר ", "פאב", "יקב", "מבשל", "בירה", "קוקטייל", "שוקולד", "קונדיטור", "עוגות", "קייטרינג", "שף", "טבח", "בשר", "קצבי", "גורמה", "חתונ", "אירועים", "הפקת אירוע", "זוגי", "מתנות",
      "restaurant", "bistro", "pub", "bar ", "winery", "brewery", "cocktail", "chocolate", "patisserie", "cake", "catering", "chef", "gourmet", "butcher", "wedding", "romantic", "gift"],
  },
  // Craft, warmth, made-by-hand, hospitality-lite → coffee brown.
  {
    theme: "espresso",
    kw: ["קפה", "בית קפה", "מאפי", "מאפה", "בייקרי", "לחם", "גלידרי", "ריהוט", "רהיט", "נגר", "עץ", "עור", "קרמיק", "חימר", "אומנות", "מלאכת יד", "וינטג", "ספרות", "ספרים", "מספר", "ברבר", "גילוח", "טיפוח גברים",
      "coffee", "cafe", "espresso", "roaster", "bakery", "bread", "pastry", "furniture", "carpent", "woodwork", "leather", "ceramic", "pottery", "artisan", "handmade", "craft", "vintage", "book", "barber"],
  },
  // Machines, industry, motion, hard goods → cool charcoal.
  {
    theme: "graphite",
    kw: ["רכב", "מוסך", "צמיג", "אופנוע", "תעשי", "ייצור", "מפעל", "מתכת", "חרטו", "לוגיסטי", "שילוח", "הובל", "מחסן", "בנייה", "בניה", "קבלן", "שיפוצ", "אינסטלצ", "חשמלא", "מיזוג", "אנרגי", "סולאר", "תשתיות", "כושר", "חדר כושר", "ספורט", "קרוספיט", "אומנויות לחימה", "גיימינג", "אבטחת מידע",
      "automotive", "garage", "tire", "motorcycle", "industrial", "manufactur", "factory", "metal", "cnc", "logistic", "shipping", "freight", "warehouse", "construction", "contractor", "renovat", "plumb", "electric", "hvac", "energy", "solar", "infrastructure", "gym", "fitness", "crossfit", "gaming", "esport"],
  },
  // Beauty, fashion, celebration, children → warm light page.
  {
    theme: "sand",
    kw: ["יופי", "אסתטיק", "קוסמטיק", "טיפוח", "איפור", "ציפורנ", "מניקור", "שיער", "עיצוב שיער", "הסרת שיער", "עיסוי", "אופנ", "בגד", "נעלי", "תכשיט", "אקססו", "בוטיק", "עיצוב פנים", "אדריכל", "צילום", "צלמ", "ילדים", "תינוק", "צעצוע", "יולד", "משפח",
      "beauty", "aesthetic", "cosmetic", "skincare", "makeup", "nail", "hair", "salon", "massage", "fashion", "clothing", "apparel", "boutique", "jewel", "shoes", "interior", "architect", "photograph", "kids", "children", "baby", "toy"],
  },
  // Clinical, educational, product-led software → clean light page.
  {
    theme: "porcelain",
    kw: ["רפוא", "רופא", "קליניק", "מרפא", "שיניים", "אורתודונט", "פיזיותרפ", "כירופרק", "אופטומטר", "תזונ", "דיאט", "פסיכולוג", "פסיכותרפ", "מטפל", "רגש", "בריאות", "קואצ", "אימון אישי", "חינוך", "הוראה", "מורה", "קורס", "הכשר", "אקדמי", "לימוד", "גן ילדים", "מעון", "אפליקצ", "מוצר דיגיטלי",
      "medical", "doctor", "clinic", "dental", "dentist", "ortho", "physio", "chiro", "optometr", "nutrition", "diet", "psycholog", "therap", "health", "coach", "education", "tutor", "academy", "course", "school", "app", "platform"],
  },
];

export function pickSiteTheme(b: {
  industry?: string | null;
  type?: string | null;
  description?: string | null;
  name?: string | null;
}): SiteThemeKey {
  const hay = [b.industry, b.type, b.description, b.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const rule of RULES) {
    if (rule.kw.some((k) => hay.includes(k))) return rule.theme;
  }
  return DEFAULT_SITE_THEME;
}
