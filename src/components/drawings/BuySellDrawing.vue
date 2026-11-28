<script setup lang="ts">
import type { DrawingObject } from '../../types/drawings';

defineProps<{
	item: DrawingObject;
	left: number;
	right: number;
	yEntry: number;
	yTarget: number;
	yStop: number;
	yTop: number;
	yBottom: number;
	entryLabel: string;
	targetLabel: string;
	stopLabel: string;
	selected: boolean;
}>();

const emit = defineEmits<{
	(e: 'entry-pointer-down', event: PointerEvent, item: DrawingObject): void;
	(e: 'level-pointer-down', event: PointerEvent, item: DrawingObject, level: 'top' | 'bottom'): void;
	(e: 'width-pointer-down', event: PointerEvent, item: DrawingObject): void;
}>();
</script>

<template>
	<g class="pointer-events-auto">
		<rect :x="left" :y="Math.min(yEntry, yTarget)" :width="right - left"
			:height="Math.abs(yTarget - yEntry)" fill="#22c55e" fill-opacity="0.11"
			class="pointer-events-none" />
		<rect :x="left" :y="Math.min(yEntry, yStop)" :width="right - left"
			:height="Math.abs(yStop - yEntry)" fill="#f43f5e" fill-opacity="0.11"
			class="pointer-events-none" />

		<line :x1="left" :y1="yTarget" :x2="right" :y2="yTarget" stroke="#4ade80" stroke-width="1" />
		<line :x1="left" :y1="yEntry" :x2="right" :y2="yEntry" stroke="#60a5fa" stroke-width="1" />
		<line :x1="left" :y1="yStop" :x2="right" :y2="yStop" stroke="#fb7185" stroke-width="1" />

		<line :x1="left" :y1="yEntry" :x2="right" :y2="yEntry" stroke="transparent" stroke-width="10"
			class="cursor-move" @pointerdown="emit('entry-pointer-down', $event, item)" />

		<text :x="right - 5" :y="yTarget - 5" text-anchor="end" fill="#86efac"
			class="pointer-events-none select-none font-sans text-[10px] font-medium">
			{{ targetLabel }}
		</text>
		<text :x="right - 5" :y="yEntry - 5" text-anchor="end" fill="#93c5fd"
			class="pointer-events-none select-none font-sans text-[10px] font-medium">
			{{ entryLabel }}
		</text>
		<text :x="right - 5" :y="yStop - 5" text-anchor="end" fill="#fda4af"
			class="pointer-events-none select-none font-sans text-[10px] font-medium">
			{{ stopLabel }}
		</text>

		<template v-if="selected">
			<circle :cx="left" :cy="yTop" r="4" fill="#161616" stroke="#cbd5e1" stroke-width="1.5"
				class="cursor-ns-resize"
				@pointerdown="emit('level-pointer-down', $event, item, 'top')" />
			<circle :cx="left" :cy="yBottom" r="4" fill="#161616" stroke="#cbd5e1" stroke-width="1.5"
				class="cursor-ns-resize"
				@pointerdown="emit('level-pointer-down', $event, item, 'bottom')" />
			<circle :cx="right" :cy="yEntry" r="4" fill="#161616" stroke="#cbd5e1" stroke-width="1.5"
				class="cursor-ew-resize" @pointerdown="emit('width-pointer-down', $event, item)" />
		</template>
	</g>
</template>
