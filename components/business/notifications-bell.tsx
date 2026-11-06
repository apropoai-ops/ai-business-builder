"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Volume2, VolumeX } from "lucide-react";

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
import {
  isNotificationSoundMuted,
  playNotificationChime,
  setNotificationSoundMuted,
} from "@/lib/notification-sound";
import type { BusinessNotification } from "@/lib/services/notifications.service";

export function NotificationsBell({
  notifications,
}: {
  notifications: BusinessNotification[];
}) {
  const total = notifications.reduce((sum, n) => sum + n.count, 0);
  // Read once on mount via the lazy initializer — localStorage isn't available
  // during SSR, and this component only ever renders on the client.
  const [muted, setMuted] = useState(() => isNotificationSoundMuted());

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setNotificationSoundMuted(next);
    // Un-muting plays the chime immediately: this click IS the user gesture
    // that unlocks audio, so it doubles as a "this is what you'll hear" test.
    if (!next) playNotificationChime();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label="התראות"
            className="relative size-9 rounded-full p-0"
          />
        }
      >
        <Bell className="size-5" />
        {total > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* Base UI requires GroupLabel to live inside a Group — a bare label throws (error #31). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>התראות</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <DropdownMenuItem disabled>אין התראות חדשות</DropdownMenuItem>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.key}
              render={<Link href={notification.href} />}
            >
              {notification.label}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem closeOnClick={false} onClick={toggleSound}>
          {muted ? (
            <VolumeX className="size-4 text-muted-foreground" />
          ) : (
            <Volume2 className="size-4 text-primary" />
          )}
          {muted ? "צליל התראה כבוי" : "צליל התראה פועל"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
