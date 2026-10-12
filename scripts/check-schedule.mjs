import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL_TO_CHECK = process.env.TOTEM_URL || "https://www.abarc.it/totem/";
const TIMEOUT_MS = Number(process.env.CRAWLER_TIMEOUT_MS || 20000);
const RETRIES = Number(process.env.CRAWLER_RETRIES || 3);
const file = resolve("data/versions.json");
const data = JSON.parse(readFileSync(file, "utf8"));

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const absoluteUrl = (value, base) => {
  try { return new URL(value, base).toString(); } catch { return null; }
};

function frameUrls(html, baseUrl) {
  const urls = [];
  const pattern = /<(?:iframe|frame)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const url = absoluteUrl(match[1], baseUrl);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function linkedScheduleUrls(html, baseUrl) {
  const urls = [];
  const pattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = absoluteUrl(match[1], baseUrl);
    const label = `${match[1]} ${match[2]}`;
    if (href && (/\.pdf(?:$|[?#])/i.test(href) || /orari|orario|schedule|timetable|lezion/i.test(label)) && !urls.includes(href)) {
      urls.push(href);
    }
  }
  return urls;
}

function normalizeHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function request(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ABARC-Orario-Counter/1.0",
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.7",
        "cache-control": "no-cache, no-store, max-age=0",
        pragma: "no-cache"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} da ${url}`);
    return response;
  } finally { clearTimeout(timer); }
}

async function retry(url, method) {
  let error;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try { return await request(url, method); } catch (caught) { error = caught; if (attempt < RETRIES - 1) await sleep(300 * 2 ** attempt); }
  }
  throw error;
}

function isPdf(response) {
  return /application\/pdf/i.test(response.headers.get("content-type") || "") || /\.pdf(?:$|[?#])/i.test(response.url || "");
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const checkedAt = new Date().toISOString();
let response;
try {
  try { response = await retry(URL_TO_CHECK, "HEAD"); } catch (error) {
    if (!String(error.message).includes("HTTP 405")) throw error;
    response = await retry(URL_TO_CHECK, "GET");
  }
  const totemLastModified = response.headers.get("last-modified");
  // HEAD provides the lightweight metadata check; GET is needed to inspect frames and links.
  const totemHtmlResponse = await retry(URL_TO_CHECK, "GET");
  const totemHtml = await totemHtmlResponse.text();
  const totemUrl = totemHtmlResponse.url || URL_TO_CHECK;
  const candidates = [...frameUrls(totemHtml, totemUrl), ...linkedScheduleUrls(totemHtml, totemUrl), URL_TO_CHECK];
  let sourceResponse;
  let contentHash;
  let contentType;
  for (const candidate of [...new Set(candidates)]) {
    const candidateResponse = candidate === URL_TO_CHECK && totemUrl === URL_TO_CHECK
      ? { url: totemUrl, headers: totemHtmlResponse.headers, __text: totemHtml }
      : await retry(candidate, "GET");
    contentType = candidateResponse.headers.get("content-type");
    if (isPdf(candidateResponse)) {
      const bytes = new Uint8Array(await candidateResponse.arrayBuffer());
      if (bytes.length === 0) continue;
      contentHash = hashBytes(bytes);
    } else {
      const candidateText = candidateResponse.__text ?? await candidateResponse.text();
      const normalized = normalizeHtml(candidateText);
      if (candidate === URL_TO_CHECK && normalized.length < 80) continue;
      contentHash = hashBytes(new TextEncoder().encode(normalized));
    }
    if (contentHash) {
      sourceResponse = candidateResponse;
      break;
    }
  }
  if (!sourceResponse || !contentHash) throw new Error("Nessun contenuto reale dell'orario trovato nei frame del totem");
  const sourceUrl = sourceResponse.url || URL_TO_CHECK;
  const lastModified = sourceResponse.headers.get("last-modified") || totemLastModified;
  const etag = sourceResponse.headers.get("etag");
  const changeKey = `content-sha256:${contentHash}`;
  const previous = data.versions.at(-1);
  const hasBaseline = Boolean(previous?.contentHash);
  const unchanged = hasBaseline && previous.contentHash === contentHash;
  data.lastCheck = { checkedAt, status: unchanged ? "unchanged" : "changed", lastModified };
  if (!hasBaseline && previous) {
    previous.sourceUrl = sourceUrl;
    previous.lastModified = lastModified;
    previous.etag = etag;
    previous.contentHash = contentHash;
    previous.contentType = contentType;
    previous.changeKey = changeKey;
    data.lastCheck.status = "unchanged";
    console.log(`Baseline aggiornata senza incrementare il counter: ${changeKey}`);
  } else if (!unchanged) {
    const versionNumber = (previous?.versionNumber || 0) + 1;
    data.versions.push({ id: versionNumber, versionNumber, detectedAt: checkedAt, sourceUrl, lastModified, etag, contentHash, contentType, changeKey });
    console.log(`Nuova versione #${versionNumber}: ${changeKey}`);
  } else console.log(`Nessun cambiamento: ${changeKey}`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
} catch (error) {
  console.error(`Controllo fallito senza incrementare il counter: ${error.message}`);
  process.exitCode = 1;
}
