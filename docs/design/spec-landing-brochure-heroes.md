# מפרט יישום — דף נחיתה, אתר תדמית ושלושת סגנונות ההירו

> מקור: ממצאים מאומתים בקוד בלבד. אין כאן שום ממצא חדש — רק ארגון, סדר ביצוע וקוד מדויק.
> קיצורי מצבים: **L** = landing (`components/public/landing-page.tsx`), **W/S** = website/store (`app/s/[slug]/page.tsx` + `TierStyles`), **H** = hero (orbit / spotlight / vanguard).

---

## 1. חמשת השינויים בעלי ההשפעה הגדולה ביותר על המראה

### 1.1 מערכת ניגודיות אחת לצבע המותג (`inkOn` / `brandInk`) — קריטי, נוגע ב-L ו-W/S
היום כל משטח מותג מקבע `text-white`, והמסנן היחיד הוא `isLight = R+G+B > 660`. `#FACC15` (475) ו-`#FFD400` (467) עוברים, ולבן עליהם ≈1.4–1.5:1. הכיוון ההפוך שבור באותה מידה: `color: brand` על רקע לבן. קיים כבר helper נכון (`inkOn` ב-`app/q/[token]/page.tsx:48-54`) אבל הוא מקומי ולא מיוצא. **העברה שלו ל-`lib/storefront-brand.ts` + `brandInk` אדפטיבי מתקנת בבת אחת 4 ממצאים קריטיים/גבוהים** (landing-top ×2, landing-bottom ×1, brochure-shell ×1). זה השינוי היחיד שיכול להפוך כפתור המרה בלתי קריא לקריא בכל אתר עם מותג צהוב/ליים/תכלת.

### 1.2 `data-el="module-section"` על כל סקשני המודולים — קריטי, W/S
20 קבצי `*-section.tsx` מחזירים 0 עבור `data-el="module-section"`; 10 מהם פותחים ב-`<section className="bg-white px-4 py-16">`. הכלל `[data-tier="professional"] { color:#ffffff }` (unlayered, מנצח את `.text-zinc-900` שעל אותו div) יורש אל הכותרות — **כותרות לבנות על לוחות לבנים באמצע עמוד שחור**. זה הפגם הכי גלוי בעמוד כולו, והתיקון שלו הוא גם התנאי המקדים לתיקון ה-condensed ולריווח המרכזי.

### 1.3 שחרור ה-h1 של ההירו מהכלל הגורף של הדרג — קריטי, H
`[data-tier="professional"] [data-el="hero"] h1` כופה `clamp(2.75rem,2rem+4vw,6.5rem)`, `font-weight:200`, `color:transparent!important` וגרדיאנט זהב. התוצאה: ב-Orbit הכותרת נשברת ל-5-6 שורות בעמודה של ~556px והפריסה הדו-טורית קורסת; ב-Vanguard האלטרנציה מלא/חלול נמחקת לגרדיאנט אחיד; ב-Spotlight שתי השורות המנוגדות נצבעות זהה. **שלושת הסגנונות מאבדים בדיוק את החתימה שבגללה נבחרו.**

### 1.4 יישור הרשתות — קריטי/גבוה, W/S
שני שברי פריסה אמיתיים: (א) רשת כרטיסי השירותים (`page.tsx:479`) יושבת מחוץ ל-`max-w-5xl` שעוטף רק את הכותרת — כותרת ממורכזת ב-1024px מול כרטיסים ברוחב מלא; (ב) פריסת ה-mosaic (`page.tsx:716`) מקבלת 3 ילדים כי `aboutSection` הוא Fragment עם `SectionDivider` בפנים — הדיוואידר תופס תא ברשת והיתרונות נדחפים לשורה שנייה ריקה למחצה.

### 1.5 שדות טופס שנעלמים — קריטי, brochure-footer
`inputCls` הוא `bg-white` בדיוק כמו הכרטיס, ובדרג המקצועי שניהם ממופים ל-#121214 — השדות נבלעים. במקביל, הטקסט שהמשתמש מקליד בשדה הניוזלטר בפוטר יורש `color:#b8b8b8` על `bg-white` = **1.98:1**. אלה שני מסלולי ההמרה היחידים באתר.

---

## 2. רשימת שינויים לפי קובץ

סדר ביצוע מומלץ: §2.1 → §2.2/§2.3 (צרכני ה-helper) → §2.4/§2.5 (דרג ומודולים) → §2.6-§2.9 (פוטר וטפסים) → §2.10-§2.13 (הירו) → §2.14-§2.15 (סכמות וניקוי).

---

### 2.1 `lib/storefront-brand.ts` — תשתית (חדש; קדימות עליונה)

מעבירים לכאן את `inkOn` הקיים מ-`app/q/[token]/page.tsx:48-54` (במקום לכתוב helper שלישי) ומוסיפים `brandInk` אדפטיבי. `pickBrandColor` נשאר בשורה 17, `isLight` בשורות 5-14 — לא נוגעים בהם.

```ts
// לצד pickBrandColor הקיים
const chan = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function relLum(hex: string) {
  const [r, g, b] = rgb(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** דיו קריא מעל משטח במילוי מותג */
export function inkOn(hex: string) {
  return relLum(hex) > 0.55 ? "#111827" : "#ffffff";
}

/** צבע מותג כטקסט/אייקון מעל לבן — מוחשך עד 4.5:1 */
export function brandInk(hex: string) {
  let [r, g, b] = rgb(hex);
  const ratio = () => 1.05 / (relLum(`#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`) + 0.05);
  for (let i = 0; i < 24 && ratio() < 4.5; i++) {
    r = Math.round(r * 0.92); g = Math.round(g * 0.92); b = Math.round(b * 0.92);
  }
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
```

**החלטה שצריך לקבע:** ממצא landing-bottom הציע סף `> 0.5` וממצא brochure-shell הציע `> 0.45`, ו-`inkOn` הקיים משתמש ב-`0.55`. **מאמצים 0.55 בכל המקומות** — זה הערך שכבר רץ בקוד ייצור ב-`app/q/[token]`. `color-mix(in oklab, X 100%, black 22%)` שהוצע במקור נפסל: הוא מוריד את `#FACC15` רק ל-~2.3:1 ועדיין נכשל.

---

### 2.2 `components/public/landing-page.tsx`

#### קריטי — לבן על מילוי מותג (שורות 77, 114-115, 159, 187, 344, 422)
מסירים `text-white` מכל משטח מותג ומחליפים ב-`color: inkOn(brand)`.

```tsx
// 114-115 — CTA ההירו (shadow-lg בשורה 114 מת ממילא: ה-boxShadow האינליני דורס אותו)
style={{ background: brand, color: inkOn(brand), boxShadow: `0 18px 40px -16px ${brand}80` }}
// שים לב לאלפא 80 — הקוד היום הוא `0 18px 40px -16px ${brand}` בלי אלפא, והצל יוצא אטום מדי
```
אותו טיפול ב-77 (CTA בהדר), 159 (עיגול מספר), 187 (עיגול Check), 422 (סרגל דביק).
בשורה 344 (סקשן ה-CTA כולו) חובה לגזור גם את הצאצאים: `text-white/85` (349) ו-`text-white/80` (360) → `opacity-90` / `opacity-80` על אותו ink, אחרת הכותרת תתוקן והמשנה תישאר בלתי קריאה.
שורה 364 — כפתור ההמרה האחרון, היום `bg-white` + `style={{ color: brand }}`: `style={{ background: inkOn(brand), color: brand }}`.
שורה 352 — להעביר `onLight={relLum(brand) > 0.55}` ל-`CountdownTimer`; הפרופ קיים (`countdown-timer.tsx:30`) ואף קריאה בריפו לא מעבירה אותו, כלומר הענף הבהיר קיים אך מת.

#### גבוה — מותג כטקסט על לבן (99-101, 211, 212, 218, 365)
```tsx
// 101
style={{ background: `${brand}1f`, color: brandInk(brand) }}
// 212, 218, 365
style={{ color: brandInk(brand) }}
// 211 — הגבול היום ${brand}33 (20%) כמעט בלתי נראה
style={{ borderColor: `${brand}4d` }}
```
שורה 301 (Quote ב-`opacity-25`) — לא נוגעים, דקורטיבי.

#### בינוני — יישור רוחב
- שורה 66 (הדר): `max-w-6xl` → `max-w-5xl`
- שורה 206 (סקשן 5): `max-w-4xl` → `max-w-5xl`
- **לא לגעת** ב-`max-w-3xl` (סרטון 272, FAQ 322) וב-`max-w-xl` (טופס 374) — מגבלות measure מכוונות.

#### בינוני — טיפוגרפיה
```tsx
// 177, 207, 292 — h2 ללא חסימת measure
className="mx-auto max-w-2xl text-center text-3xl font-bold text-balance sm:text-4xl"
// 126, 152, 244, 323 — להוסיף text-balance בלבד
// 138, 164, 193 — כותרות כרטיסים (h3 יורש 16px בגלל preflight של Tailwind v4)
// 138/164: "mt-4 text-lg font-semibold leading-snug"
// 193:     "text-lg font-semibold leading-snug"   ← בלי mt-4, ה-h3 הוא הילד הראשון ב-div של 192
```
התיאורים (139, 165, 194) נשארים `text-sm` — עם `text-lg` כבר יש מדרגה של 4px + הבדל משקל.

#### בינוני — גלריה (249, 257)
```tsx
// 249
className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
// לפני הרנדר:
const hasCaptions = gallery.some((_, i) => Boolean(landing.gallery.captions[i]));
// 257:
{hasCaptions && (
  <figcaption className="px-4 py-3 text-sm text-zinc-600">
    {landing.gallery.captions[i] || "\u00A0"}
  </figcaption>
)}
```
חובה nbsp ולא רווח רגיל — אחרת הרצועה קורסת לגובה 0 והפער חוזר.

#### בינוני — סרגל דביק ופוטר (407, אחרי 443)
```tsx
// 407 — safe-area (דפוס קיים בריפו: store-chat-widget.tsx:175)
className="sticky bottom-0 z-40 pt-3 sm:hidden ..."
style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
// מיד אחרי </SiteFooter> (אחרי 443, בתוך ה-div השורש):
<div aria-hidden className="h-[76px] sm:hidden" />
```

#### בינוני — FAQ (328-337)
```tsx
// לייבא ChevronDown מ-lucide-react (שורות 1-9)
<summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-semibold">
  {q}
  <ChevronDown className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
</summary>
```
זה גם מחייה את `className="group"` שבשורה 328 (היום אין בתוכו אף וריאנט `group-*`). **אין לגעת בריווח** — ל-summary יש `py-4`.

#### בינוני — כוכבים מומצאים (305-309)
הסכמה (`lib/ai/schemas/landing.ts:70-81`) מכילה `name/role/quote` בלבד. שתי אפשרויות, לבחור אחת:
1. להסיר את הבלוק 305-309 לגמרי (מומלץ — מהיר ולא משנה סכמה).
2. להוסיף `rating: z.number().min(1).max(5)` ל-`landing.ts:74-78`, למלא רק עד `item.rating`, ו-`aria-label={`${item.rating} מתוך 5`}`.

#### נמוך — ריווח, תנועה, ספירות
- סקאלה אחת: כותרת→אינטרו `mt-4` (127, 153, 245, 274, 377); כותרת→גריד `mt-12` (129, 155, 180, 210, 247, 295, 326); `gap-6` (129, 155, 180, 210, 295). לגלריה (247) להשאיר `gap-4 sm:gap-6` — החלטה מתועדת, לא סחף.
- 114 ו-364: `motion-safe:transition-transform motion-safe:hover:scale-[1.03]`.
- הגנת ספירה ברנדרר: `.slice(0, 3)` ב-130 ו-156, `.slice(0, 4)` ב-181. לא לגעת ב-`audience.fits` (216) — שם אין גריד.
- קריסת margin בהירו: **החלופה הבטוחה** — `mb-5` לבאדג' (100) והסרת `mt-5` מה-h1 (106). (`flex flex-col items-center` בשורה 97 גם עוצר את הקריסה אבל מחייב `w-full` על 106 ו-109.)

---

### 2.3 `app/s/[slug]/page.tsx`

#### קריטי — רשת השירותים (479)
```tsx
<div className="relative mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
```
(או להעביר את `mx-auto max-w-5xl` מה-div בשורה 473 אל ה-`<section>` בשורה 471, כמו ב-benefits.)

#### גבוה — פריסת mosaic (716)
לפצל את `aboutSection` (408-466) ל-`aboutBody` בלי הדיוואידר:
```tsx
<>
  <SectionDivider brand={brand} seed={`${slug}-div-about`} />
  <div className="grid items-start gap-8 lg:grid-cols-2">{aboutBody}{benefitsSection}</div>
</>
```
במקביל להסיר/להרחיב את `max-w-3xl` הפנימי של about (444) כשהוא יושב בחצי עמודה.

#### גבוה — סף ניגודיות (85-104, 800-805, 820-826, 898-905)
```tsx
const onBrand = inkOn(brand);            // מ-lib/storefront-brand.ts
style={{ backgroundColor: brand, color: onBrand }}   // 801-802, 822-823, 901-902
```
ולהסיר `text-white` משלושת המקומות. בפיל שבהדר צריך גם לנצח את `tier-styles.tsx:341` (`a:not([data-el])` שצובע #ececec) — מסומן ממילא ב-§2.4.

#### גבוה — הדר במובייל (790, 791, 807, 809, 810, 819-827)
```tsx
// 791
className="flex min-w-0 items-center gap-2.5"
// 807
className="truncate text-lg font-bold"
// 809
className="flex shrink-0 items-center gap-1"
```
- להוציא את פיל ה-CTA (819-827) מתוך ה-`<nav>` אל ה-div בשורה 809 כדי שיישאר גלוי מתחת ל-sm, עם `whitespace-nowrap max-sm:px-3 max-sm:text-xs`.
- להוסיף כפתור המבורגר `sm:hidden` שפותח `<details>`/drawer עם אותם עוגנים (`#about`/`#services`/`#store`/`#faq`). לשקול העלאת נקודת השבירה של ה-nav ל-`md:flex`.

#### גבוה — ריווח סקשן מעקב הזמנות (566-567)
```tsx
<div key="orderTracking" data-el="module-section" className="mx-auto max-w-5xl px-4 py-16">
  <div className="grid items-start gap-6 md:grid-cols-2">
```
ובמקביל להסיר `px-4 py-16` מ-`components/public/order-tracker.tsx:72` (px-4 מוכפל היום), ולהשאיר את הריווח לקונטיינר החיצוני.

#### בינוני
- **822** — להוסיף `data-el="btn-primary"` ל-`<a>` בשורה 820 ולהחליף ל-`className="whitespace-nowrap font-medium"`; הדרג מספק רקע, צבע, פדינג ורדיוס.
- **811, 812, 813, 818** — להסיר `hover:opacity-70` (מכהה במקום להבהיר: #ffffff@0.7 מעל הדר rgba(0,0,0,.72) ≈ #b2b2b2, כהה מ-#ececec של המנוחה).
- **291, 775** — `@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }` בשני הבלוקים.
- **474** — `mb-2` בלבד כשאין intro. לתקן מרכזית ב-§2.4 (margin-bottom ל-`section-title`), או מקומית: h2 `mb-4 ... md:mb-6` ו-p `mx-auto -mt-1 mb-10 ...`.
- **544, 818** — FAQ כפול: `const showInlineFaq = Boolean(faq?.items?.length) && !faqModuleActive;` (המשתנה `faqModuleActive` כבר קיים בשורה 345) ולהתנות בו את `faqSection` ואת קישור הניווט. במקביל להזין את `faqJsonLd` (346-359) גם מ-`faq.items` כשהסקשן הפנימי הוא זה שמוצג.
- **708, 724-730** — condensed: **לא לעטוף את הסקשן**. אחרי סימון המודולים (§2.5): `<div key={key} data-condensed className="contents">` + כלל ב-tier-styles (§2.4). לחלופין להחריג את `orderTracking` ו-`reviews` מהעטיפה.
- **869-875** — `ctaHref` להפוך ל-`string | null`, לגזור `tel:${site.business.phone}` כשקיים, ורק אחרת null; ולהוסיף רינדור מותנה בכל הווריאנטים (store-hero:207, orbit:131, spotlight:157, vanguard:156).

#### נמוך
- **797/801** — לאחד ל-`size-10` בשני המצבים (לוגו ותג אות), ולהגדיל את גופן האות ל-`text-lg`.
- **390** — `py-14` → `py-16` (הסקשן היחיד בקובץ שחורג).

---

### 2.4 `components/public/tier-styles.tsx`

```css
/* אחרי שורה 373 — הפרדת סקשנים (הכללים הייעודיים חייבים לבוא אחרי כדי לנצח) */
[data-tier="professional"] [data-el="module-section"][data-band="raised"]{
  background:#0b0b0d!important;
  border-block:1px solid rgba(255,255,255,.06);
}
[data-tier="professional"] [data-band="cta"]{
  background:radial-gradient(120% 100% at 50% 0%,
    color-mix(in srgb, var(--brand) 18%, transparent), #000 70%)!important;
}

/* שורה 372 — ריווח אנכי מרכזי (מייתר py-* מהסקשנים, פותר גם את ממצא orderTracking) */
[data-tier="professional"] [data-el="module-section"]{ padding-block: clamp(3.5rem, 6vw, 7rem); }

/* שורה 393 — סקאלת כותרות (unlayered ⇒ מנצח את text-3xl ללא !important) */
[data-tier="professional"] [data-el="section-title"]{
  font-size: clamp(1.75rem, 1.3rem + 1.6vw, 3rem);
  line-height: 1.15;
  margin-bottom: 2rem;
}

/* תמיכה ב-condensed בלי לחתוך רקעים */
[data-condensed] [data-el="module-section"] > *{ max-width:56rem; margin-inline:auto; }
```
אופציונלי במקום `hover:opacity-70` שהוסר: `[data-tier="professional"] [data-el="chrome-nav"] a:hover{ text-shadow:0 0 12px color-mix(in srgb, var(--gold) 40%, transparent) }`.

---

### 2.5 סקשני המודולים — `components/public/*-section.tsx`

להעביר `data-el="module-section"` אל תג ה-`<section>` **בתוך כל רכיב מודול** (לא wrapper ב-`page.tsx:624`) — הרכיב מחזיר `null` כשאין תוכן ולכן אין סיכון ל-phantom band, שזו החשש שבהערה בשורות 613-618.

עשרת הקבצים שפותחים ב-`bg-white`: `testimonials-section.tsx:39`, `gallery-section.tsx:24`, `menu-section.tsx:37`, `pricing-section.tsx:28`, `blog-section.tsx:33`, `courses-section.tsx:26`, `donations-section.tsx:26`, `certifications-section.tsx:26`, `partners-section.tsx:25`, `before-after-section.tsx:24` — ובנוסף `rentals-section.tsx:22` (`bg-zinc-50`).

```tsx
<section data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
```
`text-zinc-900` מפורש הוא רשת ביטחון: הכותרות (`testimonials:41`, `gallery:26`, `menu:39`, `pricing:30`, `blog:36`) הן `<h2 className="mb-8 text-center text-3xl font-bold">` ללא מחלקת צבע. וכן `text-3xl md:text-4xl` בכותרות שאין להן `data-el="section-title"` (כולל `order-tracker.tsx:76`).

---

### 2.6 `components/public/site-footer.tsx`

```tsx
// 49 — גבול שנעלם כשה-OS של המבקר כהה (globals.css:102 → --border: oklch(1 0 0 / 10%))
className="border-t border-black/5 ..."

// 46 — למחוק את slice(0,120); שורה 94:
{description && <p className="line-clamp-3 leading-relaxed">{description}</p>}

// 120 — עיגולי רשתות: מילוי ניטרלי + מטרת מגע 44px
className="flex size-11 items-center justify-center rounded-full border border-zinc-300/60 bg-white/5 backdrop-blur-sm motion-safe:transition-transform motion-safe:hover:scale-110"

// 146 — ענף ה"ניוזלטר" המת → קישור לטופס (נתיב מלא, הפוטר מרונדר גם מ-terms/accessibility)
<a href={`/s/${slug}#lead-form`} className="font-medium hover:underline" style={{ color: brand }}>
  השאירו פרטים
</a>
// וכותרת "נשארים בקשר" בענף הזה במקום "ניוזלטר"

// 137 — יישור: להעביר align="start" ל-NewsletterSignup (ראה §2.8)
// 50 — להתאים sm:grid-cols-3 ל-sm:grid-cols-2 כשאין ניוזלטר ואין קישורי עזרה מעבר לתקנון
```

---

### 2.7 `components/public/site-lead-form.tsx`

```tsx
// 62 — inputCls: ההפרדה חייבת לבוא מהרקע. אין טעם ב-border-zinc-300:
// tier-styles.tsx:388 כופה .border { border-color: rgba(255,255,255,.1) !important }
const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-black/[0.04] px-3 py-2.5 text-base sm:text-sm ...";

// 65 — טבעת פוקוס בצבע מותג (ברירת המחדל ב-Tailwind 4.3 היא currentcolor)
<form style={{ "--tw-ring-color": brandColor } as React.CSSProperties} ...>

// 68 ו-53 — גבול מפורש (מצב כהה של ה-OS)
className="... border border-black/10 ..."   // או ring-1 ring-black/5 כמו שאר הכרטיסים

// 81-112 — תוויות, name, autoComplete, dir
<label htmlFor="lf-name" className="sr-only">שם מלא (חובה)</label>
<input id="lf-name" name="name" autoComplete="name" ... />          // 81
<input id="lf-phone" name="phone" autoComplete="tel" dir="auto" ... />   // 89
<input id="lf-email" name="email" autoComplete="email" dir="auto" ... /> // 97
<textarea id="lf-message" name="message" className={`${inputCls} resize-y`} ... /> // 106-112
// סימון החובה עובר מה-placeholder ("שם מלא *") לתווית — היום הוא נמחק ברגע ההקלדה

// 115 — שגיאה: chip ששורד בשני הרקעים + הכרזה
<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>

// 116 — כפתור השליחה
data-el="btn-primary"

// 53 — מצב הצלחה: p-8 → p-6 + הכרזה
<div role="status" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm">
```
**לא להמציא `min-h-[19rem]`** — גובה הטופס משתנה לפי `wantsEmail`/`wantsMessage` (28-29); מספר קבוע יהיה שגוי ברוב המקרים.

---

### 2.8 `components/public/newsletter-signup.tsx`

```tsx
// 53 — הקריטי: הטקסט המוקלד ב-1.98:1
className="... bg-white text-black placeholder:text-zinc-500 text-base sm:text-sm ..."
// שתי המחלקות האלה אינן ברשימות הרימאפ של הפוטר (tier-styles.tsx:446-449)

// 35 — טבעת פוקוס
style={{ "--tw-ring-color": brandColor } as React.CSSProperties}

// 70 — אותו טיפול שגיאה כמו §2.7 (text-red-600 → chip)

// יישור: prop חדש align?: "center" | "start" (ברירת מחדל center)
// align="start" מבטל mx-auto/max-w-md (35) ו-justify-center (36 וגם 27 — מצב ההצלחה)
```

---

### 2.9 `components/public/countdown-timer.tsx`

```tsx
// 80
className="text-xs ..."              // במקום text-[0.65rem] = 10.4px
// כהה: text-white/85 (במקום /70) · בהיר: text-zinc-600
// 69 (אופציונלי): w-[4.5rem] במקום min-w-[4.25rem] — ארבע תיבות זהות גם ב-1000+ ימים
```
הענף הבהיר מופעל ע"י `onLight` שמועבר מ-`landing-page.tsx:352` (§2.2).
**לא לתקן** את "שבירת היישור ב-100 ימים" — לא אומתה; 3 ספרות עדיין נכנסות.

---

### 2.10 `components/public/heroes/store-hero.tsx`

```tsx
// 166-172 — ParticleField (-z-20) ו-HudFrame (-z-10) מוסתרים ב-100%:
// data-el="hero" מקבל isolation:isolate (tier-styles.tsx:345-350) והסקשן של Vanguard
// הוא position:relative עם רקע אטום, ולכן נצבע מעליהם.
<div data-el="hero" className="relative">
  {heroNode}
  <div className="pointer-events-none absolute inset-0 z-[1]">
    <ParticleField ... />
    <HudFrame ... />
  </div>
</div>
// תוכן ההירו כבר z-10 (vanguard-hero.tsx:116) ולכן יישאר מעליהן.
// חלופה: להסיר bg-[#0a0a0a] מ-vanguard-hero.tsx:36 ולהפוך את הגרדיאנט בשורה 85 לחצי-שקוף.
// לבדוק את אותה בעיה גם ב-orbit/spotlight.

// 15, 17-23, 160-161, 178-214, 62-137 — ניקוי classic/cozy:
// להסיר "classic"|"cozy" מ-HeroStyle ומ-HERO_STYLES (או למחוק את HERO_STYLES — לא נצרך באף מקום;
// לבורר יש מערך STYLES מקומי משלו), למחוק את ClassicHero (178-214) ו-HeroDecor (62-137)
// ואת הייבוא של CozyHero ו-Sparkles (1-2), ו-default: → return <VanguardHero {...p} />

// 184 — fetchPriority="high" decoding="async" (זהה ל-vanguard:69)
```

---

### 2.11 `components/public/heroes/orbit-hero.tsx`

```tsx
// 120 — קריטי. ! חובה: important מנצח הצהרה רגילה גם כשהיא unlayered
className="min-h-[2.2em] text-balance leading-[1.12]! font-bold! text-[clamp(1.75rem,1.1rem+2.2vw,3.25rem)]!"
// אין טעם ב-text-white: ה-tier קובע color:transparent!important + -webkit-text-fill-color:transparent.
// ללבן מלא: [-webkit-text-fill-color:currentColor] text-white!
// חלופה נקייה: כלל ב-tier-styles — h1.hero-split { font-size: revert-layer; font-weight: revert-layer }

// 121 — גבוה. h1 ריק ב-SSR (הטקסט מוזרק רק ב-useEffect 43/49)
<h1 className="grid ...">
  <span className="col-start-1 row-start-1 invisible">{fullHeadline}</span>
  <span ref={typeRef} aria-hidden="true" className="col-start-1 row-start-1" />
</h1>
// השכבה הבלתי-נראית מספקת טקסט לשרת/לקורא מסך וגם מקבעת את הגובה הסופי ⇒ להסיר min-h-[2.2em]

// 142 — גבוה. scale לא מקטין פריסה: 260px מצויר בתוך 400px = ~140px חלל מת
className="relative size-[260px] sm:size-[320px] md:size-[400px]"   // בלי scale-*
// חובה יחד: RING_SIZES ליחסים — width/height: `${(size/400)*100}%`, top/left: `calc(50% - ${(size/400)*50}%)`
// ו-radius (79) לאחוזים: left: `calc(50% + ${cos*37.5}%)`
// 118 → order-1 md:order-1 · 141 → order-2 md:order-2 (היום הגרפיקה ראשונה במובייל)

// 138 + 165 — גבוה. socialProof מוצג פעמיים; שורה 36 מייצרת מספר מ-hash
// להשאיר socialProof רק ב-138; שורה 165:
<span className="mt-1 max-w-[9rem] text-[11px] leading-snug text-white/50">לקוחות מרוצים</span>
// אם המספר המומצא לא מקובל — להסתיר את בלוק המונה כולו (161-166);
// אין ב-HeroProps (store-hero.tsx:25-47) שום שדה סטטיסטיקה אמיתי, כל תנאי מחייב prop חדש

// 162 — dir
<span ref={countRef} dir="ltr" className="text-3xl font-extrabold tabular-nums text-white">

// 17 — initials חוזרות (מ,ל,מ,ל,מ,ל)
const uniq = Array.from(new Set(chars));
while (uniq.length < 3) uniq.push("•");
return uniq.slice(0, 6);
// להסיר .toUpperCase() (no-op בעברית); aria-hidden="true" על ה-div בשורה 180 (או על 142)
// החישוב (360 / initials.length) * i בשורה 170 כבר מסתגל לכמות בפועל

// 117 — max-w-6xl → max-w-5xl (ביחד עם קיבוע ה-h1, אחרת העמודה מצטמצמת ל-~500px)
// 132 — hover מורגש + focus (brightness-125 על #070319 נותן rgb(9,4,31) — בלתי מורגש)
className="block rounded-full bg-[#070319] px-8 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#171034] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
// לא bg-white/10 — הכפתור הוא הליבה האטומה של מסגרת ה-conic
```

---

### 2.12 `components/public/heroes/spotlight-hero.tsx`

```tsx
// 137, 142 — גבוה. הצהרה ישירה על האלמנט מנצחת ערך שהגיע בירושה
<span className="spot-reveal spot-serif block text-white/90 [-webkit-text-fill-color:currentColor]">
<span className="spot-reveal block font-bold text-white [-webkit-text-fill-color:currentColor]">
// לשימור גרדיאנט הזהב — להשאיר אותו רק על שורה 2 ולתת לשורה 1 לבן מלא

// 76 — גבוה. Playfair Display חסר גליפים עבריים ⇒ David Libre + faux oblique
.spot-serif { font-family:'David Libre','Playfair Display',serif; font-weight:500; letter-spacing:-.01em; }
// להסיר font-style: italic; להעביר את טעינת הפונט ל-next/font ב-app/layout ולמחוק את ה-<link> (69-72)

// 154 — גבוה. RTL: items-end לוגי מול text-right פיזי
className="flex flex-col items-start gap-3 sm:items-end sm:text-end"

// 130 — scrim לא מונוטוני (70% תחתית, 10% אמצע, 40% ראש)
className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_38%,rgba(0,0,0,.12)_100%)]"
// חלופה: absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent

// 61-65 + 73-88 — רדיוס זרקור רספונסיבי
radial-gradient(circle var(--sr,40vmin) at var(--sx,50%) var(--sy,38%), ...)
.spot-section { --sr: 40vmin } @media (min-width:1024px){ .spot-section { --sr: 300px } }
// במסלול noHover (26-29) עדיף לוותר על המסכה:
layer.style.maskImage = "none"; layer.style.webkitMaskImage = "none";   // שתי הווריאנטים חובה

// 40-52 — לולאת rAF שרצה תמיד
const running = useRef(false);
// ב-tick: const done = Math.abs(p.tgtX-p.curX) < .05 && Math.abs(p.tgtY-p.curY) < .05;
//         if (done) { /* קיבוע ערך סופי */ running.current = false; return; }
// ב-onMove: if (!running.current) { running.current = true; raf = requestAnimationFrame(tick); }
// + IntersectionObserver שמסיר את מאזין ה-mousemove כשהסקשן אינו נראה

// 132 — className="relative w-full px-4 pb-16 sm:pb-20"   (להסיר sm:px-10 ואת pt-24 — חסר השפעה בגלל items-end)
// 158 — focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white
//        + transition-transform motion-reduce:transition-none motion-reduce:hover:scale-100
//        (בלוק ה-prefers-reduced-motion בשורות 84-87 מכסה רק .spot-kenburns ו-.spot-reveal)
```

---

### 2.13 `components/public/heroes/vanguard-hero.tsx`

```tsx
// 127 — קריטי. להוסיף מחלקה vg-h1, ובבלוק ה-<style> הפנימי (38-63):
[data-tier="professional"] [data-el="hero"] h1.vg-h1{
  background:none; color:#fff!important; -webkit-text-fill-color:#fff;
  font-size:clamp(2.25rem,11vw,8.5rem); line-height:.9; letter-spacing:-.02em;
  animation:none; font-weight:800;
}
[data-tier="professional"] [data-el="hero"] h1.vg-h1 .vg-outline{
  color:transparent!important; -webkit-text-fill-color:transparent;
}

// 41 — גבוה. ל-Anton אין glyphs עבריים; --font-sans (Heebo, subset hebrew) חסר מהשרשרת
.vg-display{ font-family:'Anton', var(--font-sans), sans-serif; }
// 54 — -webkit-text-stroke: 3px rgba(255,255,255,.92)
// עדיף: לוותר על Anton לטובת פונט תצוגה עברי (Heebo 900 / Rubik)

// 167-168 — בינוני. הכלל [data-el="hero"] p{color:#c6c6c6!important} מוחק את ההיררכיה
// אפשרות א׳: להמיר ל-<span className="block"> (לא נתפס בסלקטור p)
// אפשרות ב׳:
[data-tier="professional"] [data-el="hero"] p.vg-sig-name{color:#fff!important;animation:vg-fade-up .8s ease-out both}
[data-tier="professional"] [data-el="hero"] p.vg-sig-slogan{color:rgba(255,255,255,.6)!important}

// 168 — למחוק (הסלוגן כבר ב-badge בשורה 123, באותו מסך של 92vh)
// אם רוצים תוכן בבלוק החתימה — להעביר לשם את socialProof ולמחוק את 173-177

// 118-124 — לעטוף ב-{slogan && ( ... )} כדי להיפטר מ-"קולקטיב יצירתי" הקשיח (או {slogan || brandName})

// 78 — רצפת כהות לוויניט
radial-gradient(90% 90% at 50% 45%, rgba(0,0,0,.3) 35%, rgba(0,0,0,.72) 100%)
// 119 — text-white/70 → text-white/85 · להסיר uppercase · tracking-[0.12em] · [margin-inline-end:-0.12em]
// 174 — אותו טיפול (uppercase הוא no-op בעברית; letter-spacing מוסיף advance בצד ה-inline-end)

// 20-25 — חלוקת שורות אחידה, בלי לאבד מילים (לא slice(0,9))
const src = (headline || brandName || "ברוכים הבאים").split(" ").filter(Boolean);
const n = Math.min(3, src.length) || 1;
const per = Math.ceil(src.length / n);
const lines = Array.from({ length: n }, (_, i) => src.slice(i * per, (i + 1) * per).join(" ")).filter(Boolean);

// 69 — fetchPriority="high" decoding="async" + <link rel="preload" as="image" href={heroImg} /> (React 19 מרים ל-head)
// 142 → mt-8 · 149 → mt-8   (מרווח סימטרי סביב המפריד בשני המצבים)
// 166 — text-right → text-start
// 116 — למחוק את עטיפת max-w-6xl ולמזג:
<div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
```

---

### 2.14 `lib/ai/schemas/landing.ts`

```ts
// 39, 45 — points: titledPoints.min(3).max(3)
// 50 — items: titledPoints.min(4).max(4)
// (titledPoints משותף — לכן האכיפה בנקודת השימוש, לא על הטיפוס)
// 130/142-144 — galleryUrls נשאר חופשי; ההגנה היא hasCaptions ב-§2.2
// 74-78 — rating: z.number().min(1).max(5) רק אם נבחרה אפשרות 2 בממצא הכוכבים
```

---

### 2.15 ניקוי classic/cozy — מעבר ל-store-hero

- `lib/hero-style.ts:7,15,33` — `HeroStyleKey`, כללי cozy, ברירת מחדל → vanguard/spotlight
- `lib/actions/design.ts:100` — להסיר מרשימת הערכים המאושרים
- `components/business/hero-style-picker.tsx:13-19` — כולל ה-Preview של cozy ו-classic
- `tests/hero-style.test.ts:24-30`
- מיגרציה חדשה בסגנון 0074: מיפוי `'classic'`/`'cozy'` לאחד מ-orbit/spotlight/vanguard **ושינוי ה-default של העמודה** (מיגרציה 0045 קובעת `not null default 'classic'` — כל אתר שלא נגעו בו מקבל hero מיועד למחיקה)

---

## 3. מה משותף לשלושת המצבים ומה נקודתי

### 3.1 חוצה-מצבים — לתקן פעם אחת בתשתית

| נושא | ביטוי ב-L | ביטוי ב-W/S | ביטוי ב-H |
|---|---|---|---|
| **אין helper ניגודיות** — `isLight` בלבד, סף R+G+B>660 | `text-white` על brand ב-6 מקומות + `color:brand` על לבן ב-5 | תג אות, פיל CTA, כפתור צף | — |
| **prefers-reduced-motion חלקי** — המתג היחיד (`tier-styles.tsx:44-51`) scoped ל-`[data-tier] *` | `hover:scale` (114, 364), `scroll-behavior` (page.tsx:291), הפוטר (120) | `scroll-behavior` (page.tsx:775) — `<html>` אינו צאצא של `[data-tier]` | spotlight `hover:scale-[1.05]` (158) |
| **RTL: מאפיינים פיזיים במקום לוגיים** | — | — | spotlight `sm:text-right` (154), vanguard `text-right` (166), מונה בלי `dir="ltr"` |
| **מערכת רוחב `max-w-5xl` + `px-4`** (19 מופעים ב-components/public) | הדר 6xl, סקשן 5 4xl | רשת שירותים ללא קונטיינר | orbit 6xl, spotlight `px-6 sm:px-10` |
| **פונטים לטיניים על עברית** | — | — | Playfair (spotlight), Anton (vanguard) — שניהם ללא כיסוי עברי |
| **טפסים** — אותו `SiteLeadForm` ו-`SiteFooter` בשני המצבים | רקע לבן ⇒ שדות תקינים, אבל אין תוויות/dir/autoComplete | הרימאפ של הדרג בולע את השדות | — |

**מסקנת ארכיטקטורה:** שלוש נקודות תשתית פותרות רוב-רובם — `lib/storefront-brand.ts` (ניגודיות), כלל `prefers-reduced-motion` גלובלי אחד ב-`app/globals.css` שאינו תלוי ב-`[data-tier]`, וקיבוע רשת רוחב אחת. הקובץ `app/globals.css` (129 שורות) לא מכיל היום שום כלל `prefers-reduced-motion`.

### 3.2 נקודתי למצב

- **דף נחיתה בלבד:** קריסת margin בהירו, כיתובי גלריה חלקיים, כוכבים מומצאים, סרגל דביק/safe-area, אפורדנס FAQ, מונה טיימר, עמודות פוטר ריקות. גם: זה העמוד הציבורי היחיד **ללא** `data-tier`/`TierStyles` (`page.tsx:266-313` חוזר מוקדם) — ולכן ה-reveal שלו רץ ב-`.7s ease` במקום `400/800ms cubic-bezier(.22,.8,.3,1)`. **לא לעטוף ב-TierStyles** (הדרג כהה וממפה `.bg-white` — ישבור את הדף); לאמץ את הטוקנים בבלוק ה-`<style>` שכבר קיים ב-`page.tsx:290-297` והנטען רק בענף הנחיתה, ולהחליף `translateY(26px)` ב-32px. עוגן ויזואלי זול: `logoUrl` ב-`size-16` מעל הבאדג' (הפרופ כבר מועבר, שורה 40).
- **אתר תדמית בלבד:** `data-el` חסר, רקעי `!important` של הדרג, condensed, mosaic, ניווט מובייל, FAQ כפול.
- **הירו בלבד:** כל חמשת הכללים של `[data-el="hero"]` ב-`tier-styles.tsx:345-366`, ותאונת ה-z-index של ParticleField/HudFrame.

---

## 4. סיכונים ומה לאמת ידנית

### 4.1 סיכוני קסקדה (הגבוהים ביותר)
1. **`data-el="module-section"` מפעיל כללים שהיו רדומים** — ברגע הסימון, 11 סקשנים עוברים ל-`background:#000!important` + `color:#e5e5e5` + מיפוי `.bg-white`→#121214 ו-`.border`→rgba(255,255,255,.1). כרטיסים פנימיים, תמונות עם רקע לבן ובאדג'ים בתוכם ישתנו בבת אחת. **לאמת ויזואלית כל אחד מ-11 המודולים לפני ואחרי.**
2. **`padding-block` מרכזי ב-tier + `py-*` שנשאר בקוד** — אם מוסיפים את הכלל ב-`tier-styles.tsx:372` בלי להסיר `py-16` מהסקשנים, הריווח מצטבר. או שניהם, או אף אחד.
3. **`!` על ה-h1 של Orbit ו-`h1.vg-h1` של Vanguard** — הם מנצחים את הדרג, אבל גם את כל שינוי עתידי בו. לתעד בקומנט למה.
4. **`brandInk` בלולאה** — ל-`#000000` היחס כבר עובר בסיבוב הראשון; למותג רווי מאוד (למשל ציאן) הלולאה עלולה להחשיך יותר מהמצופה ולשנות את זהות המותג. לאמת מול 5-6 מותגים אמיתיים מה-DB, לא רק `#FACC15`.
5. **`inkOn` בסף 0.55 מול ההצעות 0.45/0.5** — צבעים בטווח הביניים (`#C9A227`, `#B8860B`) יקבלו החלטה שונה לפי הסף. לבחור פעם אחת ולהריץ על כל הצבעים בפועל.

### 4.2 שינויים שמזיזים פריסה — לבדוק לפני/אחרי
- `orbit-hero`: `max-w-6xl`→`max-w-5xl` + `size-[260px]` + המרת `RING_SIZES` ליחסים — **שלושתם חייבים לנחות יחד**; כל אחד לבד שובר את הפיזור.
- `mosaic`: פיצול `aboutSection` ל-`aboutBody` — לוודא שהדיוואידר לא נעלם לגמרי ושה-`max-w-3xl` הפנימי (444) הותאם.
- `flex flex-col items-center` בהירו של L (אם נבחר במקום החלופה) — מכווץ את ה-h1 וה-p לרוחב התוכן; מחייב `w-full` ב-106 ו-109.
- `p-8`→`p-6` בכרטיס ההצלחה — עדיין תיוותר קפיצת גובה; **לא לפתור עם min-h שרירותי.**

### 4.3 מה לאמת ידנית בדפדפן
1. **מותג בהיר-רווי** (`#FACC15` / `#FFD400`) בשלושת המצבים: CTA הדר, CTA הירו, סקשן CTA, סרגל דביק, פיל ניווט, כפתור צף, תג אות. יעד: ≥4.5:1 לטקסט רגיל.
2. **`prefers-reduced-motion: reduce`** — לוודא שגלילת עוגן אינה חלקה בשני הבלוקים (291 ו-775) ושאין `hover:scale` פעיל.
3. **מצב כהה של מערכת ההפעלה** (`defaultTheme="system"`, `app/layout.tsx:39`, אין `forcedTheme` תחת `app/s`) — גבול הפוטר וכרטיס הטופס.
4. **iOS Safari אמיתי** — safe-area בסרגל הדביק, זום אוטומטי בשדות (`text-base sm:text-sm`), והספייסר של 76px.
5. **מובייל 375px** — הדר עם שם מותג עברי ארוך, ניווט/CTA מתחת ל-640px, סדר Orbit (טקסט לפני גרפיקה), Spotlight ללא מסכה.
6. **HTML גולמי מהשרת** (`view-source` / בוט שיתוף) — שה-h1 של Orbit אינו ריק.
7. **תוכן חורג** — 4-5 תמונות בגלריה, 4 נקודות בעיה, 5 יתרונות, כותרת headline של 12 מילים ב-Vanguard.
8. **מצב landing מול website** לאותו עסק — הפוטר, טופס הליד והרשתות מרונדרים בשניהם עם/בלי `data-tier`. `bg-white/5` על העיגולים כמעט שקוף ברקע הבהיר של landing; שם המסגרת וצבע ה-SVG הם מה שמגדיר את הכפתור.

### 4.4 מה במפורש לא לתקן
- `max-w-3xl` בסרטון (272) וב-FAQ (322), `max-w-xl` בטופס (374) — measure מכוון.
- ריווח בין שאלה לתשובה ב-FAQ — ל-summary יש `py-4`.
- יישור הטיימר ב-100 ימים — לא אומת.
- `Quote` בשורה 301 — דקורטיבי ב-`opacity-25`.
- `audience.fits` (216) — ul בטור אחד, אין גריד ואין מה להגן עליו.
- `gap-4` בגלריה — מרווח בין תמונות, לא בין כרטיסים; להשאיר כהחלטה מתועדת.