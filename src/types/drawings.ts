import type { UTCTimestamp } from 'lightweight-charts';

export type DrawingKind = 'ray' | 'rectangle';

export interface PriceTimePoint {
  time: UTCTimestamp;
  price: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  label: string;
}

export interface DrawingObject {
  id: string;
  symbol: string;
  kind: DrawingKind;
  /** Для луча — опорная точка; для прямоугольника — первый угол (t1, p1) */
  start: PriceTimePoint;
  /** Для прямоугольника — второй угол (t2, p2) */
  end?: PriceTimePoint;
  style: DrawingStyle;
}

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: '#f59e0b',
  lineWidth: 1.5,
  label: '',
};

export const DRAWING_COLOR_PRESETS: readonly string[] = [
  '#f59e0b',
  '#38bdf8',
  '#22c55e',
  '#f43f5e',
  '#a855f7',
  '#e2e8f0',
];

export const DRAWING_WIDTH_PRESETS: readonly number[] = [1, 1.5, 2, 3];