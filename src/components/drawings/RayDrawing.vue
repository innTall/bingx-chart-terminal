<script setup lang="ts">
import type { DrawingObject } from '../../types/drawings';

defineProps<{
	item: DrawingObject;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}>();

defineEmits<{
	(e: 'shape-pointer-down', event: PointerEvent, item: DrawingObject): void;
}>();
</script>

<template>
	<g class="pointer-events-auto cursor-move" @pointerdown="$emit('shape-pointer-down', $event, item)">
		<line :x1="x1" :y1="y1" :x2="x2" :y2="y2" :stroke="item.style.color" :stroke-width="item.style.lineWidth" />
		<text v-if="item.style.label" :x="x2 - 6" :y="y1 - 5" text-anchor="end" :fill="item.style.color"
			class="select-none font-sans text-[11px] font-medium">
			{{ item.style.label }}
		</text>
	</g>
</template>