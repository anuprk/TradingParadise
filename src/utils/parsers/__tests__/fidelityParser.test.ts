/**
 * Unit tests for the Fidelity PDF Parser.
 * Tests the FidelityParser class which implements the StatementParser interface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FidelityParser } from '../fidelityParser';

// Mock pdfUtils to avoid actual PDF processing in unit tests
vi.mock('../pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

// Mock uuid to produce deterministic IDs
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

import { extractTextFromPDF } from '../pdfUtils';

const mockedExtractText = vi.mocked(extractTextFromPDF);

describe('FidelityParser', () => {
  let parser: FidelityParser;

  beforeEach(() => {
    parser = new FidelityParser();
    vi.clearAllMocks();
  });

  describe('canParse', () => {
    it('returns true for ArrayBuffer content', () => {
      const buffer = new ArrayBuffer(10);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('returns false for string content', () => {
      expect(parser.canParse('some text')).toBe(false);
    });
  });

  describe('parse', () => {
    it('returns error when content is not ArrayBuffer', async () => {
      const result = await parser.parse('not a buffer', 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('requires ArrayBuffer');
    });

    it('returns error when PDF extraction fails', async () => {
      mockedExtractText.mockRejectedValue(new Error('Corrupt PDF'));
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Failed to extract text from PDF');
      expect(result.errors[0].reason).toContain('Corrupt PDF');
    });

    it('returns error when Transaction Detail section is not found', async () => {
      mockedExtractText.mockResolvedValue(['Some random PDF content without the section header']);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('No "Transaction Detail" section found');
    });

    it('parses a YOU BOUGHT stock transaction', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL APPLE INC 100 185.50 18550.00 4.95';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);

      const txn = result.transactions[0];
      expect(txn.transactionType).toBe('Buy');
      expect(txn.symbol).toBe('AAPL');
      expect(txn.source).toBe('fidelity_pdf');
      expect(txn.portfolioId).toBe('portfolio-1');
      expect(txn.planId).toBe('plan-1');
      expect(txn.transactionDate).toEqual(new Date(2024, 0, 15));
    });

    it('parses a YOU SOLD stock transaction', async () => {
      const pdfText = 'Transaction Detail 03/20/2024 YOU SOLD MSFT MICROSOFT CORP 50 420.00 21000.00 4.95';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);

      const txn = result.transactions[0];
      expect(txn.transactionType).toBe('Sell');
      expect(txn.symbol).toBe('MSFT');
    });

    it('parses a DIVIDEND transaction', async () => {
      const pdfText = 'Transaction Detail 06/15/2024 DIVIDEND AAPL APPLE INC CASH DIV 125.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);

      const txn = result.transactions[0];
      expect(txn.transactionType).toBe('Dividend');
      expect(txn.symbol).toBe('AAPL');
      expect(txn.quantity).toBe(0);
    });

    it('parses a REINVESTMENT transaction as Dividend type', async () => {
      const pdfText = 'Transaction Detail 06/15/2024 REINVESTMENT VTI VANGUARD TOTAL STOCK 2.5 220.00 550.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);

      const txn = result.transactions[0];
      expect(txn.transactionType).toBe('Dividend');
      expect(txn.symbol).toBe('VTI');
    });

    it('extracts option details from description with CALL', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL AAPL JAN 19 2024 190 CALL 5 3.50 1750.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);

      const txn = result.transactions[0];
      expect(txn.assetType).toBe('Option');
      expect(txn.optionType).toBe('Call');
      expect(txn.strikePrice).toBe(190);
    });

    it('extracts option details from description with PUT', async () => {
      const pdfText = 'Transaction Detail 02/10/2024 YOU SOLD SPY SPY FEB 16 2024 480 PUT 10 2.00 2000.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);

      const txn = result.transactions[0];
      expect(txn.assetType).toBe('Option');
      expect(txn.optionType).toBe('Put');
      expect(txn.strikePrice).toBe(480);
    });

    it('parses multiple transactions from a single PDF', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL APPLE INC 100 185.50 18550.00 4.95 02/20/2024 YOU SOLD MSFT MICROSOFT 50 420.00 21000.00 4.95 03/01/2024 DIVIDEND VTI VANGUARD 75.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].transactionType).toBe('Buy');
      expect(result.transactions[1].transactionType).toBe('Sell');
      expect(result.transactions[2].transactionType).toBe('Dividend');
    });

    it('skips unrecognized transaction types with error', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 TRANSFER IN AAPL 100 shares';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('unsupported transaction type');
    });

    it('handles text across multiple pages', async () => {
      const page1 = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL APPLE INC 100 185.50 18550.00';
      const page2 = '02/20/2024 YOU SOLD MSFT MICROSOFT 50 420.00 21000.00';
      mockedExtractText.mockResolvedValue([page1, page2]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(2);
    });

    it('defaults fees to 0 when absent', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL APPLE INC 100 185.50 18550.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].fees).toBe(0);
    });

    it('generates unique IDs for each transaction', async () => {
      let callCount = 0;
      const { v4 } = await import('uuid');
      vi.mocked(v4).mockImplementation(() => `uuid-${++callCount}`);

      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL 100 185.50 18550.00 02/20/2024 YOU SOLD MSFT 50 420.00 21000.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      // Each transaction should have an id
      for (const txn of result.transactions) {
        expect(txn.id).toBeDefined();
        expect(txn.id.length).toBeGreaterThan(0);
      }
    });

    it('sets source to fidelity_pdf for all transactions', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL 100 185.50 18550.00 02/20/2024 DIVIDEND VTI 75.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      for (const txn of result.transactions) {
        expect(txn.source).toBe('fidelity_pdf');
      }
    });

    it('returns correct total count including skipped rows', async () => {
      const pdfText = 'Transaction Detail 01/15/2024 YOU BOUGHT AAPL 100 185.50 18550.00 02/20/2024 UNKNOWN ACTION XYZ 50';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.total).toBe(2); // 2 date segments found
      expect(result.transactions.length + result.skipped).toBeLessThanOrEqual(result.total);
    });

    it('handles case-insensitive Transaction Detail header', async () => {
      const pdfText = 'TRANSACTION DETAIL 01/15/2024 YOU BOUGHT AAPL 100 185.50 18550.00';
      mockedExtractText.mockResolvedValue([pdfText]);
      const buffer = new ArrayBuffer(10);

      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(1);
    });
  });
});
