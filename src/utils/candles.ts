import type { Candle, RawBingxCandle } from '../types/market.ts';

const MAX_CANDLES = 500;

export function normalizeTimestampSec(rawTime: number | string): number | null {
  const num = Number(rawTime);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
}

export function toCandle(raw: RawBingxCandle): Candle | null {
  const time = normalizeTimestampSec(raw.time);
  const open = Number(raw.open);
  const high = Number(raw.high);
  const low = Number(raw.low);
  const close = Number(raw.close);

  if (
    time === null ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return null;
  }

  return { time, open, high, low, close };
}

export function normalizeAndDedupeCandles(rawList: RawBingxCandle[]): Candle[] {
  const byTime = new Map<number, Candle>();

  for (const item of rawList) {
    const candle = toCandle(item);
    if (!candle) continue;
    byTime.set(candle.time, candle);
  }

  return Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-MAX_CANDLES);
}