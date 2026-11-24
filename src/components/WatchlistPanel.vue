<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { MarketSymbolItem } from '../services/bingx/tickers';

export type SortMode = 'default' | 'symbol-asc' | 'symbol-desc' | 'price-desc' | 'price-asc';

const props = defineProps<{
	items: MarketSymbolItem[];
	activeSymbol: string;
}>();

const emit = defineEmits<{
	(e: 'select-symbol', symbol: string): void;
}>();

const sortMode = ref<SortMode>('default');
const buttonRefs = ref<Record<string, HTMLButtonElement | null>>({});

const sortedItems = computed(() => {
	const list = [...props.items];

	switch (sortMode.value) {
		case 'symbol-asc':
			return list.sort((a, b) => a.label.localeCompare(b.label));
		case 'symbol-desc':
			return list.sort((a, b) => b.label.localeCompare(a.label));
		case 'price-desc':
			return list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
		case 'price-asc':
			return list.sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
		default:
			return list;
	}
});

function setButtonRef(symbol: string, el: unknown) {
	buttonRefs.value[symbol] = el instanceof HTMLButtonElement ? el : null;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
	if (sortedItems.value.length === 0) return;

	event.preventDefault();
	const currentIndex = sortedItems.value.findIndex((item) => item.symbol === props.activeSymbol);
	const delta = event.key === 'ArrowDown' ? 1 : -1;

	const nextIndex =
		currentIndex === -1
			? 0
			: (currentIndex + delta + sortedItems.value.length) % sortedItems.value.length;

	const nextItem = sortedItems.value[nextIndex];
	if (nextItem) {
		emit('select-symbol', nextItem.symbol);
	}
}

function cycleSymbolSort() {
	if (sortMode.value === 'symbol-asc') {
		sortMode.value = 'symbol-desc';
	} else if (sortMode.value === 'symbol-desc') {
		sortMode.value = 'default';
	} else {
		sortMode.value = 'symbol-asc';
	}
}

function cyclePriceSort() {
	if (sortMode.value === 'price-desc') {
		sortMode.value = 'price-asc';
	} else if (sortMode.value === 'price-asc') {
		sortMode.value = 'default';
	} else {
		sortMode.value = 'price-desc';
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
		class="flex min-h-0 flex-col rounded border border-slate-800 bg-slate-900/50 p-2 outline-none focus:ring-1 focus:ring-sky-500/50"
		@keydown="handleKeydown">
		<div class="mb-2 flex items-center justify-between gap-1 border-b border-slate-800 pb-2 text-[11px]">
			<button type="button" class="rounded px-2 py-1 font-medium transition" :class="sortMode === 'symbol-asc' || sortMode === 'symbol-desc'
					? 'bg-sky-600/25 text-sky-300'
					: 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
				" @click="cycleSymbolSort">
				Тикер
				<span v-if="sortMode === 'symbol-asc'">↑</span>
				<span v-else-if="sortMode === 'symbol-desc'">↓</span>
			</button>

			<button type="button" class="rounded px-2 py-1 font-medium transition" :class="sortMode === 'price-asc' || sortMode === 'price-desc'
					? 'bg-sky-600/25 text-sky-300'
					: 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
				" @click="cyclePriceSort">
				Цена
				<span v-if="sortMode === 'price-desc'">↓</span>
				<span v-else-if="sortMode === 'price-asc'">↑</span>
			</button>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto pr-0.5">
			<button v-for="item in sortedItems" :key="item.symbol" :ref="(el) => setButtonRef(item.symbol, el)" type="button"
				class="mb-1 flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition" :class="activeSymbol === item.symbol
						? 'bg-sky-600/25 font-semibold text-sky-300 ring-1 ring-sky-500/60'
						: 'text-slate-300 hover:bg-slate-800/70'
					" @click="emit('select-symbol', item.symbol)">
				<span>{{ item.label }}</span>
				<span class="font-mono text-[11px] text-slate-400">
					{{ item.price !== null ? item.price : '—' }}
				</span>
			</button>
		</div>
	</aside>
</template>