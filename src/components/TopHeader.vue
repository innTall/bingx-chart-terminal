<script setup lang="ts">
import { TIMEFRAMES, type Timeframe } from '../config/watchlist';

defineProps<{
	activeTimeframe: Timeframe;
	symbolsCount: number;
	loadingContracts: boolean;
	contractError: string | null;
}>();

const emit = defineEmits<{
	(e: 'select-timeframe', tf: Timeframe): void;
}>();
</script>

<template>
	<header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
		<div>
			<h1 class="text-base font-semibold text-slate-100">BingX Chart Terminal</h1>
			<p class="text-xs text-slate-400">
				<span v-if="loadingContracts">Проверка контрактов...</span>
				<span v-else-if="contractError" class="text-amber-400">{{ contractError }}</span>
				<span v-else>Символов в списке: {{ symbolsCount }}</span>
			</p>
		</div>

		<nav aria-label="Timeframes" class="flex flex-wrap items-center gap-1">
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