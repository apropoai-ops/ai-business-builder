import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Business Builder — בונה העסקים החכם",
    template: "%s · AI Business Builder",
  },
  description:
    "הפכו רעיון עסקי לעסק פעיל תוך דקות: תוכנית עסקית, מחקר שוק, מיתוג, אתר, CRM ו-AI שמנהל את העסק.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* next-themes injects an anti-FOUC inline script that applies the
            persisted theme (or the system preference) before first paint. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>{children}</Providers>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
