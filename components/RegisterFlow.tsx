'use client';

import { useId, useState, type FormEvent } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { StreamingPlatform } from './types';

interface OnboardingMovie {
  id: number;
  title: string;
  poster_path: string;
  year: string;
  genres: string[];
}

interface RegisterFlowProps {
  registerStep: 1 | 2 | 3 | 4 | 5;
  setRegisterStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  accountEmail: string;
  setAccountEmail: (val: string) => void;
  accountPassword: string;
  setAccountPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  passwordsMatch: boolean;
  canCreateAccount: boolean;
  authError: string;
  authNotice: string;
  authLoading: boolean;
  supabaseConfigured: boolean;
  platforms: StreamingPlatform[];
  chosenPlatforms: string[];
  toggleRegisterPlatform: (name: string) => void;
  onboardingFavorites: OnboardingMovie[];
  selectedFavorites: number[];
  toggleFavorite: (id: number) => void;
  onSignUp: (e: FormEvent<HTMLFormElement>) => void;
  onCompleteOnboarding: () => void;
  onOpenDashboard: () => void;
  onCancel: () => void;
}

function RegistrationPasswordField({ label, value, onChange, hint }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const hintId = inputId + '-hint';
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-left text-sm font-medium text-sky-100">{label}</label>
      <div className="relative">
        <input id={inputId} type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} required
          value={value} onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? hintId : undefined}
          placeholder={label === 'Wachtwoord' ? 'Kies een wachtwoord' : 'Herhaal je wachtwoord'}
          className="fm-register-input min-h-12 w-full rounded-xl border border-sky-200/35 bg-[#133650]/80 py-3 pl-4 pr-12 text-base text-white outline-none transition placeholder:text-sky-100/60 focus:border-rose-300/60 focus:ring-2 focus:ring-rose-300/25" />
        <button type="button" onClick={() => setVisible((current) => !current)}
          aria-label={`${label === 'Wachtwoord' ? 'Wachtwoord' : 'Herhaald wachtwoord'} ${visible ? 'verbergen' : 'tonen'}`}
          aria-pressed={visible} aria-controls={inputId}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-sky-100/80 transition hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
      {hint && <p id={hintId} className="text-xs leading-relaxed text-sky-100/80">{hint}</p>}
    </div>
  );
}

export default function RegisterFlow({
  registerStep,
  setRegisterStep,
  displayName,
  setDisplayName,
  accountEmail,
  setAccountEmail,
  accountPassword,
  setAccountPassword,
  confirmPassword,
  setConfirmPassword,
  passwordsMatch,
  canCreateAccount,
  authError,
  authNotice,
  authLoading,
  supabaseConfigured,
  platforms,
  chosenPlatforms,
  toggleRegisterPlatform,
  onboardingFavorites,
  selectedFavorites,
  toggleFavorite,
  onSignUp,
  onCompleteOnboarding,
  onOpenDashboard,
  onCancel,
}: RegisterFlowProps) {
  const welcomeMovies = onboardingFavorites
    .filter((film) => selectedFavorites.includes(film.id))
    .slice(0, 5);

  return (
    <div className="fm-register relative isolate min-h-screen bg-[#173553] text-slate-100 selection:bg-rose-500 selection:text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#173553]" aria-hidden="true">
        <picture className="block h-full w-full">
          <source media="(max-width: 639px)" srcSet="/auth/cinema-mobile.webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/auth/cinema-desktop.webp" alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-center" />
        </picture>
        <div className="absolute inset-0 bg-[#173553]/10" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-4xl flex-col items-center justify-center px-4 pb-24 pt-8 sm:px-8 sm:pb-28 sm:pt-10">
        <header className="mb-6 w-full text-center">
          <div className="flex items-center justify-center gap-2.5 sm:gap-3">
            <span className="text-[38px] leading-none sm:text-5xl" aria-hidden="true">🍿</span>
            <h1 className="whitespace-nowrap text-[clamp(1.5rem,6vw,2.125rem)] font-black leading-none tracking-tight text-white">FILM<span className="text-rose-400">MATCH</span>NL</h1>
          </div>
          <p className="mt-2 text-xs font-medium text-sky-100 sm:text-sm">De juiste film voor vanavond</p>
          <svg viewBox="0 0 140 14" className="mx-auto mt-2 h-3 w-28 text-rose-400" fill="none" aria-hidden="true"><path d="M4 10Q70-4 136 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        </header>
        <section aria-labelledby="fm-register-title" className={`w-full rounded-3xl border border-sky-200/25 bg-[#244d6d]/85 p-5 shadow-[0_20px_70px_rgba(5,24,42,.3)] backdrop-blur-md sm:p-8 ${registerStep === 3 ? 'max-w-3xl' : 'max-w-xl'}`}>
          <header className="mb-6">
            <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Registratievoortgang">
              {['Account', 'Diensten', 'Films', 'Profiel', 'Klaar'].map((label, index) => (
                <li key={label} aria-current={registerStep === index + 1 ? 'step' : undefined} className="min-w-0 text-center">
                  <span className={`block h-1.5 rounded-full ${registerStep >= index + 1 ? 'bg-rose-400' : 'bg-sky-100/15'}`} aria-hidden="true" />
                  <span className={`mt-2 block text-[10px] font-medium sm:text-xs ${registerStep === index + 1 ? 'text-white' : 'text-sky-100/75'}`}>
                    <span className="sr-only">Stap {index + 1}: </span>{label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">Stap {registerStep} van 5</p>
            <h2 id="fm-register-title" className="mt-2 text-center text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {registerStep === 1 && 'Jouw filmavond begint hier'}
              {registerStep === 2 && 'Waar kijk jij?'}
              {registerStep === 3 && 'Welke films passen bij jou?'}
              {registerStep === 4 && 'Dit wordt jouw FilmMatch'}
              {registerStep === 5 && 'Je bent er helemaal klaar voor'}
            </h2>
          </header>

        <div className="min-w-0">
          {authError && <p role="alert" className="mb-5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
          {authNotice && <p role="status" className="mb-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{authNotice}</p>}

          {registerStep === 1 && (
            <form onSubmit={onSignUp} aria-busy={authLoading} className="mx-auto max-w-md space-y-4">
              <p className="text-center text-sm leading-relaxed text-sky-100">
                Maak je account aan en stel daarna je filmsmaak in.
              </p>
              <label className="block space-y-2 text-left text-sm font-medium text-sky-100">
                Gebruikersnaam
                <input
                  autoComplete="nickname"
                  placeholder="Hoe mogen we je noemen?"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="fm-register-input min-h-12 w-full rounded-xl border border-sky-200/35 bg-[#133650]/80 px-4 py-3 text-base text-white outline-none transition focus:ring-2 focus:ring-rose-300/25 focus:border-rose-300/60"
                />
              </label>
              <label className="block space-y-2 text-left text-sm font-medium text-sky-100">
                E-mailadres
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="jij@voorbeeld.nl"
                  className="fm-register-input min-h-12 w-full rounded-xl border border-sky-200/35 bg-[#133650]/80 px-4 py-3 text-base text-white outline-none transition focus:ring-2 focus:ring-rose-300/25 placeholder:text-sky-100/60 focus:border-rose-300/60"
                />
              </label>
              <RegistrationPasswordField label="Wachtwoord" value={accountPassword} onChange={setAccountPassword} hint="Minimaal 8 tekens." />
              <RegistrationPasswordField label="Herhaal wachtwoord" value={confirmPassword} onChange={setConfirmPassword} />
              {confirmPassword && !passwordsMatch && (
                <p role="status" className="text-xs text-rose-200">Wachtwoorden komen niet overeen.</p>
              )}
              <button
                type="submit"
                disabled={authLoading || !canCreateAccount}
                className="min-h-12 w-full rounded-full bg-rose-500 px-5 py-3 text-base font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {authLoading ? 'Account aanmaken…' : 'Account aanmaken'}
              </button>
              {!supabaseConfigured && (
                <p className="text-center text-[10px] leading-relaxed text-amber-100/80">
                  Account aanmaken is tijdelijk niet beschikbaar. Probeer het later opnieuw.
                </p>
              )}
            </form>
          )}

          {registerStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-sky-100 text-center">
                Kies de diensten waarop je een abonnement hebt. Je kunt dit later aanpassen.
              </p>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2" role="group" aria-label="Jouw streamingdiensten">
                {platforms.map((p) => {
                  const active = chosenPlatforms.includes(p.name);
                  return (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => toggleRegisterPlatform(p.name)}
                      aria-pressed={active}
                      className={`min-h-24 w-full p-4 rounded-2xl border-2 transition flex items-center justify-between text-left ${
                        active
                          ? 'bg-sky-300/20 border-sky-200 text-white shadow-md shadow-sky-950/15'
                          : 'bg-[#173b57]/70 border-sky-200/20 text-sky-100/80 hover:border-sky-200/50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StreamingLogo name={p.name} logoPath={p.logo_path} mark={p.mark} color={p.color} className="h-12 w-12 shrink-0 rounded-xl" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{p.name}</span>
                          <span className="mt-1 block text-xs text-sky-100/80">{active ? 'Geselecteerd' : 'Niet geselecteerd'}</span>
                        </span>
                      </div>
                      <div
                        className={`ml-2 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                          active ? 'bg-sky-200 text-[#173553]' : 'border border-sky-200/35 text-sky-100/60'
                        }`}
                      >
                        <span aria-hidden="true">{active ? '✓' : '−'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div role="status" aria-live="polite" className="pt-1 text-center text-sm leading-relaxed text-sky-100">
                {chosenPlatforms.length > 0 ? (
                  <p>{chosenPlatforms.length} {chosenPlatforms.length === 1 ? 'dienst geselecteerd' : 'diensten geselecteerd'}</p>
                ) : (
                  <p>Kies minimaal één dienst om verder te gaan.</p>
                )}
              </div>
            </div>
          )}

          {registerStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-sky-100 text-center">
                Kies minimaal 5 films die je goed vindt. Daarmee leren we jouw filmsmaak kennen.
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[52svh] overflow-y-auto p-1">
                {onboardingFavorites.map((film) => {
                  const isSelected = selectedFavorites.includes(film.id);
                  return (
                    <button
                      type="button"
                      key={film.id}
                      onClick={() => toggleFavorite(film.id)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Verwijder' : 'Kies'} ${film.title} als favoriet`}
                      className={`group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border transition select-none ${
                        isSelected
                          ? 'border-rose-500 ring-2 ring-rose-500/50 scale-[0.98]'
                          : 'border-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${film.poster_path}`}
                        alt={film.title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className={`absolute inset-0 ${isSelected ? 'bg-rose-950/20' : 'bg-gradient-to-t from-[#102f49]/90 via-transparent to-transparent'}`} />
                      <div className="absolute top-2 right-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-rose-600 text-white' : 'bg-black/60 text-white/50'}`}>
                          {isSelected ? '✓' : '+'}
                        </span>
                      </div>
                      <div className="absolute bottom-1 inset-x-1 text-center">
                        <p className="text-[10px] font-bold text-white truncate drop-shadow">{film.title}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-xs font-semibold text-sky-100/80">
                Gekozen: <span className="text-white">{selectedFavorites.length}</span> van minimaal 5
              </p>
            </div>
          )}

          {registerStep === 4 && (
            <div className="text-center space-y-5 max-w-md mx-auto py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-300/15 border border-emerald-200/40 flex items-center justify-center text-emerald-200 text-2xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Je voorkeuren zijn gekozen</h3>
                <p className="text-sm text-sky-100/80 mt-2 leading-relaxed">
                  Je startprofiel bevat {chosenPlatforms.length} streamingdiensten en {selectedFavorites.length} favoriete films. Sla je profiel op om je dashboard klaar te zetten.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {Array.from(new Set(onboardingFavorites.filter((film) => selectedFavorites.includes(film.id)).flatMap((film) => film.genres))).slice(0, 5).map((genre) => (
                    <span key={genre} className="rounded-full border border-rose-200/20 bg-rose-300/10 px-3 py-1 text-[10px] font-semibold text-rose-100">{genre}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {registerStep === 5 && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-3 text-center">
              <span className="text-5xl" aria-hidden="true">🍿</span>
              <div>
                <p className="text-xs font-semibold text-rose-300">Welkom, {displayName.trim() || 'filmliefhebber'}</p>
                <h3 className="mt-1 text-xl font-black text-white">Jouw dashboard staat klaar</h3>
                <p className="mt-2 text-sm leading-relaxed text-sky-100">
                  Je voorkeuren zijn opgeslagen. Je persoonlijke filmtips zijn afgestemd op {chosenPlatforms.length} streamingdiensten.
                </p>
              </div>
              <div className="grid w-full grid-cols-5 gap-2" aria-label="Jouw gekozen films">
                {welcomeMovies.map((film) => (
                  <div key={film.id} className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-neutral-800">
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${film.poster_path}`}
                      alt={film.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-sky-200/20 pt-4">
          {registerStep > 1 && registerStep < 5 ? (
            <button
              onClick={() => setRegisterStep((registerStep - 1) as 1 | 2 | 3 | 4 | 5)}
              type="button" className="min-h-11 rounded-full px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/10 hover:text-white"
            >
              &larr; Vorige
            </button>
          ) : registerStep === 1 ? (
            <button
              onClick={onCancel}
              type="button" className="min-h-11 rounded-full px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/10 hover:text-white"
            >
              Annuleren
            </button>
          ) : null}

          {registerStep > 1 && registerStep < 4 ? (
            <button
              disabled={
                (registerStep === 2 && chosenPlatforms.length === 0) ||
                (registerStep === 3 && selectedFavorites.length < 5)
              }
              onClick={() => setRegisterStep((registerStep + 1) as 1 | 2 | 3 | 4 | 5)}
              type="button" className={`min-h-12 px-6 py-3 rounded-full text-sm font-bold transition ${
                (registerStep === 2 && chosenPlatforms.length === 0) ||
                (registerStep === 3 && selectedFavorites.length < 5)
                  ? 'bg-sky-100/10 text-sky-100/45 cursor-not-allowed'
                  : 'bg-rose-500 text-white hover:bg-rose-400 shadow-lg shadow-rose-950/20'
              }`}
            >
              Verder &rarr;
            </button>
          ) : registerStep === 4 ? (
            <button
              disabled={authLoading}
              onClick={onCompleteOnboarding}
              type="button" className="min-h-12 rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60"
            >
              {authLoading ? 'Profiel opslaan…' : 'Profiel opslaan'}
            </button>
          ) : registerStep === 5 ? (
            <button
              onClick={onOpenDashboard}
              type="button" className="min-h-12 rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-400"
            >
              Naar mijn dashboard &rarr;
            </button>
          ) : null}
        </div>
        </section>
        <p className="mt-5 text-center text-[11px] font-medium text-sky-100/75">Jouw smaak. Jouw filmavond.</p>
      </main>
      <style jsx>{`
        .fm-register :global(button:focus-visible) { outline: 2px solid #fda4af; outline-offset: 3px; }
        .fm-register-input:-webkit-autofill,
        .fm-register-input:-webkit-autofill:hover,
        .fm-register-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff;
          caret-color: #fff;
          -webkit-box-shadow: 0 0 0 1000px #193f5b inset;
          box-shadow: 0 0 0 1000px #193f5b inset;
        }
        @media (prefers-reduced-motion: reduce) {
          .fm-register :global(*) { transition: none; }
        }
      `}</style>
    </div>
  );
}