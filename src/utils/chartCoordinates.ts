import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export const UTC_PLUS_2_OFFSET_SEC = 2 * 60 * 60;

export function toChartTimestamp(time: number): UTCTimestamp {
	return (time + UTC_PLUS_2_OFFSET_SEC) as UTCTimestamp;
}

export function fromChartTimestamp(time: number): UTCTimestamp {
	return Math.max(0, time - UTC_PLUS_2_OFFSET_SEC) as UTCTimestamp;
}

export function priceToCoordinate(
	series: ISeriesApi<'Candlestick'> | null,
	price: number
): number | null {
	if (!series || !Number.isFinite(price)) return null;
	const y = series.priceToCoordinate(price);
	return y !== null && Number.isFinite(y) ? y : null;
}

export function coordinateToPrice(
	series: ISeriesApi<'Candlestick'> | null,
	y: number
): number | null {
	if (!series || !Number.isFinite(y)) return null;
	const price = series.coordinateToPrice(y);
	return price !== null && Number.isFinite(price) ? price : null;
}

export function timeToCoordinate(
	chart: IChartApi | null,
	time: number
): number | null {
	if (!chart || !Number.isFinite(time)) return null;
	const x = chart.timeScale().timeToCoordinate(toChartTimestamp(time));
	return x !== null && Number.isFinite(x) ? x : null;
}

export function coordinateToTime(
	chart: IChartApi | null,
	x: number
): UTCTimestamp | null {
	const chartTime = coordinateToChartTime(chart, x);
	return chartTime === null ? null : fromChartTimestamp(Number(chartTime));
}

export function coordinateToChartTime(
	chart: IChartApi | null,
	x: number
): UTCTimestamp | null {
	if (!chart || !Number.isFinite(x)) return null;
	const time = chart.timeScale().coordinateToTime(x);
	return typeof time === 'number' && Number.isFinite(time)
		? (time as UTCTimestamp)
		: null;
}
