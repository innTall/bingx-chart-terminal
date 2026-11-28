import type { UTCTimestamp } from 'lightweight-charts';
import type { DrawingObject, PriceTimePoint } from '../types/drawings';

export type DragMode =
	| { type: 'none' }
	| { type: 'draft-rect'; id: string; start: PriceTimePoint }
	| { type: 'draft-segment'; id: string; start: PriceTimePoint }
	| { type: 'move-ray'; id: string; offsetTime: number; offsetPrice: number }
	| {
			type: 'move-rect';
			id: string;
			anchor: PriceTimePoint;
			origStart: PriceTimePoint;
			origEnd: PriceTimePoint;
	  }
	| {
			type: 'move-segment';
			id: string;
			anchor: PriceTimePoint;
			origStart: PriceTimePoint;
			origEnd: PriceTimePoint;
	  }
	| { type: 'resize-rect-end'; id: string }
	| { type: 'resize-segment-end'; id: string };

function boundedTime(time: number): UTCTimestamp {
	return Math.max(1, Math.floor(time)) as UTCTimestamp;
}

export function updateDrawingForDrag(
	drawing: DrawingObject,
	mode: DragMode,
	point: PriceTimePoint,
	snappedPrice?: number,
	maxSegmentTime?: number
): DrawingObject | null {
	if (mode.type === 'none') return null;
	if (drawing.id !== mode.id) return null;

	switch (mode.type) {
		case 'draft-rect':
			return { ...drawing, end: point };
		case 'draft-segment':
			return {
				...drawing,
				end: {
					time: (maxSegmentTime === undefined
						? Number(point.time)
						: Math.min(Number(point.time), maxSegmentTime)) as UTCTimestamp,
					price: mode.start.price,
				},
			};
		case 'resize-rect-end':
			if (!drawing.end) return null;
			return {
				...drawing,
				end: { time: point.time, price: drawing.end.price },
			};
		case 'resize-segment-end':
			return {
				...drawing,
				end: {
					time: (maxSegmentTime === undefined
						? Number(point.time)
						: Math.min(Number(point.time), maxSegmentTime)) as UTCTimestamp,
					price: drawing.start.price,
				},
			};
		case 'move-ray':
			return {
				...drawing,
				start: {
					time: boundedTime(Number(point.time) + mode.offsetTime),
					price: point.price + mode.offsetPrice,
				},
			};
		case 'move-rect': {
			const dt = Number(point.time) - Number(mode.anchor.time);
			const dp = point.price - mode.anchor.price;
			return {
				...drawing,
				start: {
					time: boundedTime(Number(mode.origStart.time) + dt),
					price: mode.origStart.price + dp,
				},
				end: {
					time: boundedTime(Number(mode.origEnd.time) + dt),
					price: mode.origEnd.price + dp,
				},
			};
		}
		case 'move-segment': {
			const dt = Number(point.time) - Number(mode.anchor.time);
			const spanSec = Math.max(
				0,
				Number(mode.origEnd.time) - Number(mode.origStart.time)
			);
			const maxStartTime =
				maxSegmentTime === undefined ? Number.POSITIVE_INFINITY : maxSegmentTime - spanSec;
			const startTime = Math.min(
				boundedTime(Number(mode.origStart.time) + dt),
				maxStartTime
			) as UTCTimestamp;
			const nextPrice = snappedPrice ?? mode.origStart.price + point.price - mode.anchor.price;
			return {
				...drawing,
				start: { time: startTime, price: nextPrice },
				end: {
					time: (Number(startTime) + spanSec) as UTCTimestamp,
					price: nextPrice,
				},
			};
		}
	}
}
