import type { UTCTimestamp } from 'lightweight-charts';
import type { Timeframe } from '../config/watchlist';

export type DrawingKind = 'ray' | 'rectangle' | 'segment' | 'fibo';
export type FiboDirection = 'up' | 'down';

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
  direction?: FiboDirection;
  /** Timeframe the drawing was created on; omitted only for legacy saved drawings. */
  sourceTimeframe?: Timeframe;
  /** Для луча и отрезка — опорная точка; для прямоугольника — первый угол (t1, p1) */
  start: PriceTimePoint;
  /** Для прямоугольника — второй угол (t2, p2); для отрезка — конечная точка (t2, price) */
  end?: PriceTimePoint;
  style: DrawingStyle;
}

export interface DrawingPreset {
  id: string;
  name: string;
  kind: DrawingKind;
  direction?: FiboDirection;
  color: string;
  lineWidth: number;
  label: string;
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

export const INITIAL_DRAWING_PRESETS: readonly DrawingPreset[] = [
  {
    id: 'preset-ray-ff-1h',
    name: 'FF 1h',
    kind: 'ray',
    color: '#38bdf8',
    lineWidth: 1,
    label: 'FF 1h',
  },
  {
    id: 'preset-ray-high-1d',
    name: 'High 1D',
    kind: 'ray',
    color: '#f43f5e',
    lineWidth: 2,
    label: 'High 1D',
  },
  {
    id: 'preset-rect-snr-4h',
    name: 'SNR 4h',
    kind: 'rectangle',
    color: '#22c55e',
    lineWidth: 1.5,
    label: 'SNR 4h',
  },
  {
    id: 'preset-rect-fvg-1h',
    name: 'FVG 1h',
    kind: 'rectangle',
    color: '#f59e0b',
    lineWidth: 1.5,
    label: 'FVG 1h',
  },
  {
    id: 'preset-seg-hlc',
    name: 'HLC level',
    kind: 'segment',
    color: '#a855f7',
    lineWidth: 1.5,
    label: 'HLC',
  },
];