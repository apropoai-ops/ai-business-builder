"use client";

import { useEffect } from "react";

/**
 * Replaces the root layout when an error is thrown there, so it must render
 * its own <html> and <body>. Styling is inline because the app's global CSS
 * may not have loaded when this boundary is shown.
 */
export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Client crashes never reach the server logs — beacon them so they can
    // be diagnosed remotely (see app/api/client-error/route.ts).
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
      }),
    }).catch(() => {});
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <html dir="rtl" lang="he">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          color: "#18181b",
          fontFamily:
            "Heebo, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            משהו השתבש
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              color: "#71717a",
              lineHeight: 1.6,
            }}
          >
            אירעה שגיאה לא צפויה. נסו לרענן את העמוד, ואם הבעיה נמשכת — חזרו
            מאוחר יותר.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                color: "#a1a1aa",
              }}
            >
              קוד שגיאה:{" "}
              <span dir="ltr" style={{ fontFamily: "monospace" }}>
                {error.digest}
              </span>
            </p>
          )}
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => retry()}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#18181b",
                color: "#fafafa",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              נסו שוב
            </button>
            {/* Intentional plain <a>: the root layout crashed, so a full
                page reload is safer than client-side navigation here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #d4d4d8",
                backgroundColor: "#ffffff",
                color: "#18181b",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              לדף הבית
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
