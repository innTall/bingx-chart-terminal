import type { DrawingObject, PriceTimePoint } from '../types/drawings';

export type ProjectedDrawing =
	| {
			item: DrawingObject;
			kind: 'ray';
			x1: number;
			y1: number;
			x2: number;
			y2: number;
	  }
	| {
			item: DrawingObject;
			kind: 'rectangle';
			left: number;
			top: number;
			width: number;
			height: number;
			endX: number;
			endY: number;
	  }
	| {
			item: DrawingObject;
			kind: 'segment';
			x1: number;
			y1: number;
			x2: number;
			endX: number;
			price: number;
	  }
	| {
			item: DrawingObject;
			kind: 'fibo';
			left: number;
			right: number;
			yTop: number;
			yMid: number;
			yBottom: number;
			rayEnd: number;
	  }
	| {
			item: DrawingObject;
			kind: 'buy_sell';
			left: number;
			right: number;
			yEntry: number;
			yTarget: number;
			yStop: number;
			yTop: number;
			yBottom: number;
			entryPrice: number;
			targetPrice: number;
			stopPrice: number;
	  };

export interface DrawingProjection {
	timeToX: (time: PriceTimePoint['time']) => number | null;
	priceToY: (price: number) => number | null;
	leftEdge?: number;
	rightEdge: number;
	projectedStartTime?: (item: DrawingObject) => PriceTimePoint['time'];
	segmentStartX?: (item: DrawingObject, startTime: PriceTimePoint['time']) => number | null;
	segmentEndX?: (item: DrawingObject, endTime: PriceTimePoint['time']) => number | null;
	buySellStartX?: (item: DrawingObject, startTime: PriceTimePoint['time']) => number | null;
	buySellEndX?: (item: DrawingObject, endTime: PriceTimePoint['time']) => number | null;
}

export function projectDrawings(
	drawings: readonly DrawingObject[],
	{
		timeToX,
		priceToY,
		leftEdge = 0,
		rightEdge,
		projectedStartTime,
		segmentStartX,
		segmentEndX,
		buySellStartX,
		buySellEndX,
	}: DrawingProjection
): ProjectedDrawing[] {
	const result: ProjectedDrawing[] = [];

	for (const item of drawings) {
		const y1 = priceToY(item.start.price);
		const startTime = projectedStartTime?.(item) ?? item.start.time;
		const x1 = timeToX(startTime);
		if (y1 === null) continue;

		if (item.kind === 'ray') {
			const rayStartX = x1 ?? 0;
			result.push({
				item,
				kind: 'ray',
				x1: rayStartX,
				y1,
				x2: Math.max(rayStartX, rightEdge),
				y2: y1,
			});
			continue;
		}

		const endPoint = item.end ?? item.start;

		if (item.kind === 'buy_sell') {
			if (
				!endPoint ||
				item.targetPrice === undefined ||
				item.stopPrice === undefined
			) {
				continue;
			}
			const startX = buySellStartX?.(item, item.start.time) ?? x1;
			const endX = buySellEndX?.(item, endPoint.time) ?? timeToX(endPoint.time);
			const yEntry = priceToY(item.start.price);
			const yTarget = priceToY(item.targetPrice);
			const yStop = priceToY(item.stopPrice);
			if (startX === null || endX === null || yEntry === null || yTarget === null || yStop === null) {
				continue;
			}
			const left = Math.max(leftEdge, Math.min(rightEdge, Math.min(startX, endX)));
			const right = Math.max(leftEdge, Math.min(rightEdge, Math.max(startX, endX)));
			result.push({
				item,
				kind: 'buy_sell',
				left,
				right,
				yEntry,
				yTarget,
				yStop,
				yTop: Math.min(yEntry, yTarget, yStop),
				yBottom: Math.max(yEntry, yTarget, yStop),
				entryPrice: item.start.price,
				targetPrice: item.targetPrice,
				stopPrice: item.stopPrice,
			});
			continue;
		}

		if (item.kind === 'fibo') {
			if (x1 === null) continue;
			const x2 = timeToX(endPoint.time);
			if (x2 === null) continue;
			const minX = Math.min(x1, x2);
			const maxX = Math.max(x1, x2);
			if (maxX < leftEdge || minX > rightEdge) continue;
			const topPrice = Math.max(item.start.price, endPoint.price);
			const bottomPrice = Math.min(item.start.price, endPoint.price);
			const yTop = priceToY(topPrice);
			const yBottom = priceToY(bottomPrice);
			const yMid = priceToY((topPrice + bottomPrice) / 2);
			if (yTop === null || yBottom === null || yMid === null) continue;
			result.push({
				item,
				kind: 'fibo',
				left: Math.max(leftEdge, Math.min(rightEdge, minX)),
				right: Math.max(leftEdge, Math.min(rightEdge, maxX)),
				yTop,
				yMid,
				yBottom,
				rayEnd: rightEdge,
			});
			continue;
		}

		if (item.kind === 'segment') {
			const startX = segmentStartX
				? segmentStartX(item, startTime)
				: x1;
			const endX = segmentEndX
				? segmentEndX(item, endPoint.time)
				: timeToX(endPoint.time);
			if (startX === null || endX === null) continue;
			const segmentRightEdge = Math.max(leftEdge, rightEdge - 5);
			const clampedStartX = Math.min(segmentRightEdge, Math.max(leftEdge, startX));
			const clampedEndX = Math.min(segmentRightEdge, Math.max(leftEdge, endX));
			result.push({
				item,
				kind: 'segment',
				x1: clampedStartX,
				y1,
				x2: clampedEndX,
				endX: clampedEndX,
				price: item.start.price,
			});
			continue;
		}

		if (x1 === null) continue;
		const x2 = timeToX(endPoint.time);
		if (x2 === null) continue;
		const y2 = priceToY(endPoint.price);
		if (y2 === null) continue;
		result.push({
			item,
			kind: 'rectangle',
			left: Math.min(x1, x2),
			top: Math.min(y1, y2),
			width: Math.max(2, Math.abs(x2 - x1)),
			height: Math.max(2, Math.abs(y2 - y1)),
			endX: x2,
			endY: y2,
		});
	}

	return result;
}

export function findFocusedDrawingId(
	shapes: readonly ProjectedDrawing[],
	x: number,
	y: number
): string | null {
	const lineToleranceY = 6;
	const edgeToleranceX = 4;
	let bestLineId: string | null = null;
	let bestLineDist = Number.POSITIVE_INFINITY;

	for (const shape of shapes) {
		if (
			shape.kind !== 'segment' &&
			shape.kind !== 'ray' &&
			shape.kind !== 'fibo' &&
			shape.kind !== 'buy_sell'
		) {
			continue;
		}
		const x1 = shape.kind === 'fibo' || shape.kind === 'buy_sell' ? shape.left : shape.x1;
		const x2 = shape.kind === 'fibo' ? shape.rayEnd : shape.kind === 'buy_sell' ? shape.right : shape.x2;
		const lineY = shape.kind === 'fibo' ? shape.yMid : shape.kind === 'buy_sell' ? shape.yEntry : shape.y1;
		const minX = Math.min(x1, x2) - edgeToleranceX;
		const maxX = Math.max(x1, x2) + edgeToleranceX;
		const dy = Math.abs(y - lineY);
		if (x >= minX && x <= maxX && dy <= lineToleranceY && dy < bestLineDist) {
			bestLineDist = dy;
			bestLineId = shape.item.id;
		}
	}

	if (bestLineId) return bestLineId;

	for (let i = shapes.length - 1; i >= 0; i -= 1) {
		const shape = shapes[i];
		if (!shape) continue;
		if (shape.kind === 'buy_sell') {
			if (
				x >= shape.left - edgeToleranceX &&
				x <= shape.right + edgeToleranceX &&
				y >= shape.yTop - edgeToleranceX &&
				y <= shape.yBottom + edgeToleranceX
			) {
				return shape.item.id;
			}
			continue;
		}
		if (shape.kind === 'fibo') {
			if (
				x >= shape.left - edgeToleranceX &&
				x <= shape.right + edgeToleranceX &&
				y >= Math.min(shape.yTop, shape.yBottom) - edgeToleranceX &&
				y <= Math.max(shape.yTop, shape.yBottom) + edgeToleranceX
			) {
				return shape.item.id;
			}
			continue;
		}
		if (shape.kind !== 'rectangle') continue;
		if (
			x >= shape.left - edgeToleranceX &&
			x <= shape.left + shape.width + edgeToleranceX &&
			y >= shape.top - edgeToleranceX &&
			y <= shape.top + shape.height + edgeToleranceX
		) {
			return shape.item.id;
		}
	}

	return null;
}
