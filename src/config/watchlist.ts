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
  'ETC-USDT',
  'SOL-USDT',
  'BNB-USDT',
  'XRP-USDT',
  'DOGE-USDT',
  'ADA-USDT',
  'AVAX-USDT',
  'LINK-USDT',
  'DOT-USDT',
  'TRX-USDT',
  'NEAR-USDT',
  'LTC-USDT',
  'BCH-USDT',
  'UNI-USDT',
  'APT-USDT',
  'ARB-USDT',
  'OP-USDT',
  'SUI-USDT',
  'FIL-USDT',
  'ATOM-USDT',
  'INJ-USDT',
  'TIA-USDT',
  'SEI-USDT',
  'PEPE-USDT',
  'WIF-USDT',
  'AAVE-USDT',
  'MKR-USDT',
  'RENDER-USDT',
  'FET-USDT',
  'ALGO-USDT',
  'EOS-USDT',
  'SAND-USDT',
  'MANA-USDT',
  'GALA-USDT',
  'CRV-USDT',
  'LDO-USDT',
  'RUNE-USDT',
  'HBAR-USDT',
];

/** Преобразует 'BTC-USDT' в чистое имя 'BTC' для отображения в UI */
export function toDisplaySymbol(apiSymbol: string): string {
  const normalized = apiSymbol.trim().toUpperCase();
  const dashIndex = normalized.indexOf('-');
  return dashIndex > 0 ? normalized.slice(0, dashIndex) : normalized;
}