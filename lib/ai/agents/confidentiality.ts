/**
 * The confidentiality rule appended to every PUBLIC-FACING copywriter.
 *
 * `businesses.description` is the owner's brief to US, not to their customers.
 * Owners write things in it like "המותג פועל במודל דרופשופינג ... ונשלח ישירות
 * מהספק אל הבית", because they are describing their business to the tool that
 * is going to build it. We then hand that same paragraph to a copywriter agent
 * as context — and a helpful copywriter weaves it straight into the About page.
 * That is how a real storefront ended up telling its visitors that its jewelry
 * is supplier-fulfilled and that it is run by one 20-year-old.
 *
 * Internal agents (business plan, market research, insights, HR, CRM) must NOT
 * import this: there, the operating model is the entire point of the document.
 */
export const PUBLIC_COPY_CONFIDENTIALITY = `
סודיות עסקית (חובה, גובר על כל הנחיה אחרת):
הבריף שקיבלת נכתב עבורנו — לא עבור לקוחות העסק. הטקסט שאתה כותב ייקרא על ידי גולשים.
אסור לכתוב, לרמוז או לתאר בשום ניסוח:
- את מודל האספקה ושרשרת האספקה: דרופשיפינג, ספקים, יצרנים, "נשלח ישירות מהספק", ייבוא, סיטונאים, מחסן, מלאי או היעדר מלאי.
- מבנה עלויות ורווח: מרווחים, עמלות, מחיר עלות, תיווך, "בלי עלויות מלאי".
- את גודל העסק ומי מפעיל אותו: "עסק של אדם אחד", "מנוהל על ידי המייסד לבד", גיל המייסד, מספר עובדים, או שהעסק חדש/בהקמה/בתחילת דרכו.
- כלים, פלטפורמות, אוטומציות או ספקי שירות פנימיים שהעסק משתמש בהם.
במקום זה כתוב על מה שהלקוח מקבל: המוצר או השירות, האיכות, ההתאמה האישית, החוויה, השירות והאחריות.
מותר ונכון לציין עובדות שהלקוח צריך לדעת — זמני אספקה, מדיניות החזרות, חומרים, אחריות — אבל בלי להסביר מה מאחוריהן.
אם הבריף מתאר עסק חדש או קטן, כתוב בטון בטוח ומקצועי בלי להצהיר על הגודל או על הוותק.`;

/**
 * Terms that must never survive into public copy. Used as a post-generation
 * tripwire on the two agents that write the site body itself — a prompt rule
 * is a strong nudge, not a guarantee, and this is copy that goes live
 * unreviewed on a paying customer's storefront.
 */
const LEAK_PATTERNS: RegExp[] = [
  /דרופ\s*שיפ|דרופשיפ|dropship/i,
  /(מ|ה)?ספק(ים)?\s+(שלנו|נבחרים|שלהם)/,
  /ישירות\s+מ(ה)?(ספק|יצרן|מחסן)/,
  /סיטונא/,
  /בלי\s+מלאי|ללא\s+מלאי|אין\s+לנו\s+מלאי/,
  /מרווח\s+רווח|אחוז\s+רווח|מחיר\s+עלות/,
  /עסק\s+של\s+אדם\s+אחד|איש\s+אחד|לבד\s+מהבית/,
  // Founder age only when it is actually attached to the founder — a bare
  // "בן 3" in "מתאים לילדים בן 3" is not a leak and shouldn't cost a re-run.
  /(מייסד|מייסדת|בעלים|יזם|יזמת)[^.!?\n]{0,24}(בן|בת)\s*\d{1,2}/,
  /(בן|בת)\s*\d{1,2}[^.!?\n]{0,24}(שהקים|שייסד|שהקימה|שייסדה)/,
];

/** Returns the offending snippets found in a blob of generated copy. */
export function findInternalLeaks(text: string): string[] {
  const hits: string[] = [];
  for (const re of LEAK_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0].trim());
  }
  return hits;
}
