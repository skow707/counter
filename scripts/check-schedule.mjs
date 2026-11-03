import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL_TO_CHECK = process.env.TOTEM_URL || "https://www.abarc.it/totem/";
const SECONDARY_URL = process.env.SECONDARY_URL || "https://www.abarc.it/orario-didattico-a-a-2026-27-aggiornato/";
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
  const scheduleData = html.replace(
    /(<script\b[^>]*\bid\s*=\s*["']schedule-data["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (match, openingTag, body, closingTag) => {
      try {
        const payload = JSON.parse(body);
        delete payload.generated;
        return `${openingTag}${JSON.stringify(payload)}${closingTag}`;
      } catch {
        return match;
      }
    }
  );

  return scheduleData
    .replace(/<script\b(?![^>]*\bid\s*=\s*["']schedule-data["'])[^>]*>[\s\S]*?<\/script>/gi, "")
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

  // The official bulletin can publish a new PDF independently from the totem.
  const secondaryPageResponse = await retry(SECONDARY_URL, "GET");
  const secondaryHtml = await secondaryPageResponse.text();
  const secondaryPageUrl = secondaryPageResponse.url || SECONDARY_URL;
  const secondaryPdfUrl = linkedScheduleUrls(secondaryHtml, secondaryPageUrl).find((url) => /\.pdf(?:$|[?#])/i.test(url));
  if (!secondaryPdfUrl) throw new Error("Nessun PDF ufficiale trovato nella bacheca degli orari");
  const secondaryResponse = await retry(secondaryPdfUrl, "GET");
  if (!isPdf(secondaryResponse)) throw new Error(`La fonte secondaria non ha restituito un PDF: ${secondaryPdfUrl}`);
  const secondaryBytes = new Uint8Array(await secondaryResponse.arrayBuffer());
  if (secondaryBytes.length === 0) throw new Error("Il PDF ufficiale è vuoto");
  const secondaryContentHash = hashBytes(secondaryBytes);

  const previous = data.versions.at(-1);
  const primaryLastModified = sourceResponse.headers.get("last-modified") || totemLastModified;
  const secondaryLastModified = secondaryResponse.headers.get("last-modified");
  const primaryMatchesPrevious = previous?.primaryContentHash
    ? previous.primaryContentHash === contentHash
    : previous?.contentHash === contentHash;
  const secondaryMatchesPrevious = previous?.secondaryContentHash === secondaryContentHash;
  const primaryChanged = !primaryMatchesPrevious;
  const secondaryChanged = !secondaryMatchesPrevious;
  const unchanged = Boolean(previous?.primaryContentHash && previous?.secondaryContentHash)
    ? !primaryChanged && !secondaryChanged
    : false;
  const sourceUrl = primaryChanged && secondaryChanged
    ? `${sourceResponse.url || URL_TO_CHECK}, ${secondaryResponse.url || secondaryPdfUrl}`
    : secondaryChanged
      ? (secondaryResponse.url || secondaryPdfUrl)
      : (sourceResponse.url || URL_TO_CHECK);
  const lastModified = secondaryChanged ? secondaryLastModified : primaryLastModified;
  const etag = secondaryChanged
    ? secondaryResponse.headers.get("etag")
    : sourceResponse.headers.get("etag");
  const combinedHash = hashBytes(new TextEncoder().encode(`primary:${contentHash}\nsecondary:${secondaryContentHash}`));
  const changeKey = `content-sha256:${combinedHash}`;
  const hasBaseline = Boolean(previous?.contentHash);
  data.lastCheck = { checkedAt, status: unchanged ? "unchanged" : "changed", lastModified };
  if (!hasBaseline && previous) {
    previous.sourceUrl = sourceUrl;
    previous.lastModified = lastModified;
    previous.etag = etag;
    previous.contentHash = combinedHash;
    previous.contentType = contentType;
    previous.changeKey = changeKey;
    previous.primaryContentHash = contentHash;
    previous.secondaryContentHash = secondaryContentHash;
    data.lastCheck.status = "unchanged";
    console.log(`Baseline aggiornata senza incrementare il counter: ${changeKey}`);
  } else if (!unchanged) {
    const versionNumber = (previous?.versionNumber || 0) + 1;
    data.versions.push({
      id: versionNumber,
      versionNumber,
      detectedAt: checkedAt,
      sourceUrl,
      lastModified,
      etag,
      contentHash: combinedHash,
      contentType: secondaryChanged ? secondaryResponse.headers.get("content-type") : contentType,
      changeKey,
      primaryContentHash: contentHash,
      secondaryContentHash
    });
    console.log(`Nuova versione #${versionNumber}: ${changeKey}`);
  } else console.log(`Nessun cambiamento: ${changeKey}`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
} catch (error) {
  console.error(`Controllo fallito senza incrementare il counter: ${error.message}`);
  process.exitCode = 1;
}
