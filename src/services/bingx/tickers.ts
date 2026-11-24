import { toDisplaySymbol, WATCHLIST_SYMBOLS } from '../../config/watchlist';
import { bingxGet } from './http';

export interface MarketSymbolItem {
  /** Контрактный символ для API BingX, например 'BTC-USDT' */
  symbol: string;
  /** Чистое имя для UI, например 'BTC' */
  label: string;
  /** Последняя/опорная цена, если возвращается эндпоинтом */
  price: number | null;
}

function toOptionalPositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export async function fetchBingxContracts(
  symbols: readonly string[] = WATCHLIST_SYMBOLS,
  signal?: AbortSignal
): Promise<MarketSymbolItem[]> {
  const filterSet = new Set(symbols.map((s) => s.trim().toUpperCase()));

  const rawData = await bingxGet<unknown>(
    '/openApi/swap/v2/quote/contracts',
    symbols.length === 1 ? { symbol: symbols[0].trim().toUpperCase() } : undefined,
    signal
  );

  const list = Array.isArray(rawData)
    ? rawData
    : rawData && typeof rawData === 'object' && 'contracts' in rawData && Array.isArray((rawData as { contracts: unknown[] }).contracts)
      ? (rawData as { contracts: unknown[] }).contracts
      : [];

  const items: MarketSymbolItem[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const rawSymbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : '';

    if (!rawSymbol) continue;
    if (filterSet.size > 0 && !filterSet.has(rawSymbol)) continue;

    const price = toOptionalPositiveNumber(
      row.lastPrice ?? row.price ?? row.markPrice ?? row.indexPrice
    );

    items.push({
      symbol: rawSymbol,
      label: toDisplaySymbol(rawSymbol),
      price,
    });
  }

  // Если API вернул пустой список (например, при нестандартном ответе), сохраняем конфигурируемый список
  if (items.length === 0 && symbols.length > 0) {
    return symbols.map((sym) => {
      const normalized = sym.trim().toUpperCase();
      return {
        symbol: normalized,
        label: toDisplaySymbol(normalized),
        price: null,
      };
    });
  }

  return items;
}