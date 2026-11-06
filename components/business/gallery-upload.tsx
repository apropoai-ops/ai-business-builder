"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";

export type GalleryPreview = { key: string; src: string };

/**
 * Purely presentational drag/drop + thumbnail grid — no server calls of its
 * own, so it works both for a business that already exists (uploads persist
 * immediately, e.g. app/(dashboard)/businesses/[businessId]/website's design
 * tab) and for the creation wizard (files are staged locally as blob-URL
 * previews until the business — and its id — exist).
 */
export function GalleryUpload({
  previews,
  onFilesSelected,
  onRemove,
  busy = false,
  maxImages = 12,
}: {
  previews: GalleryPreview[];
  onFilesSelected: (files: File[]) => void;
  onRemove: (key: string) => void;
  busy?: boolean;
  maxImages?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const room = Math.max(0, maxImages - previews.length);
    if (files.length > 0 && room > 0) onFilesSelected(files.slice(0, room));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="size-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">גררו תמונות לכאן או לחצו לבחירה</p>
        <p className="text-[11px] text-muted-foreground">PNG, JPG או WEBP — עד 4MB לתמונה</p>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {previews.map((p) => (
            <div key={p.key} className="group relative aspect-square overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(p.key)}
                className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="הסר תמונה"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
