<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
	CandlestickSeries,
	ColorType,
	createChart,
	type CandlestickData,
	type IChartApi,
	type ISeriesApi,
	type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '../types/market';

const props = withDefaults(
	defineProps<{
		candles?: Candle[];
		symbol?: string;
	}>(),
	{
		candles: () => [],
		symbol: 'BTC-USDT',
	}
);

const containerRef = ref<HTMLDivElement | null>(null);

let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let lastCandleTime: number | null = null;

function toSeriesData(items: Candle[]): CandlestickData<UTCTimestamp>[] {
	return items.map((c) => ({
		time: c.time as UTCTimestamp,
		open: c.open,
		high: c.high,
		low: c.low,
		close: c.close,
	}));
}

function initChart() {
	const el = containerRef.value;
	if (!el) return;

	chart = createChart(el, {
		width: el.clientWidth,
		height: el.clientHeight,
		layout: {
			background: { type: ColorType.Solid, color: '#0b0f17' },
			textColor: '#9ca3af',
		},
		grid: {
			vertLines: { color: '#1f2937' },
			horzLines: { color: '#1f2937' },
		},
		rightPriceScale: {
			borderColor: '#374151',
		},
		timeScale: {
			borderColor: '#374151',
			timeVisible: true,
			secondsVisible: false,
		},
	});

	candleSeries = chart.addSeries(CandlestickSeries, {
		upColor: '#10b981',
		downColor: '#ef4444',
		borderVisible: false,
		wickUpColor: '#10b981',
		wickDownColor: '#ef4444',
	});

	if (props.candles.length > 0) {
		const formatted = toSeriesData(props.candles);
		candleSeries.setData(formatted);
		lastCandleTime = formatted[formatted.length - 1].time as number;
	}

	resizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			if (!chart) continue;
			const { width, height } = entry.contentRect;
			chart.applyOptions({
				width: Math.max(0, Math.floor(width)),
				height: Math.max(0, Math.floor(height)),
			});
		}
	});

	resizeObserver.observe(el);
}

watch(
	() => props.candles,
	(nextCandles) => {
		if (!candleSeries || nextCandles.length === 0) return;

		const formatted = toSeriesData(nextCandles);
		const latest = formatted[formatted.length - 1];
		const latestTime = latest.time as number;

		// Если добавилась новая свеча или обновилась последняя — используем update()
		if (lastCandleTime !== null && latestTime >= lastCandleTime && formatted.length > 1) {
			const prevTime = formatted[formatted.length - 2].time as number;
			if (latestTime === lastCandleTime || prevTime === lastCandleTime) {
				candleSeries.update(latest);
				lastCandleTime = latestTime;
				return;
			}
		}

		candleSeries.setData(formatted);
		lastCandleTime = latestTime;
	},
	{ deep: false }
);

onMounted(() => {
	initChart();
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
	chart?.remove();
	chart = null;
	candleSeries = null;
});
</script>

<template>
	<section class="relative flex h-full w-full flex-col bg-slate-950 text-slate-100">
		<div class="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs">
			<span class="font-semibold tracking-wide text-slate-200">{{ symbol }}</span>
			<span class="text-slate-400">Candles: {{ candles.length }}</span>
		</div>
		<div ref="containerRef" class="h-screen min-h-0 flex-1 w-full" />
	</section>
</template>