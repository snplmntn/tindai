export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-7xl px-5 lg:px-12">
        <header className="py-4">
          <div className="flex items-center gap-2 text-base font-bold text-emerald-900">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs">✦</span>
            Tindai
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-72px)] items-center gap-10 py-6 md:grid-cols-2 md:py-10">
          <div className="mx-auto w-full max-w-xl md:mx-0">
            <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Para sa sari-sari store
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Para sa MSME na walang oras sa komplikado - simple, mabilis, at pang-negosyo.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Bawas hula sa iyong negosyo, kita mo agad ang kulang at mabenta kahit walang internet.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#"
                className="rounded-xl bg-emerald-700 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
              >
                Subukan nang Libre
              </a>
              <a
                href="#"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Pano Gumagana (1 min)
              </a>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>Libre simulan</span>
              <span>Walang credit card</span>
              <span>Android-friendly</span>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <div className="flex -space-x-2">
                <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-300" />
                <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-400" />
                <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-500" />
              </div>
              <p className="text-xs leading-5 text-slate-600">
                <span className="font-semibold text-emerald-700">10,000+</span> tindera na ang gumagamit.
              </p>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-md items-center justify-center md:justify-end">
            <div className="h-[660px] w-[300px] rotate-[-5deg] rounded-[48px] border-[7px] border-slate-700 bg-white p-4 shadow-2xl">
              <div className="relative h-full rounded-[34px] bg-white p-4">
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-300">Benta Ngayon</p>
                <p className="mt-1 text-center text-[33px] font-bold text-emerald-900">P14,250.00</p>

                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-[12px] font-medium leading-none text-slate-400">Mababa ang Stock</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <p className="text-[34px] font-bold leading-none text-emerald-700">12</p>
                      <p className="text-[24px] font-medium leading-none text-slate-800">De-lata</p>
                    </div>
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-[12px] font-bold leading-none text-rose-500">
                      Natitira
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-[11px] font-medium text-slate-400">Huling Benta</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-xl font-semibold text-slate-900">Bigas - 5kg</p>
                      <p className="text-[10px] text-slate-400">2 minuto nakalipas</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-800">P275</p>
                  </div>
                </div>

                <div className="mt-7">
                  <p className="text-2xl text-slate-500">Mga Dapat I-restock</p>
                  <div className="mt-3 h-[7px] rounded-full bg-slate-100">
                    <div className="h-[7px] w-[78%] rounded-full bg-emerald-700" />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-slate-400">3 items</p>
                </div>

                <div className="absolute bottom-6 left-1/2 flex min-w-[210px] -translate-x-1/2 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-center text-lg font-semibold leading-none whitespace-nowrap text-white shadow">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white">
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5.002 5.002 0 0 0 4 4.9V18H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1A5.002 5.002 0 0 0 17 11z" />
                    </svg>
                  </span>
                  <span>"Nagbenta ng 2 kape"</span>
                </div>

                <div className="absolute right-2 top-2 rounded-full bg-emerald-700 p-2 text-white shadow">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5.002 5.002 0 0 0 4 4.9V18H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1A5.002 5.002 0 0 0 17 11z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="absolute left-[18px] top-[72px] rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-lg">
              <p className="text-[11px] text-slate-400">Taas Kita</p>
              <p className="text-[34px] font-bold text-slate-900">
                +2<span className="text-xl">.5%</span>
              </p>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}
