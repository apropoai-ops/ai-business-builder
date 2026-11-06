"use client";

import { useState } from "react";
import { CHIP_HAIRLINE } from "@/lib/storefront-brand";

/** KSP-style product gallery: a large main image + selectable thumbnails. */
export function ProductGallery({
  images,
  alt,
  brand,
}: {
  images: string[];
  alt: string;
  brand: string;
}) {
  const [active, setActive] = useState(images[0] ?? null);

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border bg-zinc-50 text-zinc-300">
        אין תמונה
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-2xl border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active} alt={alt} className="size-full bg-white object-contain p-4" />
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(src)}
              // Every thumbnail announced itself as "הצגת תמונה" with no way to
              // tell which one is selected — aria-pressed carries the state that
              // the border colour was carrying visually.
              aria-pressed={active === src}
              aria-label={`תמונה ${i + 1} מתוך ${images.length}`}
              className="size-16 shrink-0 overflow-hidden rounded-xl border-2 transition"
              style={{ borderColor: active === src ? brand : CHIP_HAIRLINE }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full bg-white object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
