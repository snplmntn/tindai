import Image from 'next/image';
import Link from 'next/link';

type SiteHeaderProps = {
  showTryAppCta?: boolean;
};

export function SiteHeader({ showTryAppCta = false }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" className="flex items-center gap-2 text-base font-bold text-emerald-900">
        <Image src="/logo.png" alt="Tindai" width={28} height={28} className="h-7 w-auto object-contain" priority />
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
