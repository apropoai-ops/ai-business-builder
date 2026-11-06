"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createBusinessAction } from "@/lib/actions/business";
import { siteModeDef } from "@/lib/site-mode";
import { siteModeForPlan } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepIndicator } from "@/components/wizard/step-indicator";
import { GalleryUpload } from "@/components/business/gallery-upload";

type PhotoStaged = { key: string; file: File; src: string };

type FormState = {
  name: string;
  type: string;
  industry: string;
  location: string;
  targetAudience: string;
  budget: string;
  revenueGoal: string;
  description: string;
  existingInfo: string;
  // Landing-mode only — the five questions from the spec.
  product: string;
  price: string;
  problem: string;
  whyYou: string;
};

const FIRST_STEP = 1;

const EMPTY: FormState = {
  name: "",
  type: "",
  industry: "",
  location: "",
  targetAudience: "",
  budget: "",
  revenueGoal: "",
  description: "",
  existingInfo: "",
  product: "",
  price: "",
  problem: "",
  whyYou: "",
};

export function BusinessWizard({ planTier }: { planTier: PlanTier }) {
  const router = useRouter();
  // Steps are numbered from 1: step 0 used to be the "מה בונים" picker, and
  // the package the customer already paid for answers that question now.
  const [step, setStep] = useState(FIRST_STEP);
  const [form, setForm] = useState<FormState>(EMPTY);
  const plan = PLANS[planTier];
  const siteMode = siteModeForPlan(planTier);
  const [isExisting, setIsExisting] = useState(false);
  const [photos, setPhotos] = useState<PhotoStaged[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLanding = siteMode === "landing";
  // Six steps in every mode — only step 2 changes what it asks. Indices still
  // run 1..6 so every `step === N` below keeps meaning what it says.
  const STEPS = ["הרעיון", isLanding ? "המוצר" : "השוק", "עסק קיים", "כספים", "תמונות", "סקירה"];

  function addPhotos(files: File[]) {
    setPhotos((p) => [
      ...p,
      ...files.map((file) => ({ key: crypto.randomUUID(), file, src: URL.createObjectURL(file) })),
    ]);
  }

  function removePhoto(key: string) {
    setPhotos((p) => {
      const found = p.find((x) => x.key === key);
      if (found) URL.revokeObjectURL(found.src);
      return p.filter((x) => x.key !== key);
    });
  }

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function next() {
    setError(null);
    if (step === 1 && form.description.trim().length < 20) {
      setError(
        isLanding
          ? "תארו את המוצר או ההצעה בלפחות 20 תווים כדי שה-AI יכתוב קופי מדויק"
          : "תארו את הרעיון בלפחות 20 תווים כדי שה-AI יבין אותו",
      );
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, FIRST_STEP));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createBusinessAction({
        siteMode,
        name: form.name,
        type: form.type,
        industry: form.industry,
        location: form.location,
        targetAudience: form.targetAudience,
        budget: form.budget,
        revenueGoal: form.revenueGoal,
        description: form.description,
        isExisting,
        existingInfo: isExisting ? form.existingInfo : "",
        product: isLanding ? form.product : "",
        price: isLanding ? form.price : "",
        problem: isLanding ? form.problem : "",
        whyYou: isLanding ? form.whyYou : "",
      }, photos.map((p) => p.file));
      // On success the action redirects; only errors return here.
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Replaces the old "מה בונים" step: the customer already chose and paid
          for a package, so this states what is being built rather than asking. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold">חבילת {plan.name}</span>
          <span className="text-muted-foreground"> · בונים לכם {siteModeDef(siteMode).label}</span>
        </div>
        <Link href="/pricing" className="text-xs font-medium text-primary hover:underline">
          לשדרוג חבילה
        </Link>
      </div>

      <div className="mb-8">
        <StepIndicator steps={STEPS} current={step - FIRST_STEP} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && (isLanding ? "ספרו לנו על ההצעה" : "ספרו לנו על הרעיון")}
            {step === 2 && (isLanding ? "המוצר, הקהל והמחיר" : "מי הקהל והיכן?")}
            {step === 3 && "עסק חדש או קיים?"}
            {step === 4 && "תקציב ויעדים"}
            {step === 5 && "תמונות (לא חובה)"}
            {step === 6 && "סקירה אחרונה"}
          </CardTitle>
          <CardDescription>
            {step === 1 &&
              (isLanding
                ? "ככל שתפרטו יותר — הקופירייטינג של הדף ימכור טוב יותר."
                : "תיאור טוב ככל שיהיה — תוכנית עסקית מדויקת יותר.")}
            {step === 2 &&
              (isLanding
                ? "אלו השאלות שקובעות את כל המסרים בדף — ענו עליהן בכנות."
                : "פרטים אלו עוזרים למקד את התוכנית והמיתוג.")}
            {step === 3 && "אם יש לכם עסק קיים — נבנה מערכת מתקדמת המותאמת אליו."}
            {step === 4 && "לא חובה, אך משפר את ההמלצות הפיננסיות."}
            {step === 5 && "תמונות של העסק והמוצרים — אפשר גם להוסיף מאוחר יותר."}
            {step === 6 && "ודאו שהכול נכון, וה-AI יתחיל לבנות."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">
                  {isLanding ? "תיאור ההצעה *" : "תיאור הרעיון *"}
                </Label>
                <Textarea
                  id="description"
                  rows={5}
                  placeholder={
                    isLanding
                      ? "לדוגמה: קורס דיגיטלי בן 6 שבועות שמלמד בעלי עסקים קטנים לנהל את הפרסום בפייסבוק לבד, כולל ליווי אישי וקבוצת תמיכה."
                      : "לדוגמה: אני רוצה לפתוח מכון כביסת רכב ידנית בירושלים, עם דגש על שירות מהיר ואיכותי ללקוחות עסקיים ופרטיים."
                  }
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {form.description.trim().length}/20 תווים לפחות
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">שם העסק (לא חובה)</Label>
                <Input
                  id="name"
                  placeholder="אפשר להשאיר ריק — נציע שם בשלב המיתוג"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && isLanding && (
            <>
              <div className="space-y-2">
                <Label htmlFor="product">מה המוצר או השירות?</Label>
                <Input
                  id="product"
                  placeholder="לדוגמה: קורס אונליין / וובינר / ליווי אישי / מוצר פיזי"
                  value={form.product}
                  onChange={(e) => update("product", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAudience">מי קהל היעד?</Label>
                <Textarea
                  id="targetAudience"
                  rows={2}
                  placeholder="למי בדיוק הדף מדבר? גיל, תפקיד, מצב, מה מטריד אותם"
                  value={form.targetAudience}
                  onChange={(e) => update("targetAudience", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">מה המחיר?</Label>
                  <Input
                    id="price"
                    placeholder="לדוגמה: 1,490 ש&quot;ח / חינם / לפי הצעת מחיר"
                    value={form.price}
                    onChange={(e) => update("price", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">תחום / ענף</Label>
                  <Input
                    id="industry"
                    placeholder="לדוגמה: שיווק, כושר, נדל&quot;ן"
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="problem">איזו בעיה זה פותר?</Label>
                <Textarea
                  id="problem"
                  rows={3}
                  placeholder="מה כואב ללקוח היום, לפני שהוא מגיע אליכם?"
                  value={form.problem}
                  onChange={(e) => update("problem", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whyYou">למה לבחור דווקא בכם?</Label>
                <Textarea
                  id="whyYou"
                  rows={3}
                  placeholder="ניסיון, תוצאות מוכחות, אחריות, שיטה ייחודית — מה שמבדל אתכם מהמתחרים"
                  value={form.whyYou}
                  onChange={(e) => update("whyYou", e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && !isLanding && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">סוג העסק</Label>
                  <Input
                    id="type"
                    placeholder="לדוגמה: שירות / חנות / מסעדה"
                    value={form.type}
                    onChange={(e) => update("type", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">תחום / ענף</Label>
                  <Input
                    id="industry"
                    placeholder="לדוגמה: רכב, אופנה, מזון"
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">מיקום</Label>
                <Input
                  id="location"
                  placeholder="עיר / אזור"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAudience">קהל יעד</Label>
                <Textarea
                  id="targetAudience"
                  rows={3}
                  placeholder="מי הלקוחות שלכם?"
                  value={form.targetAudience}
                  onChange={(e) => update("targetAudience", e.target.value)}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsExisting(false)}
                  className={`rounded-xl border-2 p-4 text-start transition-colors ${
                    !isExisting ? "border-primary bg-primary/5" : "border-border hover:border-zinc-400"
                  }`}
                >
                  <div className="font-semibold">עסק חדש</div>
                  <div className="text-xs text-muted-foreground">מתחילים מרעיון — נבנה הכול מאפס</div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExisting(true)}
                  className={`rounded-xl border-2 p-4 text-start transition-colors ${
                    isExisting ? "border-primary bg-primary/5" : "border-border hover:border-zinc-400"
                  }`}
                >
                  <div className="font-semibold">יש לי עסק קיים</div>
                  <div className="text-xs text-muted-foreground">נבנה מערכת מתקדמת המותאמת לעסק הפעיל</div>
                </button>
              </div>

              {isExisting && (
                <div className="space-y-2">
                  <Label htmlFor="existingInfo">ספרו על העסק הקיים</Label>
                  <Textarea
                    id="existingInfo"
                    rows={6}
                    placeholder="כדי שנבנה לכם מערכת ברמה הגבוהה ביותר, ספרו: כמה זמן העסק פעיל, הכנסה חודשית נוכחית, כמות לקוחות, מה עובד טוב ומה האתגרים, נכסים קיימים (אתר / דף עסקי / רשתות), ומה הכי תרצו לשפר או להרחיב."
                    value={form.existingInfo}
                    onChange={(e) => update("existingInfo", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    ככל שתפרטו יותר — ה-AI יבנה מערכת מדויקת ומתקדמת יותר עבורכם.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">תקציב התחלתי (ש&quot;ח)</Label>
                <Input
                  id="budget"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="50000"
                  value={form.budget}
                  onChange={(e) => update("budget", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenueGoal">יעד הכנסה חודשי (ש&quot;ח)</Label>
                <Input
                  id="revenueGoal"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="30000"
                  value={form.revenueGoal}
                  onChange={(e) => update("revenueGoal", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-2">
              <GalleryUpload
                previews={photos.map((p) => ({ key: p.key, src: p.src }))}
                onFilesSelected={addPhotos}
                onRemove={removePhoto}
              />
              <p className="text-xs text-muted-foreground">
                תמונות של העסק ושל המוצרים — לא חובה, ואפשר להוסיף או לשנות בכל שלב מאוחר יותר.
              </p>
            </div>
          )}

          {step === 6 && (
            <dl className="space-y-3 text-sm">
              <ReviewRow
                label="החבילה שלכם"
                value={`${plan.name} · ${siteModeDef(siteMode).label}`}
              />
              <ReviewRow label="תיאור" value={form.description} />
              <ReviewRow label="שם" value={form.name} />
              {isLanding ? (
                <>
                  <ReviewRow label="המוצר" value={form.product} />
                  <ReviewRow label="מחיר" value={form.price} />
                  <ReviewRow label="הבעיה" value={form.problem} />
                  <ReviewRow label="למה אתם" value={form.whyYou} />
                </>
              ) : (
                <>
                  <ReviewRow label="סוג" value={form.type} />
                  <ReviewRow label="מיקום" value={form.location} />
                </>
              )}
              <ReviewRow label="תחום" value={form.industry} />
              <ReviewRow label="קהל יעד" value={form.targetAudience} />
              <ReviewRow
                label="סטטוס"
                value={isExisting ? "עסק קיים ופעיל" : "עסק חדש"}
              />
              {isExisting && <ReviewRow label="פרטי העסק" value={form.existingInfo} />}
              <ReviewRow
                label="תקציב"
                value={form.budget ? `${form.budget} ש"ח` : ""}
              />
              <ReviewRow
                label="יעד הכנסה"
                value={form.revenueGoal ? `${form.revenueGoal} ש"ח` : ""}
              />
            </dl>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === FIRST_STEP || isPending}
            >
              <ArrowRight className="size-4" />
              חזרה
            </Button>

            {step < STEPS.length ? (
              <Button onClick={next}>
                המשך
                <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                בנו לי את העסק
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b pb-2 last:border-0">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex-1 whitespace-pre-wrap">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
