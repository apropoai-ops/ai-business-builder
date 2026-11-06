"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getNotificationsAction } from "@/lib/actions/notifications";
import { savePushSubscriptionAction } from "@/lib/actions/push";
import {
  playNotificationChime,
  primeNotificationSound,
} from "@/lib/notification-sound";
import type { BusinessNotification } from "@/lib/services/notifications.service";

const DISMISS_KEY = "apropo-push-prompt-dismissed";
/** How often to look for new activity. Short enough that a lead is noticed
 *  while the caller is still warm, long enough not to hammer the database. */
const POLL_MS = 25000;

/**
 * Polls the owner's notifications and pops a toast — plus an audible chime —
 * whenever a category's count INCREASES (= new lead / accepted quote / order).
 * The sound is the point: a silent toast in a background tab is exactly how a
 * lead gets missed. It can be muted from the bell menu.
 *
 * Also offers (once, dismissibly) to enable browser push notifications so the
 * owner is alerted even when the dashboard tab is closed.
 */
export function NotificationsWatcher({
  businessId,
  initial,
}: {
  businessId: string;
  initial: BusinessNotification[];
}) {
  const counts = useRef<Record<string, number>>(
    Object.fromEntries(initial.map((n) => [n.key, n.count])),
  );
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let active = true;
    // Audio can't start without a prior user gesture — arm it now so the chime
    // is ready the first time something actually arrives.
    const unprime = primeNotificationSound();

    async function poll() {
      const next = await getNotificationsAction(businessId).catch(() => null);
      if (!active || !next) return;
      let arrived = 0;
      for (const n of next) {
        const before = counts.current[n.key] ?? 0;
        if (n.count > before) {
          arrived += n.count - before;
          toast(`🔔 ${n.label}`, {
            description: "התקבל עדכון חדש בעסק",
            action: { label: "צפייה", onClick: () => window.location.assign(n.href) },
            duration: 10000,
          });
        }
      }
      // One chime per poll, however many categories changed — a burst of
      // overlapping tones sounds like a fault, not an alert.
      if (arrived > 0) playNotificationChime();
      counts.current = Object.fromEntries(next.map((n) => [n.key, n.count]));
    }

    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
      unprime();
    };
  }, [businessId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Ignore storage failures (private browsing etc.)
    }
    // Small delay so the prompt doesn't flash during initial paint (and the
    // setState stays async per react-hooks/set-state-in-effect).
    const t = setTimeout(() => setShowPushPrompt(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismissPrompt() {
    setShowPushPrompt(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore storage failures (private browsing etc.)
    }
  }

  async function enablePush() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    setEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismissPrompt();
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const ready = await navigator.serviceWorker.ready.catch(() => registration);
      const subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("מינוי התראות לא תקין");
      }

      const res = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!res.ok) {
        toast.error(res.error ?? "הפעלת ההתראות נכשלה");
      } else {
        toast.success("התראות בדפדפן הופעלו ✓");
      }
    } catch {
      toast.error("הפעלת ההתראות נכשלה");
    } finally {
      setEnabling(false);
      dismissPrompt();
    }
  }

  if (!showPushPrompt) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bell className="size-4 text-primary" />
        רוצים לקבל התראות גם כשהדשבורד סגור?
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={enablePush} disabled={enabling}>
          הפעל התראות בדפדפן
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={dismissPrompt}
          aria-label="סגירה"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
