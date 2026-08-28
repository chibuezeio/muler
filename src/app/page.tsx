import Link from "next/link";

const layers = [
  {
    n: "01",
    title: "Visual & Physical Integrity",
    body: "Capture QR/barcode via camera or upload. On-device decode plus AI visual checks for incomplete, scratched, or non-packaging imagery.",
  },
  {
    n: "02",
    title: "Recognition & Geospatial Risk",
    body: "Confirm the payload against the medicine registry, then measure distance between the present scan and the last scan against threshold X.",
  },
  {
    n: "03",
    title: "Temporal & Frequency Analysis",
    body: "Test whether time between scans is realistic given distance (Y hours), then flag codes whose scan count exceeds n — a reprint signal.",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#0d6e6e22,transparent_55%),linear-gradient(160deg,#0f2a2e_0%,#084848_45%,#0d6e6e_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-10 h-[28rem] w-[28rem] rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#c45c2644,#e8f1f022,#0d6e6e55,#c45c2644)] blur-2xl"
        />
        <div className="relative mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col justify-end px-4 pb-16 pt-20 sm:px-6 sm:pb-24">
          <p className="animate-rise font-[family-name:var(--font-display)] text-[clamp(3.5rem,12vw,7.5rem)] leading-[0.9] tracking-tight text-white">
            Múlẹ̀
          </p>
          <p className="animate-rise-delay mt-3 max-w-xl text-lg text-mist/90 sm:text-xl">
            Pronounced <em>Moo-leh</em> — Yoruba for “confirmed”. A research
            platform for three-tier AI authentication of tagged medicines.
          </p>
          <div className="animate-rise-delay-2 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/verify"
              className="relative rounded-md bg-accent px-5 py-3 text-sm font-medium text-white shadow-lg shadow-black/20 transition hover:brightness-110"
            >
              <span className="pulse-ring relative inline-flex">Run verification</span>
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-white/30 px-5 py-3 text-sm text-white/90 transition hover:bg-white/10"
            >
              Open research dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink sm:text-4xl">
            Methods, not marketing
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink/80">
            Counterfeit medicines remain a global health threat. Múlẹ̀ implements
            the manuscript’s layered method: intelligent preprocessing of scan
            metadata, geospatial and temporal anomaly checks, frequency analysis
            for reprint risk, and Azure OpenAI remarks that{" "}
            <strong className="font-medium text-ink">suggest</strong> risk rather
            than certify authenticity. The final decision stays with the user —
            and, when needed, regulators.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {layers.map((layer) => (
            <li key={layer.n} className="border-t border-teal/25 pt-5">
              <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-teal">
                LAYER {layer.n}
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl text-ink">
                {layer.title}
              </h3>
              <p className="mt-3 text-ink/75 leading-relaxed">{layer.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-teal/15 bg-mist/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              What this research build logs
            </h2>
            <ul className="mt-4 space-y-2 text-ink/80">
              <li>Product ID, batch, manufacturer (registry match)</li>
              <li>Device ID, geolocation, timestamp</li>
              <li>Layer-by-layer audit trail (VerificationRun)</li>
              <li>Configurable X miles · Y hours · n scans</li>
              <li>AI packaging notes &amp; hedged recommendations</li>
            </ul>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Beyond detection
            </h2>
            <p className="mt-4 leading-relaxed text-ink/80">
              The study recommends that counterfeit reports should not only be
              identified but conclusively addressed through regulatory engagement.
              The dashboard includes a report pathway stub for NAFDAC/SON-style
              escalation — detection is the beginning of accountability, not the end.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
