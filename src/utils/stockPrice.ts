/**
 * Fetch current stock prices and dividend data via Supabase Edge Function.
 * The edge function proxies Yahoo Finance to avoid CORS issues.
 *
 * Deploy the edge function first:
 *   supabase functions deploy stock-quote
 */

import { supabase } from '../lib/supabase';

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dividendYield: number;  // Annual yield as percentage (e.g., 5.2 = 5.2%)
  dividendRate: number;   // Annual dividend per share in $
  dividendFrequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'none';
  name: string;
}

/**
 * Fetch quotes for multiple symbols via the Supabase Edge Function.
 * Returns a map of symbol → quote data.
 */
export async function fetchStockQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
  const priceMap = new Map<string, StockQuote>();
  if (symbols.length === 0) return priceMap;

  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];

  try {
    // Get the Supabase project URL for the edge function
    const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
      ?? import.meta.env.VITE_SUPABASE_URL
      ?? '';

    const functionUrl = `${supabaseUrl}/functions/v1/stock-quote?symbols=${unique.join(',')}`;

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(functionUrl, {
      headers: {
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
    });

    if (!response.ok) return priceMap;

    const result = await response.json();
    const quotes = result.quotes ?? {};

    for (const [symbol, data] of Object.entries(quotes)) {
      const q = data as StockQuote & { symbol?: string };
      priceMap.set(symbol, { ...q, symbol });
    }
  } catch {
    // Silently fail — prices will show as manual entry
  }

  return priceMap;
}

/**
 * Fetch quote for a single symbol.
 */
export async function fetchStockPrice(symbol: string): Promise<StockQuote | null> {
  const map = await fetchStockQuotes([symbol]);
  return map.get(symbol.toUpperCase()) ?? null;
}
