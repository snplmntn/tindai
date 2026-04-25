import type { Metadata } from 'next';
import Image from 'next/image';

import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Paano Gamitin ang Tindai | Tindai',
  description:
    'Hindi mo na kailangan ng papel at ballpen. Sa isang pindot at salita, maayos na ang iyong imbentaryo.',
};

type Step = {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  image: string;
  title: string;
  body: string;
  example: string;
};

const steps: Step[] = [
  {
    n: 1,
    image: '/1.png',
    title: 'Buksan ang App',
    body: 'Simulan ang araw nang tama. I-open ang Tindai sa iyong smartphone.',
    example: '“Good morning, Tindai! Ready na tayo mag-track.”',
  },
  {
    n: 2,
    image: '/2.png',
    title: 'Pindutin ang Mic',
    body: 'Hanapin ang green microphone button sa ibaba ng screen para mag-record.',
    example: 'Tap ang icon para magsimulang magsalita',
  },
  {
    n: 3,
    image: '/3.png',
    title: 'Sabihin ang Transaksyon',
    body: 'Ikwento lang sa app ang nangyari. Kahit Taglish, maiintindihan ng Tindai.',
    example: '“May bumili ng tatlong lata ng sardinas at isang kilong bigas.”',
  },
  {
    n: 4,
    image: '/4.png',
    title: 'I-check ang Auto-List',
    body: 'Makikita mo agad ang listahan ng mga items na binanggit mo.',
    example: '“3x Sardinas - P60, 1kg Bigas - P55”',
  },
  {
    n: 5,
    image: '/5.png',
    title: 'Kumpirmahin ang Benta',
    body: "Isang click lang sa 'Save' para pumasok sa record ang iyong kita.",
    example: 'Pindutin ang check mark para i-finalize',
  },
  {
    n: 6,
    image: '/6.png',
    title: 'Tingnan ang Report',
    body: 'Silipin ang iyong daily sales dashboard para sa mas maayos na pag-asenso.',
    example: '“Total Kita Ngayong Araw: ₱2,450.00”',
  },
];

/** Row order: 1 | 4, then 2 | 5, then 3 | 6 */
const stepsGridOrder: Step[] = [steps[0], steps[3], steps[1], steps[4], steps[2], steps[5]];

function StepCard({ step }: { step: Step }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-100/80 bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full shrink-0 bg-emerald-50">
        <Image
          src={step.image}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 400px"
        />
        <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 shadow-sm sm:left-3 sm:top-3 sm:h-9 sm:w-9 sm:text-sm">
          {step.n}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <h2 className="text-sm font-bold leading-snug text-emerald-950 sm:text-lg">{step.title}</h2>
        <p className="mt-2 text-xs leading-5 text-emerald-900/80 sm:text-sm sm:leading-6">{step.body}</p>
        <p className="mt-2 text-xs italic leading-5 text-emerald-800/90 sm:mt-3 sm:text-sm">{step.example}</p>
      </div>
    </article>
  );
}

export default function PaanoGamitinPage() {
  return (
    <main className="min-h-screen bg-[#f4faf7] text-emerald-950">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-2 sm:px-5">
        <SiteHeader showTryAppCta />

        <section className="pt-6 text-center">
          <p className="mx-auto inline-block rounded-full bg-emerald-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800">
            Simple at mabilis
          </p>
          <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">Paano Gamitin ang Tindai</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-emerald-900/85">
            Hindi mo na kailangan ng papel at ballpen. Sa isang pindot at salita, maayos na ang iyong imbentaryo.
          </p>
        </section>

        <section className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-5">
          {stepsGridOrder.map((step) => (
            <StepCard key={step.n} step={step} />
          ))}
        </section>

        <section className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-emerald-900 via-emerald-950 to-[#022c1f] px-4 py-7 text-center text-white shadow-2xl ring-1 ring-emerald-500/20 sm:mt-10 sm:px-7 sm:py-9">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle at center, rgba(255,255,255,0.55) 0.5px, transparent 0.6px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div className="relative">
            <div className="mx-auto mb-3 flex items-center justify-center gap-5 text-emerald-200/90">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                  <path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM12 20a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
                </svg>
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5.002 5.002 0 0 0 4 4.9V18H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1A5.002 5.002 0 0 0 17 11z" />
                </svg>
              </span>
            </div>

            <h2 className="mx-auto max-w-3xl text-xl font-bold leading-snug tracking-tight sm:text-2xl lg:text-[1.75rem] lg:leading-tight">
              Sa isang pindot at salita mo lang, aayos na ang iyong negosyo.
            </h2>

            <div className="mx-auto mt-3 flex max-w-full justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <p className="whitespace-nowrap px-1 text-xs leading-6 text-emerald-100/95 sm:text-sm sm:leading-7 md:text-base">
                Sumali sa libo-libong tindera na mas pinadali ang buhay gamit ang Tindai.
              </p>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-emerald-200/90 sm:text-sm">
              <span className="text-white">10,000+</span> na tindera na ang gumagamit
            </p>

            <a
              href="#"
              className="mt-5 inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-emerald-950 shadow-md transition hover:bg-emerald-50 hover:shadow-lg"
            >
              Simulan na ang Tindahan mo!
            </a>
            <p className="mt-2 text-[11px] leading-5 text-emerald-200/85 sm:text-xs">
              Libreng simulan · Walang kailangan na credit card
            </p>
          </div>
        </section>

        <footer className="mt-14 border-t border-emerald-100 pt-10 text-center text-xs text-emerald-900/70">
          <p>© 2025 Tindai</p>
        </footer>
      </div>
    </main>
  );
}
