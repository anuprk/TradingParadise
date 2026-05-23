import { describe, it, expect, vi } from 'vitest';
import { detectAndParse } from '../index';

// Mock the format detector and parsers to isolate the orchestrator logic
vi.mock('../formatDetector', () => ({
  detectFormat: vi.fn(),
}));

vi.mock('../pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

import { detectFormat } from '../formatDetector';

const mockedDetectFormat = vi.mocked(detectFormat);

function createFile(name: string, content: string, sizeOverride?: number): File {
  const file = new File([content], name, {
    type: name.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
  });
  if (sizeOverride !== undefined) {
    Object.defineProperty(file, 'size', { value: sizeOverride });
  }
  return file;
}

describe('detectAndParse', () => {
  const portfolioId = 'portfolio-123';
  const planId = 'plan-456';

  describe('file size validation', () => {
    it('rejects files larger than 10MB', async () => {
      const file = createFile('big.csv', '', 11 * 1024 * 1024);
      const result = await detectAndParse(file, portfolioId, planId);

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('exceeds the maximum allowed size of 10 MB');
    });

    it('accepts files exactly 10MB', async () => {
      const csvContent = 'Stock Symbol,Open Date\nAAPL,01/15/2024';
      const file = createFile('exact.csv', csvContent, 10 * 1024 * 1024);
      mockedDetectFormat.mockResolvedValue('csv');

      const result = await detectAndParse(file, portfolioId, planId);
      // Should not fail on size validation
      expect(result.errors.every((e) => !e.reason.includes('exceeds the maximum'))).toBe(true);
    });

    it('accepts files smaller than 10MB', async () => {
      const csvContent = 'Stock Symbol,Open Date\nAAPL,01/15/2024';
      const file = createFile('small.csv', csvContent, 1024);
      mockedDetectFormat.mockResolvedValue('csv');

      const result = await detectAndParse(file, portfolioId, planId);
      expect(result.errors.every((e) => !e.reason.includes('exceeds the maximum'))).toBe(true);
    });
  });

  describe('file extension validation', () => {
    it('rejects files with unsupported extensions', async () => {
      const file = createFile('data.xlsx', 'content');
      const result = await detectAndParse(file, portfolioId, planId);

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Unsupported file extension');
      expect(result.errors[0].reason).toContain('.xlsx');
    });

    it('rejects files with no extension', async () => {
      const file = createFile('noextension', 'content');
      const result = await detectAndParse(file, portfolioId, planId);

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Unsupported file extension');
    });

    it('accepts .pdf files', async () => {
      const file = createFile('statement.pdf', 'pdf content');
      mockedDetectFormat.mockResolvedValue('unknown');

      const result = await detectAndParse(file, portfolioId, planId);
      // Should pass extension check (may fail on format detection)
      expect(result.errors.every((e) => !e.reason.includes('Unsupported file extension'))).toBe(true);
    });

    it('accepts .csv files', async () => {
      const csvContent = 'Stock Symbol,Open Date\nAAPL,01/15/2024';
      const file = createFile('trades.csv', csvContent);
      mockedDetectFormat.mockResolvedValue('csv');

      const result = await detectAndParse(file, portfolioId, planId);
      expect(result.errors.every((e) => !e.reason.includes('Unsupported file extension'))).toBe(true);
    });
  });

  describe('unknown format handling', () => {
    it('returns error when format cannot be determined', async () => {
      const file = createFile('mystery.pdf', 'unknown content');
      mockedDetectFormat.mockResolvedValue('unknown');

      const result = await detectAndParse(file, portfolioId, planId);

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Unable to determine file format');
      expect(result.errors[0].reason).toContain('tastytrade');
      expect(result.errors[0].reason).toContain('Fidelity');
      expect(result.errors[0].reason).toContain('CSV');
    });
  });

  describe('CSV parsing delegation', () => {
    it('parses CSV files with valid content', async () => {
      const csvContent = 'Stock Symbol,Open Date\nAAPL,01/15/2024\nMSFT,02/20/2024';
      const file = createFile('trades.csv', csvContent);
      mockedDetectFormat.mockResolvedValue('csv');

      const result = await detectAndParse(file, portfolioId, planId);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].symbol).toBe('AAPL');
      expect(result.transactions[0].portfolioId).toBe(portfolioId);
      expect(result.transactions[0].planId).toBe(planId);
      expect(result.transactions[0].source).toBe('csv');
      expect(result.transactions[1].symbol).toBe('MSFT');
    });

    it('passes portfolioId and planId to CSV parser', async () => {
      const csvContent = 'Stock Symbol,Open Date\nSPY,03/01/2024';
      const file = createFile('trades.csv', csvContent);
      mockedDetectFormat.mockResolvedValue('csv');

      const result = await detectAndParse(file, portfolioId, planId);

      expect(result.transactions[0].portfolioId).toBe(portfolioId);
      expect(result.transactions[0].planId).toBe(planId);
    });
  });

  describe('validation order', () => {
    it('checks file size before extension', async () => {
      // File with invalid extension AND too large
      const file = createFile('big.xlsx', '', 11 * 1024 * 1024);
      const result = await detectAndParse(file, portfolioId, planId);

      // Should fail on size first
      expect(result.errors[0].reason).toContain('exceeds the maximum allowed size');
    });

    it('checks extension before format detection', async () => {
      mockedDetectFormat.mockClear();
      const file = createFile('data.txt', 'some content');
      const result = await detectAndParse(file, portfolioId, planId);

      // Should fail on extension, detectFormat should not be called
      expect(result.errors[0].reason).toContain('Unsupported file extension');
      expect(mockedDetectFormat).not.toHaveBeenCalled();
    });
  });
});
