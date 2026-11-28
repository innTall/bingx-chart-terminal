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
	  };

export interface DrawingProjection {
	timeToX: (time: PriceTimePoint['time']) => number | null;
	priceToY: (price: number) => number | null;
	leftEdge?: number;
	rightEdge: number;
	projectedStartTime?: (item: DrawingObject) => PriceTimePoint['time'];
	segmentStartX?: (item: DrawingObject, startTime: PriceTimePoint['time']) => number | null;
	segmentEndX?: (item: DrawingObject, endTime: PriceTimePoint['time']) => number | null;
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
		if (shape.kind !== 'segment' && shape.kind !== 'ray') continue;
		const minX = Math.min(shape.x1, shape.x2) - edgeToleranceX;
		const maxX = Math.max(shape.x1, shape.x2) + edgeToleranceX;
		const dy = Math.abs(y - shape.y1);
		if (x >= minX && x <= maxX && dy <= lineToleranceY && dy < bestLineDist) {
			bestLineDist = dy;
			bestLineId = shape.item.id;
		}
	}

	if (bestLineId) return bestLineId;

	for (let i = shapes.length - 1; i >= 0; i -= 1) {
		const shape = shapes[i];
		if (!shape || shape.kind !== 'rectangle') continue;
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
