export type AlertCrossDirection = 'up' | 'down';

export interface PriceAlert {
	id: string;
	symbol: string;
	price: number;
	active: boolean;
	createdAt: number;
	triggeredAt?: number;
}

export interface TriggeredAlertEvent {
	alert: PriceAlert;
	prevPrice: number;
	currentPrice: number;
	direction: AlertCrossDirection;
	occurredAt: number;
}