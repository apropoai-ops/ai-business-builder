"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { useThemeToggle } from "@/components/shared/theme-toggle";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  fullName,
}: {
  email: string;
  fullName: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { label: themeLabel, Icon: ThemeIcon, cycle: cycleTheme } = useThemeToggle();
  const initials = (fullName ?? email)
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="relative size-9 rounded-full p-0"
          />
        }
      >
        <Avatar className="size-9">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI requires GroupLabel to live inside a Group — a bare label throws (error #31). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="font-medium">{fullName ?? "משתמש"}</span>
            <span className="text-xs font-normal text-muted-foreground" dir="ltr">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <UserIcon className="size-4" />
          הגדרות חשבון
        </DropdownMenuItem>
        <DropdownMenuItem closeOnClick={false} onClick={cycleTheme}>
          <ThemeIcon className="size-4" />
          <span>
            ערכת נושא:{" "}
            <span className="text-muted-foreground">{themeLabel}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => formRef.current?.requestSubmit()}
        >
          <LogOut className="size-4" />
          התנתקות
        </DropdownMenuItem>
        <form ref={formRef} action={signOutAction} className="hidden" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
