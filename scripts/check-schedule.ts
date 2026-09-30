import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { probeTotem } from "@/lib/crawler";
import type { CounterData } from "@/lib/types";

const file = path.join(process.cwd(), "data", "versions.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as CounterData;
data.academicYear = config.academicYear;

try {
  const probe = await probeTotem();
  const previous = data.versions.at(-1);
  const unchanged = previous?.changeKey === probe.changeKey;
  data.lastCheck = {
    checkedAt: probe.checkedAt,
    status: unchanged ? "unchanged" : "changed",
    lastModified: probe.lastModified
  };

  if (unchanged) {
    console.log(`Nessun cambiamento. Last-Modified: ${probe.lastModified ?? "non presente"}`);
  } else {
    const versionNumber = (previous?.versionNumber ?? 0) + 1;
    data.versions.push({
      id: versionNumber,
      versionNumber,
      detectedAt: probe.checkedAt,
      sourceUrl: probe.url,
      lastModified: probe.lastModified,
      etag: probe.etag,
      contentHash: probe.contentHash,
      contentType: probe.contentType,
      changeKey: probe.changeKey
    });
    console.log(`Nuova versione #${versionNumber}. Last-Modified: ${probe.lastModified ?? "non presente"}`);
  }

  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
} catch (error) {
  console.error(`Controllo fallito: ${error instanceof Error ? error.message : "errore sconosciuto"}`);
  process.exitCode = 1;
}
