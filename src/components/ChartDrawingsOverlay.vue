<script setup lang="ts">
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DrawingToolType } from './TopHeader.vue';
import SegmentDrawing from './drawings/SegmentDrawing.vue';
import RayDrawing from './drawings/RayDrawing.vue';
import RectangleDrawing from './drawings/RectangleDrawing.vue';
import DrawingStyleToolbar from './drawings/DrawingStyleToolbar.vue';
import {
	DEFAULT_DRAWING_STYLE,
	type DrawingKind,
	type DrawingObject,
	type DrawingPreset,
	type PriceTimePoint,
} from '../types/drawings';
import type { Candle } from '../types/market';
import { resolveMagnetState, type MagnetSnapTarget } from '../utils/magnet';

type DragMode =
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

type ComputedShape =
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

const UTC_PLUS_2_OFFSET_SEC = 2 * 60 * 60;
// Для магнита смотрим только свежую часть графика (последние 100 свечей)
const RECENT_CANDLES_LIMIT = 100;

const props = defineProps<{
	chart: IChartApi | null;
	series: ISeriesApi<'Candlestick'> | null;
	candles: readonly Candle[];
	symbol: string;
	activeTool: DrawingToolType;
	magnetEnabled: boolean;
	drawings: readonly DrawingObject[];
	activePreset?: DrawingPreset | null;
}>();

const emit = defineEmits<{
	(e: 'update:drawings', items: DrawingObject[]): void;
	(e: 'clear-tool'): void;
	(e: 'save-preset', drawing: DrawingObject): void;
}>();

const overlayRef = ref<SVGSVGElement | null>(null);
const selectedId = ref<string | null>(null);
const renderTick = ref<number>(0);
const magnetTarget = ref<MagnetSnapTarget | null>(null);
const focusedId = ref<string | null>(null);

let dragState: DragMode = { type: 'none' };
let rafId: number | null = null;

const recentCandles = computed(() =>
	props.candles.length > RECENT_CANDLES_LIMIT
		? props.candles.slice(-RECENT_CANDLES_LIMIT)
		: props.candles
);

const selectedDrawing = computed(
	() => props.drawings.find((d) => d.id === selectedId.value) ?? null
);

function clearMagnetTarget() {
	if (magnetTarget.value !== null) {
		magnetTarget.value = null;
	}
}

function bumpRender() {
	if (rafId !== null) return;
	rafId = window.requestAnimationFrame(() => {
		rafId = null;
		renderTick.value += 1;
	});
}

function priceToY(price: number): number | null {
	if (!props.series) return null;
	const y = props.series.priceToCoordinate(price);
	return y !== null && Number.isFinite(y) ? y : null;
}

function yToPrice(y: number): number | null {
	if (!props.series) return null;
	const p = props.series.coordinateToPrice(y);
	return p !== null && Number.isFinite(p) ? p : null;
}

function timeToX(time: UTCTimestamp): number | null {
	if (!props.chart) return null;
	const shiftedTime = (Number(time) + UTC_PLUS_2_OFFSET_SEC) as UTCTimestamp;
	const x = props.chart.timeScale().timeToCoordinate(shiftedTime);
	return x !== null && Number.isFinite(x) ? x : null;
}

function xToTime(x: number): UTCTimestamp | null {
	if (!props.chart) return null;
	const t = props.chart.timeScale().coordinateToTime(x);
	if (t === null) return null;
	return Math.max(0, Number(t) - UTC_PLUS_2_OFFSET_SEC) as UTCTimestamp;
}

function getLocalCoords(event: PointerEvent): { x: number; y: number } | null {
	const el = overlayRef.value;
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}

function pickRawPoint(event: PointerEvent): PriceTimePoint | null {
	const coords = getLocalCoords(event);
	if (!coords) return null;

	const rawPrice = yToPrice(coords.y);
	if (rawPrice === null || !Number.isFinite(rawPrice)) return null;

	const rawTime = xToTime(coords.x);
	if (rawTime !== null) {
		return { time: rawTime, price: rawPrice };
	}

	const lastCandle = props.candles[props.candles.length - 1];
	if (lastCandle) {
		return { time: lastCandle.time as UTCTimestamp, price: rawPrice };
	}

	return null;
}

function pickPoint(event: PointerEvent, useMagnet: boolean): PriceTimePoint | null {
	if (!useMagnet || !props.magnetEnabled) {
		clearMagnetTarget();
		return pickRawPoint(event);
	}

	const coords = getLocalCoords(event);
	if (!coords) return null;

	const resolved = resolveMagnetState(coords.x, coords.y, {
		enabled: props.magnetEnabled,
		candles: recentCandles.value,
		priceToY,
		yToPrice,
		timeToX,
		xToTime,
	});

	if (resolved) {
		magnetTarget.value = resolved.snapped ? resolved.target : null;
		return resolved.point;
	}

	clearMagnetTarget();
	return pickRawPoint(event);
}

function buildInitialStyle(kind: DrawingKind): DrawingObject['style'] {
	if (props.activePreset && props.activePreset.kind === kind) {
		return {
			color: props.activePreset.color,
			lineWidth: props.activePreset.lineWidth,
			label: props.activePreset.label,
		};
	}
	return { ...DEFAULT_DRAWING_STYLE };
}

function commitDrawings(next: DrawingObject[]) {
	emit('update:drawings', next);
	bumpRender();
}

function handleOverlayPointerDown(event: PointerEvent) {
	if (event.button !== 0) return;
	if (props.activeTool === 'none') return;

	const point = pickPoint(event, true);
	if (!point) return;

	if (props.activeTool === 'ray') {
		if (props.drawings.length >= 20) return;
		const id = `ray_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const nextItem: DrawingObject = {
			id,
			symbol: props.symbol,
			kind: 'ray',
			start: point,
			style: buildInitialStyle('ray'),
		};
		selectedId.value = id;
		clearMagnetTarget();
		commitDrawings([...props.drawings, nextItem]);
		emit('clear-tool');
		return;
	}

	if (props.activeTool === 'rectangle') {
		if (props.drawings.length >= 20) return;
		const id = `rect_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const nextItem: DrawingObject = {
			id,
			symbol: props.symbol,
			kind: 'rectangle',
			start: point,
			end: point,
			style: buildInitialStyle('rectangle'),
		};
		selectedId.value = id;
		commitDrawings([...props.drawings, nextItem]);
		dragState = { type: 'draft-rect', id, start: point };
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		return;
	}

	if (props.activeTool === 'segment') {
		if (props.drawings.length >= 20) return;
		const id = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const nextItem: DrawingObject = {
			id,
			symbol: props.symbol,
			kind: 'segment',
			start: point,
			end: { time: point.time, price: point.price },
			style: buildInitialStyle('segment'),
		};
		selectedId.value = id;
		commitDrawings([...props.drawings, nextItem]);
		dragState = { type: 'draft-segment', id, start: point };
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
	}
}

function handleShapePointerDown(event: PointerEvent, item: DrawingObject) {
	let targetItem = item;
	if (event.button !== 0) return;
	if (props.activeTool === 'none' && focusedId.value && focusedId.value !== item.id) {
		const candidate = props.drawings.find((d) => d.id === focusedId.value);
		if (candidate && (candidate.kind === 'segment' || candidate.kind === 'ray')) {
			targetItem = candidate;
		}
	}

	selectedId.value = targetItem.id;
	focusedId.value = null;
	// При захвате всей фигуры якорь берётся без магнита, чтобы не было прыжков в зоне свечей
	const point = pickPoint(event, false);
	if (!point) return;

	if (item.kind === 'ray') {
		dragState = {
			type: 'move-ray',
			id: item.id,
			offsetTime: Number(item.start.time) - Number(point.time),
			offsetPrice: item.start.price - point.price,
		};
	} else if (item.kind === 'rectangle' && item.end) {
		dragState = {
			type: 'move-rect',
			id: item.id,
			anchor: point,
			origStart: { ...item.start },
			origEnd: { ...item.end },
		};
	} else if (item.kind === 'segment') {
		const endPt = item.end ?? item.start;
		dragState = {
			type: 'move-segment',
			id: item.id,
			anchor: point,
			origStart: { ...item.start },
			origEnd: { ...endPt },
		};
	}

	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
}

function handleRectRightEdgePointerDown(event: PointerEvent, item: DrawingObject) {
	if (event.button !== 0) return;
	event.stopPropagation();
	selectedId.value = item.id;
	dragState = { type: 'resize-rect-end', id: item.id };
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
}

function handleSegmentRightPointerDown(event: PointerEvent, item: DrawingObject) {
	if (event.button !== 0) return;
	event.stopPropagation();
	selectedId.value = item.id;
	dragState = { type: 'resize-segment-end', id: item.id };
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
	if (dragState.type === 'none') {
		if (props.activeTool !== 'none') {
			focusedId.value = null;
			pickPoint(event, true);
		} else {
			clearMagnetTarget();
			const coords = getLocalCoords(event);
			focusedId.value = coords ? findFocusedShapeId(coords.x, coords.y) : null;
		}
		syncChartCrosshair(event);
		return;
	}

	if (dragState.type === 'draft-rect') {
		const point = pickPoint(event, true);
		if (!point) return;
		const draftId = dragState.id;
		commitDrawings(
			props.drawings.map((d) => (d.id === draftId ? { ...d, end: point } : d))
		);
		return;
	}

	if (dragState.type === 'draft-segment') {
		// Сегмент строго горизонтальный и правый край не цепляется
		clearMagnetTarget();
		const point = pickPoint(event, false);
		if (!point) return;
		const draftId = dragState.id;
		commitDrawings(
			props.drawings.map((d) => {
				if (d.id !== draftId) return d;
				return {
					...d,
					end: {
						time: point.time,
						price: d.start.price,
					},
				};
			})
		);
		return;
	}

	if (dragState.type === 'resize-rect-end') {
		const point = pickPoint(event, true);
		if (!point) return;
		const targetId = dragState.id;
		commitDrawings(
			props.drawings.map((d) => {
				if (d.id !== targetId || !d.end) return d;
				return {
					...d,
					end: {
						time: point.time,
						price: d.end.price,
					},
				};
			})
		);
		return;
	}

	if (dragState.type === 'resize-segment-end') {
		// Правый край сегмента тянется свободно без магнита, сохраняя горизонтальность
		clearMagnetTarget();
		const point = pickPoint(event, false);
		if (!point) return;
		const targetId = dragState.id;
		commitDrawings(
			props.drawings.map((d) => {
				if (d.id !== targetId) return d;
				return {
					...d,
					end: {
						time: point.time,
						price: d.start.price,
					},
				};
			})
		);
		return;
	}

	// Перемещение всей фигуры целиком — без магнита на точке захвата
	clearMagnetTarget();
	const point = pickPoint(event, false);
	if (!point) return;

	if (dragState.type === 'move-ray') {
		const point = pickPoint(event, true);
		if (!point) return;
		const targetId = dragState.id;
		const nextTime = Math.max(
			1,
			Math.floor(Number(point.time) + dragState.offsetTime)
		) as UTCTimestamp;
		const nextPrice = point.price + dragState.offsetPrice;
		commitDrawings(
			props.drawings.map((d) =>
				d.id === targetId ? { ...d, start: { time: nextTime, price: nextPrice } } : d
			)
		);
		return;
	}

	if (dragState.type === 'move-rect') {
		const moveState = dragState;
		const dt = Number(point.time) - Number(moveState.anchor.time);
		const dp = point.price - moveState.anchor.price;

		commitDrawings(
			props.drawings.map((d) => {
				if (d.id !== moveState.id) return d;
				return {
					...d,
					start: {
						time: Math.max(
							1,
							Math.floor(Number(moveState.origStart.time) + dt)
						) as UTCTimestamp,
						price: moveState.origStart.price + dp,
					},
					end: {
						time: Math.max(
							1,
							Math.floor(Number(moveState.origEnd.time) + dt)
						) as UTCTimestamp,
						price: moveState.origEnd.price + dp,
					},
				};
			})
		);
		return;
	}

	if (dragState.type === 'move-segment') {
		const point = pickPoint(event, true);
		if (!point) return;
		const moveState = dragState;
		const dt = Number(point.time) - Number(moveState.anchor.time);
		const dp = point.price - moveState.anchor.price;
		const spanSec = Math.max(0, Number(moveState.origEnd.time) - Number(moveState.origStart.time));
		const nextStartTime = Math.max(
			1,
			Math.floor(Number(moveState.origStart.time) + dt)
		) as UTCTimestamp;
		const nextEndTime = (Number(nextStartTime) + spanSec) as UTCTimestamp;
		const nextPrice =
			magnetTarget.value !== null ? magnetTarget.value.price : moveState.origStart.price + dp;

		commitDrawings(
			props.drawings.map((d) => {
				if (d.id !== moveState.id) return d;
				return {
					...d,
					start: { time: nextStartTime, price: nextPrice },
					end: { time: nextEndTime, price: nextPrice },
				};
			})
		);
		return;
	}
}

function findFocusedShapeId(x: number, y: number): string | null {
	const lineToleranceY = 6;
	const edgeToleranceX = 4;

	let bestLineId: string | null = null;
	let bestLineDist = Number.POSITIVE_INFINITY;

	for (const shape of computedShapes.value) {
		if (shape.kind === 'segment' || shape.kind === 'ray') {
			const minX = Math.min(shape.x1, shape.x2) - edgeToleranceX;
			const maxX = Math.max(shape.x1, shape.x2) + edgeToleranceX;
			const dy = Math.abs(y - shape.y1);
			if (x >= minX && x <= maxX && dy <= lineToleranceY && dy < bestLineDist) {
				bestLineDist = dy;
				bestLineId = shape.item.id;
			}
		}
	}

	if (bestLineId) return bestLineId;

	for (let i = computedShapes.value.length - 1; i >= 0; i -= 1) {
		const shape = computedShapes.value[i];
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

function handlePointerUp() {
	if (dragState.type === 'draft-rect' || dragState.type === 'draft-segment') {
		emit('clear-tool');
	}
	dragState = { type: 'none' };
	clearMagnetTarget();
}

function syncChartCrosshair(event: PointerEvent) {
	if (!props.chart || !props.series) return;
	if (dragState.type !== 'none' || props.activeTool !== 'none') return;

	const coords = getLocalCoords(event);
	if (!coords) return;

	const rawTime = xToTime(coords.x);
	const rawPrice = yToPrice(coords.y);
	if (rawTime === null || rawPrice === null || !Number.isFinite(rawPrice)) return;

	const shiftedTime = (Number(rawTime) + UTC_PLUS_2_OFFSET_SEC) as UTCTimestamp;
	props.chart.setCrosshairPosition(rawPrice, shiftedTime, props.series);
}

function clearChartCrosshair() {
	clearMagnetTarget();
	focusedId.value = null;
	if (dragState.type === 'none') {
		props.chart?.clearCrosshairPosition();
	}
}

function updateSelectedStyle(patch: Partial<DrawingObject['style']>) {
	if (!selectedId.value) return;
	const id = selectedId.value;
	commitDrawings(
		props.drawings.map((d) =>
			d.id === id ? { ...d, style: { ...d.style, ...patch } } : d
		)
	);
}

function saveSelectedAsPreset() {
	if (!selectedDrawing.value) return;
	emit('save-preset', selectedDrawing.value);
}

function deleteSelected() {
	if (!selectedId.value) return;
	const id = selectedId.value;
	selectedId.value = null;
	commitDrawings(props.drawings.filter((d) => d.id !== id));
}

function clearSelection() {
	selectedId.value = null;
}

defineExpose({
	clearSelection,
});

const computedShapes = computed<ComputedShape[]>(() => {
	void renderTick.value;
	void props.candles.length;

	const fullWidth = overlayRef.value?.clientWidth ?? 800;
	const paneWidth = props.chart?.timeScale().width() ?? fullWidth;
	const rightEdge = Math.max(0, paneWidth);

	const result: ComputedShape[] = [];

	for (const item of props.drawings) {
		const y1 = priceToY(item.start.price);
		const x1 = timeToX(item.start.time);
		if (y1 === null || x1 === null) continue;

		if (item.kind === 'ray') {
			result.push({
				item,
				kind: 'ray',
				x1,
				y1,
				x2: Math.max(x1, rightEdge),
				y2: y1,
			});
			continue;
		}

		if (item.kind === 'segment') {
			const endPoint = item.end ?? item.start;
			const x2 = timeToX(endPoint.time);
			if (x2 === null) continue;
			result.push({
				item,
				kind: 'segment',
				x1,
				y1,
				x2,
				endX: x2,
				price: item.start.price,
			});
			continue;
		}

		const endPoint = item.end ?? item.start;
		const x2 = timeToX(endPoint.time);
		const y2 = priceToY(endPoint.price);
		if (x2 === null || y2 === null) continue;

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
});

watch(
	() => [props.chart, props.series, props.symbol],
	() => {
		selectedId.value = null;
		clearMagnetTarget();
		bumpRender();
	}
);

watch(
	() => props.magnetEnabled,
	(enabled) => {
		if (!enabled) clearMagnetTarget();
	}
);

onMounted(() => {
	const onRangeOrSize = () => bumpRender();
	props.chart?.timeScale().subscribeVisibleLogicalRangeChange(onRangeOrSize);
	window.addEventListener('resize', onRangeOrSize);

	const pollSync = window.setInterval(onRangeOrSize, 120);
	onBeforeUnmount(() => {
		window.clearInterval(pollSync);
		window.removeEventListener('resize', onRangeOrSize);
	});
});

onBeforeUnmount(() => {
	if (rafId !== null) {
		window.cancelAnimationFrame(rafId);
		rafId = null;
	}
});
</script>

<template>
	<div class="pointer-events-none absolute inset-0 z-10">
		<!-- Компактная панель свойств выбранного элемента -->
		<DrawingStyleToolbar v-if="selectedDrawing" :drawing="selectedDrawing" @update-style="updateSelectedStyle"
			@save-preset="saveSelectedAsPreset" @delete="deleteSelected" />
		<!-- SVG-слой для Луча, Отрезка и Прямоугольника -->
		<svg ref="overlayRef" class="h-full w-full"
			:class="activeTool !== 'none' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'"
			@pointerdown="handleOverlayPointerDown" @pointermove="handlePointerMove" @pointerup="handlePointerUp" @pointerleave="clearChartCrosshair">
			<g v-for="shape in computedShapes" :key="shape.item.id" class="pointer-events-auto cursor-move"
				@pointerdown="handleShapePointerDown($event, shape.item)">
				<RayDrawing v-if="shape.kind === 'ray'" :item="shape.item" :x1="shape.x1" :y1="shape.y1" :x2="shape.x2"
					:y2="shape.y2" @shape-pointer-down="handleShapePointerDown" :focused="focusedId === shape.item.id"/>

				<SegmentDrawing v-else-if="shape.kind === 'segment'" :item="shape.item" :x1="shape.x1" :y1="shape.y1"
					:x2="shape.x2" :end-x="shape.endX" :selected="selectedId === shape.item.id"
					@shape-pointer-down="handleShapePointerDown" @right-handle-pointer-down="handleSegmentRightPointerDown" :focused="focusedId === shape.item.id"/>

				<RectangleDrawing v-else :item="shape.item" :left="shape.left" :top="shape.top" :width="shape.width"
					:height="shape.height" :selected="selectedId === shape.item.id" @shape-pointer-down="handleShapePointerDown"
					@right-handle-pointer-down="handleRectRightEdgePointerDown" />
			</g>

			<!-- Индикатор магнитной привязки к H / L / C при наведении или протягивании конца -->
			<g v-if="magnetTarget" class="pointer-events-none">
				<circle :cx="magnetTarget.x" :cy="magnetTarget.y" r="7" fill="rgba(245, 158, 11, 0.16)"
					stroke="#fbbf24" stroke-width="1.5" />
				<circle :cx="magnetTarget.x" :cy="magnetTarget.y" r="2.2" fill="#fde68a" />
			</g>
		</svg>
	</div>
</template>