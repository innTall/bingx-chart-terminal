<script setup lang="ts">
import { Camera, Bell, ChevronDown, Magnet, Square, Trash2 } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { TIMEFRAMES, type Timeframe } from '../config/watchlist';
import type { DrawingKind, DrawingPreset } from '../types/drawings';

export type DataSourceType = 'bingx' | 'oanda';
export type DrawingToolType = 'none' | 'segment' | 'ray' | 'rectangle' | 'fibo-up' | 'fibo-down';

const TOOL_CONFIG: ReadonlyArray<{
	kind: Exclude<DrawingKind, 'fibo'>;
	label: string;
}> = [
		{ kind: 'segment', label: 'Segment' },
		{ kind: 'ray', label: 'Ray' },
		{ kind: 'rectangle', label: 'Rectangle' },
	];

const props = defineProps<{
	activeSymbolLabel: string;
	activeTimeframe: Timeframe;
	activeSource: DataSourceType;
	activeTool: DrawingToolType;
	magnetEnabled: boolean;
	contractError: string | null;
	presets: readonly DrawingPreset[];
	activePresetId: string | null;
	alertPlacing: boolean;
	capturingScreenshot?: boolean;
}>();

const emit = defineEmits<{
	(e: 'select-timeframe', tf: Timeframe): void;
	(e: 'select-source', source: DataSourceType): void;
	(e: 'select-tool', tool: DrawingToolType): void;
	(e: 'select-preset', preset: DrawingPreset | null): void;
	(e: 'delete-preset', presetId: string): void;
	(e: 'toggle-magnet'): void;
	(e: 'toggle-alert-placing'): void;
	(e: 'capture-screenshot'): void;
	(e: 'clear-drawings'): void;
}>();

const toolbarRef = ref<HTMLElement | null>(null);
const openMenuKind = ref<DrawingKind | null>(null);

function presetsByKind(kind: DrawingKind): DrawingPreset[] {
	return props.presets.filter((p) => p.kind === kind);
}

function handleDraftClick(target: DrawingToolType) {
	openMenuKind.value = null;
	emit('select-preset', null);
	if (props.activeTool === target && props.activePresetId === null) {
		emit('select-tool', 'none');
		return;
	}
	emit('select-tool', target);
}

function togglePresetMenu(kind: DrawingKind) {
	openMenuKind.value = openMenuKind.value === kind ? null : kind;
}

function handlePickPreset(preset: DrawingPreset) {
	openMenuKind.value = null;
	emit('select-preset', preset);
	emit(
		'select-tool',
		preset.kind === 'fibo' ? `fibo-${preset.direction ?? 'up'}` : preset.kind
	);
}

function selectFiboDirection(direction: 'up' | 'down') {
	openMenuKind.value = null;
	emit('select-preset', null);
	const tool: DrawingToolType = direction === 'up' ? 'fibo-up' : 'fibo-down';
	emit(
		'select-tool',
		props.activeTool === tool && props.activePresetId === null ? 'none' : tool
	);
}

function handleDocumentPointerDown(event: PointerEvent) {
	if (!openMenuKind.value) return;
	const root = toolbarRef.value;
	if (root && event.target instanceof Node && !root.contains(event.target)) {
		openMenuKind.value = null;
	}
}

onMounted(() => {
	document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<template>
	<header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
		<!-- Левая зона: логотип, символ и таймфрейм -->
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-2">
				<img src="/icon-192x192.svg" alt="RM chart" class="h-6 w-6 shrink-0 object-contain" />
				<span class="text-sm font-bold tracking-wide text-slate-100">RM chart</span>
			</div>

			<span class="h-4 w-px bg-slate-800" />

			<div class="flex items-center gap-1.5">
				<span class="rounded bg-sky-500/15 px-2 py-0.5 text-sm font-bold tracking-wide text-sky-300">
					{{ activeSymbolLabel }}
				</span>
				<span class="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-300">
					{{ activeTimeframe }}
				</span>
			</div>

			<span v-if="contractError" class="text-[11px] text-amber-400">
				{{ contractError }}
			</span>
		</div>

		<!-- Центральная зона: источник данных, компактные split-кнопки элементов с пресетами и магнит -->
		<div class="flex items-center gap-2.5">
			<div class="flex items-center rounded border border-slate-800 bg-[#161616] p-0.5 text-xs">
				<button type="button" class="rounded px-2.5 py-1 font-medium transition" :class="activeSource === 'bingx'
					? 'bg-sky-600 text-white'
					: 'text-slate-400 hover:text-slate-200'
					" @click="emit('select-source', 'bingx')">
					BingX
				</button>
				<button type="button" class="rounded px-2.5 py-1 font-medium transition" :class="activeSource === 'oanda'
					? 'bg-emerald-600 text-white'
					: 'text-slate-400 hover:text-slate-200'
					" @click="emit('select-source', 'oanda')">
					Oanda
				</button>
			</div>

			<div ref="toolbarRef"
				class="flex items-center gap-1.5 rounded border border-slate-800 bg-[#161616] px-1.5 py-0.5 text-xs">
				<div v-for="tool in TOOL_CONFIG" :key="tool.kind" class="relative">
					<div class="flex items-center rounded transition"
						:class="activeTool === tool.kind ? 'ring-1 ring-slate-400/70' : ''">
						<button type="button" :aria-label="tool.label"
							class="flex items-center justify-center rounded-l border border-slate-600/80 bg-slate-700/45 px-2 py-1 font-medium transition"
							:class="activeTool === tool.kind
								? 'border-slate-400 bg-slate-600/70 text-slate-100'
								: 'text-slate-300 hover:border-slate-500 hover:bg-slate-700/70 hover:text-slate-100'
								" @click="handleDraftClick(tool.kind)">
							<svg v-if="tool.kind === 'segment'" aria-hidden="true" viewBox="0 0 16 16"
								class="h-3.5 w-3.5" fill="none">
								<path d="M3.25 12.25 12.75 3.75" stroke="currentColor" stroke-width="1.5" />
								<circle cx="3.25" cy="12.25" r="1.75" fill="currentColor" />
								<circle cx="12.75" cy="3.75" r="1.75" fill="currentColor" />
							</svg>
							<svg v-else-if="tool.kind === 'ray'" aria-hidden="true" viewBox="0 0 16 16"
								class="h-3.5 w-3.5" fill="none">
								<path d="M3.5 8h10" stroke="currentColor" stroke-width="1.5" />
								<circle cx="3.5" cy="8" r="1.75" fill="currentColor" />
							</svg>
							<Square v-else class="h-3.5 w-3.5" />
						</button>

						<button type="button" :aria-label="`${tool.label} presets`" :aria-expanded="openMenuKind === tool.kind"
							class="flex items-center rounded-r border border-l-0 border-slate-600/80 bg-neutral-900 px-1 py-1 text-slate-400 transition hover:border-slate-500 hover:bg-neutral-800 hover:text-slate-200"
							:class="openMenuKind === tool.kind ? 'bg-neutral-800 text-slate-100' : ''"
							@click.stop="togglePresetMenu(tool.kind)">
							<ChevronDown class="h-3.5 w-3.5 transition-transform"
								:class="openMenuKind === tool.kind ? 'rotate-180' : ''" />
						</button>
					</div>

					<!-- Выпадающий список пресетов -->
					<div v-if="openMenuKind === tool.kind"
						class="absolute left-0 top-full z-30 mt-1.5 max-h-64 min-w-42 overflow-y-auto rounded border border-slate-700 bg-[#161616] py-1 shadow-lg">
						<div v-if="presetsByKind(tool.kind).length === 0" class="px-2.5 py-1.5 text-[11px] text-slate-500">
							No saved presets
						</div>

						<div v-for="p in presetsByKind(tool.kind)" :key="p.id"
							class="flex items-center justify-between gap-2 px-2 py-1 text-xs transition hover:bg-neutral-800/90"
							:class="activePresetId === p.id ? 'bg-amber-500/15 text-amber-200' : 'text-slate-200'">
							<button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left"
								@click="handlePickPreset(p)">
								<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
									:style="{ backgroundColor: p.color }" />
								<span class="truncate">{{ p.name }}</span>
							</button>

							<button type="button" title="Delete preset"
								class="shrink-0 rounded p-0.5 text-slate-500 transition hover:bg-rose-950/60 hover:text-rose-400"
								@click.stop="emit('delete-preset', p.id)">
								<Trash2 class="h-3 w-3" />
							</button>
						</div>
					</div>
				</div>

				<div class="relative flex items-center rounded border border-slate-700/80 bg-neutral-900/80">
					<button type="button" aria-label="Draw Fibo up range" title="DRup (two clicks)"
						class="rounded-l px-2 py-1 font-medium transition"
						:class="activeTool === 'fibo-up' ? 'bg-rose-500/20 text-rose-200' : 'text-slate-300 hover:bg-neutral-800'"
						@click="selectFiboDirection('up')">
						DRup
					</button>
					<button type="button" aria-label="Draw Fibo down range" title="DRdown (two clicks)"
						class="border-l border-slate-700/80 px-2 py-1 font-medium transition"
						:class="activeTool === 'fibo-down' ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-300 hover:bg-neutral-800'"
						@click="selectFiboDirection('down')">
						DRdown
					</button>
					<button type="button" aria-label="Fibo presets" :aria-expanded="openMenuKind === 'fibo'"
						class="rounded-r border-l border-slate-700/80 px-1 py-1 text-slate-400 transition hover:bg-neutral-800 hover:text-slate-200"
						@click.stop="togglePresetMenu('fibo')">
						<ChevronDown class="h-3.5 w-3.5" :class="openMenuKind === 'fibo' ? 'rotate-180' : ''" />
					</button>
					<div v-if="openMenuKind === 'fibo'"
						class="absolute left-0 top-full z-30 mt-1.5 max-h-64 min-w-42 overflow-y-auto rounded border border-slate-700 bg-[#161616] py-1 shadow-lg">
						<div v-if="presetsByKind('fibo').length === 0" class="px-2.5 py-1.5 text-[11px] text-slate-500">
							No saved presets
						</div>
						<div v-for="p in presetsByKind('fibo')" :key="p.id"
							class="flex items-center justify-between gap-2 px-2 py-1 text-xs transition hover:bg-neutral-800/90"
							:class="activePresetId === p.id ? 'bg-amber-500/15 text-amber-200' : 'text-slate-200'">
							<button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left"
								@click="handlePickPreset(p)">
								<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
									:style="{ backgroundColor: p.color }" />
								<span class="truncate">{{ p.name }}</span>
							</button>
							<button type="button" title="Delete preset"
								class="shrink-0 rounded p-0.5 text-slate-500 transition hover:bg-rose-950/60 hover:text-rose-400"
								@click.stop="emit('delete-preset', p.id)">
								<Trash2 class="h-3 w-3" />
							</button>
						</div>
					</div>
				</div>

				<span class="mx-0.5 h-4 w-px bg-slate-800" />

				<button type="button" title="Magnet to High / Low / Close" :aria-pressed="magnetEnabled"
					class="flex items-center gap-1 rounded px-2 py-1 font-medium transition" :class="magnetEnabled
						? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50'
						: 'text-slate-400 hover:bg-neutral-800 hover:text-slate-200'
						" @click="emit('toggle-magnet')">
					<Magnet class="h-3.5 w-3.5" />
				</button>

				<button type="button" title="Place price alert" aria-label="Place price alert" :aria-pressed="alertPlacing"
					class="flex items-center justify-center rounded border px-2 py-1 transition" :class="alertPlacing
							? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
							: 'border-slate-700/80 bg-neutral-900/80 text-slate-400 hover:border-slate-600 hover:bg-neutral-800 hover:text-slate-200'
						" @click="emit('toggle-alert-placing')">
					<Bell class="h-3.5 w-3.5" />
				</button>

				<button type="button" title="Clear all drawings for this symbol"
						aria-label="Clear all drawings for this symbol"
						class="flex items-center justify-center rounded border border-slate-700/80 bg-neutral-900/80 px-2 py-1 text-slate-400 transition hover:border-rose-700/70 hover:bg-rose-950/40 hover:text-rose-300"
						@click="emit('clear-drawings')">
						<Trash2 class="h-3.5 w-3.5" />
				</button>

				<button type="button" title="Send chart screenshot to Telegram" aria-label="Send chart screenshot to Telegram"
					:disabled="capturingScreenshot"
					class="flex items-center justify-center rounded border border-slate-700/80 bg-neutral-900/80 px-2 py-1 text-slate-400 transition hover:border-slate-600 hover:bg-neutral-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
					@click="emit('capture-screenshot')">
					<Camera class="h-3.5 w-3.5" :class="capturingScreenshot ? 'animate-pulse text-sky-300' : ''" />	
				</button>
			</div>
		</div>

		<!-- Правая зона: таймфреймы -->
		<nav aria-label="Timeframes" class="flex items-center gap-1">
			<button v-for="tf in TIMEFRAMES" :key="tf" type="button"
				class="rounded px-2.5 py-1 text-xs font-medium transition" :class="activeTimeframe === tf
					? 'bg-sky-600 text-white'
					: 'bg-neutral-900 text-slate-300 hover:bg-neutral-800'
					" @click="emit('select-timeframe', tf)">
				{{ tf }}
			</button>
		</nav>
	</header>
</template>