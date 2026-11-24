import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../../types/market';

export interface TickerPrice {
  symbol: string;
  price: number;
  updatedAt: number;
}

function toUnixSeconds(rawTime: unknown): UTCTimestamp | null {
  const num = typeof rawTime === 'number' ? rawTime : Number(rawTime);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  // Если значение похоже на миллисекунды (13+ цифр), переводим в секунды
  const seconds = num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
  return seconds as UTCTimestamp;
}

function toPositiveNumber(rawValue: unknown): number | null {
  const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseSingleKline(item: unknown): Candle | null {
  if (Array.isArray(item)) {
    // Частый формат: [time, open, high, low, close, volume, ...]
    const time = toUnixSeconds(item[0]);
    const open = toPositiveNumber(item[1]);
    const high = toPositiveNumber(item[2]);
    const low = toPositiveNumber(item[3]);
    const close = toPositiveNumber(item[4]);

    if (time === null || open === null || high === null || low === null || close === null) {
      return null;
    }
    return { time, open, high, low, close };
  }

  if (item && typeof item === 'object') {
    const row = item as Record<string, unknown>;
    const time = toUnixSeconds(row.time ?? row.t ?? row.timestamp);
    const open = toPositiveNumber(row.open ?? row.o);
    const high = toPositiveNumber(row.high ?? row.h);
    const low = toPositiveNumber(row.low ?? row.l);
    const close = toPositiveNumber(row.close ?? row.c);

    if (time === null || open === null || high === null || low === null || close === null) {
      return null;
    }
    return { time, open, high, low, close };
  }

  return null;
}

export function normalizeKlines(rawData: unknown, limit: number): Candle[] {
  const list = Array.isArray(rawData)
    ? rawData
    : rawData && typeof rawData === 'object' && 'klines' in rawData && Array.isArray((rawData as { klines: unknown[] }).klines)
      ? (rawData as { klines: unknown[] }).klines
      : [];

  const byTime = new Map<number, Candle>();

  for (const rawItem of list) {
    const candle = parseSingleKline(rawItem);
    if (candle) {
      // Дедупликация по time: более поздняя запись с тем же time перезаписывает предыдущую
      byTime.set(candle.time, candle);
    }
  }

  const sorted = Array.from(byTime.values()).sort((a, b) => Number(a.time) - Number(b.time));
  return sorted.slice(-limit);
}

export function parseTickerList(
  rawData: unknown,
  allowedSymbols?: Set<string>
): TickerPrice[] {
  const list = Array.isArray(rawData)
    ? rawData
    : rawData && typeof rawData === 'object' && 'list' in rawData && Array.isArray((rawData as { list: unknown[] }).list)
      ? (rawData as { list: unknown[] }).list
      : [];

  const now = Date.now();
  const result: TickerPrice[] = [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const rawSymbol = row.symbol ?? row.s;
    if (typeof rawSymbol !== 'string' || !rawSymbol) continue;

    const symbol = rawSymbol.toUpperCase();
    if (allowedSymbols && allowedSymbols.size > 0 && !allowedSymbols.has(symbol)) {
      continue;
    }

    const price = toPositiveNumber(
      row.lastPrice ?? row.price ?? row.c ?? row.markPrice
    );
    if (price === null) continue;

    result.push({ symbol, price, updatedAt: now });
  }

  return result;
}