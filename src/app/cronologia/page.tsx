import Link from "next/link";
import { config } from "@/lib/config";
import { readCounterData } from "@/lib/data";
import { formatDate, formatHeader } from "@/lib/format";

export default function HistoryPage() {
  const data = readCounterData();
  const versions = data.versions.slice().reverse();
  return <section className="section history"><div className="section-heading"><div><div className="eyebrow">A.A. {config.academicYear}</div><h1>Cronologia</h1></div><span className="muted">{versions.length} version{versions.length === 1 ? "e" : "i"}</span></div>{versions.length ? <div className="version-list">{versions.map((version) => <Link className="version-row" href={`/versioni/${version.id}`} key={version.id}><span className="version-number">#{version.versionNumber}</span><span><strong>Nuova versione dell'orario</strong><br /><small>Last-Modified: {formatHeader(version.lastModified)}</small></span><span className="version-date">{formatDate(version.detectedAt)}</span></Link>)}</div> : <div className="empty">Nessuna versione ancora. Il contatore è pronto, ma non bara: aspetta la prima risposta reale.</div>}</section>;
}
