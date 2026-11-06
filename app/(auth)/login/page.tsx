import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/user";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "התחברות" };

/** Only same-origin, absolute-path redirect targets — never external. */
function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/businesses";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: nextParam, error } = await searchParams;
  const next = safeNext(nextParam);

  // Already signed in — e.g. arrived at /login?next=/invite/<token> with an
  // active session — go straight where they were headed.
  const user = await getUser();
  if (user) redirect(next);

  // A dead auth code (state expired, link reused) lands here too — say so
  // instead of showing a bare login form with no explanation.
  return (
    <LoginForm
      next={next}
      oauthError={error === "oauth" || error === "auth_callback_failed"}
    />
  );
}
