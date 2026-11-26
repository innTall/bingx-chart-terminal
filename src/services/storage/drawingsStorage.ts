import type { DrawingObject } from '../../types/drawings';

const LS_PREFIX = 'rm_chart:drawings:v1:';
const MAX_OBJECTS_PER_SYMBOL = 20;

// Элемент считается «именным» только при непустой текстовой метке
function hasLabel(item: unknown): item is DrawingObject {
	if (!item || typeof item !== 'object') return false;
	const obj = item as DrawingObject;
	return typeof obj.style?.label === 'string' && obj.style.label.trim().length > 0;
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