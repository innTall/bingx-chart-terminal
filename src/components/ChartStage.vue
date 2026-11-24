<script setup lang="ts">
import {
	CandlestickSeries,
	ColorType,
	createChart,
	CrosshairMode,
	type AutoscaleInfoProvider,
	type IChartApi,
	type ISeriesApi,
	type LogicalRange,
	type UTCTimestamp,
} from 'lightweight-charts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DrawingObject } from '../types/drawings';
import type { Candle } from '../types/market';
import { loadSavedBarSpacing, saveBarSpacing } from '../services/storage/terminalStorage';
import ChartDrawingsOverlay from './ChartDrawingsOverlay.vue';
import type { DrawingToolType } from './TopHeader.vue';

interface VisibleBounds {
	minLow: number;
	maxHigh: number;
}

const props = defineProps<{
	candles: Candle[];
	latestCandle?: Candle | null;
	loading: boolean;
	error: string | null;
	symbol: string;
	activeTool: DrawingToolType;
	magnetEnabled: boolean;
	drawings: readonly DrawingObject[];
}>();

const emit = defineEmits<{
	(e: 'update:drawings', items: DrawingObject[]): void;
	(e: 'clear-tool'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const hoveredCandle = ref<Candle | null>(null);
const chartRef = ref<IChartApi | null>(null);
const seriesRef = ref<ISeriesApi<'Candlestick'> | null>(null);

let chart: IChartApi | null = null;
let series: ISeriesApi<'Candlestick'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let visibleBounds: VisibleBounds | null = null;
let spacingSaveTimer: number | null = null;
let isInitialLoadDone = false;

function computeVisibleBounds(range: LogicalRange | null, list: Candle[]): VisibleBounds | null {
	if (!range || list.length === 0) return null;

	const startIdx = Math.max(0, Math.floor(range.from));
	const endIdx = Math.min(list.length - 1, Math.ceil(range.to));
	if (startIdx > endIdx) return null;

	let minLow = Number.POSITIVE_INFINITY;
	let maxHigh = Number.NEGATIVE_INFINITY;

	for (let i = startIdx; i <= endIdx; i += 1) {
		const c = list[i];
		if (!c) continue;
		if (c.low < minLow) minLow = c.low;
		if (c.high > maxHigh) maxHigh = c.high;
	}

	if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh)) return null;

	const span = maxHigh - minLow;
	const topPad = span > 0 ? span * 0.02 : Math.max(maxHigh * 0.005, 0.0001);
	const bottomPad = span > 0 ? span * 0.04 : Math.max(maxHigh * 0.01, 0.0001);

	return {
		minLow: minLow - bottomPad,
		maxHigh: maxHigh + topPad,
	};
}

function refreshBoundsOnly() {
	if (!chart) return;
	const range = chart.timeScale().getVisibleLogicalRange();
	visibleBounds = computeVisibleBounds(range, props.candles);
}

function scheduleBarSpacingSave() {
	if (!chart) return;
	const currentSpacing = chart.timeScale().options().barSpacing;
	if (typeof currentSpacing !== 'number' || !Number.isFinite(currentSpacing)) return;

	if (spacingSaveTimer !== null) {
		window.clearTimeout(spacingSaveTimer);
	}
	spacingSaveTimer = window.setTimeout(() => {
		saveBarSpacing(currentSpacing);
		spacingSaveTimer = null;
	}, 200);
}

const handleAutoscaleInfo: AutoscaleInfoProvider = (baseImpl) => {
	const base = baseImpl();
	if (!visibleBounds) return base;
	return {
		priceRange: {
			minValue: visibleBounds.minLow,
			maxValue: visibleBounds.maxHigh,
		},
		margins: base?.margins,
	};
};

function applyCandles(list: Candle[]) {
	if (!series || !chart) return;

	const formatted = list.map((c) => ({
		time: c.time as UTCTimestamp,
		open: c.open,
		high: c.high,
		low: c.low,
		close: c.close,
	}));

	series.setData(formatted);

	const savedSpacing = loadSavedBarSpacing();
	if (savedSpacing !== null) {
		chart.timeScale().applyOptions({ barSpacing: savedSpacing });
	}

	if (!isInitialLoadDone && formatted.length > 0) {
		isInitialLoadDone = true;
		refreshBoundsOnly();
	}
}

function formatPrice(val: number): string {
	return Number.isFinite(val) ? String(val) : '—';
}

onMounted(() => {
	if (!containerRef.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	const initialSpacing = loadSavedBarSpacing() ?? 6;

	chart = createChart(containerRef.value, {
		width: Math.max(rect.width, 300),
		height: Math.max(rect.height, 260),
		layout: {
			background: { type: ColorType.Solid, color: '#161616' },
			textColor: '#cbd5e1',
			fontSize: 10,
		},
		grid: {
			vertLines: { color: '#242424' },
			horzLines: { color: '#242424' },
		},
		crosshair: {
			mode: CrosshairMode.Normal,
		},
		rightPriceScale: {
			autoScale: true,
			borderColor: '#262626',
		},
		timeScale: {
			timeVisible: true,
			secondsVisible: false,
			rightOffset: 12,
			minBarSpacing: 1.5,
			barSpacing: initialSpacing,
			borderColor: '#262626',
		},
	});

	series = chart.addSeries(CandlestickSeries, {
		upColor: '#22c55e',
		downColor: '#ef4444',
		borderVisible: false,
		wickUpColor: '#22c55e',
		wickDownColor: '#ef4444',
		priceLineVisible: true,
		priceLineWidth: 1,
		priceLineColor: '#38bdf8',
		autoscaleInfoProvider: handleAutoscaleInfo,
	});

	chartRef.value = chart;
	seriesRef.value = series;

	applyCandles(props.candles);

	chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
		refreshBoundsOnly();
		scheduleBarSpacingSave();
	});

	chart.subscribeCrosshairMove((param) => {
		if (!param.time || !series) {
			hoveredCandle.value = null;
			return;
		}
		const bar = param.seriesData.get(series) as
			| { time?: UTCTimestamp; open?: number; high?: number; low?: number; close?: number }
			| undefined;

		if (
			bar &&
			bar.time !== undefined &&
			bar.open !== undefined &&
			bar.high !== undefined &&
			bar.low !== undefined &&
			bar.close !== undefined
		) {
			hoveredCandle.value = {
				time: bar.time,
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
			};
		} else {
			hoveredCandle.value = null;
		}
	});

	resizeObserver = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry || !chart) return;
		const width = Math.max(Math.floor(entry.contentRect.width), 200);
		const height = Math.max(Math.floor(entry.contentRect.height), 200);
		chart.resize(width, height);
		refreshBoundsOnly();
	});

	resizeObserver.observe(containerRef.value);
});

watch(
	() => props.candles,
	(nextCandles) => {
		isInitialLoadDone = false;
		applyCandles(nextCandles);
	},
	{ deep: false }
);

watch(
	() => props.latestCandle,
	(nextLatest) => {
		if (!series || !nextLatest) return;
		series.update({
			time: nextLatest.time as UTCTimestamp,
			open: nextLatest.open,
			high: nextLatest.high,
			low: nextLatest.low,
			close: nextLatest.close,
		});
		refreshBoundsOnly();
	},
	{ deep: false }
);

onBeforeUnmount(() => {
	if (spacingSaveTimer !== null) {
		window.clearTimeout(spacingSaveTimer);
		spacingSaveTimer = null;
	}
	resizeObserver?.disconnect();
	resizeObserver = null;
	chart?.remove();
	chart = null;
	series = null;
	chartRef.value = null;
	seriesRef.value = null;
});
</script>

<template>
	<div
		class="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-slate-800 bg-[#161616]">
		<div v-if="hoveredCandle"
			class="pointer-events-none absolute left-2.5 top-2 z-20 flex flex-wrap items-center gap-2 rounded bg-[#161616]/85 px-2 py-1 font-mono text-[11px] text-slate-300">
			<span>O <strong class="font-normal text-slate-100">{{ formatPrice(hoveredCandle.open) }}</strong></span>
			<span>H <strong class="font-normal text-emerald-400">{{ formatPrice(hoveredCandle.high) }}</strong></span>
			<span>L <strong class="font-normal text-rose-400">{{ formatPrice(hoveredCandle.low) }}</strong></span>
			<span>C <strong class="font-normal text-slate-100">{{ formatPrice(hoveredCandle.close) }}</strong></span>
		</div>

		<div v-if="error"
			class="absolute left-2.5 top-9 z-20 rounded border border-rose-800/70 bg-rose-950/90 px-3 py-1.5 text-xs text-rose-200">
			{{ error }}
		</div>

		<div v-else-if="loading && candles.length === 0"
			class="pointer-events-none absolute left-2.5 top-9 z-20 rounded border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300">
			Загрузка...
		</div>

		<div ref="containerRef" class="h-full min-h-0 w-full flex-1" />

		<ChartDrawingsOverlay :chart="chartRef" :series="seriesRef" :candles="candles" :symbol="symbol"
			:active-tool="activeTool" :magnet-enabled="magnetEnabled" :drawings="drawings"
			@update:drawings="emit('update:drawings', $event)" @clear-tool="emit('clear-tool')" />
	</div>
</template>