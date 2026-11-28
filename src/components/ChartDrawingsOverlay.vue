<script setup lang="ts">
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DrawingToolType } from './TopHeader.vue';
import { TIMEFRAME_SECONDS, type Timeframe } from '../config/watchlist';
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
import {
	MAGNET_CONFIG,
	resolveMagnetState,
	type MagnetSnapTarget,
} from '../utils/magnet';
import {
	coordinateToTime,
	coordinateToPrice,
	priceToCoordinate,
	toChartTimestamp,
	timeToCoordinate,
} from '../utils/chartCoordinates';
import {
	findFocusedDrawingId,
	projectDrawings,
	type ProjectedDrawing,
} from '../utils/drawingGeometry';
import { updateDrawingForDrag, type DragMode } from '../utils/drawingDrag';

const props = defineProps<{
	chart: IChartApi | null;
	series: ISeriesApi<'Candlestick'> | null;
	candles: readonly Candle[];
	symbol: string;
	timeframe: Timeframe;
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
	props.candles.length > MAGNET_CONFIG.recentCandleLimit
		? props.candles.slice(-MAGNET_CONFIG.recentCandleLimit)
		: props.candles
);

const selectedDrawing = computed(
	() =>
		props.drawings.find((drawing) => drawing.id === selectedId.value && canEditDrawing(drawing)) ??
		null
);

function canEditDrawing(drawing: DrawingObject): boolean {
	if (!drawing.sourceTimeframe) return true;
	return TIMEFRAME_SECONDS[props.timeframe] >= TIMEFRAME_SECONDS[drawing.sourceTimeframe];
}

function findMatchingLtfWickTime(drawing: DrawingObject): UTCTimestamp | null {
	const sourceTimeframe = drawing.sourceTimeframe;
	if (
		!sourceTimeframe ||
		TIMEFRAME_SECONDS[props.timeframe] >= TIMEFRAME_SECONDS[sourceTimeframe] ||
		(drawing.kind !== 'segment' && drawing.kind !== 'ray')
	) {
		return null;
	}

	const startTime = Number(drawing.start.time);
	const firstLoadedTime = props.candles[0]?.time;
	const startPrecedesLoadedCandles =
		drawing.kind === 'segment' &&
		firstLoadedTime !== undefined &&
		startTime < firstLoadedTime;
	const windowEnd = startPrecedesLoadedCandles
		? Number.POSITIVE_INFINITY
		: startTime + TIMEFRAME_SECONDS[sourceTimeframe];
	const priceTolerance = Math.max(
		Number.EPSILON * Math.max(1, Math.abs(drawing.start.price)) * 16,
		Math.abs(drawing.start.price) * 1e-10,
		1e-12
	);
	let matchingTime: number | null = null;
	const searchStartTime =
		startPrecedesLoadedCandles && firstLoadedTime !== undefined
			? firstLoadedTime
			: startTime;

	for (const candle of props.candles) {
		if (candle.time < searchStartTime || candle.time >= windowEnd) continue;
		if (
			Math.abs(candle.high - drawing.start.price) <= priceTolerance ||
			Math.abs(candle.low - drawing.start.price) <= priceTolerance
		) {
			if (matchingTime === null || candle.time < matchingTime) {
				matchingTime = candle.time;
			}
		}
	}

	return matchingTime === null ? null : (matchingTime as UTCTimestamp);
}

function getSegmentStartX(
	drawing: DrawingObject,
	startTime: UTCTimestamp
): number | null {
	const x = timeToX(startTime);
	if (x !== null) return x;

	const firstLoadedTime = props.candles[0]?.time;
	if (
		drawing.kind === 'segment' &&
		drawing.sourceTimeframe &&
		TIMEFRAME_SECONDS[props.timeframe] < TIMEFRAME_SECONDS[drawing.sourceTimeframe] &&
		firstLoadedTime !== undefined &&
		Number(startTime) < firstLoadedTime
	) {
		return 0;
	}

	return null;
}

function getSegmentEndX(
	_drawing: DrawingObject,
	endTime: UTCTimestamp
): number | null {
	const firstLoadedTime = props.candles[0]?.time;
	if (firstLoadedTime !== undefined && Number(endTime) < firstLoadedTime) return 0;

	const lastCandle = props.candles[props.candles.length - 1];
	const maxEndTime = lastCandle
		? lastCandle.time + TIMEFRAME_SECONDS[props.timeframe] * 5
		: Number(endTime);
	return timeToX(Math.min(Number(endTime), maxEndTime) as UTCTimestamp);
}

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
	return priceToCoordinate(props.series, price);
}

function yToPrice(y: number): number | null {
	return coordinateToPrice(props.series, y);
}

function timeToX(time: UTCTimestamp): number | null {
	const lastCandle = props.candles[props.candles.length - 1];
	if (lastCandle && Number(time) > lastCandle.time) {
		const barsAfterLast =
			(Number(time) - lastCandle.time) / TIMEFRAME_SECONDS[props.timeframe];
		if (barsAfterLast > 5) return null;
		const x = timeToCoordinate(props.chart, Number(time));
		if (x !== null) return x;
		const lastX = timeToCoordinate(props.chart, lastCandle.time);
		const barSpacing = props.chart?.timeScale().options().barSpacing;
		if (lastX === null || typeof barSpacing !== 'number') return null;
		return lastX + barsAfterLast * barSpacing;
	}

	const x = timeToCoordinate(props.chart, Number(time));
	if (x !== null) return x;
	if (!lastCandle) return null;

	// Historical timestamps outside the loaded data remain unprojected here.
	return null;
}

function xToTime(x: number): UTCTimestamp | null {
	return coordinateToTime(props.chart, x);
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
	const isSegmentInteraction =
		props.activeTool === 'segment' ||
		dragState.type === 'draft-segment' ||
		dragState.type === 'resize-segment-end' ||
		dragState.type === 'move-segment';
	const lastCandle = props.candles[props.candles.length - 1];
	if (isSegmentInteraction && lastCandle) {
		const lastX = timeToCoordinate(props.chart, lastCandle.time);
		const barSpacing = props.chart?.timeScale().options().barSpacing;
		if (lastX !== null && coords.x > lastX && typeof barSpacing === 'number' && barSpacing > 0) {
			const barsAfterLast = Math.min(5, (coords.x - lastX) / barSpacing);
			return {
				time: (lastCandle.time + barsAfterLast * TIMEFRAME_SECONDS[props.timeframe]) as UTCTimestamp,
				price: rawPrice,
			};
		}
	}
	if (rawTime !== null) {
		return { time: rawTime, price: rawPrice };
	}

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
			sourceTimeframe: props.timeframe,
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
			sourceTimeframe: props.timeframe,
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
			sourceTimeframe: props.timeframe,
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
	if (props.activeTool !== 'none') return;
	event.stopPropagation();
	if (focusedId.value && focusedId.value !== item.id) {
		const candidate = props.drawings.find((d) => d.id === focusedId.value);
		if (candidate && (candidate.kind === 'segment' || candidate.kind === 'ray')) {
			targetItem = candidate;
		}
	}
	if (!canEditDrawing(targetItem)) return;

	selectedId.value = targetItem.id;
	focusedId.value = null;
	// При захвате всей фигуры якорь берётся без магнита, чтобы не было прыжков в зоне свечей
	const point = pickPoint(event, false);
	if (!point) return;

	if (targetItem.kind === 'ray') {
		dragState = {
			type: 'move-ray',
			id: targetItem.id,
			offsetTime: Number(targetItem.start.time) - Number(point.time),
			offsetPrice: targetItem.start.price - point.price,
		};
	} else if (targetItem.kind === 'rectangle' && targetItem.end) {
		dragState = {
			type: 'move-rect',
			id: targetItem.id,
			anchor: point,
			origStart: { ...targetItem.start },
			origEnd: { ...targetItem.end },
		};
	} else if (targetItem.kind === 'segment') {
		const endPt = targetItem.end ?? targetItem.start;
		dragState = {
			type: 'move-segment',
			id: targetItem.id,
			anchor: point,
			origStart: { ...targetItem.start },
			origEnd: { ...endPt },
		};
	}

	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
}

function handleRectRightEdgePointerDown(event: PointerEvent, item: DrawingObject) {
	if (event.button !== 0) return;
	if (props.activeTool !== 'none') return;
	event.stopPropagation();
	if (!canEditDrawing(item)) return;
	selectedId.value = item.id;
	dragState = { type: 'resize-rect-end', id: item.id };
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
}

function handleSegmentRightPointerDown(event: PointerEvent, item: DrawingObject) {
	if (event.button !== 0) return;
	if (props.activeTool !== 'none') return;
	event.stopPropagation();
	if (!canEditDrawing(item)) return;
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
			focusedId.value = coords
				? findFocusedDrawingId(computedShapes.value, coords.x, coords.y)
				: null;
		}
		syncChartCrosshair(event);
		return;
	}

	if (dragState.type === 'draft-rect') {
		const point = pickPoint(event, true);
		if (!point) return;
		applyDragUpdate(point);
		return;
	}

	if (dragState.type === 'draft-segment') {
		// Сегмент строго горизонтальный и правый край не цепляется
		clearMagnetTarget();
		const point = pickPoint(event, false);
		if (!point) return;
		applyDragUpdate(point);
		return;
	}

	if (dragState.type === 'resize-rect-end') {
		const point = pickPoint(event, true);
		if (!point) return;
		applyDragUpdate(point);
		return;
	}

	if (dragState.type === 'resize-segment-end') {
		// Правый край сегмента тянется свободно без магнита, сохраняя горизонтальность
		clearMagnetTarget();
		const point = pickPoint(event, false);
		if (!point) return;
		applyDragUpdate(point);
		return;
	}

	if (dragState.type === 'move-ray') {
		const point = pickPoint(event, true);
		if (!point) return;
		applyDragUpdate(point);
		return;
	}

	if (dragState.type === 'move-rect') {
		const point = pickPoint(event, false);
		if (!point) return;
		applyDragUpdate(point);
		return;
	}

	if (dragState.type === 'move-segment') {
		const point = pickPoint(event, true);
		if (!point) return;
		applyDragUpdate(point, magnetTarget.value?.price);
		return;
	}
}

function applyDragUpdate(point: PriceTimePoint, snappedPrice?: number) {
	const mode = dragState;
	const lastCandle = props.candles[props.candles.length - 1];
	const maxSegmentTime = lastCandle
		? lastCandle.time + TIMEFRAME_SECONDS[props.timeframe] * 5
		: undefined;
	commitDrawings(
		props.drawings.map(
			(drawing) =>
				updateDrawingForDrag(drawing, mode, point, snappedPrice, maxSegmentTime) ?? drawing
		)
	);
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

	const shiftedTime = toChartTimestamp(Number(rawTime));
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
	const drawing = props.drawings.find((item) => item.id === id);
	if (!drawing || !canEditDrawing(drawing)) return;
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
	const drawing = props.drawings.find((item) => item.id === id);
	if (!drawing || !canEditDrawing(drawing)) return;
	selectedId.value = null;
	commitDrawings(props.drawings.filter((d) => d.id !== id));
}

function clearSelection() {
	selectedId.value = null;
}

defineExpose({
	clearSelection,
});

const computedShapes = computed<ProjectedDrawing[]>(() => {
	void renderTick.value;
	void props.candles.length;

	const fullWidth = overlayRef.value?.clientWidth ?? 800;
	const paneWidth = props.chart?.timeScale().width() ?? fullWidth;
	const currentSeconds = TIMEFRAME_SECONDS[props.timeframe];
	const visibleDrawings = props.drawings.filter((drawing) => {
		if (!drawing.sourceTimeframe) return true;
		return currentSeconds <= TIMEFRAME_SECONDS[drawing.sourceTimeframe];
	});
	return projectDrawings(visibleDrawings, {
		timeToX,
		priceToY,
		leftEdge: 0,
		rightEdge: Math.max(0, paneWidth),
		projectedStartTime: (drawing) =>
			findMatchingLtfWickTime(drawing) ?? drawing.start.time,
		segmentStartX: getSegmentStartX,
		segmentEndX: getSegmentEndX,
	});
});

watch(
	() => [props.chart, props.series, props.symbol, props.timeframe],
	() => {
		selectedId.value = null;
		focusedId.value = null;
		dragState = { type: 'none' };
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

watch(
	() => props.activeTool,
	(tool) => {
		if (tool !== 'none') {
			focusedId.value = null;
			clearMagnetTarget();
		}
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
			@pointerdown="handleOverlayPointerDown" @pointermove="handlePointerMove" @pointerup="handlePointerUp"
			@pointercancel="handlePointerUp" @pointerleave="clearChartCrosshair">
			<g v-for="shape in computedShapes" :key="shape.item.id" class="pointer-events-auto cursor-move">
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