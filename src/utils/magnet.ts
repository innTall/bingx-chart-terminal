import type { UTCTimestamp } from 'lightweight-charts';
import type { PriceTimePoint } from '../types/drawings';
import type { Candle } from '../types/market';

export type MagnetAnchorKind = 'high' | 'low' | 'close';

export interface MagnetSnapTarget {
	x: number;
	y: number;
	price: number;
	kind: MagnetAnchorKind;
}

export interface MagnetResolveResult {
	point: PriceTimePoint;
	snapped: boolean;
	target: MagnetSnapTarget | null;
}

// Настройки силы магнита (в пикселях): легко подстроить под свой глаз
export const MAGNET_CONFIG = {
	// Only the latest candles are considered by the drawing overlay.
	recentCandleLimit: 100,
	// Радиус притяжения по вертикали к High / Low / Close
	pixelRadius: 18,
	// Максимальное расстояние по горизонтали от центра свечи для захвата
	horizontalSnapPx: 14,
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
): { candle: Candle | null; x: number | null; dx: number } {
	let bestCandle: Candle | null = null;
	let bestX: number | null = null;
	let bestDx = Number.POSITIVE_INFINITY;

	for (const c of candles) {
		const cx = timeToX(c.time as UTCTimestamp);
		if (cx === null || !Number.isFinite(cx)) continue;
		const dx = Math.abs(cx - targetX);
		if (dx < bestDx) {
			bestDx = dx;
			bestCandle = c;
			bestX = cx;
		}
	}

	return { candle: bestCandle, x: bestX, dx: bestDx };
}

export function resolveMagnetState(
	pixelX: number,
	pixelY: number,
	opts: MagnetOptions
): MagnetResolveResult | null {
	if (!Number.isFinite(pixelX) || !Number.isFinite(pixelY)) return null;

	const baseTime = opts.xToTime(pixelX);
	const rawPrice = opts.yToPrice(pixelY);

	if (
		baseTime === null ||
		rawPrice === null ||
		!Number.isFinite(Number(baseTime)) ||
		!Number.isFinite(rawPrice)
	) {
		return null;
	}

	const fallbackPoint: PriceTimePoint = { time: baseTime, price: rawPrice };

	if (!opts.enabled || opts.candles.length === 0) {
		return { point: fallbackPoint, snapped: false, target: null };
	}

	const maxDx = opts.horizontalSnapPx ?? MAGNET_CONFIG.horizontalSnapPx;
	if (!Number.isFinite(maxDx) || maxDx < 0) {
		return { point: fallbackPoint, snapped: false, target: null };
	}
	const { candle, x: candleX, dx } = findNearestCandleByScreenX(
		opts.candles,
		pixelX,
		opts.timeToX
	);

	// Если рядом по горизонтали нет свечи — не цепляемся к далёким барам
	if (!candle || candleX === null || dx > maxDx) {
		return { point: fallbackPoint, snapped: false, target: null };
	}

	const radius = opts.pixelRadius ?? MAGNET_CONFIG.pixelRadius;
	if (!Number.isFinite(radius) || radius < 0) {
		return { point: fallbackPoint, snapped: false, target: null };
	}
	const candidates: ReadonlyArray<{ kind: MagnetAnchorKind; price: number }> = [
		{ kind: 'high', price: candle.high },
		{ kind: 'low', price: candle.low },
		{ kind: 'close', price: candle.close },
	];

	let bestTarget: MagnetSnapTarget | null = null;
	let bestDy = Number.POSITIVE_INFINITY;

	for (const candidate of candidates) {
		const py = opts.priceToY(candidate.price);
		if (py === null || !Number.isFinite(py)) continue;
		const dy = Math.abs(py - pixelY);
		if (dy <= radius && dy < bestDy) {
			bestDy = dy;
			bestTarget = {
				x: candleX,
				y: py,
				price: candidate.price,
				kind: candidate.kind,
			};
		}
	}

	if (!bestTarget) {
		return { point: fallbackPoint, snapped: false, target: null };
	}

	return {
		point: {
			time: candle.time as UTCTimestamp,
			price: bestTarget.price,
		},
		snapped: true,
		target: bestTarget,
	};
}

export function resolvePointWithMagnet(
	pixelX: number,
	pixelY: number,
	opts: MagnetOptions
): PriceTimePoint | null {
	const resolved = resolveMagnetState(pixelX, pixelY, opts);
	return resolved ? resolved.point : null;
}