import Link from 'next/link';

type SiteHeaderProps = {
  showTryAppCta?: boolean;
};

export function SiteHeader({ showTryAppCta = false }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" className="flex items-center gap-2 text-base font-bold text-emerald-900">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs">✦</span>
        Tindai
      </Link>
      {showTryAppCta ? (
        <a
          href="#"
          className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-900"
        >
          Subukan ang App
        </a>
      ) : null}
    </header>
  );
}
