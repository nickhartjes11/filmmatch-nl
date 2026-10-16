'use client';

import Image from 'next/image';
import type { StreamingPlatform } from './types';

interface LandingViewProps {
  platforms: StreamingPlatform[];
  onOpenDashboard: () => void;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
}

export default function LandingView({
  platforms,
  onOpenDashboard,
  onOpenRegister,
  onOpenLogin,
}: LandingViewProps) {
  return (
    <div className="min-h-screen bg-[#07080a] text-neutral-100 flex flex-col justify-between selection:bg-rose-600 selection:text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900/60 via-[#07080a] to-[#050608] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-rose-600/[0.07] rounded-full blur-[160px] pointer-events-none" />

      <header className="relative z-20 px-6 md:px-14 py-6 flex items-center justify-between border-b border-white/[0.06] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-black text-sm tracking-tighter text-white shadow-lg shadow-rose-600/20">
            FM
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-white">
              FILMMATCH<span className="text-rose-500">.NL</span>
            </span>
            <p className="text-[10px] text-neutral-400 tracking-wide uppercase font-semibold">Nederlandse streaminggids</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={onOpenDashboard}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              Dashboard
            </button>
            <button
              onClick={onOpenRegister}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white transition"
            >
              Registratie
            </button>
          </div>
          <button
            onClick={onOpenLogin}
            className="text-xs font-semibold text-neutral-300 hover:text-white px-4 py-2 rounded-lg transition"
          >
            Inloggen
          </button>
          <button
            onClick={onOpenRegister}
            className="text-xs font-bold px-5 py-2.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition shadow-lg"
          >
            Registreren
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-14 py-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-xs font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Nooit meer doelloos scrollen op de bank
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.05]">
              De juiste film. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300">
                Nu op jouw scherm.
              </span> <br />
              Meteen te kijken.
            </h1>

            <p className="text-sm md:text-base text-neutral-300 max-w-lg leading-relaxed font-normal">
              FilmMatch NL combineert jouw persoonlijke filmsmaak met betrouwbare scores van vrienden. Je ziet uitsluitend titels die nú inbegrepen zijn bij jouw Nederlandse streamingdiensten.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
              <button
                onClick={onOpenRegister}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xl shadow-rose-600/30 transition flex items-center justify-center gap-2"
              >
                <span>Start gratis registratie</span>
                <span>&rarr;</span>
              </button>

              <button
                onClick={onOpenLogin}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.08] font-semibold text-xs transition"
              >
                Direct inloggen
              </button>
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                Gekoppeld met het actuele aanbod van:
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                {platforms.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-300"
                  >
                    <div className="relative w-4 h-4 rounded overflow-hidden">
                      <Image
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <span className="font-medium text-[11px]">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative flex justify-center">
            <div className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-neutral-900 border border-white/[0.1] shadow-2xl">
              <div className="relative aspect-[16/10] w-full bg-neutral-950 overflow-hidden">
                <Image
                  src="https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
                  alt="Interstellar"
                  fill
                  unoptimized
                  className="object-cover scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className="bg-rose-600 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-md shadow">
                    98% Match
                  </span>
                  <span className="bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 font-semibold text-[11px] px-2.5 py-1 rounded-md">
                    Nu op Prime Video
                  </span>
                </div>

                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-white/10 flex items-center gap-1.5">
                  <span className="bg-[#f5c518] text-black font-black text-[9px] px-1 rounded-sm">IMDb</span>
                  <span className="text-xs font-bold text-white">8.7</span>
                </div>

                <div className="absolute bottom-4 inset-x-5">
                  <p className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-1">Uitgelichte Aanbeveling</p>
                  <h2 className="text-2xl font-black text-white">Interstellar</h2>
                  <p className="text-xs text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
                    Wanneer het voortbestaan van de mensheid op het spel staat, vertrekt een team astronauten op een adembenemende reis door een wormgat.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-neutral-950/90 border-t border-white/[0.06] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                    T
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      Thomas <span className="text-[10px] text-neutral-400 font-normal">&bull; 92% smaakmatch</span>
                    </p>
                    <p className="text-[11px] text-neutral-300 italic truncate">
                      &ldquo;Dit is echt exact jouw smaak voor vanavond.&rdquo;
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenRegister}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs shrink-0 transition"
                >
                  Kijk nu &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-6 py-5 border-t border-white/[0.06] text-center text-xs text-neutral-400">
        FilmMatch NL &bull; Alleen films die je daadwerkelijk kunt streamen in Nederland
      </footer>
    </div>
  );
}