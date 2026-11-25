import type { DrawingKind, DrawingPreset } from '../../types/drawings';

const PRESETS_STORAGE_KEY = 'rm_chart:drawing_presets:v2';
const VALID_KINDS: ReadonlySet<string> = new Set(['segment', 'ray', 'rectangle']);

export function formatDefaultPresetName(kind: DrawingKind, timeframe: string): string {
  const kindMap: Record<DrawingKind, string> = {
    segment: 'Seg',
    ray: 'Ray',
    rectangle: 'Rect',
  };
  return `${kindMap[kind]} ${timeframe}`;
}

export function loadDrawingPresets(): DrawingPreset[] {
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const result: DrawingPreset[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      if (
        typeof row.id === 'string' &&
        typeof row.name === 'string' &&
        typeof row.kind === 'string' &&
        VALID_KINDS.has(row.kind) &&
        typeof row.color === 'string' &&
        typeof row.lineWidth === 'number' &&
        Number.isFinite(row.lineWidth) &&
        row.lineWidth > 0
      ) {
        result.push({
          id: row.id,
          name: row.name,
          kind: row.kind as DrawingKind,
          color: row.color,
          lineWidth: row.lineWidth,
          label: typeof row.label === 'string' ? row.label : row.name,
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

export function saveDrawingPresets(presets: readonly DrawingPreset[]): void {
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Игнорируем ошибки хранилища
  }
}

export function deleteDrawingPreset(
  presets: readonly DrawingPreset[],
  presetId: string
): DrawingPreset[] {
  const next = presets.filter((p) => p.id !== presetId);
  saveDrawingPresets(next);
  return next;
}