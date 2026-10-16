'use client';

import type { FormEvent } from 'react';
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
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  registerStep >= s ? 'w-5 bg-rose-500' : 'w-2 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          {authError && <p role="alert" className="mb-5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
          {authNotice && <p role="status" className="mb-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{authNotice}</p>}

          {registerStep === 1 && (
            <form onSubmit={onSignUp} className="mx-auto max-w-md space-y-4 py-2">
              <p className="text-center text-xs leading-relaxed text-neutral-300">
                Maak je account aan. Je voorkeuren en persoonlijke filmoverzicht worden aan dit account gekoppeld.
              </p>
              <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                Gebruikersnaam
                <input
                  autoComplete="nickname"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
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
                  onChange={(e) => setAccountEmail(e.target.value)}
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
                  onChange={(e) => setAccountPassword(e.target.value)}
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Herhaal je wachtwoord"
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                />
              </label>
              {confirmPassword && !passwordsMatch && (
                <p role="status" className="text-xs text-rose-200">Wachtwoorden komen niet overeen.</p>
              )}
              <button
                type="submit"
                disabled={authLoading || !canCreateAccount}
                className="w-full rounded-lg bg-rose-500 py-3 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60"
              >
                {authLoading ? 'Account aanmaken…' : 'Account aanmaken'}
              </button>
              {!supabaseConfigured && (
                <p className="text-center text-[10px] leading-relaxed text-amber-100/80">
                  Supabase-configuratie ontbreekt nog. Vul de project-URL en publishable key in om accounts te activeren.
                </p>
              )}
            </form>
          )}

          {registerStep === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-300 text-center">
                Vink aan welke diensten je thuis hebt. We verbergen films die daarbuiten vallen.
              </p>

              <div className="space-y-2 pt-2">
                {platforms.map((p) => {
                  const active = chosenPlatforms.includes(p.name);
                  return (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => toggleRegisterPlatform(p.name)}
                      aria-pressed={active}
                      className={`w-full p-3 rounded-xl border transition flex items-center justify-between text-left ${
                        active
                          ? 'bg-rose-500/[0.08] border-rose-500/40 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <StreamingLogo name={p.name} logoPath={p.logo_path} mark={p.mark} color={p.color} className="h-7 w-7" />
                        <span className="font-semibold text-xs">{p.name}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          active ? 'bg-rose-600 text-white' : 'border border-white/10'
                        }`}
                      >
                        {active && '✓'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {registerStep === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-300 text-center">
                Selecteer minimaal 5 titels die je goed vindt om je startprofiel op jouw smaak af te stemmen.
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[46vh] overflow-y-auto pr-1">
                {onboardingFavorites.map((film) => {
                  const isSelected = selectedFavorites.includes(film.id);
                  return (
                    <button
                      type="button"
                      key={film.id}
                      onClick={() => toggleFavorite(film.id)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Verwijder' : 'Kies'} ${film.title} als favoriet`}
                      className={`group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border transition select-none ${
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
                      <div className={`absolute inset-0 ${isSelected ? 'bg-rose-950/40' : 'bg-black/30'}`} />
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

              <p className="text-center text-xs font-semibold text-neutral-400">
                Gekozen: <span className="text-white">{selectedFavorites.length}</span> van minimaal 5
              </p>
            </div>
          )}

          {registerStep === 4 && (
            <div className="text-center space-y-5 max-w-md mx-auto py-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Je voorkeuren zijn gekozen</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
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
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-sm font-black text-white shadow-lg shadow-rose-600/20">
                  FM
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-white">FILMMATCH<span className="text-rose-500">.NL</span></p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Nederlandse streaminggids</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-300">Welkom, {displayName.trim() || 'filmliefhebber'}</p>
                <h3 className="mt-1 text-xl font-black text-white">Jouw dashboard staat klaar</h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">
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

        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
          {registerStep > 1 && registerStep < 5 ? (
            <button
              onClick={() => setRegisterStep((registerStep - 1) as 1 | 2 | 3 | 4 | 5)}
              className="text-xs font-semibold text-neutral-400 hover:text-white"
            >
              &larr; Vorige
            </button>
          ) : registerStep === 1 ? (
            <button
              onClick={onCancel}
              className="text-xs font-semibold text-neutral-400 hover:text-white"
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
              className={`px-5 py-2 rounded-lg text-xs font-bold transition ${
                (registerStep === 2 && chosenPlatforms.length === 0) ||
                (registerStep === 3 && selectedFavorites.length < 5)
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              Verder &rarr;
            </button>
          ) : registerStep === 4 ? (
            <button
              disabled={authLoading}
              onClick={onCompleteOnboarding}
              className="px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30 disabled:cursor-wait disabled:opacity-60"
            >
              {authLoading ? 'Profiel opslaan…' : 'Profiel opslaan'}
            </button>
          ) : registerStep === 5 ? (
            <button
              onClick={onOpenDashboard}
              className="px-6 py-2.5 rounded-lg bg-rose-600 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500"
            >
              Naar mijn dashboard &rarr;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}