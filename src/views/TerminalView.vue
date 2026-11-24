<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BottomFooter from '../components/BottomFooter.vue';
import ChartStage from '../components/ChartStage.vue';
import TopHeader from '../components/TopHeader.vue';
import WatchlistPanel from '../components/WatchlistPanel.vue';
import {
	toDisplaySymbol,
	WATCHLIST_SYMBOLS,
	type Timeframe,
} from '../config/watchlist.ts';
import { fetchBingxKlines } from '../services/bingx/klines.ts';
import { fetchBingxContracts, type MarketSymbolItem } from '../services/bingx/tickers.ts';
import type { Candle } from '../types/market';

const symbols = ref<MarketSymbolItem[]>(
	WATCHLIST_SYMBOLS.map((sym) => ({
		symbol: sym,
		label: toDisplaySymbol(sym),
		price: null,
	}))
);

const activeSymbol = ref<string>(WATCHLIST_SYMBOLS[0] ?? 'BTC-USDT');
const activeTimeframe = ref<Timeframe>('15m');

const candles = ref<Candle[]>([]);
const loadingCandles = ref<boolean>(false);
const candleError = ref<string | null>(null);

const loadingContracts = ref<boolean>(false);
const contractError = ref<string | null>(null);

const activeSymbolLabel = computed(() => toDisplaySymbol(activeSymbol.value));

let klinesRequestSeq = 0;
let activeAbortController: AbortController | null = null;

async function loadContracts() {
	loadingContracts.value = true;
	contractError.value = null;

	try {
		const items = await fetchBingxContracts(symbols.value.map((s) => s.symbol));
		if (items.length > 0) {
			symbols.value = items;
		}
	} catch (err) {
		contractError.value =
			err instanceof Error ? err.message : 'Не удалось загрузить список символов';
	} finally {
		loadingContracts.value = false;
	}
}

async function loadCandles(symbol: string, interval: Timeframe) {
	activeAbortController?.abort();
	const controller = new AbortController();
	activeAbortController = controller;

	const seq = ++klinesRequestSeq;
	loadingCandles.value = true;
	candleError.value = null;

	try {
		const list = await fetchBingxKlines({
			symbol,
			interval,
			limit: 500,
			signal: controller.signal,
		});

		if (seq !== klinesRequestSeq) return;
		candles.value = list;
	} catch (err) {
		if (controller.signal.aborted || seq !== klinesRequestSeq) return;
		candles.value = [];
		candleError.value =
			err instanceof Error ? err.message : 'Ошибка сети при загрузке свечей';
	} finally {
		if (seq === klinesRequestSeq) {
			loadingCandles.value = false;
		}
	}
}

onMounted(() => {
	void loadContracts();
	void loadCandles(activeSymbol.value, activeTimeframe.value);
});

watch([activeSymbol, activeTimeframe], ([nextSymbol, nextTf]) => {
	void loadCandles(nextSymbol, nextTf);
});

onBeforeUnmount(() => {
	activeAbortController?.abort();
});
</script>

<template>
	<div class="flex h-screen flex-col gap-3 overflow-hidden bg-slate-950 p-4 text-slate-100">
		<TopHeader :active-timeframe="activeTimeframe" :symbols-count="symbols.length" :loading-contracts="loadingContracts"
			:contract-error="contractError" @select-timeframe="activeTimeframe = $event" />

		<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
			<WatchlistPanel :items="symbols" :active-symbol="activeSymbol" @select-symbol="activeSymbol = $event" />

			<section class="flex min-h-0 flex-col">
				<ChartStage :candles="candles" :loading="loadingCandles" :error="candleError" :symbol-label="activeSymbolLabel"
					:timeframe="activeTimeframe" />
			</section>
		</div>

		<BottomFooter :active-symbol-label="activeSymbolLabel" :active-timeframe="activeTimeframe"
			:candles-count="candles.length" :has-error="Boolean(candleError || contractError)" />
	</div>
</template>