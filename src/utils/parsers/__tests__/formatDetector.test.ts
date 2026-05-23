import { describe, it, expect, vi } from 'vitest';
import { detectFormat } from '../formatDetector';

// Mock pdfUtils to avoid actual PDF parsing in unit tests
vi.mock('../pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

import { extractTextFromPDF } from '../pdfUtils';

const mockedExtractText = vi.mocked(extractTextFromPDF);

function createFile(name: string, content = ''): File {
  return new File([content], name, {
    type: name.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
  });
}

describe('detectFormat', () => {
  describe('CSV detection', () => {
    it('returns "csv" for .csv files', async () => {
      const file = createFile('trades.csv');
      const result = await detectFormat(file);
      expect(result).toBe('csv');
    });

    it('returns "csv" for .CSV files (case-insensitive extension)', async () => {
      const file = createFile('trades.CSV');
      const result = await detectFormat(file);
      expect(result).toBe('csv');
    });
  });

  describe('PDF format detection', () => {
    it('returns "tastytrade_pdf" when first page contains "tastytrade"', async () => {
      mockedExtractText.mockResolvedValue([
        'Your tastytrade account summary for March 2024',
      ]);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('tastytrade_pdf');
    });

    it('returns "tastytrade_pdf" when first page contains "Account Activity"', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity for period ending 03/31/2024',
      ]);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('tastytrade_pdf');
    });

    it('returns "tastytrade_pdf" when first page contains "Transaction History"', async () => {
      mockedExtractText.mockResolvedValue([
        'Transaction History - Monthly Statement',
      ]);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('tastytrade_pdf');
    });

    it('detects tastytrade case-insensitively for "tastytrade" marker', async () => {
      mockedExtractText.mockResolvedValue(['TASTYTRADE Monthly Statement']);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('tastytrade_pdf');
    });

    it('returns "fidelity_pdf" when first page contains "Fidelity"', async () => {
      mockedExtractText.mockResolvedValue([
        'Fidelity Investments Account Statement',
      ]);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('fidelity_pdf');
    });

    it('returns "fidelity_pdf" when first page contains "Transaction Detail"', async () => {
      mockedExtractText.mockResolvedValue([
        'Transaction Detail for Account ending in 1234',
      ]);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('fidelity_pdf');
    });

    it('detects Fidelity case-insensitively for "fidelity" marker', async () => {
      mockedExtractText.mockResolvedValue(['FIDELITY Brokerage Services']);
      const file = createFile('statement.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('fidelity_pdf');
    });

    it('returns "unknown" when PDF has no recognized markers', async () => {
      mockedExtractText.mockResolvedValue([
        'Some random PDF content without any broker markers',
      ]);
      const file = createFile('random.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('unknown');
    });

    it('returns "unknown" when PDF has empty first page', async () => {
      mockedExtractText.mockResolvedValue(['']);
      const file = createFile('empty.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('unknown');
    });

    it('returns "unknown" when PDF has no pages', async () => {
      mockedExtractText.mockResolvedValue([]);
      const file = createFile('nopages.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('unknown');
    });

    it('prioritizes tastytrade over Fidelity when both markers present', async () => {
      mockedExtractText.mockResolvedValue([
        'tastytrade Fidelity Transaction Detail Account Activity',
      ]);
      const file = createFile('both.pdf');
      const result = await detectFormat(file);
      expect(result).toBe('tastytrade_pdf');
    });
  });

  describe('unknown formats', () => {
    it('returns "unknown" for unsupported extensions', async () => {
      const file = createFile('data.xlsx');
      const result = await detectFormat(file);
      expect(result).toBe('unknown');
    });

    it('returns "unknown" for files with no extension', async () => {
      const file = createFile('noextension');
      const result = await detectFormat(file);
      expect(result).toBe('unknown');
    });
  });
});
