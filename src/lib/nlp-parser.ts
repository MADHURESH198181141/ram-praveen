/**
 * NLP Parser — WhatsApp Message → Bill Items
 *
 * Understands casual, mixed-language WhatsApp orders including:
 *  - Slang / abbreviations  ("bro", "anna", "pls", "nd", "n")
 *  - English number words   ("two", "three", "one")
 *  - Hindi number words     ("ek", "do", "teen", "char", "paanch")
 *  - Tamil number words     ("oru", "rendu", "moonnu", "naangu", "aindhu")
 *  - Tamil Unicode digits   ("ஒரு", "இரண்டு", "மூன்று")
 *  - Comma / hyphen / slash separated lists
 *  - Fully numeric lines like "2 idly 1 dosa"
 *  - Mixed: "bro 2 idly n 1 dosa plz"
 */

import { Product, BillItem } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Words that carry NO product / quantity meaning and should be stripped */
const FILLER_WORDS = new Set([
  // English pleasantries / connectors
  'bro', 'anna', 'bhai', 'daa', 'da', 'machan', 'boss', 'sir', 'madam',
  'please', 'pls', 'plz', 'plzz', 'thanks', 'thank', 'thx', 'ok', 'okay',
  'hi', 'hello', 'hey', 'yo', 'sup',
  'send', 'give', 'get', 'bring', 'need', 'want', 'order',
  'me', 'us', 'my', 'our', 'i', 'we',
  'and', 'with', 'also', 'too', 'plus', 'add',
  'some', 'the', 'a', 'an',
  'each', 'per',
  'today', 'now', 'urgent', 'asap',
  'bill', 'total', 'amount',
  // Tamil / Tanglish connectors
  'venum', 'vendum', 'vennum', 'vena', 'veno', 'poda', 'podu', 'kuduga',
  'kudunga', 'kudu', 'kodu', 'taa', 'tango', 'thaango',
  'na', 'nga', 'pa', 'la', 'ra',
  // Hindi connectors
  'de', 'dena', 'chahiye', 'lagao', 'aur', 'aur',
  // conjunctions / separators (textual)
  'n', 'nd', 'wid', 'wit',
]);

/** Number word → digit mapping (English + Hindi + Tamil transliteration) */
const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
  // Hindi
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5,
  chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  // Tamil transliteration
  oru: 1, rendu: 2, moonnu: 3, naangu: 4, aindhu: 5,
  aaru: 6, ezhu: 7, ettu: 8, onpathu: 9, pathu: 10,
  // common typos / abbreviations
  '1st': 1, '2nd': 2, '3rd': 3,
};

/** Tamil Unicode number words */
const TAMIL_NUMBER_WORDS: Record<string, number> = {
  'ஒரு': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5,
  'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface NLPMatch {
  product: Product;
  quantity: number;
  confidence: ConfidenceLevel;
  /** The raw phrase from the message that triggered this match */
  matchedPhrase: string;
  /** The product name token used to identify the product */
  matchedToken: string;
  /** Levenshtein similarity score 0–1 */
  score: number;
}

export interface NLPUnmatched {
  phrase: string;
  reason: string;
}

export interface NLPResult {
  matches: NLPMatch[];
  unmatched: NLPUnmatched[];
  billItems: BillItem[];
}

// ─── String Utilities ─────────────────────────────────────────────────────────

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score 0–1 (1 = identical) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Normalize a string: lowercase, remove diacritics, collapse whitespace */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF]/g, ' ') // keep Tamil Unicode + alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if a string contains Tamil Unicode characters */
function hasTamil(s: string): boolean {
  return /[\u0B80-\u0BFF]/.test(s);
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

/** Try to parse a token as a number (digit string or number word) */
function tokenToNumber(token: string): number | null {
  // Pure digit
  const n = parseFloat(token);
  if (!isNaN(n) && token.match(/^\d+(\.\d+)?$/)) return n;

  // English / Hindi / Tamil transliteration number word
  const mapped = NUMBER_WORDS[token.toLowerCase()];
  if (mapped !== undefined) return mapped;

  // Tamil Unicode number word
  const tamilMapped = TAMIL_NUMBER_WORDS[token];
  if (tamilMapped !== undefined) return tamilMapped;

  return null;
}

/**
 * Split the raw message into segments (by newline, comma, semicolon)
 * then further tokenize each segment.
 */
function segmentMessage(raw: string): string[][] {
  // First split by newlines, then by common separators
  const lines = raw.split(/\n/);
  return lines.map(line =>
    line
      .split(/[,;|\/]/)
      .map(seg => seg.trim())
      .filter(Boolean)
  ).flat().map(seg => {
    // Tokenize: split on whitespace and hyphens
    return seg.split(/[\s\-]+/).map(t => t.trim()).filter(Boolean);
  });
}

// ─── Product Matching ─────────────────────────────────────────────────────────

interface ProductScore {
  product: Product;
  score: number;
  matchedName: string;
}

/**
 * Find the best matching product for a given token or multi-token phrase.
 * Checks:
 *  1. Exact match on full product name (or any word in it)
 *  2. Partial/prefix match
 *  3. Fuzzy (Levenshtein) match
 *
 * Returns null if no product scores above MIN_SCORE.
 */
const MIN_SCORE = 0.55;

function findBestProduct(phrase: string, products: Product[]): ProductScore | null {
  const normPhrase = normalize(phrase);
  let best: ProductScore | null = null;

  for (const product of products) {
    if (!product.isActive) continue;

    const productWords = normalize(product.name).split(' ');
    const nameTamilNorm = product.nameTamil ? normalize(product.nameTamil) : '';

    // --- Strategy 1: Exact full-name match ---
    if (normalize(product.name) === normPhrase || nameTamilNorm === normPhrase) {
      return { product, score: 1.0, matchedName: phrase };
    }

    // --- Strategy 2: Exact match on one word of the product name ---
    for (const word of productWords) {
      if (word.length >= 3 && word === normPhrase) {
        const s = 0.95;
        if (!best || s > best.score) best = { product, score: s, matchedName: phrase };
      }
    }

    // --- Strategy 3: Product name starts with / contains the phrase ---
    if (productWords[0].startsWith(normPhrase) && normPhrase.length >= 3) {
      const s = 0.85 * (normPhrase.length / productWords[0].length);
      if (!best || s > best.score) best = { product, score: s, matchedName: phrase };
    }

    // --- Strategy 4: Phrase contains a key product word ---
    for (const word of productWords) {
      if (word.length >= 4 && normPhrase.includes(word)) {
        const s = 0.80;
        if (!best || s > best.score) best = { product, score: s, matchedName: phrase };
      }
    }

    // --- Strategy 5: Fuzzy match on each product word ---
    for (const word of productWords) {
      if (word.length < 3) continue;
      const fuzz = similarity(normPhrase, word);
      if (fuzz >= MIN_SCORE && (!best || fuzz > best.score)) {
        best = { product, score: fuzz, matchedName: phrase };
      }
    }

    // --- Strategy 6: Fuzzy match on full product name ---
    const fullSim = similarity(normPhrase, normalize(product.name));
    if (fullSim >= MIN_SCORE && (!best || fullSim > best.score)) {
      best = { product, score: fullSim, matchedName: phrase };
    }

    // --- Strategy 7: Tamil name match (unicode) ---
    if (nameTamilNorm && hasTamil(normPhrase)) {
      const tamilSim = similarity(normPhrase, nameTamilNorm);
      if (tamilSim >= MIN_SCORE && (!best || tamilSim > best.score)) {
        best = { product, score: tamilSim, matchedName: phrase };
      }
      // Check individual Tamil name words
      for (const tw of nameTamilNorm.split(' ')) {
        if (tw.length >= 2 && normPhrase.includes(tw)) {
          const s = 0.80;
          if (!best || s > best.score) best = { product, score: s, matchedName: phrase };
        }
      }
    }
  }

  return best && best.score >= MIN_SCORE ? best : null;
}

function scoreToConfidence(score: number): ConfidenceLevel {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

// ─── Core Parser ──────────────────────────────────────────────────────────────

/**
 * Main NLP parser.
 * Accepts a raw WhatsApp message string and a product catalog.
 * Returns matched bill items, confidence scores, and unmatched phrases.
 */
export function parseWhatsAppMessage(raw: string, products: Product[]): NLPResult {
  const segments = segmentMessage(raw);
  const matches: NLPMatch[] = [];
  const unmatchedPhrases: NLPUnmatched[] = [];
  // Track used product IDs to avoid duplicate entries (accumulate quantities instead)
  const usedProducts = new Map<string, NLPMatch>();

  for (const tokens of segments) {
    if (tokens.length === 0) continue;

    // --- Pass 1: Identify quantity tokens and product tokens ---
    type TokenInfo = { raw: string; number: number | null; isFiller: boolean };
    const tagged: TokenInfo[] = tokens.map(t => ({
      raw: t,
      number: tokenToNumber(t),
      isFiller: FILLER_WORDS.has(t.toLowerCase()),
    }));

    // Build candidate product "phrases" from non-filler, non-number tokens
    // Sliding window of 1–3 consecutive non-number tokens
    const productTokenIndices: number[] = tagged
      .map((t, i) => (!t.isFiller && t.number === null ? i : -1))
      .filter(i => i >= 0);

    const visited = new Set<number>();

    // Try longest phrases first (3-gram → 2-gram → 1-gram)
    for (let windowSize = 3; windowSize >= 1; windowSize--) {
      for (let i = 0; i <= productTokenIndices.length - windowSize; i++) {
        const indices = productTokenIndices.slice(i, i + windowSize);
        // Only use consecutive indices
        const isConsecutive = indices.every((idx, j) =>
          j === 0 || idx === indices[j - 1] + 1 ||
          // allow one filler/number token gap
          (tagged[indices[j - 1] + 1]?.isFiller && idx === indices[j - 1] + 2)
        );
        if (!isConsecutive) continue;
        if (indices.some(idx => visited.has(idx))) continue;

        const phrase = indices.map(idx => tagged[idx].raw).join(' ');
        const bestMatch = findBestProduct(phrase, products);

        if (bestMatch) {
          // Find the nearest quantity: look left then right
          let qty = 1;
          let qtyFound = false;

          // Look left (up to 3 positions)
          for (let k = indices[0] - 1; k >= Math.max(0, indices[0] - 3); k--) {
            if (tagged[k].number !== null) {
              qty = tagged[k].number!;
              qtyFound = true;
              break;
            }
          }
          // Look right if not found
          if (!qtyFound) {
            for (let k = indices[indices.length - 1] + 1; k < Math.min(tagged.length, indices[indices.length - 1] + 4); k++) {
              if (tagged[k].number !== null) {
                qty = tagged[k].number!;
                break;
              }
            }
          }

          const rawPhrase = tokens.join(' ');
          const match: NLPMatch = {
            product: bestMatch.product,
            quantity: qty,
            confidence: scoreToConfidence(bestMatch.score),
            matchedPhrase: rawPhrase,
            matchedToken: phrase,
            score: bestMatch.score,
          };

          // Merge if same product already found
          const existing = usedProducts.get(bestMatch.product.id);
          if (existing) {
            existing.quantity += qty;
          } else {
            usedProducts.set(bestMatch.product.id, match);
            matches.push(match);
          }

          indices.forEach(idx => visited.add(idx));
        }
      }
    }

    // Collect unmatched non-filler, non-number tokens that weren't consumed
    const unconsumed = productTokenIndices.filter(idx => !visited.has(idx));
    if (unconsumed.length > 0) {
      const phrase = unconsumed.map(idx => tagged[idx].raw).join(' ');
      // Only report as unmatched if the phrase is meaningful (not all 1–2 char tokens)
      const meaningful = phrase.split(' ').some(w => w.length >= 3);
      if (meaningful) {
        unmatchedPhrases.push({
          phrase: tokens.join(' '),
          reason: `Could not find product matching "${phrase}"`,
        });
      }
    }
  }

  // Build BillItem[] from matches
  const billItems: BillItem[] = matches.map(m => ({
    id: `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    productId: m.product.id,
    productName: m.product.name,
    nameTamil: m.product.nameTamil,
    category: m.product.category,
    quantity: m.quantity,
    unitPrice: m.product.price,
    totalPrice: m.product.price * m.quantity,
    hsnCode: m.product.hsnCode,
  }));

  return { matches, unmatched: unmatchedPhrases, billItems };
}

/**
 * Legacy structured parser (PRODUCT NAME xQUANTITY format).
 * Kept as a fallback / explicit mode.
 */
export function parseStructuredText(
  text: string,
  products: Product[]
): { matched: BillItem[]; unmatched: string[] } {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const matched: BillItem[] = [];
  const unmatched: string[] = [];

  lines.forEach(line => {
    const match = line.match(/(.+?)\s*x?\s*(\d+)$/i);
    if (match) {
      const name = match[1].trim().toLowerCase();
      const quantity = parseFloat(match[2]);
      const product = products.find(
        p => p.name.toLowerCase() === name && p.isActive
      );
      if (product) {
        matched.push({
          id: `pasted-${Date.now()}-${Math.random()}`,
          productId: product.id,
          productName: product.name,
          category: product.category,
          quantity,
          unitPrice: product.price,
          totalPrice: product.price * quantity,
        });
      } else {
        unmatched.push(line.trim());
      }
    } else {
      unmatched.push(line.trim());
    }
  });

  return { matched, unmatched };
}
