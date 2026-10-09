'use client';

import type { FormEvent } from 'react';
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
  const welcomeMovies = favoriteFilms.filter((film) => selectedFavorites.includes(film.id)).slice(0, 5);

  if (mode === 'login') {
    return (
      <div className="dashboard-shell relative min-h-screen overflow-x-hidden text-neutral-100 selection:bg-rose-500 selection:text-white">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 opacity-45 blur-[1px]">
          <div className="grid h-full grid-cols-4 grid-rows-5 gap-0 sm:hidden">
            {favoriteFilms.slice(0, 20).map((film) => (
              <div key={film.id} className="relative overflow-hidden bg-[#101a1d]">
                <Image src={`https://image.tmdb.org/t/p/w342${film.poster_path}`} alt="" fill unoptimized sizes="25vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="hidden h-full grid-cols-5 grid-rows-4 gap-0 sm:grid lg:hidden">
            {favoriteFilms.slice(0, 20).map((film) => (
              <div key={film.id} className="relative overflow-hidden bg-[#101a1d]">
                <Image src={`https://image.tmdb.org/t/p/w342${film.poster_path}`} alt="" fill unoptimized sizes="20vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="hidden h-full grid-cols-6 grid-rows-3 gap-0 lg:grid">
            {favoriteFilms.slice(0, 18).map((film) => (
              <div key={film.id} className="relative overflow-hidden bg-[#101a1d]">
                <Image src={`https://image.tmdb.org/t/p/w342${film.poster_path}`} alt="" fill unoptimized sizes="17vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-[#071014]/55" />
        </div>

        <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-6 px-5 py-10 sm:px-8">
          <section className="mx-auto w-full max-w-xl rounded-xl border border-white/10 bg-[#0d1e23]/90 p-8 shadow-2xl backdrop-blur-md sm:p-10">
            <div className="mb-8 flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-400 to-amber-300 text-4xl text-slate-950 shadow-lg shadow-rose-950/30" aria-hidden="true">🍿</span>
              <div>
                <h1 className="text-3xl font-black tracking-wide text-white sm:text-4xl">FILM<span className="text-rose-400">MATCH</span>NL</h1>
                <p className="mt-1 text-sm font-medium text-neutral-200">Jouw volgende filmavond begint hier</p>
              </div>
            </div>

            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">Fijn dat je er weer bent</p>
              <h2 className="mt-2 text-4xl font-black text-white">Welkom terug</h2>
              <p className="mt-2 text-base leading-relaxed text-neutral-200">Log in om verder te gaan met films die bij jou passen.</p>
            </div>

            {authError && <p role="alert" className="mb-4 rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2.5 text-sm text-rose-100">{authError}</p>}
            {authNotice && <p role="status" className="mb-4 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2.5 text-sm text-emerald-100">{authNotice}</p>}

            <form onSubmit={onSignIn} className="space-y-5">
              <label className="block space-y-2 text-sm font-semibold text-neutral-100">
                E-mailadres
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={loginEmail}
                  onChange={(event) => onLoginEmailChange(event.target.value)}
                  placeholder="jij@voorbeeld.nl"
                  className="w-full rounded-lg border border-white/15 bg-[#14282d]/90 px-4 py-3.5 text-base text-white outline-none transition placeholder:text-neutral-400 focus:border-rose-300/70 focus:ring-2 focus:ring-rose-300/10"
                />
              </label>
              <label className="block space-y-2 text-sm font-semibold text-neutral-100">
                Wachtwoord
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(event) => onLoginPasswordChange(event.target.value)}
                  placeholder="Je wachtwoord"
                  className="w-full rounded-lg border border-white/15 bg-[#14282d]/90 px-4 py-3.5 text-base text-white outline-none transition placeholder:text-neutral-400 focus:border-rose-300/70 focus:ring-2 focus:ring-rose-300/10"
                />
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-lg bg-rose-400 py-3.5 text-base font-bold text-[#271017] transition hover:bg-rose-300 disabled:cursor-wait disabled:opacity-60"
                >
                  {authLoading ? 'Bezig met inloggen…' : 'Inloggen'}
                </button>
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="w-full rounded-lg border border-white/20 bg-white/[0.06] py-3.5 text-base font-semibold text-white transition hover:bg-white/[0.12]"
                >
                  Account aanmaken
                </button>
              </div>
            </form>

            {!supabaseConfigured && <p className="mt-4 text-center text-[10px] leading-relaxed text-amber-100/90">Supabase is nog niet geconfigureerd. Voeg de project-URL en publishable key toe.</p>}
          </section>

          <aside className="mx-auto w-full max-w-xl opacity-70">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2" role="group" aria-label="Streamingdiensten">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-400">Jouw diensten:</span>
              {platforms.map((platform) => (
                <StreamingLogo
                  key={platform.id}
                  name={platform.name}
                  logoPath={platform.logo_path}
                  mark={platform.mark}
                  color={platform.color}
                  className="h-5 w-5"
                />
              ))}
            </div>
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-neutral-100 flex items-center justify-center p-4 relative">
      <div className="w-full max-w-xl bg-neutral-900/90 border border-white/[0.08] rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl flex flex-col max-h-[90vh]">
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
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-rose-300/60"
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
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
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
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
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
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
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