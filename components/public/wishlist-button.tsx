"use client";

import { Heart } from "lucide-react";

import { useWishlist } from "@/components/public/wishlist-context";

export function WishlistButton({
  productId,
  name,
  image,
  unitPrice,
  brand,
}: {
  productId: string;
  name: string;
  image: string | null;
  unitPrice: number | null;
  brand: string;
}) {
  const { toggle, has } = useWishlist();
  const active = has(productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ productId, name, image, unitPrice });
      }}
      aria-label={active ? "הסרה ממועדפים" : "הוספה למועדפים"}
      aria-pressed={active}
      className="flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110"
    >
      <Heart
        className="size-4.5 transition-colors"
        style={{
          color: active ? brand : "#71717a",
          fill: active ? brand : "transparent",
        }}
      />
    </button>
  );
}
