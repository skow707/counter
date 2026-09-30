import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL_TO_CHECK = process.env.TOTEM_URL || "https://www.abarc.it/totem/";
const TIMEOUT_MS = Number(process.env.CRAWLER_TIMEOUT_MS || 20000);
const RETRIES = Number(process.env.CRAWLER_RETRIES || 3);
const file = resolve("data/versions.json");
const data = JSON.parse(readFileSync(file, "utf8"));

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function request(method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(URL_TO_CHECK, { method, redirect: "follow", signal: controller.signal, headers: { "user-agent": "ABARC-Orario-Counter/1.0", accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.7" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally { clearTimeout(timer); }
}

async function retry(method) {
  let error;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try { return await request(method); } catch (caught) { error = caught; if (attempt < RETRIES - 1) await sleep(300 * 2 ** attempt); }
  }
  throw error;
}

const checkedAt = new Date().toISOString();
let response;
try {
  try { response = await retry("HEAD"); } catch (error) {
    if (!String(error.message).includes("HTTP 405")) throw error;
    response = await retry("GET");
  }
  const lastModified = response.headers.get("last-modified");
  const etag = response.headers.get("etag");
  const contentType = response.headers.get("content-type");
  let contentHash = null;
  let changeKey;
  if (lastModified) changeKey = `last-modified:${lastModified}`;
  else if (etag) changeKey = `etag:${etag}`;
  else {
    const body = await retry("GET");
    contentHash = createHash("sha256").update(new Uint8Array(await body.arrayBuffer())).digest("hex");
    changeKey = `sha256:${contentHash}`;
  }
  const previous = data.versions.at(-1);
  const unchanged = previous?.changeKey === changeKey;
  data.lastCheck = { checkedAt, status: unchanged ? "unchanged" : "changed", lastModified };
  if (!unchanged) {
    const versionNumber = (previous?.versionNumber || 0) + 1;
    data.versions.push({ id: versionNumber, versionNumber, detectedAt: checkedAt, sourceUrl: response.url || URL_TO_CHECK, lastModified, etag, contentHash, contentType, changeKey });
    console.log(`Nuova versione #${versionNumber}: ${changeKey}`);
  } else console.log(`Nessun cambiamento: ${changeKey}`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
} catch (error) {
  console.error(`Controllo fallito senza incrementare il counter: ${error.message}`);
  process.exitCode = 1;
}
