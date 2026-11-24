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
} from '../config/watchlist';
import { fetchBingxKlines } from '../services/bingx/klines';
import { startLiveKlineStream, type LiveKlineSubscription } from '../services/bingx/liveKline';
import {
	fetchBingxContracts,
	fetchBingxPrices,
	type MarketSymbolItem,
} from '../services/bingx/tickers';
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
const latestCandle = ref<Candle | null>(null);
const loadingCandles = ref<boolean>(false);
const candleError = ref<string | null>(null);

const loadingContracts = ref<boolean>(false);
const contractError = ref<string | null>(null);

const activeSymbolLabel = computed(() => toDisplaySymbol(activeSymbol.value));

let klinesRequestSeq = 0;
let activeAbortController: AbortController | null = null;
let liveSub: LiveKlineSubscription | null = null;
let pricesTimerId: number | null = null;

function applySymbolPrice(symbol: string, price: number) {
	const upper = symbol.toUpperCase();
	symbols.value = symbols.value.map((item) =>
		item.symbol === upper ? { ...item, price } : item
	);
}

async function refreshWatchlistPrices() {
	try {
		const inactiveSymbols = symbols.value
			.map((item) => item.symbol)
			.filter((sym) => sym !== activeSymbol.value);

		const targets = inactiveSymbols.length > 0 ? inactiveSymbols : symbols.value.map((s) => s.symbol);
		const pricesMap = await fetchBingxPrices(targets);

		if (Object.keys(pricesMap).length === 0) return;

		symbols.value = symbols.value.map((item) => {
			if (item.symbol === activeSymbol.value) return item;
			const nextPrice = pricesMap[item.symbol];
			return nextPrice !== undefined ? { ...item, price: nextPrice } : item;
		});
	} catch {
		// Ошибки фонового обновления цен не блокируют активный график
	}
}

function restartLiveStream(symbol: string, timeframe: Timeframe) {
	liveSub?.stop();
	liveSub = null;

	liveSub = startLiveKlineStream({
		symbol,
		timeframe,
		pollIntervalMs: 2500,
		onCandle: (candle) => {
			if (symbol !== activeSymbol.value || timeframe !== activeTimeframe.value) return;
			latestCandle.value = candle;
			applySymbolPrice(symbol, candle.close);

			const current = candles.value;
			if (current.length === 0) {
				candles.value = [candle];
				return;
			}

			const last = current[current.length - 1];
			if (last && last.time === candle.time) {
				candles.value = [...current.slice(0, -1), candle];
			} else if (last && Number(candle.time) > Number(last.time)) {
				candles.value = [...current.slice(-499), candle];
			}
		},
	});
}

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
	latestCandle.value = null;

	try {
		const list = await fetchBingxKlines({
			symbol,
			interval,
			limit: 500,
			signal: controller.signal,
		});

		if (seq !== klinesRequestSeq) return;
		candles.value = list;

		const last = list[list.length - 1];
		if (last) {
			latestCandle.value = last;
			applySymbolPrice(symbol, last.close);
		}

		restartLiveStream(symbol, interval);
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
	void refreshWatchlistPrices();

	pricesTimerId = window.setInterval(() => {
		void refreshWatchlistPrices();
	}, 5000);
});

watch([activeSymbol, activeTimeframe], ([nextSymbol, nextTf]) => {
	void loadCandles(nextSymbol, nextTf);
});

onBeforeUnmount(() => {
	activeAbortController?.abort();
	liveSub?.stop();
	if (pricesTimerId !== null) {
		window.clearInterval(pricesTimerId);
		pricesTimerId = null;
	}
});
</script>

<template>
	<div class="flex h-screen flex-col gap-3 overflow-hidden bg-slate-950 p-4 text-slate-100">
		<TopHeader :active-timeframe="activeTimeframe" :symbols-count="symbols.length" :loading-contracts="loadingContracts"
			:contract-error="contractError" @select-timeframe="activeTimeframe = $event" />

		<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
			<WatchlistPanel :items="symbols" :active-symbol="activeSymbol" @select-symbol="activeSymbol = $event" />

			<section class="flex min-h-0 flex-col">
				<ChartStage :candles="candles" :latest-candle="latestCandle" :loading="loadingCandles" :error="candleError"
					:symbol-label="activeSymbolLabel" :timeframe="activeTimeframe" />
			</section>
		</div>

		<BottomFooter :active-symbol-label="activeSymbolLabel" :active-timeframe="activeTimeframe"
			:candles-count="candles.length" :has-error="Boolean(candleError || contractError)" />
	</div>
</template>