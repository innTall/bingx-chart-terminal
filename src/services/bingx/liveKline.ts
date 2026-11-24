import type { Timeframe } from '../../config/watchlist';
import type { Candle } from '../../types/market';
import { fetchBingxKlines } from './klines';

export interface LiveKlineSubscription {
  stop: () => void;
}

export function startLiveKlineStream(params: {
  symbol: string;
  timeframe: Timeframe;
  pollIntervalMs?: number;
  onCandle: (candle: Candle) => void;
  onError?: (message: string) => void;
}): LiveKlineSubscription {
  const {
    symbol,
    timeframe,
    pollIntervalMs = 2000,
    onCandle,
    onError,
  } = params;

  let stopped = false;
  let timerId: number | null = null;
  let controller: AbortController | null = null;

  const tick = async () => {
    if (stopped) return;

    controller?.abort();
    controller = new AbortController();

    try {
      const recent = await fetchBingxKlines({
        symbol,
        interval: timeframe,
        limit: 3,
        signal: controller.signal,
      });

      if (stopped || recent.length === 0) return;
      const latest = recent[recent.length - 1];
      if (latest) {
        onCandle(latest);
      }
    } catch (err) {
      if (stopped || controller.signal.aborted) return;
      if (onError) {
        onError(err instanceof Error ? err.message : 'Ошибка живого обновления');
      }
    } finally {
      if (!stopped) {
        timerId = window.setTimeout(() => {
          void tick();
        }, pollIntervalMs);
      }
    }
  };

  timerId = window.setTimeout(() => {
    void tick();
  }, pollIntervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      controller?.abort();
      controller = null;
    },
  };
}