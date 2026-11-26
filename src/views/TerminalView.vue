<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AlertTriggeredModal from '../components/AlertTriggeredModal.vue';
import BottomFooter from '../components/BottomFooter.vue';
import ChartStage from '../components/ChartStage.vue';
import TopHeader, {
	type DataSourceType,
	type DrawingToolType,
} from '../components/TopHeader.vue';
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
import {
	loadAlertsForSymbol,
	saveAlertsForSymbol,
} from '../services/storage/alertsStorage';
import { playAlertSound } from '../utils/alertSound';
import {
	loadDrawingsForSymbol,
	saveDrawingsForSymbol,
} from '../services/storage/drawingsStorage';
import {
	deleteDrawingPreset,
	formatDefaultPresetName,
	loadDrawingPresets,
	saveDrawingPresets,
} from '../services/storage/presetsStorage';
import type { PriceAlert, TriggeredAlertEvent } from '../types/alerts';
import type { DrawingObject, DrawingPreset } from '../types/drawings';
import type { Candle } from '../types/market';
import { sendScreenshotToTelegram } from '../services/telegram/sendScreenshot';

const symbols = ref<MarketSymbolItem[]>(
	WATCHLIST_SYMBOLS.map((sym) => ({
		symbol: sym,
		label: toDisplaySymbol(sym),
		price: null,
	}))
);

const activeSymbol = ref<string>(WATCHLIST_SYMBOLS[0] ?? 'BTC-USDT');
const activeTimeframe = ref<Timeframe>('15m');
const activeSource = ref<DataSourceType>('bingx');
const activeTool = ref<DrawingToolType>('none');
const magnetEnabled = ref<boolean>(true);

const presets = ref<DrawingPreset[]>(loadDrawingPresets());
const activePreset = ref<DrawingPreset | null>(null);

const drawings = ref<DrawingObject[]>([]);
const alerts = ref<PriceAlert[]>([]);
const alertPlacing = ref<boolean>(false);
const triggeredAlert = ref<TriggeredAlertEvent | null>(null);

const candles = ref<Candle[]>([]);
const latestCandle = ref<Candle | null>(null);
const loadingCandles = ref<boolean>(false);
const candleError = ref<string | null>(null);
const contractError = ref<string | null>(null);

const activeSymbolLabel = computed(() => toDisplaySymbol(activeSymbol.value));

const chartStageRef = ref<InstanceType<typeof ChartStage> | null>(null);
const capturingScreenshot = ref<boolean>(false);
const screenshotToast = ref<{ ok: boolean; text: string } | null>(null);
let toastTimerId: number | null = null;

let klinesRequestSeq = 0;
let activeAbortController: AbortController | null = null;
let liveSub: LiveKlineSubscription | null = null;
let pricesTimerId: number | null = null;
let prevTrackedPrice: number | null = null;

function applySymbolPrice(symbol: string, price: number) {
	const upper = symbol.toUpperCase();
	symbols.value = symbols.value.map((item) =>
		item.symbol === upper ? { ...item, price } : item
	);
}

function loadDrawings(symbol: string) {
	drawings.value = loadDrawingsForSymbol(symbol);
}

function handleDrawingsUpdate(nextItems: DrawingObject[]) {
	const symbolKey = activeSymbol.value;
	drawings.value = nextItems;
	saveDrawingsForSymbol(symbolKey, nextItems);
}

function loadAlerts(symbol: string) {
	alerts.value = loadAlertsForSymbol(symbol);
}

function syncAlerts(nextItems: PriceAlert[]) {
	const symbolKey = activeSymbol.value;
	alerts.value = nextItems;
	saveAlertsForSymbol(symbolKey, nextItems);
}

function handleToggleAlertPlacing() {
	activeTool.value = 'none';
	activePreset.value = null;
	alertPlacing.value = !alertPlacing.value;
}

function resolvePriceDecimals(refPrice: number | null | undefined): number {
	if (typeof refPrice !== 'number' || !Number.isFinite(refPrice) || refPrice <= 0) {
		return 4;
	}
	const str = String(refPrice);
	const dotIdx = str.indexOf('.');
	if (dotIdx === -1) return 2;
	return Math.min(6, Math.max(2, str.length - dotIdx - 1));
}

function normalizeAlertPrice(price: number, refPrice?: number | null): number {
	const decimals = resolvePriceDecimals(refPrice ?? latestCandle.value?.close);
	return Number(price.toFixed(decimals));
}

function handleCreateAlert(price: number) {
	if (!Number.isFinite(price) || price <= 0) return;
	const cleanPrice = normalizeAlertPrice(price);
	const created: PriceAlert = {
		id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
		symbol: activeSymbol.value,
		price: cleanPrice,
		active: true,
		createdAt: Date.now(),
	};
	syncAlerts([...alerts.value, created]);
}

function handleUpdateAlertPrice(payload: { id: string; price: number }) {
	if (!Number.isFinite(payload.price) || payload.price <= 0) return;
	const cleanPrice = normalizeAlertPrice(payload.price);
	const next = alerts.value.map((item) =>
		item.id === payload.id
			? { ...item, price: cleanPrice, active: true, triggeredAt: undefined }
			: item
	);
	syncAlerts(next);
}

function handleDeleteAlert(id: string) {
	syncAlerts(alerts.value.filter((item) => item.id !== id));
}

function checkAlertsCrossing(nextPrice: number) {
	if (!Number.isFinite(nextPrice)) return;

	if (prevTrackedPrice === null) {
		prevTrackedPrice = nextPrice;
		return;
	}

	const prevPrice = prevTrackedPrice;
	prevTrackedPrice = nextPrice;
	if (prevPrice === nextPrice) return;

	let hasTriggered = false;
	const now = Date.now();

	const updated = alerts.value.map((item) => {
		if (!item.active) return item;

		const crossedUp = prevPrice < item.price && nextPrice >= item.price;
		const crossedDown = prevPrice > item.price && nextPrice <= item.price;

		if (!crossedUp && !crossedDown) return item;

		hasTriggered = true;
		const finishedAlert: PriceAlert = {
			...item,
			active: false,
			triggeredAt: now,
		};

		if (!triggeredAlert.value) {
			triggeredAlert.value = {
				alert: finishedAlert,
				prevPrice,
				currentPrice: nextPrice,
				direction: crossedUp ? 'up' : 'down',
				occurredAt: now,
			};
			playAlertSound();
		}

		return finishedAlert;
	});

	if (hasTriggered) {
		syncAlerts(updated);
	}
}

function handleSavePreset(drawing: DrawingObject) {
	const customText = drawing.style.label.trim();
	const resolvedName =
		customText.length > 0
			? customText
			: formatDefaultPresetName(drawing.kind, activeTimeframe.value);

	const newPreset: DrawingPreset = {
		id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
		name: resolvedName,
		kind: drawing.kind,
		color: drawing.style.color,
		lineWidth: drawing.style.lineWidth,
		label: customText || resolvedName,
	};

	const next = [...presets.value, newPreset];
	presets.value = next;
	activePreset.value = newPreset;
	saveDrawingPresets(next);
}

function handleDeletePreset(presetId: string) {
	presets.value = deleteDrawingPreset(presets.value, presetId);
	if (activePreset.value?.id === presetId) {
		activePreset.value = null;
	}
}

async function refreshWatchlistPrices() {
	try {
		const inactiveSymbols = symbols.value
			.map((item) => item.symbol)
			.filter((sym) => sym !== activeSymbol.value);

		const targets =
			inactiveSymbols.length > 0 ? inactiveSymbols : symbols.value.map((s) => s.symbol);
		const pricesMap = await fetchBingxPrices(targets);

		if (Object.keys(pricesMap).length === 0) return;

		symbols.value = symbols.value.map((item) => {
			if (item.symbol === activeSymbol.value) return item;
			const nextPrice = pricesMap[item.symbol];
			return nextPrice !== undefined ? { ...item, price: nextPrice } : item;
		});
	} catch {
		// Фоновое обновление цен не блокирует основной интерфейс
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
			checkAlertsCrossing(candle.close);

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
	contractError.value = null;

	try {
		const items = await fetchBingxContracts(symbols.value.map((s) => s.symbol));
		if (items.length > 0) {
			symbols.value = items;
		}
	} catch (err) {
		contractError.value =
			err instanceof Error ? err.message : 'Не удалось загрузить список символов';
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
			checkAlertsCrossing(last.close);
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

function showScreenshotToast(ok: boolean, text: string) {
	screenshotToast.value = { ok, text };
	if (toastTimerId !== null) {
		window.clearTimeout(toastTimerId);
	}
	toastTimerId = window.setTimeout(() => {
		screenshotToast.value = null;
		toastTimerId = null;
	}, 3500);
}

async function handleCaptureScreenshot() {
	if (capturingScreenshot.value || !chartStageRef.value) return;
	capturingScreenshot.value = true;
	try {
		const blob = await chartStageRef.value.captureScreenshot();
		const res = await sendScreenshotToTelegram({
			blob,
			symbol: activeSymbol.value,
			timeframe: activeTimeframe.value,
			source: activeSource.value,
			lastPrice: latestCandle.value?.close ?? null,
		});

		if (res.ok) {
			showScreenshotToast(true, 'Sent to Telegram');
		} else {
			showScreenshotToast(false, res.error ?? 'Failed to send screenshot');
		}
	} catch (err) {
		showScreenshotToast(
			false,
			err instanceof Error ? err.message : 'Screenshot error'
		);
	} finally {
		capturingScreenshot.value = false;
	}
}

onMounted(() => {
	void loadContracts();
	loadDrawings(activeSymbol.value);
	loadAlerts(activeSymbol.value);
	void loadCandles(activeSymbol.value, activeTimeframe.value);
	void refreshWatchlistPrices();

	pricesTimerId = window.setInterval(() => {
		void refreshWatchlistPrices();
	}, 5000);
});

watch(activeSymbol, (nextSymbol) => {
	activeTool.value = 'none';
	alertPlacing.value = false;
	prevTrackedPrice = null;
	drawings.value = [];
	alerts.value = [];
	loadDrawings(nextSymbol);
	loadAlerts(nextSymbol);
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
	<div class="flex h-screen flex-col gap-2 overflow-hidden bg-[#161616] p-2.5 text-slate-100">
		<TopHeader :active-symbol-label="activeSymbolLabel" :active-timeframe="activeTimeframe"
			:active-source="activeSource" :active-tool="activeTool" :magnet-enabled="magnetEnabled"
			:alert-placing="alertPlacing" :contract-error="contractError" :presets="presets"
			:active-preset-id="activePreset?.id ?? null" @select-timeframe="activeTimeframe = $event"
			@select-source="activeSource = $event" @select-tool="alertPlacing = false; activeTool = $event"
			@select-preset="activePreset = $event" @delete-preset="handleDeletePreset"
			@toggle-magnet="magnetEnabled = !magnetEnabled" @toggle-alert-placing="handleToggleAlertPlacing" 
			:capturing-screenshot="capturingScreenshot" @capture-screenshot="handleCaptureScreenshot" />

		<div v-if="screenshotToast"
			class="fixed bottom-4 right-4 z-50 rounded border px-3 py-1.5 font-mono text-xs shadow-lg" :class="screenshotToast.ok
					? 'border-emerald-500/50 bg-[#161616]/95 text-emerald-300'
					: 'border-rose-500/50 bg-[#161616]/95 text-rose-300'
				">
			{{ screenshotToast.text }}
		</div>

		<main class="grid min-h-0 flex-1 grid-cols-1 gap-2.5 md:grid-cols-[1fr_180px]">
			<section class="flex h-full min-h-0 flex-col">
				<ChartStage ref="chartStageRef" :candles="candles" :latest-candle="latestCandle" :loading="loadingCandles" :error="candleError"
					:symbol="activeSymbol" :active-tool="activeTool" :magnet-enabled="magnetEnabled" :drawings="drawings"
					:active-preset="activePreset" :alerts="alerts" :alert-placing="alertPlacing" @save-preset="handleSavePreset"
					@update:drawings="handleDrawingsUpdate" @clear-tool="activeTool = 'none'" @create-alert="handleCreateAlert"
					@update-alert-price="handleUpdateAlertPrice" @delete-alert="handleDeleteAlert"
					@clear-alert-placing="alertPlacing = false" />
			</section>

			<WatchlistPanel class="h-full min-h-0" :items="symbols" :active-symbol="activeSymbol"
				@select-symbol="activeSymbol = $event" />
		</main>

		<BottomFooter />

		<AlertTriggeredModal :event="triggeredAlert" @close="triggeredAlert = null" />
	</div>
</template>