"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { savePartnerAction, deletePartnerAction } from "@/lib/actions/partners";
import { ImageField } from "@/components/business/image-field";
import type { Partner } from "@/types/database";

export function PartnersManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Partner[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await savePartnerAction(businessId, {
        name: String(formData.get("name") ?? ""),
        logoUrl: logoUrl ?? "",
        link: String(formData.get("link") ?? ""),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("השותף נוסף ✓");
        formRef.current?.reset();
        setLogoUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deletePartnerAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Handshake className="size-4 text-primary" />
          שותפים ולקוחות
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="שם השותף/לקוח" required />
          <Input name="link" type="url" dir="ltr" placeholder="קישור לאתר (לא חובה)" />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={logoUrl}
              onChange={setLogoUrl}
              label="לוגו (לא חובה)"
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף שותף
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt={p.name} className="h-8 object-contain" />
                ) : null}
                <span className="font-medium">{p.name}</span>
                {p.link && (
                  <span dir="ltr" className="text-xs text-muted-foreground">{p.link}</span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(p.id)} disabled={busyId === p.id}>
                    {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
