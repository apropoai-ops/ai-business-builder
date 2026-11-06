"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

/**
 * Drag/drop + thumbnail-preview picker for the product form's native
 * `<input type="file" name="images" multiple>` — kept as a real hidden input
 * (its files re-synced via DataTransfer on every change) so the surrounding
 * form's existing action="submit" plumbing (FormData.getAll("images") in
 * saveProductAction) needs no changes at all.
 */
export function ProductImagesField({
  name = "images",
  max = 6,
  maxSizeMb = 4,
}: {
  name?: string;
  max?: number;
  maxSizeMb?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Recomputed only when `files` actually changes; the effect below just
  // revokes the previous batch of object URLs, it never sets state.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function sync(next: File[]) {
    setFiles(next);
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = Math.max(0, max - files.length);
    if (room <= 0) return;
    const picked = Array.from(list).filter(
      (f) => f.type.startsWith("image/") && f.size <= maxSizeMb * 1024 * 1024,
    );
    if (picked.length) sync([...files, ...picked.slice(0, room)]);
  }

  function remove(idx: number) {
    sync(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-xs font-medium">
          גררו תמונות לכאן או לחצו לבחירה ({files.length}/{max})
        </p>
        <p className="text-[11px] text-muted-foreground">
          PNG, JPG או WEBP — עד {maxSizeMb}MB לתמונה. הראשונה תהיה התמונה הראשית.
        </p>
        <input
          ref={inputRef}
          type="file"
          name={name}
          hidden
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {previews.map((src, i) => (
            <div key={src} className="group relative aspect-square overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  ראשית
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
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
