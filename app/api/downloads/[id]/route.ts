import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Public digital-download delivery. GET /api/downloads/:id
 *
 * Looks up the download item (no auth — this is the public lead-magnet
 * delivery link) and redirects to either:
 *  - a fresh 1-hour signed URL into the private 'business-files' bucket
 *    (uploaded files — see lib/actions/downloads.ts), or
 *  - the stored external file_url (legacy / externally-hosted files).
 *
 * FREE ITEMS ONLY. A download with a price is not deliverable here: the app has
 * no digital-goods checkout, so there is nothing that could have been paid.
 * Until one exists a priced file behaves like the other paid-but-uncheckoutable
 * modules (courses, memberships) — the storefront shows the price and sends the
 * buyer to the contact form. This check is the server half of that: the id is
 * printed on a public page, so hiding the button would not be a control.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  const supabase = createServiceRoleClient();
  const { data: item } = await supabase
    .from("downloads")
    .select("id, storage_path, file_url, price")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  if (item.price != null && Number(item.price) > 0) {
    return NextResponse.json(
      { error: "הקובץ הזה בתשלום — יש ליצור קשר עם העסק כדי לרכוש אותו" },
      { status: 402 },
    );
  }

  if (item.storage_path) {
    const { data: signed, error } = await supabase.storage
      .from("business-files")
      .createSignedUrl(item.storage_path, 3600);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: "יצירת קישור ההורדה נכשלה" }, { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl);
  }

  if (item.file_url) {
    return NextResponse.redirect(item.file_url);
  }

  return NextResponse.json({ error: "הקובץ אינו זמין כרגע" }, { status: 404 });
}
