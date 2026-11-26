<script setup lang="ts">
import type { DrawingObject } from '../../types/drawings';

defineProps<{
	item: DrawingObject;
	left: number;
	top: number;
	width: number;
	height: number;
	selected: boolean;
}>();

defineEmits<{
	(e: 'shape-pointer-down', event: PointerEvent, item: DrawingObject): void;
	(e: 'right-handle-pointer-down', event: PointerEvent, item: DrawingObject): void;
}>();
</script>

<template>
	<g class="pointer-events-auto cursor-move" @pointerdown="$emit('shape-pointer-down', $event, item)">
		<rect :x="left" :y="top" :width="width" :height="height" stroke="none" :fill="item.style.color"
			fill-opacity="0.14" />
		<circle v-if="selected" :cx="left + width" :cy="top + height / 2" r="4" fill="#161616" :stroke="item.style.color"
			stroke-width="2" class="cursor-ew-resize" @pointerdown="$emit('right-handle-pointer-down', $event, item)" />
		<text v-if="item.style.label" :x="left + width - 6" :y="top + height / 2 + 4" text-anchor="end"
			:fill="item.style.color" class="select-none font-sans text-[11px] font-medium">
			{{ item.style.label }}
		</text>
	</g>
</template>