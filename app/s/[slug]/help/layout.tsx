import { requirePublicRoute } from "@/lib/public-route-guard";

/** The help/FAQ page is part of the multi-page product, not of a landing page. */
export default async function HelpRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requirePublicRoute(slug, "help");
  return <>{children}</>;
}
