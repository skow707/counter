import Link from "next/link";
import { notFound } from "next/navigation";
import { readCounterData } from "@/lib/data";
import { formatDate, formatHeader } from "@/lib/format";

export function generateStaticParams() {
  return readCounterData().versions.map((version) => ({ id: String(version.id) }));
}

export default function VersionPage({ params }: { params: { id: string } }) {
  const version = readCounterData().versions.find((item) => item.id === Number(params.id));
  if (!version) notFound();
  return <><section className="detail-head"><Link className="back" href="/cronologia">← Torna alla cronologia</Link><div className="eyebrow">Versione rilevata</div><h1>#{version.versionNumber}</h1><p className="muted">{formatDate(version.detectedAt)} · <a href={version.sourceUrl}>sorgente</a></p></section><section className="detail-grid"><div><h2>Il segnale osservato</h2><dl className="facts"><div><dt>Last-Modified</dt><dd>{formatHeader(version.lastModified)}</dd></div><div><dt>ETag</dt><dd>{version.etag ?? "non dichiarato"}</dd></div><div><dt>Tipo di contenuto</dt><dd>{version.contentType ?? "non dichiarato"}</dd></div><div><dt>Chiave di confronto</dt><dd>{version.changeKey}</dd></div></dl></div><div><h2>Perché esiste questa versione?</h2><p className="muted">Il valore restituito dal server è diverso da quello registrato nel controllo precedente. Il contatore non interpreta l'orario e non inventa versioni: conserva il segnale tecnico che ha osservato.</p><a className="button primary" href={version.sourceUrl}>Apri la fonte</a></div></section></>;
}
