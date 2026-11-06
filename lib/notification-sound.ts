/**
 * The alert chime for new leads / orders / bookings.
 *
 * Synthesised with the Web Audio API rather than shipping an .mp3 on purpose:
 * no asset to download, nothing for the Content-Security-Policy to allow, no
 * 404 risk, and it starts instantly instead of after a network round trip.
 *
 * Browsers refuse to start audio before the user has interacted with the page,
 * so `primeNotificationSound()` is wired to the first click/keypress in the
 * dashboard — by the time a poll finds a new lead, the context is already
 * unlocked and the chime actually plays.
 */

const MUTE_KEY = "apropo-notification-sound-muted";

let ctx: AudioContext | null = null;

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Is the chime muted? Defaults to ON — missing a lead is the expensive failure. */
export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false; // private browsing — fall back to audible
  }
}

export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Unlocks audio on the first user gesture. Safe to call repeatedly; it detaches
 * its own listeners once it has run.
 */
export function primeNotificationSound(): () => void {
  if (typeof window === "undefined") return () => {};
  const unlock = () => {
    const audio = audioContext();
    if (audio?.state === "suspended") void audio.resume().catch(() => {});
    detach();
  };
  const detach = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return detach;
}

/** One short two-note chime (A5 → E6). Never throws. */
export function playNotificationChime(): void {
  if (isNotificationSoundMuted()) return;
  const audio = audioContext();
  if (!audio) return;

  try {
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const now = audio.currentTime;
    // Two rising notes read as "something arrived" rather than "something broke".
    [
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.13 },
    ].forEach(({ freq, at }) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Ramped envelope — a raw start/stop on a sine clicks audibly.
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.22, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.34);
    });
  } catch {
    // Audio is a nicety; the toast is the actual notification.
  }
}
