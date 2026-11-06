/**
 * Seeds "בית חב״ד בנגקוק" as a website-mode business.
 *
 * Content is hand-authored from the organisation's own public pages
 * (chabadthailand.co.il/houses/bangkok) rather than AI-generated, so every
 * address, phone, prayer time and opening hour on the site is the real one.
 *
 *   npx tsx --env-file=.env.local scripts/seed-chabad-bangkok.ts
 *
 * Re-running is safe: matched by slug, upserted in place. Pass --no-images to
 * keep the existing artwork instead of regenerating it (image generation is
 * the slow part — roughly 2-4 minutes for the seven frames).
 */
import { createClient } from "@supabase/supabase-js";

import type { Json } from "@/types/database";

const OWNER_ID = "2f2f4479-22d1-4525-8702-e02ea043fd73";
const SLUG = "chabad-bangkok";
const SKIP_IMAGES = process.argv.includes("--no-images");
const HERO_ONLY = process.argv.includes("--hero-only");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ---------------------------------------------------------------------------
// Real-world facts
// ---------------------------------------------------------------------------

const ADDRESS = "18 Phra Athit Road, Chana Songkhram, Phra Nakhon, Bangkok 10200, Thailand";
const PHONE = "+66-2-6292770";
const PHONE_RESTAURANT = "+66-2-6292755";
const PHONE_MIKVEH = "+66-81-9244570";
const EMAIL = "bkk@chabadthailand.com";

const BUSINESS = {
  owner_id: OWNER_ID,
  name: 'בית חב"ד בנגקוק',
  type: "מרכז קהילתי ובית חם למטייל",
  industry: "קהילה יהודית, אירוח וכשרות",
  location: ADDRESS,
  target_audience:
    "מטיילים ישראלים ויהודים בבנגקוק, משפחות, אנשי עסקים ותיירים המחפשים אוכל כשר, מניין, שבת וסיוע במקום",
  description:
    'בית חב"ד בנגקוק שוכן ברחוב פרה אתית, צעדים מרחוב קאוסן — התחנה הראשונה של כל מטייל יהודי בתאילנד. כבר למעלה מ-30 שנה מנהלים אותו הרב נחמיה ונחמי וילהלם, שליחי הרבי בבנגקוק. במקום בית כנסת ומניינים בכל ימות השבוע, שתי מסעדות כשרות למהדרין — חלבית ובשרית עם משלוחים, מקווה טהרה לנשים בתיאום מראש, שבתות וחגים לאלפי אורחים, חנות מוצרים ישראלים, כביסה, אחסון ציוד, פינת ישיבה ומשחקים, וסיוע בשעת חירום בכל שעה. בית חם לכל יהודי, בלב אסיה.',
  site_mode: "website" as const,
  status: "ready" as const,
  catalog_only: false,
  // Nothing is sold here, so the hero trust marquee must not claim "תשלום
  // מאובטח ומוצפן" — that line is driven purely by payment_methods.
  payment_methods: [] as unknown as Json,
};

const PAGE_HOME = {
  hero: {
    headline: "בית חם לכל יהודי, בלב בנגקוק",
    subheadline:
      "יותר מ-30 שנה שבית חב״ד בנגקוק הוא התחנה הראשונה של המטייל היהודי בתאילנד — ארוחה כשרה, מניין, שבת בלתי נשכחת ואוזן קשבת בכל שעה. פשוט תיכנסו.",
    cta: { text: "דברו איתנו עכשיו", href: "/#contact" },
  },
  benefits: [
    {
      title: "פתוח כל יום, 09:00–00:00",
      description:
        "לא צריך תיאום ולא צריך סיבה. דלת פתוחה מהבוקר ועד חצות — לנוח, לטעון טלפון, לשאול שאלה או פשוט לשבת עם ישראלים אחרים.",
    },
    {
      title: "שתי מסעדות כשרות למהדרין",
      description:
        "המסעדה החלבית ״החלבית״ והמסעדה הבשרית, שתיהן בהשגחת בית חב״ד — כולל משלוחים למלון. אוכל ביתי אמיתי אחרי שבועיים של פאד תאי.",
    },
    {
      title: "שבת שלא תשכחו",
      description:
        "מאות אורחים סביב שולחנות ארוכים, קידוש, שירה וסיפורים — שבת בבית חב״ד בנגקוק היא החוויה שכל מטייל מספר עליה בחזרה הביתה.",
    },
  ],
  socialProof:
    "מאז 1993 פועלת רשת חב״ד תאילנד ושירתה למעלה משני מיליון יהודים; בית חב״ד בנגקוק, בהנהלת הרב נחמיה ונחמי וילהלם, הוא הוותיק והמרכזי שבהם.",
};

const PAGE_ABOUT = {
  headline: "שלושים שנה של דלת פתוחה",
  story:
    "הגענו לבנגקוק לפני למעלה משלושים שנה, כשליחים של הרבי מליובאוויטש, עם משימה אחת פשוטה: שאף יהודי לא יישאר לבד במזרח. התחלנו בדירה קטנה עם שולחן שבת אחד, והיום בית חב״ד ברחוב פרה אתית הוא בית מלא — בית כנסת, שתי מסעדות כשרות, מקווה, חנות, וחדר שבו תמיד יושב מישהו ומדבר.\n\nבנגקוק היא צומת. אנשים עוברים בה בדרך לאיים, בדרך הביתה, בדרך לעסקה או אחרי שנה של טיול. חלקם באים לאכול, חלקם באים להתפלל, וחלקם באים כי משהו השתבש — נגנב הדרכון, נגמר הכסף, קרה משהו במשפחה. אנחנו כאן בשביל כל אחד מהמצבים האלה, באותה מידה.\n\nאנחנו לא שואלים מאיפה אתם, כמה אתם יודעים או מה אתם שומרים. הכניסה חופשית, האוכל כשר, והקפה חם. זה כל הסיפור.",
  values: [
    {
      title: "אהבת ישראל בלי תנאים",
      description: "כל יהודי הוא אורח, בלי מבחן כניסה ובלי שאלות. זה הכלל היחיד בבית הזה.",
    },
    {
      title: "כשרות למהדרין",
      description: "כל מה שיוצא מהמטבחים שלנו הוא בהשגחה מלאה, כדי שתוכלו לאכול בראש שקט.",
    },
    {
      title: "עזרה בשעת צרה",
      description: "אובדן דרכון, אשפוז, תקלה כספית או חירום משפחתי — יש למי להתקשר, גם באמצע הלילה.",
    },
    {
      title: "בית, לא משרד",
      description: "פינת ישיבה, משחקים, אחסון ציוד וכביסה. דברים קטנים שהופכים מקום זר לבית.",
    },
  ],
  teamNote:
    "הרב נחמיה ונחמי וילהלם מנהלים את בית חב״ד בנגקוק יחד עם צוות מתנדבים, בחורי ישיבה ומשפחות מהקהילה המקומית.",
};

const PAGE_SERVICES = {
  headline: "מה מחכה לכם אצלנו",
  intro:
    "הכול תחת קורת גג אחת, ברחוב פרה אתית — צעדים מקאוסן רואד ומרחק נסיעה קצרה מכל מקום בבנגקוק.",
  items: [
    {
      name: "בית כנסת ומניינים",
      description:
        "מניין קבוע בכל ימות השבוע ובשבת, בבית כנסת חם עם ספרים, טליתות ותפילין לשימוש חופשי. אין צורך בהרשמה — פשוט מגיעים.",
      price: null,
      features: [
        "שחרית בימות החול — 09:00",
        "מנחה — רבע שעה לפני השקיעה",
        "ערבית — 45 דקות לאחר מכן",
        "שיעור גמרא בין מנחה לערבית",
        "טלית ותפילין זמינים במקום",
      ],
    },
    {
      name: "מסעדות כשרות למהדרין",
      description:
        "שתי מסעדות בהשגחת בית חב״ד: ״החלבית״ למנות חלביות ומאפים, ומסעדה בשרית עם תפריט ביתי ישראלי ומשלוחים למלונות באזור.",
      price: null,
      features: [
        "פתוח א׳–ה׳ 10:00–22:00",
        "יום שישי 10:00–15:00",
        "מוצאי שבת אחרי הבדלה ועד 22:00",
        "משלוחים למלון — " + PHONE_RESTAURANT,
        "הזמנות קבוצות ואירועים",
      ],
    },
    {
      name: "שבתות וחגים",
      description:
        "ארוחות ליל שבת ושבת בצהריים לכל מי שמגיע, וסעודות חג עם הרשמה מראש. שולחנות ארוכים, קידוש, שירה ואווירה שלא תשכחו.",
      price: null,
      features: [
        "שיעור חסידות ופרשת שבוע — 09:30",
        "שחרית של שבת — 10:00",
        "מנחה בזמן הדלקת נרות",
        "ערבית והבדלה שעה לאחר מנחה",
        "הרשמה מראש לסעודות החג",
      ],
    },
    {
      name: "מקווה טהרה לנשים",
      description:
        "מקווה טהרה נעים, חדיש ומפנק בבית חב״ד. יש לתאם מראש עם הרבנית נחמי וילהלם, ואנחנו עוזרים גם בהתאמת הזמנים סביב טיסות.",
      price: null,
      features: [
        "בתיאום מראש בלבד",
        "תיאום עם הרבנית נחמי וילהלם — " + PHONE_MIKVEH,
        "ליווי ודיסקרטיות מלאה",
        "התאמה ללוח הזמנים שלכם",
      ],
    },
    {
      name: "סיוע ותמיכה למטייל",
      description:
        "הצד הפחות מצולם של בית חב״ד: אובדן דרכון, אשפוז, מצוקה כספית, חירום משפחתי או סתם עצה על העיר. יש עם מי לדבר, בכל שעה.",
      price: null,
      features: [
        "סיוע בשעת חירום",
        "אחסון ציוד ותיקים",
        "שירותי כביסה",
        "חנות מוצרים ישראלים",
        "פינת ישיבה, משחקים ואינטרנט",
        "המלצות על מלונות באזור",
      ],
    },
    {
      name: "הריטריט בבנגקוק — המסע אל עצמי",
      description:
        "סדנה מיוחדת בריזורט בבנגקוק, עם כלים לחיים למי שמחפש משהו מעבר לתחנה טכנית בדרך לאיים. בנוסף מתקיימות אצלנו סדנאות יהדות מדי חודש.",
      price: null,
      features: [
        "סדנה בריזורט בבנגקוק",
        "סדנאות יהדות מדי חודש",
        "ארוחות כשרות מלאות",
        "לפרטים על הסדנה הקרובה — " + PHONE,
      ],
    },
  ],
};

const PAGE_CONTACT = {
  headline: "אנחנו כאן, בואו נדבר",
  intro:
    "מגיעים לבנגקוק, צריכים מקום לשבת, רוצים להזמין ארוחה או שנקלעתם למצב שצריך עזרה? כתבו לנו, שלחו וואטסאפ ל-" +
    PHONE +
    ", או במייל " +
    EMAIL +
    " — עונים בעברית.",
  formFields: ["שם מלא", "טלפון / וואטסאפ", "אימייל", "תאריכי השהות בבנגקוק", "במה נוכל לעזור?"],
  responseTime: "מענה בוואטסאפ בדרך כלל תוך שעה, בשעות הפעילות 09:00–00:00 (שעון תאילנד)",
};

const PAGE_FAQ = {
  headline: "שאלות שנשאלות כאן כל יום",
  items: [
    {
      question: "צריך לתאם מראש כדי להגיע?",
      answer:
        "לא. בית חב״ד פתוח כל יום בין 09:00 ל-00:00 וכל יהודי מוזמן להיכנס בלי תיאום ובלי תשלום. תיאום מראש נדרש רק למקווה ולסעודות חג.",
    },
    {
      question: "איפה זה בדיוק ואיך מגיעים?",
      answer:
        "הכתובת היא 18 Phra Athit Road, Chana Songkhram, Phra Nakhon, Bangkok 10200 — צעדים מרחוב קאוסן, ליד רציף הסירות של נהר הצ׳או פראיה. כל נהג טוק-טוק או מונית מכיר את הכתובת, ואפשר גם להגיע ברכבת המהירה ובהמשך במונית קצרה.",
    },
    {
      question: "מה שעות הפעילות של המסעדות?",
      answer:
        "ראשון עד חמישי 10:00–22:00, יום שישי 10:00–15:00, ובמוצאי שבת אחרי ההבדלה ועד 22:00. יש גם משלוחים למלונות באזור בטלפון " +
        PHONE_RESTAURANT +
        ".",
    },
    {
      question: "צריך להירשם לארוחות שבת?",
      answer:
        "לארוחות ליל שבת ושבת בצהריים אפשר פשוט להגיע. לסעודות חג, שבהן מגיעים אלפי אורחים, יש הרשמה מראש — צרו קשר מוקדם ככל האפשר.",
    },
    {
      question: "יש מקווה טהרה?",
      answer:
        "כן, מקווה טהרה לנשים, בתיאום אישי ודיסקרטי מראש בטלפון " + PHONE_MIKVEH + ".",
    },
    {
      question: "איפה אפשר לישון בקרבת מקום?",
      answer:
        "יש מלונות רבים במרחק הליכה: Chillax Heritage Hotel צמוד לבית חב״ד, Riva Surya Bangkok ממש מולנו, Khaosan Art Hotel ו-New Siam Riverside במרחק 3 דקות, Rambuttri Village Plaza 7 דקות, Nouvo City Hotel 10 דקות, וגם The StandardX Bangkok Phra Arthit ו-Villa De Khaosan by Chillax. כתבו לנו את התאריכים והתקציב ונכוון אתכם למה שמתאים.",
    },
    {
      question: "נקלעתי לבעיה בתאילנד — אתם יכולים לעזור?",
      answer:
        "כן, וזה חלק מרכזי ממה שאנחנו עושים: אובדן דרכון, אשפוז, מצוקה כספית, חירום משפחתי או קשר עם הרשויות. התקשרו ל-" +
        PHONE +
        " בכל שעה.",
    },
    {
      question: "יש בתי חב״ד נוספים בתאילנד?",
      answer:
        "כן. מלבד בנגקוק פועלים בתי חב״ד בפוקט, קוסמוי, קופנגן, צ׳יאנג מאי, פאי, מרכז העיר בנגקוק (בית אלישבע) וגם בלאוס. כולם חלק מרשת חב״ד תאילנד שנוסדה ב-1993.",
    },
  ],
};

const SEO_META = {
  title: 'בית חב"ד בנגקוק — בית חם לכל יהודי בתאילנד',
  description:
    'בית חב"ד בנגקוק: מסעדות כשרות למהדרין, מניינים, שבתות וחגים, מקווה וסיוע למטייל. פרה אתית 18, פתוח כל יום 09:00–00:00.',
  keywords: [
    'בית חב"ד בנגקוק',
    "אוכל כשר בנגקוק",
    "מסעדה כשרה תאילנד",
    "שבת בבנגקוק",
    'חב"ד תאילנד',
    "מקווה בנגקוק",
    "מניין בבנגקוק",
    "עזרה למטייל בתאילנד",
  ],
};

const BRAND = {
  brand_name: 'בית חב"ד בנגקוק',
  slogan: "בית חם לכל יהודי, בלב בנגקוק",
  mission:
    "לוודא שאף יהודי בתאילנד לא יישאר לבד — עם ארוחה כשרה, מניין, שבת ועזרה אמיתית בכל שעה.",
  brand_voice: "חם, ישיר, מזמין, בלי התחכמויות ובלי דרישות סף",
  color_palette: [
    { name: "סגול חב״ד", hex: "#981D97", usage: "primary" },
    { name: "תכלת סיאם", hex: "#00C1D5", usage: "secondary" },
    { name: "זהב תאילנדי", hex: "#FEDB00", usage: "accent" },
  ],
  typography: { primary: { font: "Heebo" }, secondary: { font: "Heebo" } },
};

const STATS = [
  { value: "30", suffix: "+", label: "שנות שליחות בבנגקוק" },
  { value: "1993", suffix: null, label: 'שנת ייסוד רשת חב"ד תאילנד' },
  { value: "2", suffix: null, label: "מסעדות כשרות למהדרין" },
  { value: "09:00–00:00", suffix: null, label: "פתוח כל יום בשבוע" },
];

const PROCESS_STEPS = [
  {
    title: "פשוט נכנסים",
    description:
      "בלי תיאום, בלי תשלום ובלי שאלות. פרה אתית 18, כל יום בין 09:00 ל-00:00. יש מקום לשבת, לטעון טלפון ולנשום.",
  },
  {
    title: "אוכלים משהו כשר",
    description:
      "עולים למסעדה החלבית או הבשרית, או מזמינים משלוח למלון. אוכל ביתי אמיתי בהשגחה מלאה.",
  },
  {
    title: "מצטרפים לתפילה או לשיעור",
    description:
      "מניין בכל יום, שיעור גמרא בין מנחה לערבית ושיעור חסידות בשבת בבוקר. טלית ותפילין מחכים במקום.",
  },
  {
    title: "נשארים לשבת",
    description:
      "שולחנות ארוכים, קידוש, שירה ואנשים מכל העולם. זו החוויה שאנשים חוזרים לספר עליה בבית.",
  },
  {
    title: "מבקשים עזרה כשצריך",
    description:
      "דרכון שנעלם, אשפוז, מצוקה כספית או חירום משפחתי — מתקשרים ל-" +
      PHONE +
      " ואנחנו נכנסים לתמונה.",
  },
];

// One joint entry, because the only real photograph of them is a joint one —
// splitting it across two cards would crop one of them out of their own portrait.
const TEAM = [
  {
    name: "הרב נחמיה ונחמי וילהלם",
    role: 'שלוחי הרבי ומנהלי בית חב"ד בנגקוק',
    bio: "הגיעו לבנגקוק לפני כשלושים שנה כשלוחי הרבי, והפכו את בית חב״ד לבית חם ליהודים מכל העולם. הרב נחמיה מוביל את המניינים, הכשרות והסיוע למטיילים; הרבנית נחמי מובילה את האירוח, ארוחות השבת והחגים ואת המקווה. אצלם הדלת פתוחה בכל שעה.",
    photoKey: "rabbi",
  },
  {
    name: "צוות המתנדבים",
    role: "בחורי ישיבה ומתנדבים מהקהילה",
    bio: "צוות מתחלף של בחורי ישיבה ומתנדבים שמפעילים את המטבחים, המניינים והסיוע היומיומי לאורחים.",
    photoKey: null,
  },
];

const COURSES = [
  {
    title: "שיעור גמרא יומי",
    description: "שיעור גמרא בין מנחה לערבית, בכל ימות החול. פתוח לכל רמה, גם למי שלא פתח גמרא שנים.",
    duration: "בין מנחה לערבית",
    level: "לכל הרמות",
  },
  {
    title: "שיעור חסידות ופרשת שבוע",
    description: "שבת בבוקר ב-09:30, לפני שחרית — פרשת השבוע דרך פנימיות התורה, בעברית פשוטה.",
    duration: "09:30, שבת בבוקר",
    level: "לכל הרמות",
  },
  {
    title: "מפגשים אישיים וריטריט",
    description:
      "שיחות אישיות, מפגשי העמקה וימי ריטריט לקבוצות ולזוגות. בתיאום מראש בטלפון " + PHONE + ".",
    duration: "בתיאום מראש",
    level: "אישי / קבוצתי",
  },
];

const EVENTS = [
  {
    title: "ליל שבת בבית חב״ד",
    description:
      "קבלת שבת, קידוש וארוחת ליל שבת סביב שולחנות ארוכים. בלי הרשמה — פשוט מגיעים לפני השקיעה.",
    location: "בית חב״ד בנגקוק, פרה אתית 18",
  },
  {
    title: "סעודת שבת בצהריים",
    description:
      "שחרית ב-10:00 ולאחריה קידוש וסעודה. מנחה בזמן הדלקת נרות, ערבית והבדלה שעה לאחר מכן.",
    location: "בית חב״ד בנגקוק, פרה אתית 18",
  },
  {
    title: "סעודות ראש השנה ויום כיפור",
    description:
      "תפילות החגים וסעודות לאלפי אורחים. ההרשמה נפתחת מוקדם ומתמלאת מהר — צרו קשר בהקדם.",
    location: "בית חב״ד בנגקוק",
  },
  {
    title: "סדר פסח לאלפי מטיילים",
    description:
      "אחד מלילות הסדר הגדולים בעולם. הגדה, מצות, יין וארוחה מלאה — עם הרשמה מראש.",
    location: "בית חב״ד בנגקוק",
  },
  {
    title: "חנוכה ברחוב קאוסן",
    description: "הדלקת נרות פומבית בלב רובע התרמילאים, עם סופגניות, מוזיקה וישראלים מכל העולם.",
    location: "רחוב קאוסן, בנגקוק",
  },
  {
    title: "ריטריט בנגקוק",
    description:
      "ימי העמקה, שיעורים ומפגשים אישיים לקבוצות ולזוגות. פרטים והרשמה בטלפון " + PHONE + ".",
    location: "בית חב״ד בנגקוק",
  },
];

const BRANCHES = [
  {
    name: 'בית חב"ד בנגקוק (הראשי)',
    address: ADDRESS,
    phone: `${PHONE} · מסעדה ${PHONE_RESTAURANT} · ${EMAIL}`,
    hours: "כל יום 09:00–00:00 · מסעדות א׳–ה׳ 10:00–22:00, ו׳ 10:00–15:00",
  },
  {
    name: 'בית חב"ד מרכז העיר — בית אלישבע',
    address: "מרכז העיר, בנגקוק, תאילנד",
    phone: PHONE,
    hours: "לפרטים ותיאום — צרו קשר",
  },
  { name: 'בית חב"ד פוקט', address: "פוקט, תאילנד", phone: null, hours: null },
  { name: 'בית חב"ד קוסמוי', address: "קו סמוי, תאילנד", phone: null, hours: null },
  { name: 'בית חב"ד קופנגן', address: "קו פנגן, תאילנד", phone: null, hours: null },
  { name: 'בית חב"ד צ׳יאנג מאי', address: "צ׳יאנג מאי, תאילנד", phone: null, hours: null },
  { name: 'בית חב"ד פאי', address: "פאי, תאילנד", phone: null, hours: null },
  { name: 'בית חב"ד לאוס', address: "לאוס", phone: null, hours: null },
];

const CERTIFICATIONS = [
  {
    title: "כשרות למהדרין",
    issuer: 'בהשגחת בית חב"ד תאילנד',
    year: null,
  },
  {
    title: 'שליחות רשמית של חב"ד ליובאוויטש',
    issuer: "המרכז לענייני חינוך, ניו יורק",
    year: null,
  },
  {
    title: 'חלק מרשת חב"ד תאילנד',
    issuer: 'נוסדה ב-1993 · 8 בתי חב"ד באזור',
    year: "1993",
  },
];

const DONATIONS = [
  {
    title: "תרמו לארוחות השבת",
    description:
      "כל ארוחת שבת בבית חב״ד בנגקוק מוגשת לכל מי שמגיע, בלי תשלום. התרומה שלכם היא מה שמאפשר את זה — צלחת אחת, מטייל אחד, שבת אחת בכל פעם.",
  },
  {
    title: "קרן סיוע חירום למטייל",
    description:
      "דרכון שנגנב, אשפוז פתאומי, כרטיס טיסה הביתה. הקרן הזו נכנסת לפעולה ברגע שמישהו מרים טלפון, ולא שואלת שאלות.",
  },
  {
    title: "סעודות החגים",
    description:
      "סדר פסח, ראש השנה וסוכות לאלפי אורחים. תרומה לחג היא הדרך להיות שותפים באחד השולחנות הגדולים בעולם.",
  },
];

const MENU_ITEMS = [
  {
    section: "המסעדה החלבית — ״החלבית״",
    name: "מנות חלביות ומאפים",
    description: "פסטות, סלטים, שקשוקה, מאפים טריים וקפה — הכול בהשגחה חלבית מלאה.",
  },
  {
    section: "המסעדה החלבית — ״החלבית״",
    name: "ארוחת בוקר ישראלית",
    description: "ביצים, סלט, גבינות ולחם טרי. הבוקר שחיכיתם לו אחרי שבועיים בדרכים.",
  },
  {
    section: "המסעדה הבשרית",
    name: "תפריט ביתי ישראלי",
    description: "מרקים, אורז, שניצל, בשרים על האש וצלחות ביתיות בהשגחה בשרית מלאה.",
  },
  {
    section: "המסעדה הבשרית",
    name: "משלוחים למלון",
    description: "מזמינים בטלפון " + PHONE_RESTAURANT + " ומקבלים ארוחה כשרה עד הדלת.",
  },
  {
    section: "שבת וחג",
    name: "סעודות שבת",
    description: "ליל שבת ושבת בצהריים, פתוח לכל מי שמגיע. אין צורך בהרשמה.",
  },
  {
    section: "שבת וחג",
    name: "סעודות חג",
    description: "סדר פסח, ראש השנה, סוכות ועוד — בהרשמה מראש בלבד.",
  },
];

// ---------------------------------------------------------------------------
// Real photographs, mirrored from the organisation's own site
//
// ⚠️ These are chabadthailand.co.il's copyrighted photographs, including a
// portrait of two identifiable real people. They are mirrored here because the
// site being built IS that organisation's site — get their permission before
// this goes anywhere beyond a preview. Everything else on the page is either
// hand-authored fact or clearly-generated atmosphere art.
// ---------------------------------------------------------------------------

const UPLOADS = "https://chabadthailand.co.il/wp-content/uploads/";

/** Encode each path segment — every one of these filenames is Hebrew. */
const source = (p: string) => UPLOADS + p.split("/").map(encodeURIComponent).join("/");

type RealPhoto = {
  key: string;
  url: string;
  /** The composite skyline graphic carries the building on a transparent
   *  background; this pulls just the building out of it. */
  crop?: { left: number; top: number; width: number; height: number };
  /** Flatten alpha onto white — several of these are cut-outs. */
  flatten?: boolean;
  width: number;
  height: number;
};

const REAL_PHOTOS: RealPhoto[] = [
  {
    key: "rabbi",
    url: source("2025/10/הרב-נחמיה-ונחמי-e1761838077148-1024x780.webp"),
    width: 1024,
    height: 780,
  },
  {
    key: "building",
    url: source("2025/10/בנגקוק-12-1.webp"),
    crop: { left: 1245, top: 130, width: 780, height: 490 },
    flatten: true,
    width: 1170,
    height: 735,
  },
  {
    key: "rooftop",
    url: source("2025/09/בית-חבד-בנגקוק-תאילנד.jpeg"),
    width: 747,
    height: 1120,
  },
];

/** Gallery cards built from the real photographs, shown before the art. */
const REAL_GALLERY: { key: string; title: string; caption: string }[] = [
  {
    key: "building",
    title: 'בית חב"ד בנגקוק',
    caption: "המבנה ברחוב פרה אתית 18 — צעדים מרחוב קאוסן",
  },
  {
    key: "rooftop",
    title: "פינת המטיילים",
    caption: "הגג של בית חב״ד — מטיילים, שיחות וקפה עד חצות",
  },
  {
    key: "rabbi",
    title: "הרב נחמיה ונחמי וילהלם",
    caption: "שלוחי הרבי בבנגקוק כבר למעלה משלושים שנה",
  },
];

async function fetchReal(photo: RealPhoto): Promise<Buffer> {
  const res = await fetch(photo.url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`non-image (${contentType})`);
  return Buffer.from(await res.arrayBuffer());
}

async function mirrorRealPhoto(businessId: string, photo: RealPhoto): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    let pipeline = sharp(await fetchReal(photo));
    if (photo.crop) pipeline = pipeline.extract(photo.crop);
    if (photo.flatten) pipeline = pipeline.flatten({ background: "#ffffff" });
    const webp = await pipeline
      .resize(photo.width, photo.height, { fit: "cover" })
      .webp({ quality: 86 })
      .toBuffer();
    const url = await upload(`${businessId}/chabad/real-${photo.key}.webp`, webp, "image/webp");
    console.log(`   ✔ real:${photo.key}`);
    return url;
  } catch (e) {
    console.warn(`   ✖ real:${photo.key}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Imagery — Pollinations (free, no key) uploaded to the public site-assets bucket
// ---------------------------------------------------------------------------

const PHOTO_STYLE =
  "Photorealistic editorial photograph, warm natural light, shallow depth of field, rich colour, no text, no watermark, no captions, no lettering anywhere in the image.";

// The horizon hero renders this at full strength with no scrim, so the frame
// itself has to carry the warmth — an evening/blue-hour take read as a black
// rectangle behind the headline.
const HERO_PROMPT =
  "A long communal Shabbat table photographed from one end straight down its length, filling the frame, in a warm sunlit hall: crisp white tablecloth, rows of set places with white plates and silver cutlery, several braided challah loaves under embroidered velvet covers, silver kiddush cups filled with red wine, lit white candles in silver candlesticks, small arrangements of white flowers, warm wooden chairs down both sides. Golden afternoon light pours in from tall windows on the right; warm honey-toned wooden walls behind. Rich saturated colour, deep warm golden tones, sharp focus throughout, not washed out, not overexposed, no people, no text. " +
  PHOTO_STYLE;

const GALLERY_PROMPTS: { title: string; caption: string; prompt: string }[] = [
  {
    title: "שולחן השבת",
    caption: "שולחנות ארוכים, נרות וחלות — ליל שבת בבית חב״ד בנגקוק",
    prompt:
      "Close-up of a Shabbat table: braided challah bread under an embroidered cover, a silver kiddush cup, lit white candles in silver candlesticks, white tablecloth, warm golden evening light. No people, no text. " +
      PHOTO_STYLE,
  },
  {
    title: "בית הכנסת",
    caption: "בית כנסת חם עם ארון קודש, ספרים וטליתות לשימוש חופשי",
    prompt:
      "Interior of a small warm synagogue: wooden bookshelves full of prayer books, a carved wooden ark with a velvet curtain, simple wooden benches, soft warm light from hanging lamps. Empty, no people, no text. " +
      PHOTO_STYLE,
  },
  {
    title: "המטבח הכשר",
    caption: "אוכל ביתי בהשגחה מלאה, כל יום מ-10:00",
    prompt:
      "Overhead view of a home-style Israeli meal on a wooden table: bowls of hummus, fresh salad, rice, soup, warm pita bread, olive oil. Bright natural daylight, no people, no text. " +
      PHOTO_STYLE,
  },
  {
    title: "רחוב קאוסן",
    caption: "צעדים מרחוב קאוסן, לב רובע התרמילאים של בנגקוק",
    prompt:
      "A lively Bangkok backpacker street at night: neon signs, street food carts, tuk-tuks, warm glowing lanterns, wet pavement reflecting the lights. Cinematic, no readable text, no legible signage lettering. " +
      PHOTO_STYLE,
  },
  {
    title: "נהר הצ׳או פראיה",
    caption: "בנגקוק בשעת בין ערביים, דקות הליכה מהבית",
    prompt:
      "The Chao Phraya river in Bangkok at golden hour: long-tail boats, a golden temple spire on the bank, the city skyline behind, warm orange sky reflected in the water. No text. " +
      PHOTO_STYLE,
  },
];

async function pollinate(prompt: string, width: number, height: number): Promise<Buffer> {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&nologo=true&private=true&enhance=false` +
    `&seed=${Math.floor(Math.random() * 1e9)}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`Pollinations returned non-image (${contentType || "unknown"})`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5_000) throw new Error("Pollinations returned an empty image");
      return buffer;
    } catch (e) {
      lastError = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 8_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Pollinations failed");
}

/** Same Blob handling as lib/services/image-gen.ts — a raw Buffer gets
 *  UTF-8-mangled by fetch on some runtimes and lands in storage corrupted. */
async function upload(path: string, data: Buffer, contentType: string): Promise<string> {
  const blob = new Blob([new Uint8Array(data)], { type: contentType });
  const { error } = await db.storage
    .from("site-assets")
    .upload(path, blob, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: pub } = db.storage.from("site-assets").getPublicUrl(path);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

async function makeImage(
  businessId: string,
  name: string,
  prompt: string,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const raw = await pollinate(prompt, width, height);
    const sharp = (await import("sharp")).default;
    const webp = await sharp(raw).resize(width, height, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    const url = await upload(`${businessId}/chabad/${name}.webp`, webp, "image/webp");
    console.log(`   ✔ ${name}`);
    return url;
  } catch (e) {
    console.warn(`   ✖ ${name}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function upsertBusiness(): Promise<string> {
  const { data: existingSite } = await db
    .from("websites")
    .select("business_id")
    .eq("slug", SLUG)
    .maybeSingle();

  if (existingSite?.business_id) {
    const { error } = await db.from("businesses").update(BUSINESS).eq("id", existingSite.business_id);
    if (error) throw new Error(`update business: ${error.message}`);
    return existingSite.business_id;
  }

  const { data, error } = await db.from("businesses").insert(BUSINESS).select("id").single();
  if (error) throw new Error(`insert business: ${error.message}`);
  return data.id;
}

async function upsertOne(table: string, businessId: string, row: Record<string, unknown>) {
  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing) {
    const { error } = await db.from(table).update(row).eq("id", existing.id);
    if (error) throw new Error(`${table}: ${error.message}`);
  } else {
    const { error } = await db.from(table).insert({ business_id: businessId, ...row });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function replaceAll(table: string, businessId: string, rows: Record<string, unknown>[]) {
  const del = await db.from(table).delete().eq("business_id", businessId);
  if (del.error) throw new Error(`${table} delete: ${del.error.message}`);
  if (!rows.length) return;
  const { error } = await db
    .from(table)
    .insert(rows.map((r, i) => ({ business_id: businessId, sort: i, ...r })));
  if (error) throw new Error(`${table} insert: ${error.message}`);
}

/** Modules that render on this site, in the order they appear. Everything not
 *  listed here is explicitly switched off. */
const ENABLED_MODULES = [
  "stats",
  "process_steps",
  "menu",
  "events",
  "courses",
  "team",
  "gallery",
  "certifications",
  "branches",
  "donations",
  "faqs",
  "contact",
];
const DISABLED_MODULES = [
  "testimonials",
  "pricing",
  "blog",
  "jobs",
  "gift_cards",
  "before_after",
  "memberships",
  "downloads",
  "partners",
  "returns",
  "order_tracking",
];

async function run() {
  console.log(`▶ ${SLUG} — בית חב"ד בנגקוק`);

  const businessId = await upsertBusiness();
  console.log(`  business ${businessId}`);

  const moduleConfig: Record<string, { enabled: boolean; sort: number }> = {};
  ENABLED_MODULES.forEach((k, i) => (moduleConfig[k] = { enabled: true, sort: i }));
  DISABLED_MODULES.forEach((k, i) => (moduleConfig[k] = { enabled: false, sort: 100 + i }));
  const modErr = await db
    .from("businesses")
    .update({ module_config: moduleConfig as unknown as Json })
    .eq("id", businessId);
  if (modErr.error) throw new Error(`module_config: ${modErr.error.message}`);

  await upsertOne("brand_assets", businessId, {
    ...BRAND,
    color_palette: BRAND.color_palette as unknown as Json,
    typography: BRAND.typography as unknown as Json,
    generated_at: new Date().toISOString(),
  });

  await upsertOne("whatsapp_config", businessId, {
    display_phone: PHONE,
    enabled: true,
    greeting: 'שלום! הגעתם לבית חב"ד בנגקוק. איך נוכל לעזור?',
  });

  // Real photographs first — the team card and the first gallery slots depend
  // on them, and they are cheap (three downloads) next to the generated art.
  console.log("  · mirroring real photographs");
  const real: Record<string, string> = {};
  for (const photo of REAL_PHOTOS) {
    const url = await mirrorRealPhoto(businessId, photo);
    if (url) real[photo.key] = url;
  }

  console.log("  · modules content");
  await replaceAll("stats", businessId, STATS);
  await replaceAll("process_steps", businessId, PROCESS_STEPS);
  await replaceAll(
    "team_members",
    businessId,
    TEAM.map(({ photoKey, ...m }) => ({
      ...m,
      photo_url: photoKey ? (real[photoKey] ?? null) : null,
    })),
  );
  await replaceAll("courses", businessId, COURSES.map((c) => ({ ...c, active: true })));
  await replaceAll("events", businessId, EVENTS.map((e) => ({ ...e, active: true })));
  await replaceAll("branches", businessId, BRANCHES);
  await replaceAll("certifications", businessId, CERTIFICATIONS);
  await replaceAll("donations", businessId, DONATIONS.map((d) => ({ ...d, active: true })));
  await replaceAll("menu_items", businessId, MENU_ITEMS);
  await replaceAll(
    "faqs",
    businessId,
    PAGE_FAQ.items.map((f) => ({ question: f.question, answer: f.answer })),
  );

  type GalleryRow = { title: string; caption: string; image_url: string };

  // The real photographs always lead the gallery. The generated atmosphere art
  // follows — regenerated on a full run, and otherwise carried over from what
  // is already stored, so --no-images never wipes it.
  const realGallery: GalleryRow[] = REAL_GALLERY.filter((g) => real[g.key]).map((g) => ({
    title: g.title,
    caption: g.caption,
    image_url: real[g.key],
  }));

  let heroUrl: string | null = null;
  let artGallery: GalleryRow[] = [];

  if (SKIP_IMAGES || HERO_ONLY) {
    const { data: existing } = await db
      .from("gallery_items")
      .select("title, caption, image_url")
      .eq("business_id", businessId)
      .order("sort");
    // Only carry over art that a full run would still produce — dropping a
    // prompt from GALLERY_PROMPTS must actually retire its stored image, not
    // leave it stranded in the gallery forever.
    const live = new Set(GALLERY_PROMPTS.map((_, i) => `gallery-${i + 1}.webp`));
    artGallery = (existing ?? [])
      .filter((g) => {
        if (g.image_url.includes("/real-")) return false;
        const file = g.image_url.split("/").pop()?.split("?")[0] ?? "";
        return live.has(file);
      })
      .map((g) => ({ title: g.title ?? "", caption: g.caption ?? "", image_url: g.image_url }));
  }

  if (SKIP_IMAGES) {
    console.log("  · images skipped (--no-images)");
  } else {
    console.log("  · generating imagery (Pollinations, free)");
    heroUrl = await makeImage(businessId, "hero", HERO_PROMPT, 1792, 1024);

    if (!HERO_ONLY) {
      for (const [i, g] of GALLERY_PROMPTS.entries()) {
        const url = await makeImage(businessId, `gallery-${i + 1}`, g.prompt, 1024, 1024);
        if (url) artGallery.push({ title: g.title, caption: g.caption, image_url: url });
      }
    }
  }

  await replaceAll("gallery_items", businessId, [...realGallery, ...artGallery]);

  const websiteRow: Record<string, unknown> = {
    business_id: businessId,
    slug: SLUG,
    published: true,
    generated_at: new Date().toISOString(),
    // aurora, not horizon: horizon paints a white headline straight onto the
    // photo, and this hero is a bright white-tablecloth frame. aurora's scrim
    // guarantees the contrast instead of borrowing it from the picture.
    hero_style: "aurora",
    layout_style: "flow",
    theme: "navy",
    hero_particles_enabled: false,
    page_home: PAGE_HOME as unknown as Json,
    page_about: PAGE_ABOUT as unknown as Json,
    page_services: PAGE_SERVICES as unknown as Json,
    page_contact: PAGE_CONTACT as unknown as Json,
    page_faq: PAGE_FAQ as unknown as Json,
    seo_meta: SEO_META as unknown as Json,
    landing_settings: {} as unknown as Json,
    tracking: {} as unknown as Json,
    social_links: [
      { platform: "whatsapp", url: `https://wa.me/${PHONE.replace(/\D/g, "")}`, enabled: true },
      {
        platform: "googlemaps",
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`,
        enabled: true,
      },
    ] as unknown as Json,
  };
  if (heroUrl) websiteRow.hero_image_url = heroUrl;

  const { data: existingWebsite } = await db
    .from("websites")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existingWebsite) {
    const { error } = await db.from("websites").update(websiteRow).eq("id", existingWebsite.id);
    if (error) throw new Error(`update website: ${error.message}`);
  } else {
    const { error } = await db.from("websites").insert(websiteRow);
    if (error) throw new Error(`insert website: ${error.message}`);
  }

  console.log(`✔ done — /s/${SLUG}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
