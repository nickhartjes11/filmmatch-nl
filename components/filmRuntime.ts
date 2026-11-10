// Standard theatrical runtimes for the curated monthly tips, used only
// when the movie metadata does not include a usable runtime.
const MONTHLY_RUNTIME_MINUTES: Record<number, number> = {
  671: 152,
  299534: 181,
  438631: 155,
  693134: 167,
  771: 103,
};

export function formatFilmRuntime(runtime: unknown, movieId: number): string | null {
  let minutes: number | undefined;
  if (typeof runtime === 'number' && Number.isFinite(runtime) && runtime > 0) {
    minutes = runtime;
  } else if (typeof runtime === 'string') {
    const value = runtime.trim();
    const plain = value.match(/^(\d+)\s*(?:m|min|mins|minuten|minutes)?$/i);
    const hours = value.match(/^(\d+)\s*(?:h|u|uur)\s*(?:(\d+)\s*(?:m|min|minuten)?)?$/i);
    if (plain) minutes = Number(plain[1]);
    else if (hours) minutes = Number(hours[1]) * 60 + Number(hours[2] || 0);
  }
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
    minutes = MONTHLY_RUNTIME_MINUTES[movieId];
  }
  return minutes ? `${Math.round(minutes)} min` : null;
}
