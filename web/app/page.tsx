export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 text-base font-bold text-emerald-900">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs">✦</span>
            Tindai
          </div>
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a className="font-semibold text-emerald-700 underline underline-offset-8" href="#">
              Home
            </a>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
          </nav>
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">Get App</button>
        </header>

        <section className="grid min-h-[calc(100vh-84px)] items-center gap-10 py-10 md:grid-cols-2">
          <div className="mx-auto w-full max-w-md md:mx-0">
            <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Pinoy Tech
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight lg:text-5xl">
              Boses-una na inventory para sa tindahan mo.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              I-track ang benta, i-manage ang stocks, at palaguin ang negosyo gamit ang boses. Simple, mabilis, at
              gawang-Pinoy.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#"
                className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm"
              >
                Download on the App Store
              </a>
              <a
                href="#"
                className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm"
              >
                Get it on Google Play
              </a>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">Subukan nang libre - walang credit card kailangan.</p>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-300" />
                <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-400" />
                <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-500" />
              </div>
              <p className="text-xs text-slate-600">
                Sinamahan na kami ng <span className="font-semibold text-emerald-700">10,000+</span> tindera sa buong
                bansa.
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="mx-auto h-[560px] w-[310px] rotate-[-5deg] rounded-[46px] border-[5px] border-emerald-900 bg-white p-4 shadow-2xl">
              <div className="h-full rounded-[34px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Today&apos;s Sales</p>
                <p className="mt-1 text-center text-lg font-bold text-emerald-900">P14,250.00</p>

                <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-400">Stocks Low</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-700">Canned Goods</p>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                      12 left
                    </span>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-400">Recent Sale</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-700">Rice - 5kg</p>
                    <p className="text-xs font-bold text-emerald-800">P275</p>
                  </div>
                </div>

                <div className="mt-4 border-b-4 border-emerald-700" />
                <p className="mt-3 text-xs text-slate-400">Inventory Health</p>
                <div className="mt-44 rounded-full bg-emerald-700 px-3 py-2 text-center text-[10px] font-semibold text-white">
                  Nagbenta ng 2 kape
                </div>
              </div>
            </div>

            <div className="absolute left-1/2 top-24 -translate-x-[190px] rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-lg">
              +2.5%
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
