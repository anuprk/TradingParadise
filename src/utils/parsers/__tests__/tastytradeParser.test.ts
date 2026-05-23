/**
 * Unit tests for the Tastytrade PDF parser.
 * Tests the parsing logic using mocked PDF text extraction.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TastytradeParser } from '../tastytradeParser';

// Mock pdfUtils to avoid actual PDF processing in unit tests
vi.mock('../pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

import { extractTextFromPDF } from '../pdfUtils';

const mockedExtractText = vi.mocked(extractTextFromPDF);

describe('TastytradeParser', () => {
  let parser: TastytradeParser;

  beforeEach(() => {
    parser = new TastytradeParser();
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
    });

    it('returns error when no transaction section is found', async () => {
      mockedExtractText.mockResolvedValue(['Some random PDF content\nNo sections here']);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('No valid transaction section found');
    });

    it('parses stock transactions from Account Activity section', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const [tx1, tx2] = result.transactions;
      expect(tx1.symbol).toBe('AAPL');
      expect(tx1.transactionType).toBe('Buy');
      expect(tx1.quantity).toBe(10);
      expect(tx1.price).toBe(175.50);
      expect(tx1.fees).toBe(1.50);
      expect(tx1.amount).toBe(-1756.50);
      expect(tx1.source).toBe('tastytrade_pdf');
      expect(tx1.portfolioId).toBe('portfolio-1');
      expect(tx1.planId).toBe('plan-1');

      expect(tx2.symbol).toBe('MSFT');
      expect(tx2.transactionType).toBe('Sell');
      expect(tx2.quantity).toBe(5);
      expect(tx2.price).toBe(420.00);
    });

    it('parses transactions from Transaction History section', async () => {
      mockedExtractText.mockResolvedValue([
        'Transaction History\n' + '01/10/24 SPY Buy 100 450.00 0.50 -45000.50',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].symbol).toBe('SPY');
      expect(result.transactions[0].transactionType).toBe('Buy');
    });

    it('parses options transactions and extracts option details', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL 03/15/24 P170 Sold 1 3.25 0.50 324.50',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
      const tx = result.transactions[0];
      expect(tx.symbol).toBe('AAPL');
      expect(tx.assetType).toBe('Option');
      expect(tx.optionType).toBe('Put');
      expect(tx.strikePrice).toBe(170);
      expect(tx.expirationDate).toBeInstanceOf(Date);
    });

    it('parses call options', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '02/20/24 SPY 03/15/24 C450 Buy 2 5.00 1.00 -1001.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
      const tx = result.transactions[0];
      expect(tx.symbol).toBe('SPY');
      expect(tx.assetType).toBe('Option');
      expect(tx.optionType).toBe('Call');
      expect(tx.strikePrice).toBe(450);
    });

    it('skips subtotal lines without adding to errors', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          'Total: $5,000.00\n' +
          'Subtotal\n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('skips blank lines without adding to errors', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          '\n' +
          '   \n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('skips page headers/footers without adding to errors', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          'Page 2\n' +
          'tastytrade Inc.\n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('adds unparseable rows to errors list', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          'Some random unrecognized content here\n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Unrecognized');
    });

    it('handles dividend transactions', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' + '03/15/24 AAPL Dividend 0 0.00 0.00 25.50',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].transactionType).toBe('Dividend');
      expect(result.transactions[0].assetType).toBe('Cash');
    });

    it('generates unique IDs for each transaction', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions[0].id).not.toBe(result.transactions[1].id);
      // UUID format check
      expect(result.transactions[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('sets createdAt and updatedAt timestamps', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' + '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions[0].createdAt).toBeInstanceOf(Date);
      expect(result.transactions[0].updatedAt).toBeInstanceOf(Date);
    });

    it('handles options with decimal strike prices', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL 03/15/24 P170.50 Sold 1 3.25 0.50 324.50',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].strikePrice).toBe(170.50);
    });

    it('handles negative amounts (debits)', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' + '03/15/24 AAPL Buy 10 175.50 1.50 (1756.50)',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(-1756.50);
    });

    it('returns correct total and skipped counts', async () => {
      mockedExtractText.mockResolvedValue([
        'Account Activity\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50\n' +
          '\n' +
          'Total: $5,000.00\n' +
          '03/16/24 MSFT Sold 5 420.00 1.00 2099.00',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('finds section header within a line (not just standalone)', async () => {
      mockedExtractText.mockResolvedValue([
        'Some header content Account Activity more content\n' +
          '03/15/24 AAPL Bought 10 175.50 1.50 -1756.50',
      ]);
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, 'portfolio-1', 'plan-1');

      expect(result.transactions).toHaveLength(1);
    });
  });
});
