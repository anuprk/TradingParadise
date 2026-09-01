/**
 * Discord trade-alert parser (proof-of-concept).
 *
 * Best-effort heuristic parser that turns free-form Discord trade-alert
 * messages into a structured {@link ParsedTradeAlert}. Alerts come from many
 * communities with wildly different formats, so extraction is regex/keyword
 * driven and every structured field is optional. Precision is favored over
 * recall: when a field cannot be confidently extracted it is left null rather
 * than guessed.
 *
 * The parser is a pure function and fully deterministic: the same input always
 * yields the same output, including a stable {@link ParsedTradeAlert.messageId}
 * derived from a small inline FNV-1a hash of community + chatRoom + rawContent.
 *
 * This module is a standalone POC. It is intentionally not wired into the UI,
 * database, routing, or Supabase.
 */

// --- Public types ---

export type AlertActionType = 'Open' | 'Adjust' | 'Close' | 'Unclassified';
export type AlertDirection = 'buy' | 'sell';
export type AmountKind = 'credit' | 'debit';

export interface ParsedTradeAlert {
  actionType: AlertActionType;
  symbol: string | null;
  strategy: string | null;
  expiration: string | null;
  strikes: string | null;
  direction: AlertDirection | null;
  fillPrice: number | null;
  amount: number | null;
  amountKind: AmountKind | null;
  links: string[];
  rawContent: string;
  messageId: string;
  extractedAnyField: boolean;
}

// --- Constants ---

const MAX_LINKS = 50;

/**
 * Common English/formatting words that must never be mistaken for a ticker
 * symbol even though they look like short uppercase tokens.
 */
const SYMBOL_STOPWORDS = new Set<string>([
  'BTO',
  'STO',
  'BTC',
  'STC',
  'NEW',
  'OPEN',
  'TRADE',
  'CLOSE',
  'BUY',
  'SELL',
  'CALL',
  'PUT',
  'SPREAD',
  'VERTICAL',
  'LMT',
  'THE',
  'AND',
  'FOR',
  'PER',
  'MAX',
  'LMTS',
  'IRON',
  'CONDOR',
  'CREDIT',
  'DEBIT',
  'PT',
  'SL',
  'POP',
  'ROLL',
  'ADJUST',
  'STRATEGY',
  'FILLED',
  'AT',
  'EXPIRING',
  'SENTIMENT',
  'MARGIN',
  'POTENTIAL',
  'RETURN',
  'PREMIUM',
]);

// --- Small inline FNV-1a string hash (32-bit) ---

/**
 * FNV-1a 32-bit string hash, returned as an 8-char lowercase hex string.
 * Deterministic and dependency-free; suitable for a stable POC message id.
 */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit range via Math.imul
    hash = Math.imul(hash, 0x01000193);
  }
  // Coerce to unsigned 32-bit and hex-encode.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function computeMessageId(community: string, chatRoom: string, rawContent: string): string {
  return fnv1aHash(`${community}\u0000${chatRoom}\u0000${rawContent}`);
}

// --- Number parsing ---

/** Strips $ and commas and parses a numeric value, returning null on failure. */
function parseAmountNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

// --- Classification ---

/**
 * Keyword groups for action classification. Ordering within each group does
 * not matter; determinism comes from scanning the raw text for the earliest
 * occurring keyword across all groups (see classifyAction).
 */
const OPEN_KEYWORDS = [
  'bto',
  'sto',
  'new open trade',
  'sell to open',
  'buy to open',
  'selling',
  'buy +',
];
const ADJUST_KEYWORDS = ['adjust', 'roll', 'rolling'];
const CLOSE_KEYWORDS = [
  'btc',
  'stc',
  'close',
  'closing',
  'sell to close',
  'buy to close',
  'take profit and exit',
];

/** An opening-spread phrase that also implies an Open action. */
const OPEN_SPREAD_PHRASES = [
  'call credit spread',
  'put credit spread',
  'call debit spread',
  'put debit spread',
  'credit spread',
  'debit spread',
  'iron condor',
];

/**
 * Classify the alert action deterministically.
 *
 * Precedence rule: we find the earliest occurring keyword (by string index) in
 * the lowercased text across Open, Adjust and Close keyword sets. Whichever
 * category owns that earliest index wins. This makes classification
 * order-independent of the keyword lists and deterministic for a given input:
 * if both an open and a close keyword appear, the FIRST occurring keyword in
 * the text decides the class. Opening-spread phrases (e.g. "credit spread",
 * "iron condor") are treated as Open signals as well.
 */
function classifyAction(lower: string): AlertActionType {
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestType: AlertActionType = 'Unclassified';

  const consider = (keywords: string[], type: AlertActionType): void => {
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1 && idx < bestIndex) {
        bestIndex = idx;
        bestType = type;
      }
    }
  };

  consider(OPEN_KEYWORDS, 'Open');
  consider(OPEN_SPREAD_PHRASES, 'Open');
  consider(ADJUST_KEYWORDS, 'Adjust');
  consider(CLOSE_KEYWORDS, 'Close');

  return bestType;
}

// --- Direction ---

/**
 * Determine buy vs sell. If both buy- and sell-signalling keywords appear, the
 * first occurring one in the text wins (deterministic).
 */
function extractDirection(lower: string): AlertDirection | null {
  const buyPatterns = ['bto', 'buy to open', 'buy to close', 'buy +', 'bought', 'buy'];
  const sellPatterns = ['sto', 'sell to open', 'sell to close', 'selling', 'sold', 'sell'];

  let buyIdx = Number.POSITIVE_INFINITY;
  for (const p of buyPatterns) {
    const idx = lower.indexOf(p);
    if (idx !== -1 && idx < buyIdx) buyIdx = idx;
  }
  let sellIdx = Number.POSITIVE_INFINITY;
  for (const p of sellPatterns) {
    const idx = lower.indexOf(p);
    if (idx !== -1 && idx < sellIdx) sellIdx = idx;
  }

  if (buyIdx === Number.POSITIVE_INFINITY && sellIdx === Number.POSITIVE_INFINITY) {
    return null;
  }
  return buyIdx <= sellIdx ? 'buy' : 'sell';
}

// --- Fill price ---

/**
 * Extract a fill price associated with an "@" or debit/credit context, e.g.
 * "@ 2.8", "@2.80 LMT", "@ 2.8 debit". Returns the first such price found.
 */
function extractFillPrice(raw: string): number | null {
  // Prefer a price right after an "@".
  const atMatch = raw.match(/@\s*\$?(\d+(?:\.\d+)?)/);
  if (atMatch) {
    const n = parseFloat(atMatch[1]);
    if (!Number.isNaN(n)) return n;
  }
  // Fallback: "<number> debit" / "<number> credit" as a fill context.
  const ctxMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:debit|credit)\b/i);
  if (ctxMatch) {
    const n = parseFloat(ctxMatch[1]);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

// --- Amount + amountKind ---

interface AmountResult {
  amount: number | null;
  amountKind: AmountKind | null;
}

/**
 * Extract a reported credit/debit amount and its kind. Handles several shapes:
 * - "$890 CREDIT"
 * - "Credit: 8.75"
 * - "2.8 debit"
 */
function extractAmount(raw: string): AmountResult {
  // "$890 CREDIT" or "890 debit" (number then kind)
  const numThenKind = raw.match(/\$?([\d,]+(?:\.\d+)?)\s*(credit|debit)\b/i);
  // "Credit: 8.75" (kind then number)
  const kindThenNum = raw.match(/\b(credit|debit)\s*:?\s*\$?([\d,]+(?:\.\d+)?)/i);

  const numThenKindIdx = numThenKind ? raw.indexOf(numThenKind[0]) : Number.POSITIVE_INFINITY;
  const kindThenNumIdx = kindThenNum ? raw.indexOf(kindThenNum[0]) : Number.POSITIVE_INFINITY;

  if (numThenKind && numThenKindIdx <= kindThenNumIdx) {
    return {
      amount: parseAmountNumber(numThenKind[1]),
      amountKind: numThenKind[2].toLowerCase() as AmountKind,
    };
  }
  if (kindThenNum) {
    return {
      amount: parseAmountNumber(kindThenNum[2]),
      amountKind: kindThenNum[1].toLowerCase() as AmountKind,
    };
  }
  return { amount: null, amountKind: null };
}

// --- Symbol ---

/**
 * Extract the underlying ticker (1-6 uppercase letters). Heuristics look right
 * after known lead-ins (BTO/STO/"NEW OPEN TRADE:"/"BUY +N VERTICAL"); the first
 * non-stopword uppercase token there wins. Falls back to the first standalone
 * uppercase token in the text that is not a stopword.
 */
function extractSymbol(raw: string): string | null {
  const leadIns = [
    /\bNEW OPEN TRADE:\s*([A-Z]{1,6})\b/,
    /\bBUY\s*\+\s*\d+\s+VERTICAL\s+([A-Z]{1,6})\b/,
    /\bBTO\s+([A-Z]{1,6})\b/,
    /\bSTO\s+(?:\d[\d/]*\s+)?([A-Z]{1,6})\b/,
  ];
  for (const re of leadIns) {
    const m = raw.match(re);
    if (m && !SYMBOL_STOPWORDS.has(m[1])) {
      return m[1];
    }
  }

  // Fallback: scan standalone uppercase tokens for the first non-stopword.
  const tokens = raw.match(/\b[A-Z]{1,6}\b/g);
  if (tokens) {
    for (const t of tokens) {
      if (!SYMBOL_STOPWORDS.has(t)) {
        return t;
      }
    }
  }
  return null;
}

// --- Strategy ---

/**
 * Detect a common option-strategy phrase and return a human-readable label.
 * Ordering is most-specific first so "portfolio secured put" wins over
 * "secured put", and "unbalanced iron condor" wins over "iron condor".
 */
const STRATEGY_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /unbalanced\s+iron\s+condor/i, label: 'Unbalanced Iron Condor' },
  { re: /iron\s+condor/i, label: 'Iron Condor' },
  { re: /portfolio\s+secured\s+put/i, label: 'Portfolio Secured Put' },
  { re: /secured\s+put/i, label: 'Secured Put' },
  { re: /bull\s+call\s+spread/i, label: 'Bull Call Spread' },
  { re: /bear\s+put\s+spread/i, label: 'Bear Put Spread' },
  { re: /call\s+credit\s+spread/i, label: 'Call Credit Spread' },
  { re: /put\s+credit\s+spread/i, label: 'Put Credit Spread' },
  { re: /call\s+debit\s+spread/i, label: 'Call Debit Spread' },
  { re: /put\s+debit\s+spread/i, label: 'Put Debit Spread' },
  { re: /call\s+spread/i, label: 'Call Spread' },
  { re: /put\s+spread/i, label: 'Put Spread' },
  { re: /credit\s+spread/i, label: 'Credit Spread' },
  { re: /debit\s+spread/i, label: 'Debit Spread' },
  { re: /vertical/i, label: 'Vertical' },
];

function extractStrategy(raw: string): string | null {
  for (const { re, label } of STRATEGY_PATTERNS) {
    if (re.test(raw)) return label;
  }
  return null;
}

// --- Expiration ---

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalizeTwoDigitYear(yy: number): number {
  // POC assumption: 2-digit years map to 20YY.
  return 2000 + yy;
}

/**
 * Detect an expiration date and normalize to 'YYYY-MM-DD' when confidently
 * parseable. Recognizes:
 * - "16 OCT 26"      (day month year)
 * - "OCT 16th 26"    (month day year) / "OCT 16"
 * - "2/19/27"        (M/D/YY or M/D/YYYY), optionally preceded by EXPIRING
 * If a date-like substring is matched but cannot be confidently normalized,
 * the raw matched substring is returned instead of null.
 */
function extractExpiration(raw: string): string | null {
  // "16 OCT 26" -> day month year
  const dmy = raw.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{2,4})\b/i);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = MONTHS[dmy[2].toLowerCase()];
    let year = parseInt(dmy[3], 10);
    if (year < 100) year = normalizeTwoDigitYear(year);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
    return dmy[0];
  }

  // "M/D/YY" or "M/D/YYYY", possibly after "EXPIRING"
  const numeric = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (numeric) {
    const month = parseInt(numeric[1], 10);
    const day = parseInt(numeric[2], 10);
    let year = parseInt(numeric[3], 10);
    if (year < 100) year = normalizeTwoDigitYear(year);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
    return numeric[0];
  }

  // "OCT 16th" / "OCT 16 26" -> month day [year]
  const mdy = raw.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?\b/i);
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()];
    const day = parseInt(mdy[2], 10);
    if (mdy[3]) {
      let year = parseInt(mdy[3], 10);
      if (year < 100) year = normalizeTwoDigitYear(year);
      if (month && day >= 1 && day <= 31) {
        return `${year}-${pad2(month)}-${pad2(day)}`;
      }
    }
    // No year -> not confidently normalizable, return raw matched substring.
    return mdy[0];
  }

  return null;
}

// --- Strikes ---

/**
 * Capture strike/price levels. Recognizes:
 * - "450/460"            (spread strikes)
 * - "190p" / "190"       (single strike, optional put/call suffix)
 * - "50 point wide ... 30 point wide" (descriptive width strings)
 */
function extractStrikes(raw: string): string | null {
  // A single strike with an explicit put/call suffix (e.g. "190p") is the most
  // unambiguous strike signal, so prefer it before slash pairs.
  const single = raw.match(/\b(\d+(?:\.\d+)?)([pc])\b/i);
  if (single) return `${single[1]}${single[2].toLowerCase()}`;

  // Spread strikes like "450/460". Reject M/D/Y date forms (three slash-parts)
  // so an expiration date is never mistaken for strikes.
  const slashCandidates = raw.match(/\b\d+(?:\.\d+)?\/\d+(?:\.\d+)?(?:\/\d+)?\b/g);
  if (slashCandidates) {
    for (const candidate of slashCandidates) {
      if (candidate.split('/').length === 2) return candidate;
    }
  }

  const widths = raw.match(/\d+\s*point\s+wide[^.]*/i);
  if (widths) return widths[0].trim();

  return null;
}

// --- Links ---

/** Extract all http(s) URLs, dedupe (order-preserving), and cap at MAX_LINKS. */
function extractLinks(raw: string): string[] {
  const matches = raw.match(/https?:\/\/[^\s<>"')]+/gi);
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
      if (out.length >= MAX_LINKS) break;
    }
  }
  return out;
}

// --- Public entry point ---

/**
 * Parse a raw Discord trade-alert message into a structured record.
 *
 * @param rawContent - The complete original message text (stored unmodified).
 * @param source - The originating community and chat room, used to derive a
 *   deterministic message id.
 * @returns A {@link ParsedTradeAlert}. Empty/whitespace-only input yields an
 *   'Unclassified' result with all extracted fields null/empty and
 *   extractedAnyField false.
 */
export function parseDiscordAlert(
  rawContent: string,
  source: { community: string; chatRoom: string },
): ParsedTradeAlert {
  const messageId = computeMessageId(source.community, source.chatRoom, rawContent);

  if (rawContent.trim() === '') {
    return {
      actionType: 'Unclassified',
      symbol: null,
      strategy: null,
      expiration: null,
      strikes: null,
      direction: null,
      fillPrice: null,
      amount: null,
      amountKind: null,
      links: [],
      rawContent,
      messageId,
      extractedAnyField: false,
    };
  }

  const lower = rawContent.toLowerCase();

  const actionType = classifyAction(lower);
  const symbol = extractSymbol(rawContent);
  const strategy = extractStrategy(rawContent);
  const expiration = extractExpiration(rawContent);
  const strikes = extractStrikes(rawContent);
  const direction = extractDirection(lower);
  const fillPrice = extractFillPrice(rawContent);
  const { amount, amountKind } = extractAmount(rawContent);
  const links = extractLinks(rawContent);

  const extractedAnyField =
    actionType !== 'Unclassified' ||
    symbol !== null ||
    strategy !== null ||
    expiration !== null ||
    strikes !== null ||
    direction !== null ||
    fillPrice !== null ||
    amount !== null ||
    amountKind !== null ||
    links.length > 0;

  return {
    actionType,
    symbol,
    strategy,
    expiration,
    strikes,
    direction,
    fillPrice,
    amount,
    amountKind,
    links,
    rawContent,
    messageId,
    extractedAnyField,
  };
}
