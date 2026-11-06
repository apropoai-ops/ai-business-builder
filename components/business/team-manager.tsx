"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveTeamMemberAction,
  deleteTeamMemberAction,
} from "@/lib/actions/team";
import { ImageField } from "@/components/business/image-field";
import type { TeamMember } from "@/types/database";

export function TeamManager({
  businessId,
  items,
}: {
  businessId: string;
  items: TeamMember[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  function add(formData: FormData) {
    startTransition(async () => {
      const res = await saveTeamMemberAction(businessId, {
        name: String(formData.get("name") ?? ""),
        role: String(formData.get("role") ?? ""),
        photoUrl: photoUrl ?? "",
        bio: String(formData.get("bio") ?? ""),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("חבר/ת הצוות נוסף/ה ✓");
        formRef.current?.reset();
        setPhotoUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteTeamMemberAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          הצוות שלנו
        </div>

        <form ref={formRef} action={add} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="שם (חובה)" required />
          <Input name="role" placeholder="תפקיד (לא חובה)" />
          <Textarea
            name="bio"
            placeholder="תיאור קצר (לא חובה)"
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={photoUrl}
              onChange={setPhotoUrl}
              label="תמונת חבר/ת הצוות (לא חובה)"
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1.5 sm:col-span-2 sm:w-fit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            הוסף לצוות
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                {m.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo_url}
                    alt={m.name}
                    loading="lazy"
                    className="size-9 rounded-full object-cover"
                  />
                )}
                <span className="font-semibold">{m.name}</span>
                {m.role && (
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                )}
                {m.bio && (
                  <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                    · {m.bio}
                  </span>
                )}
                <div className="ms-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(m.id)}
                    disabled={busyId === m.id}
                  >
                    {busyId === m.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
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
