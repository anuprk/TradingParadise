/**
 * Format detector for imported brokerage files.
 *
 * Determines the file format by checking the extension first,
 * then scanning content for broker-specific markers.
 * For CSVs: identifies format by header columns.
 * For PDFs: extracts text and scans for broker markers.
 */

import { extractTextFromPDF } from './pdfUtils';
import { isTastytradeCsvFormat } from './tastytradeCsvParser';
import { isFidelityCsvFormat } from './fidelityCsvParser';

export type DetectedFormat = 'tastytrade_pdf' | 'fidelity_pdf' | 'tastytrade_csv' | 'fidelity_csv' | 'csv' | 'unknown';

/**
 * Checks if the first page text contains tastytrade-specific markers.
 */
function hasTastytradeMarkers(text: string): boolean {
  const lowerText = text.toLowerCase();
  return (
    lowerText.includes('tastytrade') ||
    lowerText.includes('account activity') ||
    lowerText.includes('transaction history') ||
    (lowerText.includes('apex clearing') && lowerText.includes('account number'))
  );
}

/**
 * Checks if the first page text contains Fidelity-specific markers.
 */
function hasFidelityMarkers(text: string): boolean {
  const lowerText = text.toLowerCase();
  return lowerText.includes('fidelity') || text.includes('Transaction Detail');
}

/**
 * Detects the format of an uploaded file based on extension and content.
 */
export async function detectFormat(file: File): Promise<DetectedFormat> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    // Read first few lines to detect CSV format by headers
    try {
      const text = await file.text();
      // Remove BOM if present
      const cleanText = text.replace(/^\uFEFF/, '');
      // Find the first non-empty line (Fidelity CSVs may have blank lines at the top)
      const lines = cleanText.split('\n');
      let firstLine = '';
      for (const line of lines) {
        if (line.trim()) {
          firstLine = line;
          break;
        }
      }
      const headers = firstLine.split(',').map((h) => h.trim().replace(/"/g, ''));

      if (isTastytradeCsvFormat(headers)) return 'tastytrade_csv';
      if (isFidelityCsvFormat(headers)) return 'fidelity_csv';

      // Fall back to generic CSV
      return 'csv';
    } catch {
      return 'csv';
    }
  }

  if (extension === 'pdf') {
    try {
      const buffer = await file.arrayBuffer();
      const pages = await extractTextFromPDF(buffer);

      const pagesToCheck = pages.slice(0, Math.min(5, pages.length));
      const combinedText = pagesToCheck.join(' ');

      if (hasTastytradeMarkers(combinedText)) return 'tastytrade_pdf';
      if (hasFidelityMarkers(combinedText)) return 'fidelity_pdf';
    } catch {
      return 'unknown';
    }

    return 'unknown';
  }

  return 'unknown';
}
