<script setup lang="ts">
import { Magnet, Minus, Spline, Square, X } from 'lucide-vue-next';
import { TIMEFRAMES, type Timeframe } from '../config/watchlist';
import type { DrawingKind, DrawingPreset } from '../types/drawings';

export type DataSourceType = 'bingx' | 'oanda';
export type DrawingToolType = 'none' | 'segment' | 'ray' | 'rectangle';

const props = defineProps<{
	activeSymbolLabel: string;
	activeTimeframe: Timeframe;
	activeSource: DataSourceType;
	activeTool: DrawingToolType;
	magnetEnabled: boolean;
	contractError: string | null;
	presets: readonly DrawingPreset[];
	activePresetId: string | null;
}>();

const emit = defineEmits<{
	(e: 'select-timeframe', tf: Timeframe): void;
	(e: 'select-source', source: DataSourceType): void;
	(e: 'select-tool', tool: DrawingToolType): void;
	(e: 'select-preset', preset: DrawingPreset | null): void;
	(e: 'delete-preset', presetId: string): void;
	(e: 'toggle-magnet'): void;
}>();

function presetsByKind(kind: DrawingKind): DrawingPreset[] {
	return props.presets.filter((p) => p.kind === kind);
}

function selectedPresetForKind(kind: DrawingKind): DrawingPreset | null {
	if (!props.activePresetId) return null;
	return props.presets.find((p) => p.id === props.activePresetId && p.kind === kind) ?? null;
}

function handleDraftClick(current: DrawingToolType, target: Exclude<DrawingToolType, 'none'>) {
	// Клик по кнопке создаёт дефолтный (черновой) элемент без выбранного пресета
	emit('select-preset', null);
	if (current === target && props.activePresetId === null) {
		emit('select-tool', 'none');
		return;
	}
	emit('select-tool', target);
}

function handlePresetChange(kind: DrawingKind, event: Event) {
	const id = (event.target as HTMLSelectElement).value;
	if (!id) {
		emit('select-preset', null);
		return;
	}
	const found = props.presets.find((p) => p.id === id && p.kind === kind) ?? null;
	emit('select-preset', found);
	emit('select-tool', kind);
}
</script>

<template>
	<header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
		<!-- Левая зона: логотип, символ и таймфрейм -->
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-2">
				<img src="/favicon.svg" alt="RM chart" class="h-6 w-6 shrink-0 object-contain" />
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

		<!-- Центральная зона: источник данных, инструменты разметки со встроенными пресетами и магнит -->
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

			<div class="flex items-center gap-1.5 rounded border border-slate-800 bg-[#161616] px-1.5 py-0.5 text-xs">
				<!-- Segment: кнопка черновика + встроенный список пресетов -->
				<div class="flex items-center rounded bg-neutral-900 transition"
					:class="activeTool === 'segment' ? 'ring-1 ring-amber-500/50' : ''">
					<button type="button" title="New draft Segment"
						class="flex items-center gap-1 rounded-l px-2 py-1 font-medium transition" :class="activeTool === 'segment'
							? 'bg-amber-500/20 text-amber-300'
							: 'text-slate-300 hover:bg-neutral-800'
							" @click="handleDraftClick(activeTool, 'segment')">
						<Spline class="h-3.5 w-3.5" />
						<span>Segment</span>
					</button>
					<select :value="selectedPresetForKind('segment')?.id ?? ''" aria-label="Segment presets"
						style="max-width: 88px"
						class="rounded-r border-l border-neutral-800 bg-transparent px-1 py-1 text-[11px] text-slate-300 focus:outline-none"
						@change="handlePresetChange('segment', $event)">
						<option value="" class="bg-[#161616]">Preset</option>
						<option v-for="p in presetsByKind('segment')" :key="p.id" :value="p.id" class="bg-[#161616]">
							{{ p.name }}
						</option>
					</select>
					<button v-if="selectedPresetForKind('segment')" type="button" title="Delete selected Segment preset"
						class="pr-1.5 text-neutral-400 transition hover:text-rose-400"
						@click.stop="emit('delete-preset', selectedPresetForKind('segment')!.id)">
						<X class="h-3 w-3" />
					</button>
				</div>

				<!-- Ray: кнопка черновика + встроенный список пресетов -->
				<div class="flex items-center rounded bg-neutral-900 transition"
					:class="activeTool === 'ray' ? 'ring-1 ring-amber-500/50' : ''">
					<button type="button" title="New draft Ray"
						class="flex items-center gap-1 rounded-l px-2 py-1 font-medium transition" :class="activeTool === 'ray'
							? 'bg-amber-500/20 text-amber-300'
							: 'text-slate-300 hover:bg-neutral-800'
							" @click="handleDraftClick(activeTool, 'ray')">
						<Minus class="h-3.5 w-3.5" />
						<span>Ray</span>
					</button>
					<select :value="selectedPresetForKind('ray')?.id ?? ''" aria-label="Ray presets" style="max-width: 88px"
						class="rounded-r border-l border-neutral-800 bg-transparent px-1 py-1 text-[11px] text-slate-300 focus:outline-none"
						@change="handlePresetChange('ray', $event)">
						<option value="" class="bg-[#161616]">Preset</option>
						<option v-for="p in presetsByKind('ray')" :key="p.id" :value="p.id" class="bg-[#161616]">
							{{ p.name }}
						</option>
					</select>
					<button v-if="selectedPresetForKind('ray')" type="button" title="Delete selected Ray preset"
						class="pr-1.5 text-neutral-400 transition hover:text-rose-400"
						@click.stop="emit('delete-preset', selectedPresetForKind('ray')!.id)">
						<X class="h-3 w-3" />
					</button>
				</div>

				<!-- Rectangle: кнопка черновика + встроенный список пресетов -->
				<div class="flex items-center rounded bg-neutral-900 transition"
					:class="activeTool === 'rectangle' ? 'ring-1 ring-amber-500/50' : ''">
					<button type="button" title="New draft Rectangle"
						class="flex items-center gap-1 rounded-l px-2 py-1 font-medium transition" :class="activeTool === 'rectangle'
							? 'bg-amber-500/20 text-amber-300'
							: 'text-slate-300 hover:bg-neutral-800'
							" @click="handleDraftClick(activeTool, 'rectangle')">
						<Square class="h-3.5 w-3.5" />
						<span>Rectangle</span>
					</button>
					<select :value="selectedPresetForKind('rectangle')?.id ?? ''" aria-label="Rectangle presets"
						style="max-width: 88px"
						class="rounded-r border-l border-neutral-800 bg-transparent px-1 py-1 text-[11px] text-slate-300 focus:outline-none"
						@change="handlePresetChange('rectangle', $event)">
						<option value="" class="bg-[#161616]">Preset</option>
						<option v-for="p in presetsByKind('rectangle')" :key="p.id" :value="p.id" class="bg-[#161616]">
							{{ p.name }}
						</option>
					</select>
					<button v-if="selectedPresetForKind('rectangle')" type="button" title="Delete selected Rectangle preset"
						class="pr-1.5 text-neutral-400 transition hover:text-rose-400"
						@click.stop="emit('delete-preset', selectedPresetForKind('rectangle')!.id)">
						<X class="h-3 w-3" />
					</button>
				</div>

				<span class="mx-0.5 h-4 w-px bg-slate-800" />

				<button type="button" title="Magnet to High / Low / Close" :aria-pressed="magnetEnabled"
					class="flex items-center gap-1 rounded px-2 py-1 font-medium transition" :class="magnetEnabled
						? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50'
						: 'text-slate-400 hover:bg-neutral-800 hover:text-slate-200'
						" @click="emit('toggle-magnet')">
					<Magnet class="h-3.5 w-3.5" />
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