import { requirePublicRoute } from "@/lib/public-route-guard";

/** Product pages exist only in 'store' mode — see lib/site-mode.ts. */
export default async function ProductRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requirePublicRoute(slug, "product");
  return <>{children}</>;
}
