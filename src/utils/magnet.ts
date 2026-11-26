import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../types/market';
import type { PriceTimePoint } from '../types/drawings';

// Настройки силы магнита (в пикселях): легко подстроить под свой глаз
export const MAGNET_CONFIG = {
	// Радиус притяжения по вертикали к High / Low / Close
	pixelRadius: 28,
	// Максимальное расстояние по горизонтали от центра свечи для захвата
	horizontalSnapPx: 22,
};

export interface MagnetOptions {
	enabled: boolean;
	candles: readonly Candle[];
	priceToY: (price: number) => number | null;
	yToPrice: (y: number) => number | null;
	timeToX: (time: UTCTimestamp) => number | null;
	xToTime: (x: number) => UTCTimestamp | null;
	pixelRadius?: number;
	horizontalSnapPx?: number;
}

function findNearestCandleByScreenX(
	candles: readonly Candle[],
	targetX: number,
	timeToX: (time: UTCTimestamp) => number | null
): { candle: Candle | null; dx: number } {
	let bestCandle: Candle | null = null;
	let bestDx = Number.POSITIVE_INFINITY;

	for (const c of candles) {
		const cx = timeToX(c.time as UTCTimestamp);
		if (cx === null) continue;
		const dx = Math.abs(cx - targetX);
		if (dx < bestDx) {
			bestDx = dx;
			bestCandle = c;
		}
	}

	return { candle: bestCandle, dx: bestDx };
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

	const maxDx = opts.horizontalSnapPx ?? MAGNET_CONFIG.horizontalSnapPx;
	const { candle, dx } = findNearestCandleByScreenX(opts.candles, pixelX, opts.timeToX);

	// Если рядом по горизонтали нет свечи — не цепляемся к далёким барам
	if (!candle || dx > maxDx) {
		return { time: baseTime, price: rawPrice };
	}

	const radius = opts.pixelRadius ?? MAGNET_CONFIG.pixelRadius;
	const candidates: number[] = [candle.high, candle.low, candle.close];

	let snappedPrice = rawPrice;
	let bestDy = Number.POSITIVE_INFINITY;

	for (const candidatePrice of candidates) {
		const py = opts.priceToY(candidatePrice);
		if (py === null) continue;
		const dy = Math.abs(py - pixelY);
		if (dy <= radius && dy < bestDy) {
			bestDy = dy;
			snappedPrice = candidatePrice;
		}
	}

	return {
		time: candle.time as UTCTimestamp,
		price: snappedPrice,
	};
}