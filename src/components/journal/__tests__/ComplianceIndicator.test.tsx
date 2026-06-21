import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ComplianceIndicator from '../ComplianceIndicator';
import type { TradeJournalEntry } from '../../../types/journal';
import type { Strategy } from '../../../types/tradingPlan';

function makeEntry(overrides: Partial<TradeJournalEntry> = {}): TradeJournalEntry {
  return {
    id: '1',
    instrumentType: 'Option',
    stockSymbol: 'AAPL',
    campaign: '',
    openDate: new Date('2025-01-01'),
    expirationDate: new Date('2025-02-14'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 150,
    dte: 44,
    ditc: 10,
    breakEvenPrice: 145,
    strikePrice: 150,
    premium: 5,
    contracts: 1,
    quantity: 0,
    cashReserve: 15000,
    fees: 1,
    tradeStatus: 'Open',
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan1',
    winLoss: null,
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 's1',
    name: 'Test Strategy',
    classification: 'Core',
    description: 'A test strategy',
    entryCriteria: [],
    managementRules: [{ id: 'm1', triggerCondition: 'test', actionDescription: 'test' }],
    profitTargets: [],
    stopLosses: [],
    ...overrides,
  };
}

describe('ComplianceIndicator', () => {
  it('shows compliant badge when no deviations', () => {
    const entry = makeEntry({ dte: 40 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });

    render(<ComplianceIndicator entry={entry} strategy={strategy} />);
    expect(screen.getByText(/Compliant/)).toBeInTheDocument();
  });

  it('shows compliant badge when strategy has no entry criteria', () => {
    const entry = makeEntry();
    const strategy = makeStrategy({ entryCriteria: [] });

    render(<ComplianceIndicator entry={entry} strategy={strategy} />);
    expect(screen.getByText(/Compliant/)).toBeInTheDocument();
  });

  it('shows violation badge when entry deviates from criteria', () => {
    const entry = makeEntry({ dte: 10 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });

    render(<ComplianceIndicator entry={entry} strategy={strategy} />);
    expect(screen.getByText(/violation/i)).toBeInTheDocument();
  });

  it('expands to show deviation details on click', () => {
    const entry = makeEntry({ dte: 10 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });

    render(<ComplianceIndicator entry={entry} strategy={strategy} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Deviations')).toBeInTheDocument();
    expect(screen.getByText('DTE')).toBeInTheDocument();
    expect(screen.getByText(/Expected:/)).toBeInTheDocument();
    expect(screen.getByText(/Actual:/)).toBeInTheDocument();
  });

  it('collapses deviation details on second click', () => {
    const entry = makeEntry({ dte: 10 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });

    render(<ComplianceIndicator entry={entry} strategy={strategy} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Deviations')).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByText('Deviations')).not.toBeInTheDocument();
  });

  it('shows warning badge for minor deviations', () => {
    // DTE of 28 is just below the 30-45 range but within 10% of min (27)
    const entry = makeEntry({ dte: 28 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });

    render(<ComplianceIndicator entry={entry} strategy={strategy} />);
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });
});
