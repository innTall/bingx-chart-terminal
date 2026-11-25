import type { UTCTimestamp } from 'lightweight-charts';
import { BINGX_CONFIG, type Timeframe } from '../../config/watchlist';
import type { Candle } from '../../types/market';
import { bingxGet } from './http';

export interface FetchKlinesParams {
  symbol: string;
  interval: Timeframe;
  limit?: number;
  signal?: AbortSignal;
}

// BingX v3 klines ожидает интервалы в нижнем регистре (например, '1d' вместо '1D')
function toBingxInterval(interval: Timeframe): string {
  const normalized = interval.trim();
  if (normalized === '1M') return '1M';
  return normalized.toLowerCase();
}

function toUnixSeconds(rawTime: unknown): UTCTimestamp | null {
  const num = typeof rawTime === 'number' ? rawTime : Number(rawTime);
  if (!Number.isFinite(num) || num <= 0) return null;
  const seconds = num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
  return seconds as UTCTimestamp;
}

function toPositiveNumber(rawValue: unknown): number | null {
  const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeV3Klines(rawData: unknown, limit: number): Candle[] {
  const list = Array.isArray(rawData) ? rawData : [];
  const byTime = new Map<number, Candle>();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;

    const time = toUnixSeconds(row.time);
    const open = toPositiveNumber(row.open);
    const high = toPositiveNumber(row.high);
    const low = toPositiveNumber(row.low);
    const close = toPositiveNumber(row.close);

    if (time === null || open === null || high === null || low === null || close === null) {
      continue;
    }

    byTime.set(time, { time, open, high, low, close });
  }

  return Array.from(byTime.values())
    .sort((a, b) => Number(a.time) - Number(b.time))
    .slice(-limit);
}

export async function fetchBingxKlines({
  symbol,
  interval,
  limit = BINGX_CONFIG.klinesLimit,
  signal,
}: FetchKlinesParams): Promise<Candle[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);

  const rawData = await bingxGet<unknown>(
    '/openApi/swap/v3/quote/klines',
    {
      symbol: symbol.trim().toUpperCase(),
      interval: toBingxInterval(interval),
      limit: safeLimit,
    },
    signal
  );

  return normalizeV3Klines(rawData, safeLimit);
}