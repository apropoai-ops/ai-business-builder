"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getWebsite } from "@/lib/services/website.service";
import { getBusiness } from "@/lib/services/business.service";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  replaceVariants,
  type VariantInput,
} from "@/lib/services/store.service";
import type { ProductColor, ProductEngraving } from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function revalidateStore(businessId: string) {
  revalidatePath(`/businesses/${businessId}/store`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

/**
 * Sets (or clears) the business's provider-agnostic payment link. Surfaced as a
 * "pay now" button on accepted quotes and the store. Pass an empty string to clear.
 */
export async function setPaymentLinkAction(
  businessId: string,
  link: string,
): Promise<{ error?: string }> {
  await requireUser();
  const trimmed = link.trim();
  if (trimmed && !/^https:\/\/[^\s]+\.[^\s]+/.test(trimmed)) {
    return { error: "נא להזין כתובת תקינה שמתחילה ב-https://" };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ payment_link: trimmed || null })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    revalidatePath(`/businesses/${businessId}/store`);
    revalidatePath(`/businesses/${businessId}/quotes`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

/** Parses a comma-separated sizes string into a clean, de-duped list. */
function parseSizes(raw: string): string[] | null {
  const list = raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : null;
}

/** Parses the colors hidden field (JSON array of {name,hex}); tolerant of junk. */
function parseColors(raw: string): ProductColor[] | null {
  if (!raw.trim()) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const clean = arr
      .filter((c) => c && typeof c.name === "string" && /^#[0-9a-fA-F]{6}$/.test(c.hex))
      .map((c) => ({ name: String(c.name).slice(0, 30), hex: c.hex }));
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

const engravingSchema = z.object({
  enabled: z.boolean(),
  label: z.string().max(40).optional(),
  maxChars: z.number().int().min(1).max(60).optional(),
  required: z.boolean().optional(),
  fields: z.number().int().min(1).max(2).optional(),
});

/**
 * Parses the engraving hidden field (JSON matching ProductEngraving). Returns
 * null when disabled, invalid, or unparsable — the product then has no
 * engraving option (products.engraving stays null).
 */
function parseEngraving(raw: string): ProductEngraving | null {
  if (!raw.trim()) return null;
  try {
    const parsed = engravingSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !parsed.data.enabled) return null;
    const label = parsed.data.label?.trim();
    return {
      enabled: true,
      ...(label ? { label } : {}),
      ...(parsed.data.maxChars ? { maxChars: parsed.data.maxChars } : {}),
      ...(parsed.data.required ? { required: true } : {}),
      ...(parsed.data.fields && parsed.data.fields > 1 ? { fields: parsed.data.fields } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Parses the free-form attributes hidden field (JSON object of string→string
 * — "חומר: עור", "משקל: 300 גרם", whatever this particular product needs).
 * Tolerant of junk; caps count/length so one product can't bloat the row.
 */
function parseAttributes(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      const k = key.trim().slice(0, 40);
      const v = String(value).trim().slice(0, 200);
      if (!k || !v || Object.keys(clean).length >= 12) continue;
      clean[k] = v;
    }
    return clean;
  } catch {
    return {};
  }
}

/** Sets the business's shipping fee + free-shipping threshold (₪). Empty = clear. */
export async function setShippingSettingsAction(
  businessId: string,
  input: { shippingFee: string; freeThreshold: string },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const fee = input.shippingFee.trim() ? Number(input.shippingFee) : null;
    const threshold = input.freeThreshold.trim() ? Number(input.freeThreshold) : null;
    if (fee !== null && (isNaN(fee) || fee < 0)) return { error: "דמי משלוח לא תקינים" };
    if (threshold !== null && (isNaN(threshold) || threshold < 0)) {
      return { error: "סכום למשלוח חינם לא תקין" };
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ shipping_fee: fee, free_shipping_threshold: threshold })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    await revalidateStore(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

/** Splits one CSV line into fields, honoring double-quoted values. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Bulk import/update products from a CSV (the same columns the export emits).
 * Upserts by SKU within the business: a row whose SKU matches an existing
 * product updates it; otherwise a new product is created. `sizes` is "|"-joined.
 */
export async function importProductsAction(
  businessId: string,
  csvText: string,
): Promise<{ error?: string; created?: number; updated?: number }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };

    const text = csvText.replace(/^﻿/, "").trim();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { error: "הקובץ ריק או חסר שורות" };

    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);
    const iName = idx("name");
    if (iName < 0) return { error: "חסרה עמודת name בכותרת" };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("products")
      .select("id, sku")
      .eq("business_id", businessId);
    const bySku = new Map(
      (existing ?? []).filter((p) => p.sku).map((p) => [p.sku as string, p.id]),
    );

    let created = 0;
    let updated = 0;
    const get = (cols: string[], name: string) => {
      const i = idx(name);
      return i >= 0 ? cols[i]?.trim() ?? "" : "";
    };
    const num = (v: string) => (v.trim() === "" ? null : Number(v));

    for (const line of lines.slice(1).slice(0, 1000)) {
      const cols = parseCsvLine(line);
      const name = (cols[iName] ?? "").trim();
      if (!name) continue;
      const sku = get(cols, "sku") || null;
      const sizesRaw = get(cols, "sizes");
      const statusRaw = get(cols, "status");
      const status = ["active", "draft", "hidden"].includes(statusRaw) ? statusRaw : "active";
      const fields = {
        name,
        category: get(cols, "category") || null,
        subcategory: get(cols, "subcategory") || null,
        brand: get(cols, "brand") || null,
        sku,
        barcode: get(cols, "barcode") || null,
        price: num(get(cols, "price")),
        sale_price: num(get(cols, "sale_price")),
        stock_qty: num(get(cols, "stock_qty")) != null ? Math.max(0, Math.floor(num(get(cols, "stock_qty"))!)) : null,
        sizes: sizesRaw ? sizesRaw.split(/[|,]/).map((s) => s.trim()).filter(Boolean) : null,
        description: get(cols, "description") || null,
        status,
        active: status === "active",
      };

      const existingId = sku ? bySku.get(sku) : undefined;
      if (existingId) {
        await updateProduct(existingId, fields);
        updated++;
      } else {
        await createProduct(businessId, { ...fields, image_url: null });
        created++;
      }
    }

    await revalidateStore(businessId);
    return { created, updated };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הייבוא נכשל" };
  }
}

/**
 * Replaces a product's variants (per-size/color stock) and syncs the product's
 * in_stock flag to whether any variant still has stock.
 */
export async function saveVariantsAction(
  businessId: string,
  productId: string,
  variants: VariantInput[],
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };
    if (!Array.isArray(variants) || variants.length > 100) {
      return { error: "יותר מדי וריאציות" };
    }
    await replaceVariants(businessId, productId, variants);

    const anyStock = variants.some((v) => Math.floor(Number(v.stock_qty) || 0) > 0);
    const supabase = await createClient();
    await supabase
      .from("products")
      .update({ track_inventory: variants.length > 0, in_stock: variants.length === 0 ? true : anyStock })
      .eq("id", productId)
      .eq("business_id", businessId);

    await revalidateStore(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function saveProductAction(
  businessId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    // Ownership check before any service-role work (image upload).
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };

    // `id` is empty for a create and a products.id (uuid) for an edit. It is
    // interpolated into the image storage key below, so reject anything that
    // isn't a UUID rather than letting it shape a path.
    const id = String(formData.get("id") ?? "");
    if (id && !UUID_RE.test(id)) return { error: "מוצר לא תקין" };
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "נא למלא שם מוצר" };
    const description = String(formData.get("description") ?? "").trim() || null;
    const category = String(formData.get("category") ?? "").trim() || null;

    const priceRaw = String(formData.get("price") ?? "").trim();
    const price = priceRaw ? Number(priceRaw) : null;
    if (price !== null && (isNaN(price) || price < 0)) return { error: "מחיר לא תקין" };

    const saleRaw = String(formData.get("sale_price") ?? "").trim();
    const sale_price = saleRaw ? Number(saleRaw) : null;
    if (sale_price !== null && (isNaN(sale_price) || sale_price < 0)) {
      return { error: "מחיר מבצע לא תקין" };
    }
    if (sale_price !== null && price !== null && sale_price >= price) {
      return { error: "מחיר המבצע חייב להיות נמוך מהמחיר הרגיל" };
    }

    const sizes = parseSizes(String(formData.get("sizes") ?? ""));
    const colors = parseColors(String(formData.get("colors") ?? ""));
    const engraving = parseEngraving(String(formData.get("engraving") ?? ""));
    const attributes = parseAttributes(String(formData.get("attributes") ?? ""));

    // New fields + inventory.
    const sku = String(formData.get("sku") ?? "").trim() || null;
    const brand = String(formData.get("brand") ?? "").trim() || null;
    const subcategory = String(formData.get("subcategory") ?? "").trim() || null;
    const full_description = String(formData.get("full_description") ?? "").trim() || null;

    const stockRaw = String(formData.get("stock_qty") ?? "").trim();
    const stock_qty = stockRaw ? Math.max(0, Math.floor(Number(stockRaw))) : null;
    if (stock_qty !== null && isNaN(stock_qty)) return { error: "כמות מלאי לא תקינה" };
    const lowRaw = String(formData.get("low_stock_threshold") ?? "").trim();
    const low_stock_threshold = lowRaw ? Math.max(0, Math.floor(Number(lowRaw))) : null;

    const statusRaw = String(formData.get("status") ?? "active");
    const status = ["active", "draft", "hidden"].includes(statusRaw) ? statusRaw : "active";

    // Per-variant inventory (Wave C): when on, stock is managed by variant rows.
    const track_inventory = formData.get("track_inventory") === "true";
    const preorder = formData.get("preorder") === "true";
    const barcode = String(formData.get("barcode") ?? "").trim() || null;
    const costRaw = String(formData.get("cost_price") ?? "").trim();
    const cost_price = costRaw ? Number(costRaw) : null;
    if (cost_price !== null && (isNaN(cost_price) || cost_price < 0)) return { error: "מחיר עלות לא תקין" };
    const wholesaleRaw = String(formData.get("wholesale_price") ?? "").trim();
    const wholesale_price = wholesaleRaw ? Number(wholesaleRaw) : null;
    if (wholesale_price !== null && (isNaN(wholesale_price) || wholesale_price < 0)) return { error: "מחיר סיטונאי לא תקין" };
    const video_url = String(formData.get("video_url") ?? "").trim() || null;
    if (video_url && !/^https?:\/\//i.test(video_url)) return { error: "קישור וידאו חייב להתחיל ב-http(s)" };

    // Visibility: a product shows on the site only when status is 'active'.
    // When stock is tracked, 0 in stock forces out-of-stock regardless.
    const tracked = stock_qty !== null;
    const in_stock = tracked ? stock_qty > 0 : formData.get("in_stock") !== "false";
    const active = status === "active";

    // Gallery: accept up to 6 images. First becomes the primary image_url.
    const key = id || crypto.randomUUID();
    const files = formData
      .getAll("images")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, 6);
    let images: string[] | undefined;
    let image_url: string | undefined;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 4 * 1024 * 1024) return { error: "כל תמונה עד 4MB" };
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return { error: "פורמט תמונה לא נתמך" };
      const url = await uploadProductImage(businessId, key, file, i);
      (images ??= []).push(url);
    }
    if (images?.length) image_url = images[0];

    const fields = {
      name,
      description,
      category,
      price,
      sale_price,
      sizes,
      colors,
      engraving,
      attributes,
      sku,
      brand,
      subcategory,
      full_description,
      stock_qty,
      low_stock_threshold,
      track_inventory,
      preorder,
      barcode,
      cost_price,
      wholesale_price,
      video_url,
      status,
      active,
      in_stock,
      ...(images ? { images, image_url } : {}),
    };

    if (id) {
      await updateProduct(id, fields);
    } else {
      await createProduct(businessId, { ...fields, image_url: image_url ?? null });
    }
    await revalidateStore(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function deleteProductAction(
  businessId: string,
  productId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteProduct(productId);
    await revalidateStore(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function toggleProductAction(
  businessId: string,
  productId: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await updateProduct(productId, { active, status: active ? "active" : "hidden" });
    await revalidateStore(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
