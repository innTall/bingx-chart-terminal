<script setup lang="ts">
import { toDisplaySymbol } from '../config/watchlist';
import type { TriggeredAlertEvent } from '../types/alerts';

defineProps<{
	event: TriggeredAlertEvent | null;
}>();

defineEmits<{
	(e: 'close'): void;
}>();
</script>

<template>
	<div v-if="event" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
		@click.self="$emit('close')">
		<div class="w-full max-w-sm rounded border border-amber-500/50 bg-[#161616] p-4 text-slate-100 shadow-2xl">
			<div class="mb-2 flex items-center justify-between">
				<span class="font-mono text-xs uppercase tracking-wider text-amber-300">
					Price Alert Triggered
				</span>
				<span class="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-sky-300">
					{{ toDisplaySymbol(event.alert.symbol) }}
				</span>
			</div>

			<div class="space-y-1.5 rounded border border-slate-800 bg-neutral-900/80 p-3 font-mono text-xs">
				<div class="flex justify-between">
					<span class="text-slate-400">Level:</span>
					<span class="text-amber-300">{{ event.alert.price }}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-slate-400">Current price:</span>
					<span class="text-slate-100">{{ event.currentPrice }}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-slate-400">Direction:</span>
					<span :class="event.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'">
						{{ event.direction === 'up' ? 'Crossed Up ↑' : 'Crossed Down ↓' }}
					</span>
				</div>
			</div>

			<button type="button"
				class="mt-3 w-full rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
				@click="$emit('close')">
				OK
			</button>
		</div>
	</div>
</template>