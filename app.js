const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
const utcFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function formatDate(value) { return dateFormatter.format(new Date(value)); }
function formatHeader(value) { return value ? utcFormatter.format(new Date(value)) : "non dichiarato dal server"; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
function text(value) { return document.createTextNode(value); }

function showCurrent(data) {
  const current = data.versions[data.versions.length - 1];
  document.querySelector("#version-count").textContent = `${data.versions.length} version${data.versions.length === 1 ? "e" : "i"}`;
  if (!current) {
    document.querySelector("#current-meta").textContent = "In attesa del primo controllo reale.";
    return;
  }
  document.querySelector("#current-version").textContent = current.versionNumber;
  const meta = document.querySelector("#current-meta");
  meta.innerHTML = `<strong>Rilevata il ${escapeHtml(formatDate(current.detectedAt))}</strong><span>Last-Modified: ${escapeHtml(formatHeader(current.lastModified))}</span>`;
}

function showHistory(data) {
  const history = document.querySelector("#history");
  const versions = [...data.versions].reverse();
  if (!versions.length) return;
  history.innerHTML = versions.map((version) => `<a class="version-row" href="?version=${encodeURIComponent(version.id)}#dettaglio"><span class="version-number">#${escapeHtml(version.versionNumber)}</span><span><strong>Nuova versione dell'orario</strong><br><small>Last-Modified: ${escapeHtml(formatHeader(version.lastModified))}</small></span><span class="version-date">${escapeHtml(formatDate(version.detectedAt))}</span></a>`).join("");
}

function showDetail(data) {
  const id = new URLSearchParams(window.location.search).get("version");
  if (!id) return;
  const version = data.versions.find((item) => String(item.id) === id);
  if (!version) return;
  document.querySelector("#dettaglio").hidden = false;
  document.querySelector("#detail-title").textContent = `Versione #${version.versionNumber}`;
  const facts = document.querySelector("#detail-facts");
  facts.innerHTML = "";
  const rows = [["Rilevata", formatDate(version.detectedAt)], ["Last-Modified", formatHeader(version.lastModified)], ["ETag", version.etag || "non dichiarato"], ["Content-Type", version.contentType || "non dichiarato"], ["Chiave di confronto", version.changeKey]];
  rows.forEach(([label, value]) => { const row = document.createElement("div"); const dt = document.createElement("dt"); const dd = document.createElement("dd"); dt.append(text(label)); dd.append(text(value)); row.append(dt, dd); facts.append(row); });
}

fetch("data/versions.json", { cache: "no-store" }).then((response) => {
  if (!response.ok) throw new Error("Impossibile leggere lo storico");
  return response.json();
}).then((data) => { showCurrent(data); showHistory(data); showDetail(data); }).catch(() => {
  document.querySelector("#current-meta").textContent = "Storico non disponibile al momento.";
  document.querySelector("#history").innerHTML = "<p class=\"empty\">Non riesco a leggere data/versions.json.</p>";
});
