import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for the product-image storage key.
 *
 * The 'site-assets' bucket has no user policies — uploadProductImage runs as
 * service role with `upsert: true`, and the only thing separating one business's
 * images from another's is the "<businessId>/products/" prefix of the object
 * key. The key is sent as a URL path, so `fetch` resolves `..` segments in it
 * before the request leaves us: an unvalidated productKey of
 * "../../<otherBusinessId>/products/x" escapes the prefix and overwrites
 * another business's image.
 *
 * `id` reaches this function straight from a FormData field, so the UUID shape
 * is the boundary. These tests pin that the guard runs BEFORE any storage call.
 */

const upload = vi.fn();
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.test/x.jpg" } }));
const createServiceRoleClient = vi.fn(() => ({
  storage: { from: () => ({ upload, getPublicUrl }) },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: () => createServiceRoleClient(),
}));

const { uploadProductImage } = await import("@/lib/services/store.service");

const BIZ = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const file = () => new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" });

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  createServiceRoleClient.mockClear();
});

describe("uploadProductImage storage-key safety", () => {
  const traversals = [
    "../../3333/products/x",
    "..",
    "a/../../b",
    "%2e%2e%2fescape",
    "not-a-uuid",
    "",
  ];

  for (const key of traversals) {
    it(`rejects productKey ${JSON.stringify(key)} without touching storage`, async () => {
      await expect(uploadProductImage(BIZ, key, file())).rejects.toThrow("Invalid image path");
      expect(createServiceRoleClient).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
    });
  }

  it("rejects a traversal in businessId too", async () => {
    await expect(uploadProductImage("../evil", PRODUCT, file())).rejects.toThrow(
      "Invalid image path",
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("accepts a real uuid pair and keeps the key inside the business prefix", async () => {
    await uploadProductImage(BIZ, PRODUCT, file());
    expect(upload).toHaveBeenCalledTimes(1);
    const key = upload.mock.calls[0][0] as string;
    expect(key).toBe(`${BIZ}/products/${PRODUCT}.jpg`);
    expect(key.startsWith(`${BIZ}/`)).toBe(true);
    expect(key).not.toContain("..");
  });

  it("keeps gallery slots inside the same prefix", async () => {
    await uploadProductImage(BIZ, PRODUCT, file(), 2);
    expect(upload.mock.calls[0][0]).toBe(`${BIZ}/products/${PRODUCT}-2.jpg`);
  });
});
