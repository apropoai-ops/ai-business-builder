"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Mail, Plus, ShieldCheck, Trash2, UserCog, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/lib/actions/members";
import type {
  EffectiveRole,
  InviteEntry,
  MemberEntry,
  MemberRole,
} from "@/lib/services/members.service";

const ROLE_LABEL: Record<EffectiveRole, string> = {
  owner: "בעלים",
  admin: "מנהל",
  staff: "צוות",
};

const ROLE_BADGE: Record<EffectiveRole, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  staff: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export function MembersManager({
  businessId,
  initialMembers,
  initialInvites,
}: {
  businessId: string;
  currentRole: EffectiveRole;
  initialMembers: MemberEntry[];
  initialInvites: InviteEntry[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [inviteRole, setInviteRole] = useState<MemberRole>("staff");
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function invite(formData: FormData) {
    startTransition(async () => {
      const res = await inviteMemberAction(businessId, {
        email: String(formData.get("email") ?? ""),
        role: inviteRole,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("ההזמנה נשלחה ✓");
        formRef.current?.reset();
        setInviteRole("staff");
        router.refresh();
      }
    });
  }

  function revoke(inviteId: string) {
    setBusyId(inviteId);
    startTransition(async () => {
      const res = await revokeInviteAction(businessId, inviteId);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function remove(memberId: string) {
    setBusyId(memberId);
    startTransition(async () => {
      const res = await removeMemberAction(businessId, memberId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("החבר/ה הוסר/ה מהצוות");
        router.refresh();
      }
      setBusyId(null);
    });
  }

  function changeRole(memberId: string, role: MemberRole) {
    setBusyId(memberId);
    startTransition(async () => {
      const res = await changeMemberRoleAction(businessId, memberId, role);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Role explainer */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col gap-2 p-4 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-600" />
            <span>
              <b className="text-foreground">מנהל/ת:</b> גישה מלאה לכל הנתונים, חוץ מניהול חברי צוות ומחיקת העסק
            </span>
          </div>
          <div className="flex items-start gap-2">
            <UserCog className="mt-0.5 size-4 shrink-0 text-zinc-500" />
            <span>
              <b className="text-foreground">צוות:</b> גישה מלאה לנתוני העסק, ללא הרשאות ניהול
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Invite form */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4 text-primary" />
            הזמנת חבר/ת צוות
          </div>
          <form ref={formRef} action={invite} className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="email"
              type="email"
              dir="ltr"
              placeholder="you@example.com"
              required
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">צוות</SelectItem>
                <SelectItem value="admin">מנהל</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              שליחת הזמנה
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending invites */}
      {initialInvites.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted-foreground">
            הזמנות ממתינות
          </span>
          {initialInvites.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="flex flex-wrap items-center gap-2 p-3">
                <span dir="ltr" className="font-medium">
                  {inv.email}
                </span>
                <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[inv.role]}`}>
                  {ROLE_LABEL[inv.role]}
                </Badge>
                <span className="text-xs text-muted-foreground">ממתינה לאישור</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ms-auto gap-1 text-muted-foreground hover:text-destructive"
                  onClick={() => revoke(inv.id)}
                  disabled={busyId === inv.id}
                >
                  {busyId === inv.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  ביטול
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Members */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted-foreground">חברי הצוות</span>
        {initialMembers.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.fullName || m.email || "משתמש/ת"}</span>
                  {m.isOwner && <Crown className="size-3.5 text-amber-500" />}
                  <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[m.role]}`}>
                    {ROLE_LABEL[m.role]}
                  </Badge>
                </div>
                {m.email && (
                  <span dir="ltr" className="text-sm text-muted-foreground">
                    {m.email}
                  </span>
                )}
              </div>

              {!m.isOwner && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {busyId === m.id && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                  <Select
                    value={m.role}
                    onValueChange={(v) => changeRole(m.id, v as MemberRole)}
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">צוות</SelectItem>
                      <SelectItem value="admin">מנהל</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(m.id)}
                    disabled={busyId === m.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
