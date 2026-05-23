import { describe, it, expect } from 'vitest';
import { CsvParser } from '../csvParser';

describe('CsvParser', () => {
  const parser = new CsvParser();
  const portfolioId = 'portfolio-1';
  const planId = 'plan-1';

  describe('canParse', () => {
    it('returns true for string content', () => {
      expect(parser.canParse('some,csv,content')).toBe(true);
    });

    it('returns false for ArrayBuffer content', () => {
      const buffer = new ArrayBuffer(10);
      expect(parser.canParse(buffer)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses valid CSV with required columns', async () => {
      const csv = `Stock Symbol,Open Date,Strike Price,Premium,Contracts,Fees,Profit/Loss
AAPL,01/15/2024,170.00,3.25,2,1.30,150.00
MSFT,2024-03-01,400.00,5.50,1,0.65,-50.00`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(2);

      const aapl = result.transactions[0];
      expect(aapl.symbol).toBe('AAPL');
      expect(aapl.transactionDate).toEqual(new Date(2024, 0, 15));
      expect(aapl.strikePrice).toBe(170);
      expect(aapl.price).toBe(3.25);
      expect(aapl.quantity).toBe(2);
      expect(aapl.fees).toBe(1.30);
      expect(aapl.amount).toBe(150);
      expect(aapl.portfolioId).toBe(portfolioId);
      expect(aapl.planId).toBe(planId);
      expect(aapl.source).toBe('csv');

      const msft = result.transactions[1];
      expect(msft.symbol).toBe('MSFT');
      expect(msft.transactionDate).toEqual(new Date(2024, 2, 1));
    });

    it('returns error when required columns are missing', async () => {
      const csv = `Name,Price,Date
AAPL,150.00,01/15/2024`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Missing required columns');
      expect(result.errors[0].missingFields).toContain('Stock Symbol');
      expect(result.errors[0].missingFields).toContain('Open Date');
    });

    it('skips rows with empty Stock Symbol and adds to errors', async () => {
      const csv = `Stock Symbol,Open Date,Premium
AAPL,01/15/2024,3.25
,01/20/2024,2.00
MSFT,02/01/2024,5.50`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions).toHaveLength(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(3); // row 3 in the file (header=1, data starts at 2)
      expect(result.errors[0].reason).toContain('Missing or empty Stock Symbol');
    });

    it('skips rows with unparseable Open Date and adds to errors', async () => {
      const csv = `Stock Symbol,Open Date,Premium
AAPL,01/15/2024,3.25
TSLA,not-a-date,2.00
MSFT,02/01/2024,5.50`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions).toHaveLength(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0].reason).toContain('Unparseable Open Date');
    });

    it('maps Option Type to determine assetType', async () => {
      const csv = `Stock Symbol,Open Date,Option Type,Direction,Strike Price,Premium
AAPL,01/15/2024,Call,Buy,170.00,3.25
MSFT,01/15/2024,Put,Sell,400.00,5.50
SPY,01/15/2024,,Buy,,0`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].assetType).toBe('Option');
      expect(result.transactions[0].optionType).toBe('Call');
      expect(result.transactions[0].transactionType).toBe('Buy');
      expect(result.transactions[1].assetType).toBe('Option');
      expect(result.transactions[1].optionType).toBe('Put');
      expect(result.transactions[1].transactionType).toBe('Sell');
      expect(result.transactions[2].assetType).toBe('Stock');
      expect(result.transactions[2].optionType).toBeUndefined();
    });

    it('maps Strategy to description and Notes to rawDescription', async () => {
      const csv = `Stock Symbol,Open Date,Strategy,Notes
AAPL,01/15/2024,Iron Condor,Weekly play on earnings`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].description).toBe('Iron Condor');
      expect(result.transactions[0].rawDescription).toBe('Weekly play on earnings');
    });

    it('maps Close Date to settlementDate', async () => {
      const csv = `Stock Symbol,Open Date,Close Date
AAPL,01/15/2024,02/15/2024`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].settlementDate).toEqual(new Date(2024, 1, 15));
    });

    it('generates unique IDs for each transaction', async () => {
      const csv = `Stock Symbol,Open Date
AAPL,01/15/2024
AAPL,01/15/2024`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].id).not.toBe(result.transactions[1].id);
      expect(result.transactions[0].id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('handles ArrayBuffer input gracefully', async () => {
      const buffer = new ArrayBuffer(10);
      const result = await parser.parse(buffer, portfolioId, planId);

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('requires string content');
    });

    it('handles MM/DD/YY date format', async () => {
      const csv = `Stock Symbol,Open Date
AAPL,01/15/24`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].transactionDate).toEqual(new Date(2024, 0, 15));
    });

    it('normalizes symbol to uppercase', async () => {
      const csv = `Stock Symbol,Open Date
aapl,01/15/2024`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].symbol).toBe('AAPL');
    });

    it('defaults quantity to 1 when contracts is 0 or empty', async () => {
      const csv = `Stock Symbol,Open Date,Contracts
AAPL,01/15/2024,
MSFT,01/15/2024,0`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].quantity).toBe(1);
      expect(result.transactions[1].quantity).toBe(1);
    });

    it('handles Expiration Date column', async () => {
      const csv = `Stock Symbol,Open Date,Expiration Date,Option Type
AAPL,01/15/2024,03/15/2024,Call`;

      const result = await parser.parse(csv, portfolioId, planId);

      expect(result.transactions[0].expirationDate).toEqual(new Date(2024, 2, 15));
    });
  });
});
