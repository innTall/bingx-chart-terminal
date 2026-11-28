<script setup lang="ts">
import { BookmarkPlus, Trash2 } from 'lucide-vue-next';
import {
	DRAWING_COLOR_PRESETS,
	DRAWING_WIDTH_PRESETS,
	type DrawingObject,
} from '../../types/drawings';

defineProps<{
	drawing: DrawingObject;
}>();

const emit = defineEmits<{
	(e: 'update-style', patch: Partial<DrawingObject['style']>): void;
	(e: 'save-preset'): void;
	(e: 'delete'): void;
}>();

function onWidthChange(event: Event) {
	const target = event.target as HTMLSelectElement;
	emit('update-style', { lineWidth: Number(target.value) });
}

function onLabelInput(event: Event) {
	const target = event.target as HTMLInputElement;
	emit('update-style', { label: target.value });
}
</script>

<template>
	<div
		class="pointer-events-auto absolute right-3 top-2.5 z-20 flex flex-wrap items-center gap-2 rounded border border-slate-700 bg-[#161616]/95 px-2.5 py-1.5 text-xs text-slate-200 shadow"
		@pointerdown.stop>
		<div class="flex items-center gap-1">
			<button v-for="hex in DRAWING_COLOR_PRESETS" :key="hex" type="button"
				class="h-4 w-4 rounded-full border transition" :class="drawing.style.color === hex
						? 'scale-110 border-white'
						: 'border-slate-600 opacity-80 hover:opacity-100'
					" :style="{ backgroundColor: hex }" @click="emit('update-style', { color: hex })" />
		</div>

		<select :value="drawing.style.lineWidth" aria-label="Line width"
			class="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
			@change="onWidthChange">
			<option v-for="w in DRAWING_WIDTH_PRESETS" :key="w" :value="w">
				{{ w }}px
			</option>
		</select>

		<input type="text" :value="drawing.style.label" placeholder="Label..." maxlength="60"
			class="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
			@input="onLabelInput" />

		<button v-if="drawing.kind !== 'buy_sell'" type="button" title="Save as preset"
			class="rounded p-1 text-amber-300 transition hover:bg-amber-950/50 hover:text-amber-200"
			@click="emit('save-preset')">
			<BookmarkPlus class="h-3.5 w-3.5" />
		</button>

		<button type="button" title="Delete drawing"
			class="rounded p-1 text-rose-400 transition hover:bg-rose-950/60 hover:text-rose-300" @click="emit('delete')">
			<Trash2 class="h-3.5 w-3.5" />
		</button>
	</div>
</template>