'use client';

import { useId, useState, type FormEvent } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { StreamingPlatform } from './types';

type RegistrationStep = 1 | 2 | 3 | 4 | 5;

interface OnboardingFavorite {
  id: number;
  title: string;
  poster_path: string;
  year: string;
  genres: string[];
}

interface AuthPageProps {
  mode: 'login' | 'register';
  registerStep: RegistrationStep;
  displayName: string;
  accountEmail: string;
  accountPassword: string;
  confirmPassword: string;
  loginEmail: string;
  loginPassword: string;
  authError: string;
  authNotice: string;
  authLoading: boolean;
  supabaseConfigured: boolean;
  passwordsMatch: boolean;
  canCreateAccount: boolean;
  chosenPlatforms: string[];
  selectedFavorites: number[];
  platforms: StreamingPlatform[];
  favoriteFilms: OnboardingFavorite[];
  onSignUp: (event: FormEvent<HTMLFormElement>) => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onDisplayNameChange: (value: string) => void;
  onAccountEmailChange: (value: string) => void;
  onAccountPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onTogglePlatform: (name: string) => void;
  onToggleFavorite: (id: number) => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onCompleteOnboarding: () => void;
  onOpenDashboard: () => void;
  onCancelRegistration: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

function CinemaBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#173553]" aria-hidden="true">
      <picture className="block h-full w-full">
        <source media="(max-width: 639px)" srcSet="/auth/cinema-mobile.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/auth/cinema-desktop.webp" alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-center" />
      </picture>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,42,65,.08),rgba(15,42,65,.08)_70%,rgba(15,42,65,.2))]" />
    </div>
  );
}

function AuthFieldIcon({ kind }: { kind: 'email' | 'lock' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      {kind === 'email' ? (
        <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>
      ) : (
        <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>
      )}
    </svg>
  );
}

export default function AuthPage({
  mode,
  registerStep,
  displayName,
  accountEmail,
  accountPassword,
  confirmPassword,
  loginEmail,
  loginPassword,
  authError,
  authNotice,
  authLoading,
  supabaseConfigured,
  passwordsMatch,
  canCreateAccount,
  chosenPlatforms,
  selectedFavorites,
  platforms,
  favoriteFilms,
  onSignUp,
  onSignIn,
  onDisplayNameChange,
  onAccountEmailChange,
  onAccountPasswordChange,
  onConfirmPasswordChange,
  onLoginEmailChange,
  onLoginPasswordChange,
  onTogglePlatform,
  onToggleFavorite,
  onPreviousStep,
  onNextStep,
  onCompleteOnboarding,
  onOpenDashboard,
  onCancelRegistration,
  onOpenLogin,
  onOpenRegister,
}: AuthPageProps) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const welcomeMovies = favoriteFilms.filter((film) => selectedFavorites.includes(film.id)).slice(0, 5);

  if (mode === 'login') {
    return (
      <div className="relative isolate min-h-screen bg-[#173553] text-slate-100 selection:bg-rose-500 selection:text-white">
        <CinemaBackdrop />
        <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center px-4 pb-24 pt-10 sm:px-8 sm:pb-28 sm:pt-12">
          <header className="mb-6 w-full max-w-[440px] text-center sm:mb-7">
            <div className="flex items-center justify-center gap-2.5 sm:gap-3">
              <span className="text-[38px] leading-none sm:text-5xl" aria-hidden="true">🍿</span>
              <h1 className="whitespace-nowrap text-[clamp(1.5rem,6vw,2.125rem)] font-black leading-none tracking-tight text-white">FILM<span className="text-rose-400">MATCH</span>NL</h1>
            </div>
            <p className="mt-2 text-xs font-medium text-sky-100 sm:text-sm">De juiste film voor vanavond</p>
            <svg viewBox="0 0 140 14" className="mx-auto mt-2 h-3 w-28 text-rose-400" fill="none" aria-hidden="true"><path d="M4 10Q70-4 136 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </header>

          <section aria-labelledby="fm-login-title" className="fm-auth-card w-full max-w-[440px] rounded-[24px] border border-sky-200/25 bg-[#244d6d]/75 p-5 shadow-[0_20px_70px_rgba(5,24,42,.3)] backdrop-blur-md sm:p-8">
            <div className="mb-6 text-center">
              <h2 id="fm-login-title" className="text-[1.875rem] font-black leading-tight tracking-tight text-white sm:text-4xl">Welkom terug</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-sky-100">Log in en ontdek welke film bij je past.</p>
            </div>

            {authError && <p role="alert" className="mb-4 rounded-xl border border-rose-200/35 bg-rose-950/50 px-3 py-2.5 text-sm text-rose-100">{authError}</p>}
            {authNotice && <p role="status" className="mb-4 rounded-xl border border-emerald-200/30 bg-emerald-950/45 px-3 py-2.5 text-sm text-emerald-100">{authNotice}</p>}

            <form onSubmit={onSignIn} aria-busy={authLoading} className="space-y-4">
              <div>
                <label htmlFor={emailId} className="sr-only">E-mailadres</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sky-100/80"><AuthFieldIcon kind="email" /></span>
                  <input id={emailId} type="email" name="email" autoComplete="email" required value={loginEmail}
                    onChange={(event) => onLoginEmailChange(event.target.value)} placeholder="E-mailadres"
                    className="fm-auth-input min-h-12 w-full rounded-xl border border-sky-200/35 bg-[#133650]/80 py-3 pl-11 pr-4 text-base text-white shadow-inner outline-none transition placeholder:text-sky-100/70 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/25" />
                </div>
              </div>
              <div>
                <label htmlFor={passwordId} className="sr-only">Wachtwoord</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sky-100/80"><AuthFieldIcon kind="lock" /></span>
                  <input id={passwordId} type={showLoginPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required value={loginPassword}
                    onChange={(event) => onLoginPasswordChange(event.target.value)} placeholder="Wachtwoord"
                    className="fm-auth-input min-h-12 w-full rounded-xl border border-sky-200/35 bg-[#133650]/80 py-3 pl-11 pr-12 text-base text-white shadow-inner outline-none transition placeholder:text-sky-100/70 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/25" />
                  <button type="button" onClick={() => setShowLoginPassword((visible) => !visible)} aria-label={showLoginPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'} aria-pressed={showLoginPassword} aria-controls={passwordId}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-sky-100/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                      {showLoginPassword && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
              </div>
              <button type="submit" disabled={authLoading}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-rose-500 px-5 py-3 text-base font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-200 disabled:cursor-wait disabled:opacity-60">
                <span>{authLoading ? 'Bezig met inloggen…' : 'Inloggen'}</span>
                {!authLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs sm:text-sm">
              <span className="text-sky-100">Nog geen account?</span>
              <button type="button" onClick={onOpenRegister} className="min-h-11 rounded-full border border-sky-200/60 px-4 py-2 text-xs font-semibold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300">Account aanmaken</button>
            </div>

            {!supabaseConfigured && <p role="status" className="mt-4 text-center text-xs leading-relaxed text-amber-100">Inloggen is tijdelijk niet beschikbaar. Probeer het later opnieuw.</p>}

            <aside className="mt-6" aria-label="Streamingdiensten">
              <div className="mb-4 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-sky-200/25" /><span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-100">Jouw streamingdiensten</span><span className="h-px flex-1 bg-sky-200/25" /></div>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
                {platforms.map((platform) => (
                  <span key={platform.name} title={platform.name}>
                    <StreamingLogo name={platform.name} logoPath={platform.logo_path} mark={platform.mark} color={platform.color} className="h-7 w-7 rounded-md" />
                  </span>
                ))}
              </div>
            </aside>
          </section>
          <p className="mt-5 text-center text-[11px] font-medium text-sky-100/75">Jouw smaak. Jouw filmavond.</p>
        </main>
        <style jsx>{`
          .fm-auth-input:-webkit-autofill,
          .fm-auth-input:-webkit-autofill:hover,
          .fm-auth-input:-webkit-autofill:focus {
            -webkit-text-fill-color: #fff;
            caret-color: #fff;
            -webkit-box-shadow: 0 0 0 1000px #193f5b inset;
            box-shadow: 0 0 0 1000px #193f5b inset;
          }
          @media (prefers-reduced-motion: reduce) {
            .fm-auth-input { transition: none; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-[100svh] items-center justify-center bg-[#173553] p-4 text-neutral-100">
      <CinemaBackdrop />
      <div className="relative z-10 flex max-h-[90svh] w-full max-w-xl flex-col rounded-3xl border border-sky-200/25 bg-[#244d6d]/90 p-6 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-500">Stap {registerStep} van 5</p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {registerStep === 1 && 'Maak je account aan'}
              {registerStep === 2 && 'Jouw streamingdiensten'}
              {registerStep === 3 && 'Kies je favorieten'}
              {registerStep === 4 && 'Controleer je profiel'}
              {registerStep === 5 && 'Welkom bij FilmMatchNL'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-all ${registerStep >= step ? 'w-5 bg-rose-500' : 'w-2 bg-white/10'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          {authError && <p role="alert" className="mb-5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
          {authNotice && <p role="status" className="mb-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{authNotice}</p>}

          {registerStep === 1 && (
            <form onSubmit={onSignUp} className="mx-auto max-w-md space-y-4 py-2">
              <p className="text-center text-xs leading-relaxed text-neutral-300">Maak je account aan. Je voorkeuren en persoonlijke filmoverzicht worden aan dit account gekoppeld.</p>
              <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                Gebruikersnaam
                <input
                  autoComplete="nickname"
                  required
                  value={displayName}
                  onChange={(event) => onDisplayNameChange(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#133650]/85 px-3 py-2.5 text-sm text-white outline-none transition focus:border-rose-300/60"
                />
              </label>
              <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                E-mailadres
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={accountEmail}
                  onChange={(event) => onAccountEmailChange(event.target.value)}
                  placeholder="jij@voorbeeld.nl"
                  className="w-full rounded-lg border border-white/10 bg-[#133650]/85 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                />
              </label>
              <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                Wachtwoord
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={accountPassword}
                  onChange={(event) => onAccountPasswordChange(event.target.value)}
                  placeholder="Minimaal 8 tekens"
                  className="w-full rounded-lg border border-white/10 bg-[#133650]/85 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                />
              </label>
              <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                Herhaal wachtwoord
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  placeholder="Herhaal je wachtwoord"
                  className="w-full rounded-lg border border-white/10 bg-[#133650]/85 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                />
              </label>
              {confirmPassword && !passwordsMatch && <p role="status" className="text-xs text-rose-200">Wachtwoorden komen niet overeen.</p>}
              <button
                type="submit"
                disabled={authLoading || !canCreateAccount}
                className="w-full rounded-lg bg-rose-500 py-3 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60"
              >
                {authLoading ? 'Account aanmaken…' : 'Account aanmaken'}
              </button>
              {!supabaseConfigured && <p className="text-center text-[10px] leading-relaxed text-amber-100/80">Supabase-configuratie ontbreekt nog. Vul de project-URL en publishable key in om accounts te activeren.</p>}
            </form>
          )}

          {registerStep === 2 && (
            <div className="space-y-4">
              <p className="text-center text-xs text-neutral-300">Vink aan welke diensten je thuis hebt. We verbergen films die daarbuiten vallen.</p>
              <div className="space-y-2 pt-2">
                {platforms.map((platform) => {
                  const active = chosenPlatforms.includes(platform.name);
                  return (
                    <button
                      type="button"
                      key={platform.name}
                      onClick={() => onTogglePlatform(platform.name)}
                      aria-pressed={active}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${active ? 'border-rose-500/40 bg-rose-500/[0.08] text-white' : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:border-white/10'}`}
                    >
                      <span className="flex items-center gap-3">
                        <StreamingLogo name={platform.name} logoPath={platform.logo_path} mark={platform.mark} color={platform.color} className="h-7 w-7" />
                        <span className="text-xs font-semibold">{platform.name}</span>
                      </span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${active ? 'bg-rose-600 text-white' : 'border border-white/10'}`} aria-hidden="true">
                        {active ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {registerStep === 3 && (
            <div className="space-y-4">
              <p className="text-center text-xs text-neutral-300">Selecteer minimaal 5 titels die je goed vindt om je startprofiel op jouw smaak af te stemmen.</p>
              <div className="grid max-h-[46vh] grid-cols-3 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-4">
                {favoriteFilms.map((film) => {
                  const isSelected = selectedFavorites.includes(film.id);
                  return (
                    <button
                      type="button"
                      key={film.id}
                      onClick={() => onToggleFavorite(film.id)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Verwijder' : 'Kies'} ${film.title} als favoriet`}
                      className={`group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-lg border transition select-none ${isSelected ? 'scale-[0.98] border-rose-500 ring-2 ring-rose-500/50' : 'border-white/[0.08] hover:border-white/20'}`}
                    >
                      <Image src={`https://image.tmdb.org/t/p/w500${film.poster_path}`} alt={film.title} fill unoptimized className="object-cover" />
                      <span className={`absolute inset-0 ${isSelected ? 'bg-rose-950/40' : 'bg-black/30'}`} />
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                        {isSelected ? '✓' : '+'}
                      </span>
                      <span className="absolute inset-x-1 bottom-1 text-center text-[10px] font-bold text-white drop-shadow">
                        <span className="block truncate">{film.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-xs font-semibold text-neutral-400">Gekozen: <span className="text-white">{selectedFavorites.length}</span> van minimaal 5</p>
            </div>
          )}

          {registerStep === 4 && (
            <div className="mx-auto max-w-md space-y-5 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xl font-bold text-emerald-400">✓</div>
              <div>
                <h3 className="text-lg font-bold text-white">Je voorkeuren zijn gekozen</h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-400">Je startprofiel bevat {chosenPlatforms.length} streamingdiensten en {selectedFavorites.length} favoriete films. Sla je profiel op om je dashboard klaar te zetten.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {Array.from(new Set(favoriteFilms.filter((film) => selectedFavorites.includes(film.id)).flatMap((film) => film.genres))).slice(0, 5).map((genre) => (
                    <span key={genre} className="rounded-full border border-rose-200/20 bg-rose-300/10 px-3 py-1 text-[10px] font-semibold text-rose-100">{genre}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {registerStep === 5 && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-3 text-center">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-sm font-black text-white shadow-lg shadow-rose-600/20">FM</div>
                <div className="text-left">
                  <p className="text-sm font-black text-white">FILMMATCH<span className="text-rose-500">.NL</span></p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Nederlandse streaminggids</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-300">Welkom, {displayName.trim() || 'filmliefhebber'}</p>
                <h3 className="mt-1 text-xl font-black text-white">Jouw dashboard staat klaar</h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">Je voorkeuren zijn opgeslagen. Je persoonlijke filmtips zijn afgestemd op {chosenPlatforms.length} streamingdiensten.</p>
              </div>
              <div className="grid w-full grid-cols-5 gap-2" aria-label="Jouw gekozen films">
                {welcomeMovies.map((film) => (
                  <div key={film.id} className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-neutral-800">
                    <Image src={`https://image.tmdb.org/t/p/w500${film.poster_path}`} alt={film.title} fill unoptimized className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
          {registerStep > 1 && registerStep < 5 ? (
            <button type="button" onClick={onPreviousStep} className="text-xs font-semibold text-neutral-400 hover:text-white">&larr; Vorige</button>
          ) : registerStep === 1 ? (
            <button type="button" onClick={onCancelRegistration} className="text-xs font-semibold text-neutral-400 hover:text-white">Annuleren</button>
          ) : <span />}

          {registerStep > 1 && registerStep < 4 ? (
            <button
              type="button"
              disabled={(registerStep === 2 && chosenPlatforms.length === 0) || (registerStep === 3 && selectedFavorites.length < 5)}
              onClick={onNextStep}
              className={`rounded-lg px-5 py-2 text-xs font-bold transition ${(registerStep === 2 && chosenPlatforms.length === 0) || (registerStep === 3 && selectedFavorites.length < 5) ? 'cursor-not-allowed bg-neutral-800 text-neutral-500' : 'bg-white text-black hover:bg-neutral-200'}`}
            >
              Verder &rarr;
            </button>
          ) : registerStep === 4 ? (
            <button type="button" disabled={authLoading} onClick={onCompleteOnboarding} className="rounded-lg bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60">
              {authLoading ? 'Profiel opslaan…' : 'Profiel opslaan'}
            </button>
          ) : registerStep === 5 ? (
            <button type="button" onClick={onOpenDashboard} className="rounded-lg bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500">
              Naar mijn dashboard &rarr;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}