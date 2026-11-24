<script setup lang="ts">
import {
	CandlestickSeries,
	ColorType,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type UTCTimestamp,
} from 'lightweight-charts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Candle } from '../types/market';

const props = defineProps<{
	candles: Candle[];
	latestCandle?: Candle | null;
	loading: boolean;
	error: string | null;
	symbolLabel: string;
	timeframe: string;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

let chart: IChartApi | null = null;
let series: ISeriesApi<'Candlestick'> | null = null;
let resizeObserver: ResizeObserver | null = null;

function applyCandles(list: Candle[]) {
	if (!series) return;
	const formatted = list.map((c) => ({
		time: c.time as UTCTimestamp,
		open: c.open,
		high: c.high,
		low: c.low,
		close: c.close,
	}));
	series.setData(formatted);
	if (formatted.length > 0) {
		chart?.timeScale().fitContent();
	}
}

onMounted(() => {
	if (!containerRef.value) return;

	const rect = containerRef.value.getBoundingClientRect();
	chart = createChart(containerRef.value, {
		width: Math.max(rect.width, 300),
		height: Math.max(rect.height, 260),
		layout: {
			background: { type: ColorType.Solid, color: '#0f172a' },
			textColor: '#cbd5e1',
		},
		grid: {
			vertLines: { color: '#1e293b' },
			horzLines: { color: '#1e293b' },
		},
		timeScale: {
			timeVisible: true,
			secondsVisible: false,
		},
	});

	series = chart.addSeries(CandlestickSeries, {
		upColor: '#22c55e',
		downColor: '#ef4444',
		borderVisible: false,
		wickUpColor: '#22c55e',
		wickDownColor: '#ef4444',
	});

	applyCandles(props.candles);

	resizeObserver = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry || !chart) return;
		const width = Math.max(Math.floor(entry.contentRect.width), 200);
		const height = Math.max(Math.floor(entry.contentRect.height), 200);
		chart.resize(width, height);
	});

	resizeObserver.observe(containerRef.value);
});

watch(
	() => props.candles,
	(nextCandles) => {
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
	},
	{ deep: false }
);

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
	chart?.remove();
	chart = null;
	series = null;
});
</script>

<template>
	<div class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-slate-800 bg-slate-950">
		<div class="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-300">
			<span class="font-semibold text-slate-100">{{ symbolLabel }} · {{ timeframe }}</span>
			<span v-if="loading" class="text-amber-400">Загрузка свечей...</span>
			<span v-else-if="error" class="text-rose-400">Ошибка</span>
			<span v-else class="text-emerald-400">Свечей: {{ candles.length }}</span>
		</div>

		<div v-if="error" class="m-4 rounded border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200">
			{{ error }}
		</div>

		<div v-else-if="!loading && candles.length === 0"
			class="m-4 rounded border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
			Нет данных свечей для {{ symbolLabel }} ({{ timeframe }}).
		</div>

		<div ref="containerRef" class="min-h-0 w-full flex-1" />
	</div>
</template>