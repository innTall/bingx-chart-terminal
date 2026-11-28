<script setup lang="ts">
import type { DrawingObject } from '../../types/drawings';

defineProps<{
	item: DrawingObject;
	left: number;
	right: number;
	yTop: number;
	yMid: number;
	yBottom: number;
	rayEnd: number;
}>();

defineEmits<{
	(e: 'shape-pointer-down', event: PointerEvent, item: DrawingObject): void;
}>();
</script>

<template>
	<g class="pointer-events-auto cursor-move" @pointerdown="$emit('shape-pointer-down', $event, item)">
		<rect :x="left" :y="Math.min(yTop, yMid)" :width="right - left" :height="Math.abs(yMid - yTop)"
			fill="#a45b67" fill-opacity="0.06" />
		<rect :x="left" :y="Math.min(yMid, yBottom)" :width="right - left"
			:height="Math.abs(yBottom - yMid)" fill="#5e8a68" fill-opacity="0.06" />

		<line :x1="left" :y1="item.direction === 'down' ? yTop : yBottom" :x2="right"
			:y2="item.direction === 'down' ? yTop : yBottom" stroke="#9ca3af" stroke-width="1" />
		<line :x1="left" :y1="yMid" :x2="rayEnd" :y2="yMid" stroke="#9ca3af" stroke-width="1" />
		<line :x1="left" :y1="item.direction === 'down' ? yBottom : yTop" :x2="right"
			:y2="item.direction === 'down' ? yBottom : yTop" stroke="#9ca3af" stroke-width="1" />

		<text v-if="item.style.label" :x="rayEnd - 7" :y="yMid - 5" text-anchor="end"
			fill="#9ca3af" class="select-none font-sans text-[11px] font-medium">
			{{ item.style.label }}
		</text>

		<rect :x="left" :y="Math.min(yTop, yBottom)" :width="Math.max(1, rayEnd - left)"
			:height="Math.max(1, Math.abs(yBottom - yTop))" fill="transparent" />
	</g>
</template>
