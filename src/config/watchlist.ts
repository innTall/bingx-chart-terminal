export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

export interface BingxConfig {
  directBaseUrl: string;
  proxyBaseUrl?: string;
  klinesLimit: number;
  requestTimeoutMs: number;
}

export const TIMEFRAMES: readonly Timeframe[] = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1D',
];

export const BINGX_CONFIG: BingxConfig = {
  directBaseUrl: 'https://open-api.bingx.com',
  // Для локальной разработки в Chrome через Vite proxy можно задать '/bingx'
  proxyBaseUrl: '/bingx',
  klinesLimit: 500,
  requestTimeoutMs: 8000,
};

export const WATCHLIST_SYMBOLS: readonly string[] = [
  'BTC-USDT',
  'ETH-USDT',
  'SOL-USDT',
  'AAVE-USDT',
  'ADA-USDT',
  'ALGO-USDT',
  'ATOM-USDT',
  'AVAX-USDT',
  'BCH-USDT',
  'BNB-USDT',
  'DASH-USDT',
  'DOGE-USDT',
  'DOT-USDT',
  'ETC-USDT',
  'FET-USDT',
  'FIL-USDT',
  'HYPE-USDT',
  'INJ-USDT',
  'JTO-USDT',
	'JUP-USDT',
	'LDO-USDT',
  'LINK-USDT',
  'LTC-USDT',
  'NEAR-USDT',
  'SEI-USDT',
  'SUI-USDT',
  'TAO-USDT',
  'UNI-USDT',
  'WIF-USDT',
  'WLD-USDT',
  'XLM-USDT',
  'XMR-USDT',
  'XRP-USDT',
  'ZEC-USDT',
  'ZRO-USDT',
];

/** Преобразует 'BTC-USDT' в чистое имя 'BTC' для отображения в UI */
export function toDisplaySymbol(apiSymbol: string): string {
  const normalized = apiSymbol.trim().toUpperCase();
  const dashIndex = normalized.indexOf('-');
  return dashIndex > 0 ? normalized.slice(0, dashIndex) : normalized;
}