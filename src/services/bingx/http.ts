import { BINGX_CONFIG } from '../../config/watchlist';

export interface BingxEnvelope<T> {
  code?: number | string;
  msg?: string;
  data?: T;
}

function resolveBaseUrl(): string {
  const proxy = BINGX_CONFIG.proxyBaseUrl?.trim();
  if (proxy) {
    return proxy.replace(/\/+$/, '');
  }
  return BINGX_CONFIG.directBaseUrl.replace(/\/+$/, '');
}

export function buildBingxUrl(
  path: string,
  params?: Record<string, string | number | undefined>
): string {
  const base = resolveBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`, window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function isTransientBingxMsg(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    msg.includes('请稍后重试') ||
    lower.includes('system error') ||
    lower.includes('busy')
  );
}

function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function bingxGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  externalSignal?: AbortSignal,
  maxRetries = 3,
  retryDelayMs = 600
): Promise<T> {
  const url = buildBingxUrl(path, params);
  let delay = retryDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, BINGX_CONFIG.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries) {
          await waitMs(delay, externalSignal);
          delay *= 2;
          continue;
        }
        throw new Error(`BingX HTTP ${response.status}`);
      }

      const payload = (await response.json()) as BingxEnvelope<T> | T;

      if (
        payload &&
        typeof payload === 'object' &&
        'code' in payload &&
        payload.code !== undefined &&
        Number(payload.code) !== 0
      ) {
        const msg = payload.msg ?? 'Unknown error';
        if (isTransientBingxMsg(msg) && attempt < maxRetries) {
          await waitMs(delay, externalSignal);
          delay *= 2;
          continue;
        }
        throw new Error(`BingX API error ${payload.code}: ${msg}`);
      }

      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data as T;
      }

      return payload as T;
    } catch (err) {
      if (externalSignal?.aborted) {
        throw err;
      }
      if (attempt < maxRetries) {
        await waitMs(delay, externalSignal);
        delay *= 2;
        continue;
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw new Error('BingX request failed');
}