<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { MarketSymbolItem } from '../services/bingx/tickers';
import {
	loadWatchlistMarkers,
	saveWatchlistMarkers,
	type WatchlistMarkerColor,
} from '../services/storage/terminalStorage';

export type MarkerColor = 'none' | 'emerald' | 'amber' | 'rose' | 'sky';
export type SymbolSortMode = 'default' | 'symbol-asc' | 'symbol-desc';

const PINNED_ORDER = ['BTC', 'ETH', 'SOL'] as const;

const MARKER_CYCLE: readonly MarkerColor[] = [
	'none',
	'emerald',
	'amber',
	'rose',
	'sky',
];

const MARKER_DOT_CLASS: Record<MarkerColor, string> = {
	none: 'border-slate-700 bg-transparent opacity-0 group-hover/row:opacity-60',
	emerald: 'border-emerald-400 bg-emerald-400',
	amber: 'border-amber-400 bg-amber-400',
	rose: 'border-rose-400 bg-rose-400',
	sky: 'border-sky-400 bg-sky-400',
};

const props = defineProps<{
	items: MarketSymbolItem[];
	activeSymbol: string;
	activeAlertSymbols: readonly string[];
}>();

const emit = defineEmits<{
	(e: 'select-symbol', symbol: string): void;
}>();

const sortMode = ref<SymbolSortMode>('default');
const markers = ref<Record<string, WatchlistMarkerColor>>(loadWatchlistMarkers());
const buttonRefs = ref<Record<string, HTMLButtonElement | null>>({});
const activeAlertSymbolSet = computed(
	() => new Set(props.activeAlertSymbols.map((symbol) => symbol.trim().toUpperCase()))
);

function getPinRank(label: string): number {
	const idx = PINNED_ORDER.indexOf(label.toUpperCase() as (typeof PINNED_ORDER)[number]);
	return idx === -1 ? PINNED_ORDER.length : idx;
}

const orderedItems = computed(() => {
	const list = [...props.items];

	if (sortMode.value === 'symbol-desc') {
		return list.sort((a, b) => b.label.localeCompare(a.label));
	}

	// По умолчанию (и при 'symbol-asc'): BTC, ETH, SOL закреплены сверху, остальные по алфавиту
	return list.sort((a, b) => {
		const pinA = getPinRank(a.label);
		const pinB = getPinRank(b.label);
		if (pinA !== pinB) {
			return pinA - pinB;
		}
		return a.label.localeCompare(b.label);
	});
});

function getMarker(symbol: string): MarkerColor {
	return markers.value[symbol] ?? 'none';
}

function cycleMarker(event: MouseEvent, symbol: string) {
	event.stopPropagation();
	const upper = symbol.toUpperCase();
	const current = markers.value[upper] ?? 'none';
	const nextIndex = (MARKER_CYCLE.indexOf(current) + 1) % MARKER_CYCLE.length;
	const nextMarkers: Record<string, WatchlistMarkerColor> = {
		...markers.value,
		[upper]: MARKER_CYCLE[nextIndex] ?? 'none',
	};
	markers.value = nextMarkers;
	saveWatchlistMarkers(nextMarkers);
}

function setButtonRef(symbol: string, el: unknown) {
	buttonRefs.value[symbol] = el instanceof HTMLButtonElement ? el : null;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
	if (orderedItems.value.length === 0) return;

	event.preventDefault();
	const currentIndex = orderedItems.value.findIndex((item) => item.symbol === props.activeSymbol);
	const delta = event.key === 'ArrowDown' ? 1 : -1;

	const nextIndex =
		currentIndex === -1
			? 0
			: (currentIndex + delta + orderedItems.value.length) % orderedItems.value.length;

	const nextItem = orderedItems.value[nextIndex];
	if (nextItem) {
		emit('select-symbol', nextItem.symbol);
	}
}

function cycleSymbolSort() {
	if (sortMode.value === 'default') {
		sortMode.value = 'symbol-asc';
	} else if (sortMode.value === 'symbol-asc') {
		sortMode.value = 'symbol-desc';
	} else {
		sortMode.value = 'default';
	}
}

watch(
	() => props.activeSymbol,
	async (nextSymbol) => {
		await nextTick();
		buttonRefs.value[nextSymbol]?.scrollIntoView({ block: 'nearest' });
	}
);
</script>

<template>
	<aside tabindex="0" aria-label="Watchlist"
		class="flex min-h-0 flex-col rounded border border-slate-800 bg-[#161616] p-2 outline-none focus:ring-1 focus:ring-sky-500/50"
		@keydown="handleKeydown">
		
		<div class="mb-2 flex items-center justify-between border-b border-slate-800 pb-2 text-[11px]">
			<button type="button" class="rounded px-2 py-1 font-medium transition" :class="sortMode === 'symbol-desc'
					? 'bg-sky-600/25 text-sky-300'
					: 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
				" @click="cycleSymbolSort">
				Тикер
				<span v-if="sortMode === 'symbol-desc'">↓</span>
				<span v-else>↑</span>
			</button>

			<span title="Symbols"
				class="flex h-6 min-w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800/90 px-1.5 font-mono text-[11px] font-semibold text-slate-200">
				{{ items.length }}
			</span>
		</div>

		<div class="watchlist-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
			<button v-for="item in orderedItems" :key="item.symbol" :ref="(el) => setButtonRef(item.symbol, el)" type="button"
				class="group/row mb-1 flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition"
				:class="activeSymbol === item.symbol
						? 'bg-sky-600/25 font-semibold text-sky-300 ring-1 ring-sky-500/60'
						: 'text-slate-300 hover:bg-slate-800/70'
					" @click="emit('select-symbol', item.symbol)">
				<span class="flex min-w-0 items-center gap-1.5">
					<span role="button" tabindex="-1" title="Цветной значок"
						class="inline-block h-2 w-2 shrink-0 rounded-full border transition"
						:class="MARKER_DOT_CLASS[getMarker(item.symbol)]" @click="cycleMarker($event, item.symbol)" />
					<span
						class="truncate"
						:class="activeAlertSymbolSet.has(item.symbol.trim().toUpperCase()) ? 'text-amber-300' : ''"
					>{{ item.label }}</span>
				</span>

				<span class="ml-1 shrink-0 font-mono text-[11px] text-slate-400">
					{{ item.price !== null ? item.price : '—' }}
				</span>
			</button>
		</div>
	</aside>
</template>

<style scoped>
.watchlist-scroll {
	scrollbar-width: thin;
	scrollbar-color: #334155 #020617;
}

.watchlist-scroll::-webkit-scrollbar {
	width: 10px;
}

.watchlist-scroll::-webkit-scrollbar-track {
	background: #161616;
}

.watchlist-scroll::-webkit-scrollbar-thumb {
	background-color: #262626;
	border-radius: 4px;
	border: 2px solid #161616;
}

.watchlist-scroll::-webkit-scrollbar-thumb:hover {
	background-color: #334155;
}

.watchlist-scroll::-webkit-scrollbar-button {
	background-color: #020617;
	color: #64748b;
	height: 10px;
}

.watchlist-scroll::-webkit-scrollbar-button:hover {
	background-color: #0f172a;
}
</style>