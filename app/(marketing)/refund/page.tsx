import type { Metadata } from "next";

import { LegalShell, Section } from "@/components/marketing/legal-shell";

export const metadata: Metadata = { title: "מדיניות ביטולים והחזרות" };

export default function RefundPage() {
  return (
    <LegalShell
      title="מדיניות ביטולים והחזרות"
      updated="25 ביוני 2026"
      intro="מדיניות זו חלה על המנוי לשירות AI Business Builder, והיא מנוסחת בהתאם לחוק הגנת הצרכן, התשמ״א-1981."
    >
      <Section title="1. ביטול מנוי">
        <p>
          ניתן לבטל את המנוי בכל עת דרך אזור ההגדרות בחשבון, ללא קנס ביטול. הביטול ייכנס
          לתוקף בתום תקופת החיוב הנוכחית ששולמה, ולא יתבצע חיוב נוסף לאחר מכן.
        </p>
      </Section>

      <Section title="2. תקופת צינון (החזר כספי)">
        <p>
          בהתאם לחוק הגנת הצרכן, ניתן לבטל עסקה לרכישת שירות מתמשך תוך 14 ימים מיום ביצוע
          העסקה ולקבל החזר, בניכוי דמי ביטול כחוק (5% מערך העסקה או 100 ₪, הנמוך מביניהם),
          ובלבד שטרם נעשה שימוש מהותי בשירות.
        </p>
      </Section>

      <Section title="3. אופן ביצוע ההחזר">
        <p>
          החזר כספי יבוצע לאמצעי התשלום שבו בוצעה העסקה, תוך פרק זמן סביר ובכפוף לתנאי ספק
          הסליקה (Stripe). לבקשת החזר יש לפנות בדוא״ל:{" "}
          <a className="underline" href="mailto:apropo.ai@gmail.com">apropo.ai@gmail.com</a>.
        </p>
      </Section>

      <Section title="4. חבילה חינמית">
        <p>
          ניתן להשתמש בחבילה החינמית כדי להתנסות בשירות ללא תשלום ולפני רכישת חבילה בתשלום.
          אין החזר בגין חבילה חינמית שכן לא בוצע בה חיוב.
        </p>
      </Section>

      <Section title="5. הזמנות בחנויות המשתמשים">
        <p>
          חשוב להבחין: מדיניות זו חלה על המנוי לפלטפורמה בלבד. רכישות שמבצעים לקוחות בחנות
          של בעל עסק כפופות למדיניות הביטולים וההחזרות של אותו עסק, והאחריות להן חלה על בעל
          העסק.
        </p>
      </Section>

      <Section title="6. יצירת קשר">
        <p>
          לכל שאלה בנושא ביטול או החזר: <a className="underline" href="mailto:apropo.ai@gmail.com">apropo.ai@gmail.com</a>.
        </p>
      </Section>
    </LegalShell>
  );
}
