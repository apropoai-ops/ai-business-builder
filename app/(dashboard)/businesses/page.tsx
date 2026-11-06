import Link from "next/link";
import { Plus, Sparkles, ArrowLeft } from "lucide-react";

import { listBusinesses } from "@/lib/services/business.service";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { BusinessStatusBadge } from "@/components/shared/business-status-badge";

export const metadata = { title: "העסקים שלי" };

export default async function BusinessesPage() {
  const businesses = await listBusinesses();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">העסקים שלי</h1>
          <p className="text-sm text-muted-foreground">
            נהלו את העסקים שלכם או צרו עסק חדש
          </p>
        </div>
        {businesses.length > 0 && (
          <ButtonLink href="/businesses/new">
            <Plus className="size-4" />
            עסק חדש
          </ButtonLink>
        )}
      </div>

      {businesses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">עדיין אין לכם עסקים</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                תארו רעיון עסקי, וה-AI יבנה עבורכם תוכנית עסקית, מחקר שוק,
                מיתוג, אתר ועוד.
              </p>
            </div>
            <ButtonLink size="lg" href="/businesses/new">
              בנו את העסק הראשון שלכם
              <ArrowLeft className="size-4" />
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link key={b.id} href={`/businesses/${b.id}/overview`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">
                      {b.name ?? "עסק ללא שם"}
                    </h3>
                    <BusinessStatusBadge status={b.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {b.description}
                  </p>
                  {b.industry && (
                    <span className="text-xs text-muted-foreground">
                      {b.industry}
                      {b.location ? ` · ${b.location}` : ""}
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
