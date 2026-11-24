<script setup lang="ts">
import { Minus, Square } from 'lucide-vue-next';
import { TIMEFRAMES, type Timeframe } from '../config/watchlist';

export type DataSourceType = 'bingx' | 'oanda';
export type DrawingToolType = 'none' | 'ray' | 'rectangle';

defineProps<{
	activeSymbolLabel: string;
	activeTimeframe: Timeframe;
	activeSource: DataSourceType;
	activeTool: DrawingToolType;
	contractError: string | null;
}>();

const emit = defineEmits<{
	(e: 'select-timeframe', tf: Timeframe): void;
	(e: 'select-source', source: DataSourceType): void;
	(e: 'select-tool', tool: DrawingToolType): void;
}>();

function toggleTool(current: DrawingToolType, target: Exclude<DrawingToolType, 'none'>) {
	emit('select-tool', current === target ? 'none' : target);
}
</script>

<template>
	<header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
		<!-- Левая зона: Logo + RM chart + активный символ и TF -->
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-2">
				<img src="/favicon.svg" alt="RM chart" class="h-6 w-6 shrink-0 object-contain" />
				<span class="text-sm font-bold tracking-wide text-slate-100">RM chart</span>
			</div>

			<span class="h-4 w-px bg-slate-800" />

			<div class="flex items-center gap-1.5">
				<span class="rounded bg-sky-500/15 px-2 py-0.5 text-sm font-bold tracking-wide text-sky-300">
					{{ activeSymbolLabel }}
				</span>
				<span class="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-300">
					{{ activeTimeframe }}
				</span>
			</div>

			<span v-if="contractError" class="text-[11px] text-amber-400">
				{{ contractError }}
			</span>
		</div>

		<!-- Центральная зона: заглушки BingX / Oanda + кнопки разметки -->
		<div class="flex items-center gap-3">
			<div class="flex items-center rounded border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
				<button type="button" class="rounded px-2.5 py-1 font-medium transition" :class="activeSource === 'bingx'
						? 'bg-sky-600 text-white'
						: 'text-slate-400 hover:text-slate-200'
					" @click="emit('select-source', 'bingx')">
					BingX
				</button>
				<button type="button" class="rounded px-2.5 py-1 font-medium transition" :class="activeSource === 'oanda'
						? 'bg-emerald-600 text-white'
						: 'text-slate-400 hover:text-slate-200'
					" @click="emit('select-source', 'oanda')">
					Oanda
				</button>
			</div>

			<div class="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
				<button type="button" title="Горизонтальный луч"
					class="flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition" :class="activeTool === 'ray'
							? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
							: 'text-slate-300 hover:bg-slate-800'
						" @click="toggleTool(activeTool, 'ray')">
					<Minus class="h-3.5 w-3.5" />
					<span>Луч</span>
				</button>

				<button type="button" title="Прямоугольник"
					class="flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition" :class="activeTool === 'rectangle'
							? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
							: 'text-slate-300 hover:bg-slate-800'
						" @click="toggleTool(activeTool, 'rectangle')">
					<Square class="h-3.5 w-3.5" />
					<span>Прямоугольник</span>
				</button>
			</div>
		</div>

		<!-- Правая зона: Таймфреймы -->
		<nav aria-label="Timeframes" class="flex items-center gap-1">
			<button v-for="tf in TIMEFRAMES" :key="tf" type="button"
				class="rounded px-2.5 py-1 text-xs font-medium transition" :class="activeTimeframe === tf
						? 'bg-sky-600 text-white'
						: 'bg-slate-900 text-slate-300 hover:bg-slate-800'
					" @click="emit('select-timeframe', tf)">
				{{ tf }}
			</button>
		</nav>
	</header>
</template>