<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PriceAlert } from '../types/alerts';
import {
	coordinateToChartTime,
	coordinateToPrice,
	priceToCoordinate,
} from '../utils/chartCoordinates';

interface RenderedAlert {
	alert: PriceAlert;
	y: number;
}

const props = defineProps<{
	chart: IChartApi | null;
	series: ISeriesApi<'Candlestick'> | null;
	symbol: string;
	alerts: readonly PriceAlert[];
	alertPlacing: boolean;
}>();

const emit = defineEmits<{
	(e: 'create-alert', price: number): void;
	(e: 'update-alert-price', payload: { id: string; price: number }): void;
	(e: 'delete-alert', id: string): void;
	(e: 'clear-alert-placing'): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const renderTick = ref<number>(0);

let draggingAlertId: string | null = null;
let rafId: number | null = null;

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
	const price = coordinateToPrice(props.series, y);
	return price !== null && price > 0 ? price : null;
}

function getLocalCoords(event: PointerEvent): { x: number; y: number } | null {
	const el = svgRef.value;
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}

function syncChartCrosshair(event: PointerEvent) {
	if (!props.chart || !props.series) return;
	if (draggingAlertId !== null || props.alertPlacing) return;

	const coords = getLocalCoords(event);
	if (!coords) return;

	const rawPrice = yToPrice(coords.y);
	const chartTime = coordinateToChartTime(props.chart, coords.x);
	if (rawPrice === null || chartTime === null) return;

	props.chart.setCrosshairPosition(rawPrice, chartTime, props.series);
}

function clearChartCrosshair() {
	if (draggingAlertId === null) {
		props.chart?.clearCrosshairPosition();
	}
}

function handleSvgPointerDown(event: PointerEvent) {
	if (event.button !== 0 || !props.alertPlacing) return;
	const coords = getLocalCoords(event);
	if (!coords) return;

	const price = yToPrice(coords.y);
	if (price === null) return;

	emit('create-alert', price);
	emit('clear-alert-placing');
}

function handleLinePointerDown(event: PointerEvent, alert: PriceAlert) {
	if (event.button !== 0 || props.alertPlacing) return;
	event.stopPropagation();
	draggingAlertId = alert.id;
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
}

function handleSvgPointerMove(event: PointerEvent) {
	if (draggingAlertId === null) {
		syncChartCrosshair(event);
		return;
	}

	const coords = getLocalCoords(event);
	if (!coords) return;

	const nextPrice = yToPrice(coords.y);
	if (nextPrice === null) return;

	emit('update-alert-price', { id: draggingAlertId, price: nextPrice });
	bumpRender();
}

function handleSvgPointerUp() {
	draggingAlertId = null;
}

const renderedAlerts = computed<RenderedAlert[]>(() => {
	void renderTick.value;
	const items: RenderedAlert[] = [];

	for (const alert of props.alerts) {
		if (alert.symbol.toUpperCase() !== props.symbol.toUpperCase()) continue;
		const y = priceToY(alert.price);
		if (y === null) continue;
		items.push({ alert, y });
	}

	return items;
});

watch(
	() => [props.chart, props.series, props.symbol, props.alerts],
	() => {
		bumpRender();
	},
	{ deep: true }
);

onMounted(() => {
	const onSync = () => bumpRender();
	props.chart?.timeScale().subscribeVisibleLogicalRangeChange(onSync);
	window.addEventListener('resize', onSync);

	const poll = window.setInterval(onSync, 150);
	onBeforeUnmount(() => {
		window.clearInterval(poll);
		window.removeEventListener('resize', onSync);
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
		<svg ref="svgRef" class="h-full w-full"
			:class="alertPlacing ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'"
			@pointerdown="handleSvgPointerDown" @pointermove="handleSvgPointerMove" @pointerup="handleSvgPointerUp"
			@pointerleave="clearChartCrosshair">
			<g v-for="{ alert, y } in renderedAlerts" :key="alert.id" class="pointer-events-auto">
				<line :x1="0" :y1="y" x2="100%" :y2="y" stroke="transparent" stroke-width="10" class="cursor-ns-resize"
					@pointerdown="handleLinePointerDown($event, alert)" />
				<line :x1="0" :y1="y" x2="100%" :y2="y" :stroke="alert.active ? '#f59e0b' : '#64748b'"
					:stroke-dasharray="alert.active ? '5 4' : '2 4'" stroke-width="1.5" class="cursor-ns-resize"
					@pointerdown="handleLinePointerDown($event, alert)" />
			</g>
		</svg>

		<div v-for="{ alert, y } in renderedAlerts" :key="`badge_${alert.id}`"
			class="pointer-events-auto absolute left-2.5 flex -translate-y-1/2 items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] shadow"
			:style="{ top: `${y}px` }" :class="alert.active
					? 'border-amber-500/60 bg-[#161616]/95 text-amber-300'
					: 'border-slate-700 bg-[#161616]/90 text-slate-400'
				">
			<span>{{ alert.price }}</span>
			<span v-if="!alert.active" class="rounded bg-slate-800 px-1 text-[9px] uppercase text-slate-400">
				Done
			</span>
			<button type="button" title="Delete alert"
				class="ml-0.5 rounded p-0.5 text-slate-400 transition hover:bg-rose-950/70 hover:text-rose-400"
				@click.stop="emit('delete-alert', alert.id)">
				<Trash2 class="h-3 w-3" />
			</button>
		</div>
	</div>
</template>