import type { DrawingObject } from '../../types/drawings';

const LS_PREFIX = 'rm_chart:drawings:v1:';
const MAX_OBJECTS_PER_SYMBOL = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPriceTimePoint(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return (
		typeof value.time === 'number' &&
		Number.isFinite(value.time) &&
		value.time > 0 &&
		typeof value.price === 'number' &&
		Number.isFinite(value.price) &&
		value.price > 0
	);
}

function hasLabel(item: unknown): item is DrawingObject {
	if (!isRecord(item) || !isRecord(item.style)) return false;
	if (item.kind !== 'ray' && item.kind !== 'rectangle' && item.kind !== 'segment') {
		return false;
	}

	const style = item.style;
	return (
		typeof item.id === 'string' &&
		item.id.length > 0 &&
		typeof item.symbol === 'string' &&
		item.symbol.length > 0 &&
		isPriceTimePoint(item.start) &&
		(item.end === undefined || isPriceTimePoint(item.end)) &&
		typeof style.color === 'string' &&
		style.color.length > 0 &&
		typeof style.lineWidth === 'number' &&
		Number.isFinite(style.lineWidth) &&
		style.lineWidth > 0 &&
		typeof style.label === 'string' &&
		style.label.trim().length > 0
	);
}

function filterLabeledDrawings(items: unknown): DrawingObject[] {
	if (!Array.isArray(items)) return [];
	return items.filter(hasLabel);
}

function getStorageKey(symbol: string): string {
	return `${LS_PREFIX}${symbol.trim().toUpperCase()}`;
}

export function loadDrawingsForSymbol(symbol: string): DrawingObject[] {
	try {
		const raw = window.localStorage.getItem(getStorageKey(symbol));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return filterLabeledDrawings(parsed).slice(0, MAX_OBJECTS_PER_SYMBOL);
	} catch {
		return [];
	}
}

export function saveDrawingsForSymbol(symbol: string, items: readonly DrawingObject[]): void {
	try {
		// В постоянную память символа пишем только элементы с текстовой меткой
		const bounded = filterLabeledDrawings(items).slice(0, MAX_OBJECTS_PER_SYMBOL);
		window.localStorage.setItem(getStorageKey(symbol), JSON.stringify(bounded));
	} catch {
		// Игнорируем возможные ошибки записи в localStorage (например, квота)
	}
}