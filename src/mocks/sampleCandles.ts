import type { Candle } from '../types/market.ts';

export const DEFAULT_SYMBOL = 'BTC-USDT';

export const SAMPLE_CANDLES: Candle[] = [
  { time: 1700000000, open: 36000, high: 36500, low: 35800, close: 36300 },
  { time: 1700000060, open: 36300, high: 36800, low: 36200, close: 36700 },
  { time: 1700000120, open: 36700, high: 37100, low: 36500, close: 36600 },
  { time: 1700000180, open: 36600, high: 37400, low: 36550, close: 37250 },
];