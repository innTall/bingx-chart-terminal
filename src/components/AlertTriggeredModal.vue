<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { computed } from 'vue';
import { toDisplaySymbol } from '../config/watchlist';
import type { TriggeredAlertEvent } from '../types/alerts';

const props = defineProps<{
	events: readonly TriggeredAlertEvent[];
}>();

defineEmits<{
	(e: 'dismiss', alertId: string): void;
}>();

// Самый свежий алерт всегда сверху (предполагаем, что новые события добавляются в конец списка)
const topEvent = computed<TriggeredAlertEvent | null>(() => {
	if (props.events.length === 0) return null;
	return props.events[props.events.length - 1] ?? null;
});

function formatAlertTime(timestampMs: number): string {
	const date = new Date(timestampMs);
	if (Number.isNaN(date.getTime())) return '—';
	return date.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}
</script>

<template>
	<div
		v-if="topEvent"
		class="pointer-events-none fixed bottom-4 left-4 z-50 w-60"
	>
		<div
			:key="topEvent.alert.id"
			class="pointer-events-auto w-full rounded border bg-[#161616]/95 px-3 py-2 font-mono text-[11px] text-slate-100 shadow-2xl"
			:class="
				topEvent.direction === 'up'
					? 'border-emerald-500/50'
					: 'border-rose-500/50'
			"
		>
			<div class="mb-1.5 flex items-center justify-between gap-2">
				<div class="truncate font-semibold tracking-tight">
					<span :class="topEvent.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'">
						{{ topEvent.direction === 'up' ? 'Crossed UP' : 'Crossed DOWN' }}
					</span>
					<span class="mx-1 text-slate-500">|</span>
					<span class="text-sky-300">{{ toDisplaySymbol(topEvent.alert.symbol) }}</span>
				</div>
				<button
					type="button"
					title="Delete alert"
					aria-label="Delete alert"
					class="rounded p-0.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
					@click="$emit('dismiss', topEvent.alert.id)"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>

			<div class="space-y-1 text-[11px]">
				<div class="flex items-center justify-between gap-2">
					<span class="text-slate-400">Level:</span>
					<span class="text-amber-300">{{ topEvent.alert.price }}</span>
				</div>
				<div class="flex items-center justify-between gap-2">
					<span class="text-slate-400">Current Price:</span>
					<span class="text-slate-100">{{ topEvent.currentPrice }}</span>
				</div>
				<div class="flex items-center justify-between gap-2">
					<span class="text-slate-400">Time:</span>
					<span class="text-slate-300">{{
						formatAlertTime(topEvent.alert.triggeredAt ?? topEvent.occurredAt)
					}}</span>
				</div>
			</div>
		</div>
	</div>
</template>