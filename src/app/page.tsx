import Link from "next/link";
import { config } from "@/lib/config";
import { readCounterData } from "@/lib/data";
import { formatDate, formatHeader } from "@/lib/format";

export default function HomePage() {
  const data = readCounterData();
  const current = data.versions.at(-1);
  return (
    <>
      <section className="hero">
        <div><div className="eyebrow">A.A. {config.academicYear}</div><h1>L'orario è cambiato di nuovo?</h1><p>Il contatore automatico che osserva il <code>Last-Modified</code> del totem ABARC e tiene memoria di ogni cambio.</p><div className="actions"><Link className="button primary" href="/cronologia">Vedi la cronologia</Link><a className="button" href={config.totemUrl}>Apri il totem</a></div></div>
        <div className="counter-panel"><div className="counter-label">Versione corrente</div><div className="counter-number">{current?.versionNumber ?? "—"}</div>{current ? <div className="counter-meta"><strong>Rilevata il {formatDate(current.detectedAt)}</strong><span>Last-Modified: {formatHeader(current.lastModified)}</span></div> : <div className="counter-meta"><strong>In attesa del primo controllo</strong><span>La prima risposta valida diventerà la #1.</span></div>}</div>
      </section>
      <section className="section"><div className="section-heading"><h2>Il radar</h2><span className="muted">{data.lastCheck ? `Ultimo check: ${formatDate(data.lastCheck.checkedAt)}` : "Non ancora attivo"}</span></div><p className="muted">Ogni mezz'ora GitHub Actions interroga il totem con una richiesta HEAD. Se il suo <code>Last-Modified</code> cambia, la cronologia cresce. Se la connessione cade, il numero resta fermo.</p></section>
    </>
  );
}
