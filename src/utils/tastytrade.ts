/**
 * TastyTrade API integration for live option prices.
 * Uses the Open API at https://api.tastyworks.com
 *
 * Requires VITE_TASTYTRADE_TOKEN env var (session token).
 * Generate token by POSTing to /sessions with your credentials.
 */

const API_BASE = 'https://api.tastyworks.com';

interface OptionQuote {
  symbol: string;         // OCC symbol
  bid: number;
  ask: number;
  last: number;
  mid: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
}

/**
 * Build OCC option symbol from trade details.
 * Format: SYMBOL  YYMMDD C/P STRIKE (padded to 21 chars)
 * Example: SPY   260718P00550000
 */
export function buildOccSymbol(
  underlying: string,
  expirationDate: Date,
  optionType: 'Call' | 'Put',
  strikePrice: number,
): string {
  const sym = underlying.padEnd(6, ' ');
  const exp = expirationDate;
  const yy = String(exp.getFullYear()).slice(2);
  const mm = String(exp.getMonth() + 1).padStart(2, '0');
  const dd = String(exp.getDate()).padStart(2, '0');
  const cp = optionType === 'Call' ? 'C' : 'P';
  const strike = String(Math.round(strikePrice * 1000)).padStart(8, '0');
  return `${sym}${yy}${mm}${dd}${cp}${strike}`;
}

/**
 * Fetch option quotes from TastyTrade market data API.
 * Returns a map of OCC symbol -> quote data.
 */
export async function fetchOptionQuotes(
  occSymbols: string[],
  sessionToken: string,
): Promise<Map<string, OptionQuote>> {
  if (occSymbols.length === 0) return new Map();

  const results = new Map<string, OptionQuote>();

  // TastyTrade uses the market-data endpoint for streamer tokens,
  // but for simple quote lookup we use the instruments endpoint
  try {
    const response = await fetch(
      `${API_BASE}/market-data/chains/AAPL/nested`, // Placeholder - actual implementation needs streamer
      {
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn('TastyTrade API unavailable:', response.status);
      return results;
    }

    // Parse response and map to our format
    const data = await response.json();
    // Note: Actual implementation depends on TastyTrade's response format
    // This is a placeholder structure
    if (data?.data?.items) {
      for (const item of data.data.items) {
        results.set(item.symbol, {
          symbol: item.symbol,
          bid: item.bid ?? 0,
          ask: item.ask ?? 0,
          last: item.last ?? 0,
          mid: ((item.bid ?? 0) + (item.ask ?? 0)) / 2,
          volume: item.volume ?? 0,
          openInterest: item['open-interest'] ?? 0,
          impliedVolatility: item['implied-volatility'] ?? 0,
        });
      }
    }
  } catch (err) {
    console.warn('TastyTrade fetch failed:', err);
  }

  return results;
}

/**
 * Check if TastyTrade token is configured.
 */
export function hasTastyTradeToken(): boolean {
  return !!import.meta.env.VITE_TASTYTRADE_TOKEN;
}

/**
 * Get the configured TastyTrade session token.
 */
export function getTastyTradeToken(): string {
  return import.meta.env.VITE_TASTYTRADE_TOKEN || '';
}
