# מפרט יישום — "הכל לעסקים / AI Business Builder"
## תיקוני עיצוב מאומתים: חנות · לוגו · מצבי אתר

> **הערה מחייבת:** אין git בריפו. המפרט הזה הוא **תוכנית ביצוע בלבד** — לא בוצע שינוי בקובץ כלשהו.
> כל הנתיבים יחסיים ל-`C:\Users\ofek8\OneDrive\Desktop\הכל לעסקים`.

### מקרא מצבים (מסומן ליד כל סעיף)
| סימון | משמעות | איפה זה מרונדר בפועל |
|---|---|---|
| **[כל 3]** | נוגע ל-website + landing + store | דרך קומפוננטה משותפת / הדר |
| **[website+store]** | שני המצבים בעלי הדרג | `app/s/[slug]/page.tsx` (המסלול שאחרי הבדיקה `isLandingMode` בשורה 266) + עמודי משנה |
| **[store]** | מסחר בלבד | `public-store`, `cart-drawer`, `product/[productId]`, `product-gallery` |
| **[landing]** | דף נחיתה בלבד | `components/public/landing-page.tsx` — **אין בו `data-tier`**, ולכן שום כלל מ-`tier-styles.tsx` לא חל עליו |

---

## 1. חמשת השינויים שבעל העסק ירגיש מיד

1. **הלוגו מפסיק להיעלם ולהידחס — קומפוננטת `SiteLogo` אחת בכל משטח ציבורי.** [כל 3]
   היום: הדר כל אתר חי הוא `rgba(0,0,0,.72)` כפוי (`tier-styles.tsx:328`), בעוד צינור הלוגו כותב דיו כהה (`svg-design.ts:316-317`, והפרומפט ב-`logo-options/route.ts:40` מבקש "כמעט-שחור") — לוגו שחור על הדר שחור. במקביל נכס 512×256 נדחס לתיבת `size-10` ריבועית ומרונדר בפועל 40×20 עם טקסט עברי ב-~3.6px. שני הפגמים חיים באותה שורה (`app/s/[slug]/page.tsx:797`) ונסגרים בתיקון אחד. זה השינוי היחיד שרואים בכל עמוד, בכל מצב, בשנייה הראשונה.
2. **ה-Lightbox של המוצר מפסיק להיכלא בתוך הכרטיס.** [store]
   `transform: translateY(-4px)` בריחוף (`tier-styles.tsx:407-409` + `page.tsx:779`) יוצר containing block ל-`position:fixed`, ולכן `fixed inset-0 z-[200]` מתמקם ביחס לכרטיס ונחתך ב-`overflow-hidden`. תמונת מוצר בהגדלה היא רגע ההמרה — היום הוא שבור.
3. **כפתור "הוספה לסל" בעמוד המוצר מפסיק להיות גלולה בתוך גלולה.** [store]
   `data-el="btn-primary"` מוחל פעמיים (עוטף ב-`product/[productId]/page.tsx:295` + הכפתור עצמו ב-`add-to-cart-button.tsx:163`), והדרג מחיל `border-radius:50px !important` ורקע זהב על שניהם. תופעת לוואי חמורה: כפתור **מושבת** ("אזל") יושב בתוך גלולת זהב זוהרת ונראה כמו CTA פעיל.
4. **רשת המוצרים מתיישרת — כפתורי הוספה בקו אחד, תגים לא מכסים כפתורים.** [store]
   `h-full` על פריט הרשת ועל שורש הכרטיס + הפרדת מקבץ התגים ומקבץ הזום לפינות נגדיות. זה מה שהופך את החנות מ"נראית מורכבת" ל"נראית מקצועית".
5. **המסגרת מפסיקה לקפוץ בין עמודים.** [website+store]
   `max-w-6xl` בעמוד המוצר מול `max-w-5xl` בכל שאר האתר = קפיצה של ~64px לכל צד בכל ניווט; ובעגלה — סרגל הסכומים וכפתור התשלום נגללים עם הרשימה במקום להיות מקובעים לתחתית.

---

## 2. רשימת שינויים לפי קובץ

### 2.1 `components/public/site-logo.tsx` — **קובץ חדש** [כל 3]
> סוגר את הממצאים: לוגו כהה על הדר כהה · לוקאפ 512×256 בתיבה ריבועית · שתי צורות שונות בין עמודים · קפיצת פריסה (CLS) · alt כפול. **זה הצעד הראשון — כל שאר תיקוני הלוגו נשענים עליו.**

```tsx
// components/public/site-logo.tsx — קומפוננטת שרת, ללא hooks.
export function SiteLogo({
  logoUrl,
  brandName,
  brand,
  surface = "dark",
  showName = true,
}: {
  logoUrl?: string | null;
  brandName: string;
  brand: string;
  /** "dark" = הדר שחור של הדרג · "light" = הדר לבן (נחיתה/חשבונית) · "none" = ללא משטח */
  surface?: "dark" | "light" | "none";
  showName?: boolean;
}) {
  const plate =
    surface === "dark"
      ? "bg-white/90 p-1 shadow-sm ring-1 ring-black/5"
      : surface === "light"
        ? "p-1 ring-1 ring-black/5"
        : "";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        <span
          className={`flex h-9 w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg ${plate}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-contain"
          />
        </span>
      ) : (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{ backgroundColor: brand }}
        >
          {brandName.charAt(0)}
        </span>
      )}
      {showName && <span className="truncate text-lg font-bold">{brandName}</span>}
    </div>
  );
}
```

**למה תיבה ברוחב קבוע `w-[120px]` ולא `max-w-[168px]`:** רוחב מקסימלי לא מונע CLS — הרוחב עדיין לא ידוע עד סיום הטעינה. תיבה קבועה שומרת מקום מראש. הבחירה ב-120px מכסה את שתי צורות הנכס הקיימות בלי גלישה: נכס 512×256 (`site-design.ts:24`) מרונדר 72×36 בתוכה, ונכס 1024×1024 (`logo-options/route.ts:100`) מרונדר 36×36. לוגו פנורמי שהועלה ידנית נכנס גם הוא (`object-contain`), רק נמוך יותר.

### 2.2 `app/s/[slug]/page.tsx` [website+store]
| שורה | שינוי |
|---|---|
| ~792-806 | להחליף את כל בלוק הלוגו+שם ב-`<SiteLogo logoUrl={logoUrl} brandName={brandName} brand={brand} surface="dark" />` (הוא כולל את ה-fallback של האות הראשונה ואת ה-`<span>` של השם — הקוד הקיים בשורות 798-806 נמחק) |
| 166-181 | `generateMetadata`: להוסיף ל-return `...(site.brand?.logo_url ? { icons: { icon: [{ url: site.brand.logo_url }], apple: [{ url: site.brand.logo_url }] } } : {})`, ובבלוק `openGraph` (176-178) נפילה חזרה ללוגו כשאין `hero_image_url`. **תלוי בסעיף 4.5** — עדיף להצביע על `logo-display.png` ולא על ה-PNG של 1024×1024 |
| 779 | לא נוגעים ב-`.svc-card:hover { transform }` — ה-transform הוא אפקט מכוון; הפתרון ל-Lightbox הוא פורטל (2.3) ולא ביטול ה-hover |

### 2.3 `components/public/public-store.tsx` [store]
| שורה | שינוי |
|---|---|
| 3-4 | להוסיף `useEffect` לייבוא מ-react, ובראש הקובץ `import { createPortal } from "react-dom";` |
| 51 | ב-`MediaLightbox`: להוסיף `dir="rtl" role="dialog" aria-modal="true"` + `useEffect` להאזנת Escape. **הצבעים המפורשים נשארים כפי שהם** (`bg-black/80`, `text-zinc-800` על כפתור הסגירה) — הפורטל יושב מחוץ ל-`[data-tier]` ומחוץ להורה עם רקע, ואסור לו לרשת `--foreground` |
| 51 | **לייצא** את `MediaLightbox` (נצרך ע"י `product-gallery.tsx`, סעיף 2.5) |
| 102 | `className="svc-card flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm"` |
| 114 | `absolute start-3 top-3 z-10 flex flex-col items-start gap-1` (תגי מבצע/חדש → פינה נגדית + מאפיינים לוגיים) |
| 127 | תג "אזל" → `absolute bottom-3 end-3 ...` |
| 131-133 | `<div className="pointer-events-none absolute inset-0 bg-black/45" />` — היום השכבה חוסמת את הקליק על התמונה (גם למוצרי preorder), ו-`bg-white/40` לא נתפס ע"י ה-remap ב-`tier-styles.tsx:378` (הוא מכוון ל-`.bg-white` בלבד) ויוצר הילה חלבית על כרטיס `#111214` |
| 135 | `absolute end-2 top-2 flex gap-1` |
| 157 | משאלות → `absolute bottom-2 start-2` |
| 162 | `{zoom && typeof document !== "undefined" && createPortal(<MediaLightbox media={zoom} onClose={() => setZoom(null)} />, document.body)}` |
| 192 | `₪{eff.toLocaleString("he-IL")}` |
| 195 | `₪{p.price!.toLocaleString("he-IL")}` |
| 434 | `className="text-zinc-400 transition-colors hover:text-white"` (וריאנט `hover:` מייצר `.hover\:text-zinc-600:hover` שה-remap של הדרג לא תופס) |
| 533 | מצב ריק עם יציאה: אייקון `Package` (כבר מיובא בשורה 5) + כפתור `onClick={() => { clearAll(); setQuery(""); setFilter(null); }}` — `clearAll` (291-298) לא מאפס `query`/`filter`, והכפתור היחיד (430) חבוי בפאנל סינון שעשוי להיות סגור |
| 537 | `<div key={p.id} data-reveal className="h-full">` |

**נדחה במפורש:** שריון `h-14` קבוע לרצועת הממוזערות (שורה 165) — מוסיף ~56px אוויר ריק לכל כרטיס בלי תמונות נוספות. שתי תוספות ה-`h-full` לבדן פותרות את יישור הכפתורים.

### 2.4 `app/s/[slug]/product/[productId]/page.tsx` [store]
| שורה | שינוי |
|---|---|
| 174 | `max-w-6xl` → `max-w-5xl`; ולהעלות את גובה ההדר מ-`py-3`+`h-8` (~57px) ל-`h-16` כדי ליישר לאתר הראשי (`page.tsx:790`) |
| 178 | להחליף בלוק הלוגו ב-`<SiteLogo logoUrl={logoUrl} brandName={brandName} brand={brand} surface="dark" />`. שים לב: העמודים הפנימיים היום מציגים לוגו **או** שם — `SiteLogo` מציג את שניהם, כמו העמוד הראשי |
| 186 | `className="hidden items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-white sm:flex"` |
| 206 | `max-w-6xl` → `max-w-5xl` |
| 209, 211 | `className="transition-colors hover:text-white"` — ה-`main` נושא `data-el="module-section"` שהדרג צובע `background:#000000 !important` (`tier-styles.tsx:372-375`); `hover:text-zinc-900` = טקסט `#18181b` על שחור, הקישור נעלם בדיוק ברגע ההצבעה |
| 221 | להעביר `videoUrl={product.video_url}` ל-`ProductGallery` (סעיף 2.5) |
| 256 | `₪{eff.toLocaleString("he-IL")}` |
| 260 | `₪{Number(product.price).toLocaleString("he-IL")}` |
| 295 | `<div className="mt-6">` — **להסיר את `data-el="btn-primary"`**. ה-`data-el` הפנימי של `AddToCartButton` מספיק |

### 2.5 `components/public/product-gallery.tsx` [store]
| שורה | שינוי |
|---|---|
| 27-30 | לעטוף את התמונה הראשית ב-`<button type="button" onClick={() => setZoom({ type: "img", src: active })} aria-label="הגדלת התמונה" className="aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border bg-white">` |
| — | פרופ חדש `videoUrl?: string | null` שמרנדר ממוזערת נוספת עם אייקון Play. אומת בחיפוש: `video_url` נצרך היום רק ב-`public-store.tsx:146,150` — סוחר שהעלה וידאו לא רואה אותו במשטח ההמרה המרכזי |
| 33-45 | `{images.map((src, i) => (...))}` עם `aria-pressed={active === src}` ו-`aria-label={\`תמונה ${i + 1} מתוך ${images.length}\`}` — היום כל הכפתורים נושאים `aria-label="הצגת תמונה"` זהה והמצב הנבחר ויזואלי בלבד (`borderColor`, שורה 39) |
| — | לרנדר את `MediaLightbox` המיוצא (2.3) — **רק אחרי** שהוא עבר לפורטל |

### 2.6 `components/public/cart-drawer.tsx` [store]
| שורה | שינוי |
|---|---|
| 3 | להוסיף `useEffect` לייבוא |
| — | `useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", h); const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", h); document.body.style.overflow = prev; }; }, [open]);` |
| 300 | להוסיף `role="dialog" aria-modal="true" aria-label="סל הקניות"` |
| 338 | `<div className="flex min-h-0 flex-1 flex-col">` |
| 340-424 | לעטוף ב-`<div className="min-h-0 flex-1 overflow-y-auto">` |
| 360 | `text-zinc-400` → `text-zinc-600` (הפאנל מרונדר בפורטל ל-`document.body`, כלומר מחוץ ל-`[data-tier]` — נשאר `bg-white` עם `color:#18181b`; `#a1a1aa` על לבן ≈ 2.6:1, נכשל AA. זה טקסט חריטה שהלקוח הזין ושילם עליו) |
| 427 | `<div className="shrink-0 space-y-3 border-t bg-white p-4">` |
| 453 | קופון: להוסיף `aria-label="קוד קופון"` |
| 513 | ל-`<form>` להוסיף `max-h-[55vh] overflow-y-auto` |
| 547 | `text-zinc-400` → `text-zinc-600` (למצב הלא-נבחר בלבד; `text-white/80` על רקע המותג נשאר) |
| 610-612, 624-629, 635 | `aria-label` לכל שדה + `aria-required="true"` לשדות חובה (שם, טלפון). היום כולם placeholder בלבד — אין `<label>`, אין `aria-label`, אין `id` |
| 611 | להוסיף `dir="ltr" inputMode="tel"` |
| 624, 626, 627 | להוסיף `aria-describedby="addr-err"` |
| 627 | להוסיף `dir="ltr"` |
| 623 | `<div className="grid grid-cols-6 gap-2">` + `col-span`: עיר 4, מדינה 2, רחוב 4, מספר 2, דירה 3, קומה 3 |
| 632 | להוסיף `id="addr-err"` |
| 636-637 | רמז דינמי מתחת לכפתור המושבת: `{!isPending && (!shipValid || !addressValid || name.trim().length < 2 || phone.replace(/\D/g,"").length < 9) && (<p className="text-xs text-amber-600">{!shipValid ? "נא לבחור אזור / נקודת איסוף" : name.trim().length < 2 ? "נא למלא שם מלא" : phone.replace(/\D/g,"").length < 9 ? "נא למלא מספר טלפון תקין" : "נא להשלים את כתובת המשלוח"}</p>)}` — `resolveShipping` מחזיר `null` כשלא נבחר אזור (`lib/shipping.ts:60,68`) והכפתור מאפור בלי שום הסבר |
| 699-703 | להסיר `dir="ltr"` מה-`<ul>` ולעטוף רק ערכים: `סניף: <span dir="ltr" className="inline-block">{b.branch}</span>`, `חשבון: <span dir="ltr" className="inline-block font-mono">{b.account}</span>`. `b.bank` ו-`b.holder` נשארים טקסט עברי. (התבנית הנכונה כבר קיימת באותו קובץ בשורה 684) |

**הבהרה ל-RTL:** אין להוסיף `text-start` לשדות עם `dir="ltr"` — כשה-dir של האלמנט הוא ltr, `start` מתפרש כשמאל. להשאיר בדיוק כמו שדה האימייל (612): `dir="ltr"` בלבד.

### 2.7 `components/public/checkout-result.tsx` [website+store]
| שורה | שינוי |
|---|---|
| 4 | `import { CheckCircle2, XCircle, X } from "lucide-react";` |
| 36 | `className="fixed inset-x-0 top-[68px] z-[120] flex justify-center p-3"` — המיכל תופס היום את כל רוחב המסך מעל הדר `sticky top-0 z-50` וחוסם לוגו/כפתור סל **גם לקליקים**. 68px מפנה את שני ההדרים אחרי איחוד הגובה בסעיף 2.4 |
| 38 | להוסיף `max-w-[calc(100vw-1.5rem)]` |
| 64 | `<X className="size-4" />` במקום התו הגולמי ✕ |

**נדחה חלקית:** היעלמות אוטומטית — רק כאופציה ובזמן של 12-15 שניות. אישור תשלום מוצלח שנעלם אחרי 8 שניות נתפס כאיבוד מידע.

### 2.8 `components/public/landing-page.tsx` [landing]
| שורה | שינוי |
|---|---|
| 68-74 | להחליף את `<div className="flex min-w-0 items-center gap-2">` + ה-`<img>`/fallback ב-`<SiteLogo logoUrl={logoUrl} brandName={brandName} brand={brand} surface="light" />` |

הערה: זהו ההדר הלבן **האמיתי** היחיד — `landing-page.tsx` מרונדר במסלול המוקדם של `app/s/[slug]/page.tsx:266-299` ואין עליו `data-tier`, ולכן `tier-styles.tsx:328` לא נוגע בו. ה-`surface="light"` (טבעת דקה במקום משטח לבן) מעניק ללוגו Pollinations אטום מראה של כרטיס מכוון במקום תמונה תקועה.
**נדחה:** `width={168} height={32}` — יחס 21:9 שאינו קיים באף אחד משני הנכסים (2:1 או 1:1); ניחוש יחס שגוי מזיז את הקפיצה במקום למנוע אותה. התיבה הקבועה ב-`SiteLogo` היא הפתרון.

### 2.9 עמודי משנה — אותו טיפול לוגו [website+store]
| קובץ:שורה | שינוי |
|---|---|
| `app/s/[slug]/blog/page.tsx:69` | `<SiteLogo ... surface="dark" />` — ההדר `bg-white/90` נדרס ע"י `tier-styles.tsx:328` (הקובץ מסומן `data-tier` בשורה 60) |
| `app/s/[slug]/blog/[postId]/page.tsx:128` | זהה (`data-tier` בשורה 115) |
| `app/s/[slug]/account/layout.tsx:40-50` | `<SiteLogo ... surface="dark" />` — מחליף גם את ה-`<span>{brandName}</span>` בשורה 50 |
| `app/q/[token]/page.tsx:166-167` | `<SiteLogo ... surface="light" />` — כאן המשטח כבר קיים ונכון (`bg-white/90 ... p-1.5 shadow-sm`); רק הגודל והצורה משתנים |
| `app/invoice/[id]/page.tsx:64` | `h-12 w-auto max-w-[160px] object-contain` + `alt="" aria-hidden="true"` (עמוד נייר לבן — לא להשתמש ב-`SiteLogo`, המבנה שונה) |
| `components/business/quote-pdf-button.tsx:151-153` | `alt="" aria-hidden="true"` + `style={{ height: 56, width: "auto", maxWidth: 180, objectFit: "contain", background: "#fff", borderRadius: 10, padding: 6 }}` — **לא** להשתמש ב-`SiteLogo`: זהו עץ שנלכד לקנבס ל-PDF ודורש סגנונות inline |

### 2.10 `components/public/partners-section.tsx` [website+store]
| שורה | שינוי |
|---|---|
| 34 | `className="h-10 w-auto max-w-[140px] object-contain"` — ה-`<img>` יושב בתוך flex-item עם `min-width:auto`, ולכן לוגו שותף ביחס 10:1 מקבל רוחב פנימי ~400px וגורם לגלישה אופקית במסך צר |

**נדחה:** העלאת `opacity-60` ל-70% — העדפת טעם; זו קונבנציה מקובלת לשורות שותפים. אם בכל זאת נוגעים בשורה 39, התוספת היחידה בעלת ערך היא `hover:grayscale-0` (`hover:opacity-100` כבר קיים).

### 2.11 `components/business/design-studio.tsx` (דשבורד, לא ציבורי)
| שורה | שינוי |
|---|---|
| 47 | לאתחל `logoBg` ל-`"dark"` — זה מצב ההדר בפועל בכל אתר חי |
| 226 | ``className={`h-10 w-auto max-w-[168px] rounded-lg border object-contain p-1 ${logoBg === "dark" ? "bg-zinc-900" : "bg-white"}`}`` |
| 283-300 | להעביר את מתג בהיר/כהה אל שורת הכותרת (221), **מחוץ** לתנאי `options.length > 0` שנפתח בשורה 279 — היום בעל עסק שהעלה לוגו משלו (270-274) רואה תמיד רקע לבן ולעולם לא מגלה שהלוגו שלו נעלם בהדר |
| — | להוסיף תווית `<p className="text-[10px] text-muted-foreground">כך הלוגו ייראה בהדר האתר (רקע כהה)</p>` |

---

## 3. סעיף הלוגו — סדר פעולות מחייב

צינור הלוגו נשבר בשלוש נקודות בלתי תלויות: **הצגה** (הדר), **ייצור AI** (Gemini / Pollinations), **העלאה עצמית**. סדר הביצוע חשוב — שלב 1 לבדו כבר סוגר את שני הממצאים הקריטיים, וללא תלות בשרשרת התמונות.

### שלב 1 — הצגה (חובה, ראשון) [כל 3]
`components/public/site-logo.tsx` (2.1) → החלפה ב-9 משטחים: `page.tsx`, `product/[productId]`, `blog`, `blog/[postId]`, `account/layout`, `landing-page`, `q/[token]`, ובנפרד `invoice` ו-`quote-pdf-button`.
זה סוגר: לוגו כהה נעלם · לוקאפ 512×256 בתיבה ריבועית · שתי צורות שונות בין עמודים · CLS · `alt` כפול (השם מוצג כטקסט לצדו, ולכן `alt="" aria-hidden`).
**לא לבצע** את הפיכת ה-`fill` ב-`svg-design.ts:316-317` לבהיר: זהו קובץ `logo.svg` **יחיד** שמוגש גם על משטחים לבנים (`invoice/[id]/page.tsx:64`, `quote-pdf-button.tsx:153`, `landing-page.tsx:70`, פוטר). הפיכתו לבהיר תעלים אותו שם. הפתרון הנכון לטווח ארוך: שני נכסים — `logo.svg` + `logo-light.svg` — ועמודת `brand_assets.logo_light_url` שרק ההדר הכהה צורך. מחוץ להיקף הנוכחי.

### שלב 2 — ייצור AI, מסלול Gemini (`lib/services/image-gen.ts`)
**2א. flood-fill במקום סף גלובלי — קודם.** להחליף את הלולאה בשורות 49-54:
```ts
const { width: W, height: H } = info;
const seen = new Uint8Array(W * H);
const stack: number[] = [0, W - 1, (H - 1) * W, H * W - 1];
const near = (p: number) => Math.min(data[p*4], data[p*4+1], data[p*4+2]) >= 232;
while (stack.length) {
  const p = stack.pop()!;
  if (p < 0 || p >= W * H || seen[p] || !near(p)) continue;
  seen[p] = 1;
  const x = p % W;
  if (x > 0) stack.push(p - 1);
  if (x < W - 1) stack.push(p + 1);
  stack.push(p - W, p + W);
}
for (let p = 0; p < W * H; p++) {
  if (!seen[p]) continue;
  const min = Math.min(data[p*4], data[p*4+1], data[p*4+2]);
  data[p*4+3] = min >= 250 ? 0 : Math.min(data[p*4+3], Math.round(((250 - min) / 18) * 255));
}
```
הסף הנוכחי מוחל על כל פיקסל בפריים: ivory `#FFFFF0` (min=240) מקבל אלפא 142/255 — 44% שקיפות **בתוך העיצוב**; טקסט לבן טהור בתוך מדליון כהה נמחק לחור. וזה בדיוק הגוון שהפרומפט ב-`logo-options/route.ts:40` ו-`WHITE_BG_SUFFIX` (`image-gen.ts:32-33`) מורים לבקש.

**2ב. חיתוך שוליים — רק אחרי 2א.** במקום שורות 55-57:
```ts
return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 1 })
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
```
**סדר קריטי:** `trim` על תמונה שבה לבן פנימי כבר נמחק (ההתנהגות הנוכחית) עלול לחתוך לתוך העיצוב.

### שלב 3 — ייצור AI, מסלול Pollinations
**לא להפעיל `whiteToAlpha` על Pollinations.** ההערה בשורות 111-114 מתעדת החלטה מפורשת שהקילוף שם יוצא מוכתם ("blotchy") כי הרקעים רועשים — סתירה ישירה לשיקול שכבר נשקל בקוד. הפתרון הוא המשטח משלב 1: ריבוע אטום בתוך כרטיס לוגו נראה מכוון.
תיקון משלים זול: `image-gen.ts:123` → `The design sits on a plain solid pure white #FFFFFF background, no shadow, no gradient, no texture.`
דיוק לניסוח הממצא: `background: "transparent"` שמועבר ב-`logo-options/route.ts:100` **כן** משפיע — הוא משנה את הפרומפט בשורה 123; הוא פשוט לא מפיק ערוץ אלפא.

### שלב 4 — העלאה עצמית (`lib/actions/design.ts`)
שני התיקונים באותה עריכה של `uploadLogoAction`, **סינון לפני נרמול**:
```ts
import { sanitizeSvg } from "@/lib/services/svg-design";
// ...
let body: Buffer | string = Buffer.from(await file.arrayBuffer());
let outType = file.type;
let ext = file.type === "image/svg+xml" ? "svg" : "png";

if (file.type === "image/svg+xml") {
  const clean = sanitizeSvg(body.toString("utf8"));
  if (!clean) return { error: "קובץ ה-SVG מכיל אלמנטים שאינם נתמכים (סקריפטים, פילטרים או תמונות מוטמעות) — נסו PNG" };
  body = clean;
} else {
  const sharp = (await import("sharp")).default;
  const img = sharp(body as Buffer).rotate();      // rotate לפני metadata — EXIF הופך מימדים
  const meta = await img.metadata();
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 80)
    return { error: "הלוגו קטן מדי — נדרשים לפחות 200×80 פיקסלים כדי שלא ייראה מטושטש" };
  body = await img
    .trim({ threshold: 12 })
    .resize({ width: 1024, height: 512, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  outType = "image/png";
}
```
ולהעביר `body/outType/ext` ל-`uploadSiteAsset` במקום החישוב הנוכחי בשורה 43.
`validImage` (24-31) בודקת היום רק גודל ו-MIME regex — אין מימדים, אין trim, אין resize; קובץ 11MB נטען בכל עמוד בהדר sticky, ולוגו 120×40 מוצג ב-32px שדורש 64px ב-2x.
**דיוק לנימוק האבטחה:** הכפתור ב-`design-studio.tsx:239` אינו פותח את ה-URL ישירות (`downloadLogo` עושה fetch→Blob→objectURL). החשיפה האמיתית: `uploadSiteAsset` מחזיר URL ציבורי של Supabase Storage המוגש עם `contentType=image/svg+xml`, נשמר כ-`brand_assets.logo_url` וניתן לניווט ישיר — שם SVG מרונדר כמסמך, לא כ-`<img>`. `sanitizeSvg` (`lib/services/svg-design.ts:328`) כבר מופעלת על תוצרי AI (`site-design.ts:79`) — כלומר תוכן פנימי מסונן וחיצוני לא.

### שלב 5 — משקל ומטמון
1. `lib/services/image-gen.ts:250` → `.upload(path, data, { contentType, upsert: true, cacheControl: "31536000" })`. ה-`?v=${Date.now()}` בשורה 255 כבר מבטיח URL חדש לכל גרסה, ולכן אין סיכון לתוכן מיושן.
2. `lib/actions/design.ts:84` (`chooseLogoAction`) — לייצר גרסת תצוגה ולשמור אותה כ-`logo_url` (המקור נשמר בנפרד):
```ts
const src = Buffer.from(await (await fetch(url)).arrayBuffer());
const small = await (await import("sharp")).default(src)
  .resize({ height: 256, fit: "inside", withoutEnlargement: true }).png().toBuffer();
const displayUrl = await uploadSiteAsset(`${businessId}/logo-display.png`, small, "image/png");
```
לדלג כשה-URL מסתיים ב-`.svg` (המסלול הדיפולטי מ-`site-design.ts`).
3. רק אחרי שלב 5.2 — לחבר את ה-`icons` ב-`generateMetadata` (2.2) ל-`logo-display.png`.

---

## 4. הכרעות בין ממצאים סותרים

| הסתירה | הכרעה | נימוק |
|---|---|---|
| משטח רקע ללוגו (`bg-white/90 ... p-1 shadow-sm`) **מול** מימדים (`h-9 w-auto max-w-[168px]`) — שניהם על `page.tsx:797` | **מיזוג לקומפוננטה אחת** (2.1) | שני ממצאים שכותבים את אותה תכונה; יישום סדרתי היה מוחק אחד את השני |
| `max-w-[168px]` (רוחב מקסימלי) **מול** רוחב מפורש למניעת CLS | **תיבה ברוחב קבוע `w-[120px]`** | `max-w` לא שומר מקום — הרוחב עדיין לא ידוע עד סיום הטעינה. תיבה קבועה מונעת CLS *וגם* חוסמת גלישה |
| `width={168} height={32}` (יחס 21:9) **מול** הנכסים בפועל | **נדחה** | הנכסים הם 512×256 (2:1) או 1024×1024 (1:1). נעילת יחס שגוי מזיזה את הקפיצה, לא מונעת אותה. נועלים את התיבה, לא את התמונה |
| "העמודים הפנימיים חסרים fallback לשם" **מול** "alt=brandName בעמודים פנימיים" | **לוקאפ אחיד — לוגו + שם תמיד, ו-`alt="" aria-hidden`** | ה-fallback כבר קיים (product:180, blog:70, blog/[postId]:129); החוסר הפוך — הם לא מציגים שם *כשיש* לוגו. משהשם מוצג כטקסט, `alt={brandName}` יוצר הכרזה כפולה בקורא מסך |
| הפעלת `whiteToAlpha` על Pollinations | **נדחה** | ההערה בשורות 111-114 מתעדת החלטה מפורשת שהקילוף שם יוצא מוכתם. המשטח משלב 1 פותר את אותה בעיה בלי לסתור שיקול קיים |
| הפיכת `fill` של ה-SVG לבהיר | **נדחה** | קובץ יחיד המוגש גם על לבן (חשבונית, PDF, נחיתה, פוטר) |
| `trim` אחרי הקילוף **מול** לולאת הסף הנוכחית | **תלות סדר**: flood-fill קודם, `trim` אחריו | `trim` על תמונה שבה לבן פנימי נמחק חותך לתוך העיצוב |
| `checkout-result` ב-`top-[68px]` **מול** גובה הדר לא אחיד (57px / 64px) | **לאחד קודם את גובה ההדר** ב-`product/[productId]/page.tsx:174` ל-`h-16`, ואז 68px נכון לשני העמודים | אחרת המרווח יהיה שגוי באחד מהם |
| `h-14` קבוע לרצועת הממוזערות | **נדחה** | ~56px אוויר ריק בכל כרטיס ללא תמונות נוספות; `h-full` לבדו פותר את היישור |
| `text-start` לשדות `dir="ltr"` | **נדחה** | ב-dir=ltr, `start` = שמאל. להשאיר `dir="ltr"` בלבד, כמו שדה האימייל בשורה 612 |
| היעלמות אוטומטית של באנר התשלום | **נדחה כברירת מחדל**, אופציונלי ב-12-15 שניות | אישור תשלום שנעלם ב-8 שניות נתפס כאיבוד מידע |

---

## 5. סיכונים ואימות ידני חובה

### 5.1 מה עלול להישבר
1. **`document.body.style.overflow = "hidden"` במגירת העגלה** — אם עמוד אחר כבר משנה overflow, השחזור (`prev`) יכול להתנגש. במובייל Safari נעילת גלילה על `body` לעיתים מאבדת את מיקום הגלילה בסגירה.
2. **`createPortal` ב-`public-store.tsx`** — הקומפוננטה מרונדרת גם בשרת. חובה השמירה `typeof document !== "undefined"`, אחרת שגיאת רינדור בשרת.
3. **`sharp` ב-Server Action** — `lib/actions/design.ts` יריץ `sharp` בזמן ריצה. `sharp` הוא תלות ישירה (`package.json:39`) וכבר בשימוש ב-`image-gen.ts:45`, אבל זו הפעם הראשונה במסלול העלאת משתמש: יש לאמת שהוא נארז ב-build של Vercel (ולא רק בנתיב שכבר עובד) ושזמן הריצה של resize לתמונה 12MB לא חורג מהתקציב.
4. **`.trim()` על תמונה שקופה לגמרי** — `sharp` זורק חריגה כשאין מה לחתוך. חובה `try/catch` שנופל חזרה ל-buffer המקורי, אחרת בחירת לוגו תיכשל לגמרי במקום להיראות פחות טוב.
5. **flood-fill על 1024×1024** — מיליון פיקסלים, מחסנית מערך; לא רקורסיה ולכן אין stack overflow, אבל יש לוודא שזמן הריצה לא מאריך את זמן ה-job מעבר ל-timeout.
6. **`icons` ב-`generateMetadata`** — Next יפלוט `<link rel="icon">` לדומיין Supabase חיצוני. יש לאמת ש-`img-src` ב-CSP (`next.config.ts`) מתיר את הדומיין הזה, אחרת הפאביקון ייחסם בשקט.
7. **הסרת `data-el="btn-primary"` מהעוטף** — לאמת שהכפתור עצמו עדיין מקבל את גרדיאנט הזהב (הוא נושא `data-el` משלו ב-`add-to-cart-button.tsx:163`), ושמצב "אזל" נראה עכשיו מושבת.
8. **`hover:text-white`** — בטוח **רק** כי `lib/design-tier.ts` מחזיר `professional` קשיח (משטח כהה יחיד). אם אי פעם יתווסף דרג בהיר, כל הקישורים האלה ייעלמו הפוך. יש להשאיר הערה בקוד ליד כל אחד מהם.
9. **`h-full` על הכרטיס** — לאמת שכרטיס בודד בשורה לא נמתח לגובה מוזר, ושרצועת הממוזערות לא דוחפת את המחיר מחוץ למסגרת.
10. **`toLocaleString("he-IL")`** — התיקון מסיר hydration mismatch (`public-store.tsx` הוא קומפוננטת לקוח שמרונדרת גם בשרת), אך יש לאמת שהפורמט זהה בין השרת ללקוח בכל ארבעת המקומות.
11. **`sanitizeSvg` בהעלאה** — היא חוסמת `<filter>` ו-`<image>`, שקיימים בלוגואים לגיטימיים מיוצאים מ-Illustrator. הודעת השגיאה חייבת להסביר בדיוק מה נדחה, אחרת בעל עסק יחשוב שהמערכת שבורה.

### 5.2 בדיקות ידניות אחרי היישום
- [ ] **מצב כהה של מערכת ההפעלה** על כל עמוד ציבורי — `next-themes` מוסיף `class="dark"` ל-`<html>` לפי מערכת המבקר. כל משטח שמקבע רקע בהיר (המשטח הלבן של `SiteLogo`, `bg-white` של מגירת העגלה, ה-overlay של ה-Lightbox) חייב צבע טקסט מפורש. זה בדיוק מה שקרה בדף הצעת המחיר.
- [ ] **שלושת המצבים בנפרד:** landing (הדר לבן, `surface="light"`, ללא דרג) · website (הדר שחור של הדרג) · store (הדר שחור + עגלה + עמוד מוצר).
- [ ] **מעבר עמוד ראשי ← עמוד מוצר ← חזרה** — לוודא שהלוגו לא קופץ בגודל/צורה ושהמסגרת לא זזה אופקית.
- [ ] **Lightbox** — פתיחה מכרטיס שנמצא בריחוף, סגירה ב-Escape וב-backdrop, RTL תקין, ולא נחתך.
- [ ] **מגירת העגלה** — הסכומים וכפתור התשלום מקובעים בתחתית עם 15+ פריטים; טופס הצ'קאאוט נגלל בתוך עצמו; Escape סוגר.
- [ ] **צ'קאאוט ב-RTL** — טלפון, מספר בית ופרטי בנק: מספרים מוצגים LTR, טקסט עברי נשאר מיושר לימין.
- [ ] **קורא מסך** — גלריית המוצר (`aria-pressed` + מספור), שדות הטופס, והלוגו (שלא מכריז את שם העסק פעמיים).
- [ ] **צינור הלוגו מקצה לקצה** — ייצור 3 הצעות AI (Gemini + Pollinations), בחירה, ואז העלאה עצמית של: PNG גדול, PNG קטן מדי (חייב לדחות עם ההודעה הנכונה), SVG נקי, SVG עם `<filter>` (חייב לדחות), ותמונה עם EXIF orientation.
- [ ] **התצוגה המקדימה בסטודיו** מול האתר החי — לוודא שהן זהות עכשיו, כולל מתג בהיר/כהה שמופיע גם למי שהעלה לוגו בעצמו.
- [ ] **מדידת ניגודיות** — Tailwind v4 פולט `lab()`, שמנועי בדיקה נאיביים ורסטר לא תמיד מפרשים. יש לאמת ידנית ולא להסתמך על כלי אוטומטי.
- [ ] **4 האתרים החיים** שיושבים על hero `classic` — מחוץ להיקף הזה, אך יש לוודא שאף אחד מהתיקונים לא נשען על סגנון hero שנמחק (`classic`/`cozy`); כל התיקונים כאן נוגעים להדר, לכרטיסים ולעגלה בלבד.