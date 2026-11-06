/**
 * Zero-API-key navigation deep links for an address — Google Maps + Waze.
 * Pure presentational; used by branches-section and the storefront contact
 * block. Renders nothing when there is no address and no explicit map URL.
 */
import { MapPin, Navigation } from "lucide-react";

export function MapLinks({
  address,
  mapUrl,
  brand,
  className = "",
}: {
  address?: string | null;
  mapUrl?: string | null;
  brand: string;
  className?: string;
}) {
  if (!address && !mapUrl) return null;

  const googleHref =
    mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!)}`;
  const wazeHref = address
    ? `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`
    : null;

  return (
    <div className={`mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold ${className}`}>
      <a
        href={googleHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:underline"
        style={{ color: brand }}
      >
        <MapPin className="size-3.5" />
        גוגל מפות
      </a>
      {wazeHref && (
        <a
          href={wazeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:underline"
          style={{ color: brand }}
        >
          <Navigation className="size-3.5" />
          Waze
        </a>
      )}
    </div>
  );
}
