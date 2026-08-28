export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-teal/15 bg-ink text-mist">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-[family-name:var(--font-display)] text-lg text-white">
            Múlẹ̀
          </span>{" "}
          — research platform for 3-tier AI medicine authentication
        </p>
        <p className="text-mist/70">
          Advisory outputs only · Final judgment rests with users &amp; regulators
        </p>
      </div>
    </footer>
  );
}
