import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildChangeKey } from "@/lib/crawler";

describe("identità del controllo", () => {
  it("preferisce Last-Modified", () => {
    const lastModified = "Wed, 30 Sep 2026 10:00:00 GMT";
    expect(buildChangeKey(lastModified, "etag-vecchio", null)).toBe("last-modified:Wed, 30 Sep 2026 10:00:00 GMT");
  });

  it("usa ETag e hash solo come fallback", () => {
    expect(buildChangeKey(null, "etag-123", null)).toBe("etag:etag-123");
    const hash = createHash("sha256").update("orario").digest("hex");
    expect(hash).toHaveLength(64);
    expect(buildChangeKey(null, null, hash)).toBe(`sha256:${hash}`);
  });
});
