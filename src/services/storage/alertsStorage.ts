import type { PriceAlert } from '../../types/alerts';

const LS_PREFIX = 'rm_chart:alerts:v1:';
const MAX_ALERTS_PER_SYMBOL = 20;

function normalizeSymbol(symbol: string): string {
	return symbol.trim().toUpperCase();
}

function getStorageKey(symbol: string): string {
	return `${LS_PREFIX}${normalizeSymbol(symbol)}`;
}

function isValidAlert(item: unknown): item is PriceAlert {
	if (!item || typeof item !== 'object') return false;
	const obj = item as Partial<PriceAlert>;
	return (
		typeof obj.id === 'string' &&
		obj.id.length > 0 &&
		typeof obj.symbol === 'string' &&
		obj.symbol.length > 0 &&
		typeof obj.price === 'number' &&
		Number.isFinite(obj.price) &&
		obj.price > 0 &&
		typeof obj.active === 'boolean' &&
		typeof obj.createdAt === 'number' &&
		Number.isFinite(obj.createdAt)
	);
}

export function loadAlertsForSymbol(symbol: string): PriceAlert[] {
	try {
		const raw = window.localStorage.getItem(getStorageKey(symbol));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isValidAlert).slice(0, MAX_ALERTS_PER_SYMBOL);
	} catch {
		return [];
	}
}

export function saveAlertsForSymbol(symbol: string, items: readonly PriceAlert[]): void {
	try {
		const bounded = items.filter(isValidAlert).slice(0, MAX_ALERTS_PER_SYMBOL);
		window.localStorage.setItem(getStorageKey(symbol), JSON.stringify(bounded));
	} catch {
		// Игнорируем ошибки доступа / квоты localStorage
	}
}