import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../types/market';
import type { PriceTimePoint } from '../types/drawings';

export interface MagnetOptions {
  enabled: boolean;
  candles: readonly Candle[];
  priceToY: (price: number) => number | null;
  yToPrice: (y: number) => number | null;
  timeToX: (time: UTCTimestamp) => number | null;
  xToTime: (x: number) => UTCTimestamp | null;
  pixelRadius?: number;
}

function findNearestCandle(
  candles: readonly Candle[],
  targetTime: UTCTimestamp,
  targetX: number,
  timeToX: (time: UTCTimestamp) => number | null
): Candle | null {
  if (candles.length === 0) return null;

  let best: Candle | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const c of candles) {
    const cx = timeToX(c.time as UTCTimestamp);
    if (cx !== null) {
      const dx = Math.abs(cx - targetX);
      if (dx < bestDist) {
        bestDist = dx;
        best = c;
      }
    } else {
      const dt = Math.abs(Number(c.time) - Number(targetTime));
      if (dt < bestDist) {
        bestDist = dt;
        best = c;
      }
    }
  }

  return best;
}

export function resolvePointWithMagnet(
  pixelX: number,
  pixelY: number,
  opts: MagnetOptions
): PriceTimePoint | null {
  const baseTime = opts.xToTime(pixelX);
  const rawPrice = opts.yToPrice(pixelY);

  if (baseTime === null || rawPrice === null || !Number.isFinite(rawPrice)) {
    return null;
  }

  if (!opts.enabled || opts.candles.length === 0) {
    return { time: baseTime, price: rawPrice };
  }

  const candle = findNearestCandle(opts.candles, baseTime, pixelX, opts.timeToX);
  if (!candle) {
    return { time: baseTime, price: rawPrice };
  }

  const radius = opts.pixelRadius ?? 14;
  const candidates: number[] = [candle.high, candle.low, candle.close];

  let snappedPrice = rawPrice;
  let bestPyDist = Number.POSITIVE_INFINITY;

  for (const candidatePrice of candidates) {
    const py = opts.priceToY(candidatePrice);
    if (py === null) continue;
    const dy = Math.abs(py - pixelY);
    if (dy <= radius && dy < bestPyDist) {
      bestPyDist = dy;
      snappedPrice = candidatePrice;
    }
  }

  return {
    time: candle.time as UTCTimestamp,
    price: snappedPrice,
  };
}