import { barcodeSvg } from "@/lib/barcode";

/** Renders a Code 128 barcode for a value (e.g. SKU / EAN). Null if unencodable. */
export function BarcodeSvg({
  value,
  height = 36,
  module = 1.3,
  className,
}: {
  value: string;
  height?: number;
  module?: number;
  className?: string;
}) {
  const svg = barcodeSvg(value, { height, module });
  if (!svg) return null;
  return (
    <span
      className={className}
      aria-label={`ברקוד ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
