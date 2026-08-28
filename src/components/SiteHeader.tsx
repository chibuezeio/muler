import Link from "next/link";

const links = [
  { href: "/", label: "Methods" },
  { href: "/verify", label: "Verify" },
  { href: "/dashboard", label: "Research Dashboard" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-teal/15 bg-sand/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-ink sm:text-3xl">
            Múlẹ̀
          </span>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-teal sm:inline">
            confirmed
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-ink/80 transition hover:bg-mist hover:text-teal-deep"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
