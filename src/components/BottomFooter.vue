<script setup lang="ts">
defineProps<{
	activeSymbolLabel: string;
	activeTimeframe: string;
	candlesCount: number;
	hasError: boolean;
}>();
</script>

<template>
	<footer
		class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
		<div>
			Активный инструмент: <span class="font-medium text-slate-200">{{ activeSymbolLabel }}</span>
			· TF: <span class="font-medium text-slate-200">{{ activeTimeframe }}</span>
		</div>
		<div>
			<span v-if="hasError" class="text-rose-400">Состояние: ошибка запроса</span>
			<span v-else class="text-emerald-400">Свечей загружено: {{ candlesCount }}</span>
		</div>
	</footer>
</template>