<script setup lang="ts">
import type { DrawingObject } from '../../types/drawings';

defineProps<{
	item: DrawingObject;
	x1: number;
	y1: number;
	x2: number;
	endX: number;
	selected: boolean;
}>();

defineEmits<{
	(e: 'shape-pointer-down', event: PointerEvent, item: DrawingObject): void;
	(e: 'right-handle-pointer-down', event: PointerEvent, item: DrawingObject): void;
}>();
</script>

<template>
	<g class="pointer-events-auto cursor-move" @pointerdown="$emit('shape-pointer-down', $event, item)">
		<line :x1="x1" :y1="y1" :x2="x2" :y2="y1" :stroke="item.style.color" :stroke-width="item.style.lineWidth" />
		<circle v-if="selected" :cx="endX" :cy="y1" r="4" fill="#161616" :stroke="item.style.color" stroke-width="2"
			class="cursor-ew-resize" @pointerdown="$emit('right-handle-pointer-down', $event, item)" />
		<text v-if="item.style.label" :x="endX - 6" :y="y1 - 5" text-anchor="end" :fill="item.style.color"
			class="select-none font-sans text-[11px] font-medium">
			{{ item.style.label }}
		</text>
	</g>
</template>