import type { PriceAlert, TriggeredAlertEvent } from '../../types/alerts';

const LS_PREFIX = 'rm_chart:alerts:v1:';
const TRIGGERED_EVENTS_KEY = 'rm_chart:triggered_alert_events:v1';
const MAX_ALERTS_PER_SYMBOL = 20;

function normalizeSymbol(symbol: string): string {
	return symbol.trim().toUpperCase();
}

function getStorageKey(symbol: string): string {
	return `${LS_PREFIX}${normalizeSymbol(symbol)}`;
}

function parseAlerts(raw: string | null): PriceAlert[] {
	if (!raw) return [];
	const parsed = JSON.parse(raw) as unknown;
	if (!Array.isArray(parsed)) return [];
	return parsed.filter(isValidAlert).slice(0, MAX_ALERTS_PER_SYMBOL);
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
		Number.isFinite(obj.createdAt) &&
		(obj.triggeredAt === undefined ||
			(typeof obj.triggeredAt === 'number' && Number.isFinite(obj.triggeredAt)))
	);
}

function isValidTriggeredAlertEvent(item: unknown): item is TriggeredAlertEvent {
	if (!item || typeof item !== 'object') return false;
	const event = item as Partial<TriggeredAlertEvent>;
	return (
		isValidAlert(event.alert) &&
		typeof event.prevPrice === 'number' &&
		Number.isFinite(event.prevPrice) &&
		typeof event.currentPrice === 'number' &&
		Number.isFinite(event.currentPrice) &&
		(event.direction === 'up' || event.direction === 'down') &&
		typeof event.occurredAt === 'number' &&
		Number.isFinite(event.occurredAt)
	);
}

export function loadAlertsForSymbol(symbol: string): PriceAlert[] {
	try {
		return parseAlerts(window.localStorage.getItem(getStorageKey(symbol))).map((alert) => ({
			...alert,
			symbol: normalizeSymbol(alert.symbol),
		}));
	} catch {
		return [];
	}
}

export function loadAllAlerts(): PriceAlert[] {
	const items: PriceAlert[] = [];

	try {
		for (let index = 0; index < window.localStorage.length; index += 1) {
			const key = window.localStorage.key(index);
			if (!key?.startsWith(LS_PREFIX)) continue;
			items.push(
				...parseAlerts(window.localStorage.getItem(key)).map((alert) => ({
					...alert,
					symbol: normalizeSymbol(alert.symbol),
				}))
			);
		}
	} catch {
		return [];
	}

	return items;
}

export function saveAlertsForSymbol(symbol: string, items: readonly PriceAlert[]): void {
	try {
		const bounded = items
			.filter(isValidAlert)
			.slice(0, MAX_ALERTS_PER_SYMBOL)
			.map((alert) => ({ ...alert, symbol: normalizeSymbol(alert.symbol) }));
		window.localStorage.setItem(getStorageKey(symbol), JSON.stringify(bounded));
	} catch {
		// Игнорируем ошибки доступа / квоты localStorage
	}
}

export function loadTriggeredAlertEvents(): TriggeredAlertEvent[] {
	try {
		const raw = window.localStorage.getItem(TRIGGERED_EVENTS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];

		const seenAlertIds = new Set<string>();
		return parsed.filter((item): item is TriggeredAlertEvent => {
			if (!isValidTriggeredAlertEvent(item) || seenAlertIds.has(item.alert.id)) {
				return false;
			}
			seenAlertIds.add(item.alert.id);
			return true;
		});
	} catch {
		return [];
	}
}

export function saveTriggeredAlertEvents(events: readonly TriggeredAlertEvent[]): void {
	try {
		const seenAlertIds = new Set<string>();
		const validEvents = events.filter((event) => {
			if (!isValidTriggeredAlertEvent(event) || seenAlertIds.has(event.alert.id)) {
				return false;
			}
			seenAlertIds.add(event.alert.id);
			return true;
		});
		window.localStorage.setItem(TRIGGERED_EVENTS_KEY, JSON.stringify(validEvents));
	} catch {
		// Ignore localStorage access and quota errors, matching alert storage behavior.
	}
}