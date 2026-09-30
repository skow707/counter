import { createHash } from "node:crypto";
import { config } from "./config";

export type ProbeResult = {
  url: string;
  checkedAt: string;
  lastModified: string | null;
  etag: string | null;
  contentHash: string | null;
  contentType: string | null;
  changeKey: string;
};

export class ProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeError";
  }
}

export function buildChangeKey(lastModified: string | null, etag: string | null, contentHash: string | null) {
  if (lastModified) return `last-modified:${lastModified}`;
  if (etag) return `etag:${etag}`;
  if (contentHash) return `sha256:${contentHash}`;
  throw new ProbeError("La risposta non contiene un segnale di versione");
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": config.userAgent,
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.7"
      }
    });
    if (!response.ok) throw new ProbeError(`HTTP ${response.status} da ${url}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < config.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < config.retries - 1) await wait(300 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new ProbeError("Controllo fallito");
}

export async function probeTotem(): Promise<ProbeResult> {
  const checkedAt = new Date().toISOString();
  let head: Response;
  try {
    head = await withRetry(() => request(config.totemUrl, "HEAD"));
  } catch (error) {
    if (!(error instanceof ProbeError) || !error.message.includes("HTTP 405")) throw error;
    head = await withRetry(() => request(config.totemUrl, "GET"));
  }
  const lastModified = head.headers.get("last-modified");
  const etag = head.headers.get("etag");
  const contentType = head.headers.get("content-type");

  if (lastModified) {
    return {
      url: head.url || config.totemUrl,
      checkedAt,
      lastModified,
      etag,
      contentHash: null,
      contentType,
      changeKey: buildChangeKey(lastModified, etag, null)
    };
  }

  if (etag) {
    return {
      url: head.url || config.totemUrl,
      checkedAt,
      lastModified: null,
      etag,
      contentHash: null,
      contentType,
      changeKey: buildChangeKey(null, etag, null)
    };
  }

  const body = await withRetry(() => request(config.totemUrl, "GET"));
  const bytes = new Uint8Array(await body.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  return {
    url: body.url || config.totemUrl,
    checkedAt,
    lastModified: null,
    etag: null,
    contentHash,
    contentType: body.headers.get("content-type"),
    changeKey: buildChangeKey(null, null, contentHash)
  };
}
