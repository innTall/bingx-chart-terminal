<script setup lang="ts">
import type { MarketSymbolItem } from '../services/bingx/tickers';

defineProps<{
	items: MarketSymbolItem[];
	activeSymbol: string;
}>();

const emit = defineEmits<{
	(e: 'select-symbol', symbol: string): void;
}>();
</script>

<template>
	<aside class="flex min-h-0 flex-col overflow-y-auto rounded border border-slate-800 bg-slate-900/50 p-2">
		<button v-for="item in items" :key="item.symbol" type="button"
			class="mb-1 flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition" :class="activeSymbol === item.symbol
					? 'bg-sky-600/25 font-semibold text-sky-300 ring-1 ring-sky-500/60'
					: 'text-slate-300 hover:bg-slate-800/70'
				" @click="emit('select-symbol', item.symbol)">
			<span>{{ item.label }}</span>
			<span v-if="item.price !== null" class="text-slate-400">{{ item.price }}</span>
		</button>
	</aside>
</template>