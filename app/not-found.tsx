import { Sparkles } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";

export const metadata = { title: "העמוד לא נמצא" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 text-center">
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="size-6" />
      </div>
      <p className="text-7xl font-extrabold tracking-tight text-primary md:text-8xl">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold">העמוד לא נמצא</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        העמוד שחיפשתם הוסר, שינה כתובת או שאף פעם לא היה קיים.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/">לדף הבית</ButtonLink>
        <ButtonLink href="/businesses" variant="outline">
          לאזור האישי
        </ButtonLink>
      </div>
    </div>
  );
}
