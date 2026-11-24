export type WatchlistMarkerColor = 'none' | 'emerald' | 'amber' | 'rose' | 'sky';

const BAR_SPACING_KEY = 'rm_chart:bar_spacing:v1';
const MARKERS_KEY = 'rm_chart:watchlist_markers:v1';

const VALID_MARKERS: ReadonlySet<string> = new Set([
  'none',
  'emerald',
  'amber',
  'rose',
  'sky',
]);

export function loadSavedBarSpacing(): number | null {
  try {
    const raw = window.localStorage.getItem(BAR_SPACING_KEY);
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch {
    return null;
  }
}

export function saveBarSpacing(spacing: number): void {
  if (!Number.isFinite(spacing) || spacing <= 0) return;
  try {
    window.localStorage.setItem(BAR_SPACING_KEY, String(spacing));
  } catch {
    // Игнорируем ошибки квоты/приватного режима
  }
}

export function loadWatchlistMarkers(): Record<string, WatchlistMarkerColor> {
  try {
    const raw = window.localStorage.getItem(MARKERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: Record<string, WatchlistMarkerColor> = {};
    for (const [symbol, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof symbol === 'string' && typeof val === 'string' && VALID_MARKERS.has(val)) {
        result[symbol.toUpperCase()] = val as WatchlistMarkerColor;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveWatchlistMarkers(markers: Record<string, WatchlistMarkerColor>): void {
  try {
    window.localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
  } catch {
    // Игнорируем ошибки хранилища
  }
}