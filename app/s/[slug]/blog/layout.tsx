import { requirePublicRoute } from "@/lib/public-route-guard";

/** No blog on a landing page — one page means one page. */
export default async function BlogRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requirePublicRoute(slug, "blog");
  return <>{children}</>;
}
