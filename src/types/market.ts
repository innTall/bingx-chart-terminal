export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

export interface RawBingxCandle {
  time: number | string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

export interface Candle {
  time: number; // Unix timestamp в секундах (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TickerPrice {
  symbol: string;
  price: number;
  updatedAt: number;
}