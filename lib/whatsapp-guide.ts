/**
 * The WhatsApp connection walkthrough, as data.
 *
 * Two surfaces render it — the compact stepper on the connection tab and the
 * full guide page — and they must never drift apart, because the whole point
 * is that an owner can follow one and finish. Every step names the exact page
 * to open, so nobody has to hunt through Meta's console.
 */

export type GuideStep = {
  /** Short imperative title. */
  title: string;
  /** What the owner actually does there. */
  body: string;
  /** The exact Meta page for this step. */
  link?: { label: string; href: string };
  /** The value this step produces, matching the field label on the form. */
  yields?: string;
  /** Extra detail shown only in the long guide. */
  detail?: string[];
};

export const WHATSAPP_STEPS: GuideStep[] = [
  {
    title: "חשבון עסקי ב-Meta",
    body: "פתחו תיק עסקי (Business Portfolio) ב-Meta Business. אם כבר יש לכם אחד לעסק — דלגו.",
    link: { label: "Meta Business", href: "https://business.facebook.com/" },
    detail: [
      "נדרש חשבון פייסבוק אישי כדי לפתוח תיק עסקי — הוא לא ייחשף ללקוחות.",
      "מלאו את שם העסק והאימייל העסקי בדיוק כפי שהם מופיעים במסמכי העסק. אי-התאמה מעכבת אימות עסק בהמשך.",
    ],
  },
  {
    title: "אפליקציה ב-Meta for Developers",
    body: "צרו אפליקציה חדשה מסוג Business, ואז הוסיפו לה את המוצר WhatsApp.",
    link: { label: "Meta for Developers · Apps", href: "https://developers.facebook.com/apps/" },
    detail: [
      "Create App → בוחרים Business → נותנים שם (השם הזה לא מוצג ללקוחות).",
      "במסך המוצרים לוחצים Set up על WhatsApp.",
      "מקשרים את האפליקציה לתיק העסקי שפתחתם בשלב 1.",
    ],
  },
  {
    title: "מספר טלפון ו-Phone Number ID",
    body: "בתוך האפליקציה: WhatsApp → API Setup. שם יופיע מספר בדיקה עם Phone Number ID, ואפשר להוסיף את המספר האמיתי של העסק.",
    yields: "Phone Number ID",
    detail: [
      "מספר הבדיקה של Meta חינמי ומצוין להתנסות — אבל הוא שולח הודעות רק למספרים שהוספתם ידנית לרשימה באותו מסך.",
      "מספר אמיתי חייב להיות מספר שאינו פעיל כרגע באפליקציית וואטסאפ רגילה. אם הוא פעיל — צריך למחוק שם את החשבון קודם.",
      "העתיקו את Phone Number ID (מספר ארוך), לא את מספר הטלפון עצמו.",
    ],
  },
  {
    title: "טוקן קבוע (System User)",
    body: "ב-Meta Business → Settings → Users → System Users: צרו משתמש מערכת, שייכו לו את האפליקציה ואת חשבון הוואטסאפ, וייצרו טוקן.",
    link: {
      label: "Business Settings · System Users",
      href: "https://business.facebook.com/settings/system-users",
    },
    yields: "Access Token",
    detail: [
      "Add → שם כלשהו → תפקיד Admin.",
      "Add Assets → בוחרים את האפליקציה ואת ה-WhatsApp Account → Full control.",
      "Generate New Token → בוחרים את האפליקציה → מסמנים את ההרשאות whatsapp_business_messaging ו-whatsapp_business_management → תוקף Never.",
      "הטוקן מוצג פעם אחת בלבד. אל תשתמשו בטוקן הזמני שמופיע במסך API Setup — הוא פג אחרי 24 שעות והסוכן יפסיק לענות.",
    ],
  },
  {
    title: "App Secret",
    body: "באפליקציה: Settings → Basic → App Secret → Show. זה מה שמאפשר לנו לוודא שההודעות באמת הגיעו מהאפליקציה שלכם.",
    yields: "App Secret",
    detail: [
      "בלי הערך הזה אנחנו לא יכולים לאמת את חתימת ההודעות, וההודעות הנכנסות יידחו — הסוכן פשוט לא יענה.",
    ],
  },
  {
    title: "חיבור ה-Webhook",
    body: "באפליקציה: WhatsApp → Configuration → Webhook → Edit. הדביקו את ה-Callback URL ואת ה-Verify Token מהמסך הזה, ואז Verify and save. אחר כך Manage → סמנו messages.",
    detail: [
      "שני הערכים מופיעים למטה בעמוד הזה עם כפתור העתקה.",
      "אם Verify and save נכשל — בדקו שהדבקתם את ה-Verify Token בלי רווחים בקצוות.",
      "השדה messages הוא היחיד שחייב להיות מסומן. בלעדיו Meta לא תשלח אלינו הודעות בכלל.",
    ],
  },
  {
    title: "הדבקה כאן והפעלה",
    body: "מלאו למטה את שלושת הערכים שאספתם — Phone Number ID, Access Token ו-App Secret — ולחצו \"חבר והפעל\".",
    detail: [
      "מומלץ למלא גם את מספר התצוגה, כדי שיוצג ללקוחות בכפתור הוואטסאפ באתר.",
    ],
  },
  {
    title: "בדיקה אמיתית",
    body: "שלחו הודעת וואטסאפ למספר העסק מטלפון אחר. התשובה אמורה להגיע תוך שניות, והשיחה תופיע בלשונית \"שיחות\".",
    detail: [
      "לא הגיעה תשובה? ודאו שהסוכן מופעל בלשונית \"סוכן וסימולטור\".",
      "עם מספר בדיקה של Meta — רק מספרים שהוספתם לרשימה במסך API Setup יקבלו מענה.",
      "וואטסאפ מאפשר מענה חופשי רק בתוך 24 שעות מההודעה האחרונה של הלקוח. אחרי זה נדרשת תבנית מאושרת.",
    ],
  },
];

export const WHATSAPP_TROUBLESHOOTING: { problem: string; fix: string }[] = [
  {
    problem: "הסוכן לא עונה בכלל",
    fix: "ברוב המקרים ה-App Secret שגוי או ריק, או ש-messages לא מסומן ב-Webhook. שני אלה גורמים להודעות להידחות בשקט לפני שהן מגיעות לסוכן.",
  },
  {
    problem: "עבד ופתאום הפסיק",
    fix: "כנראה טוקן זמני שפג. צרו טוקן System User עם תוקף Never (שלב 4) והדביקו אותו כאן מחדש.",
  },
  {
    problem: "Verify and save נכשל אצל Meta",
    fix: "ה-Verify Token לא תואם. העתיקו אותו שוב מהעמוד הזה בעזרת כפתור ההעתקה, בלי רווחים.",
  },
  {
    problem: "אני מקבל הודעות אבל לא נשלחת תשובה",
    fix: "ה-Access Token חסר הרשאה whatsapp_business_messaging, או שחלפו 24 שעות מההודעה האחרונה של הלקוח.",
  },
  {
    problem: "רק אני מקבל תשובות, לקוחות לא",
    fix: "אתם עדיין על מספר הבדיקה של Meta, שמוגבל לרשימת מספרים ידנית. הוסיפו את המספר האמיתי של העסק ב-API Setup.",
  },
];
