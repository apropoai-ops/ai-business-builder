import { NextResponse } from "next/server";

/**
 * Client-side error beacon. The error boundaries (app/error.tsx,
 * app/global-error.tsx) POST the crash details here so client-only crashes —
 * which never reach the server logs on their own — show up in the Vercel
 * runtime logs and can be diagnosed remotely.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      message?: string;
      stack?: string;
      digest?: string;
      url?: string;
    };
    console.error(
      "[client-error]",
      JSON.stringify({
        message: String(body.message ?? "").slice(0, 500),
        stack: String(body.stack ?? "").slice(0, 3000),
        digest: String(body.digest ?? "").slice(0, 100),
        url: String(body.url ?? "").slice(0, 300),
        ua: req.headers.get("user-agent")?.slice(0, 200) ?? "",
      }),
    );
  } catch {
    // never fail the beacon
  }
  return new NextResponse(null, { status: 204 });
}
