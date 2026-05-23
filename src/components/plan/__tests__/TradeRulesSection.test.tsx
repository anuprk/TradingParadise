import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TradeRulesSection from '../TradeRulesSection';
import type { TradeRule } from '../../../types/tradingPlan';

function makeRules(count: number): TradeRule[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    order: i + 1,
    text: `Rule ${i + 1}`,
    category: i % 2 === 0 ? 'Cat A' : undefined,
  }));
}

describe('TradeRulesSection', () => {
  it('renders empty state when no rules exist', () => {
    render(<TradeRulesSection tradeRules={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no trade rules defined yet/i)).toBeInTheDocument();
  });

  it('renders existing rules as a numbered list', () => {
    const rules = makeRules(3);
    render(<TradeRulesSection tradeRules={rules} onChange={vi.fn()} />);
    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(screen.getByText('Rule 2')).toBeInTheDocument();
    expect(screen.getByText('Rule 3')).toBeInTheDocument();
    // Check numbering
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });

  it('displays category labels when present', () => {
    const rules = makeRules(2);
    render(<TradeRulesSection tradeRules={rules} onChange={vi.fn()} />);
    expect(screen.getByText('Category: Cat A')).toBeInTheDocument();
  });

  it('adds a new rule with text and optional category', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TradeRulesSection tradeRules={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Rule Text'), 'Never chase a trade');
    await user.type(screen.getByLabelText('Category (optional)'), 'Discipline');
    await user.click(screen.getByRole('button', { name: 'Add Rule' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as TradeRule[];
    expect(updated).toHaveLength(1);
    expect(updated[0].text).toBe('Never chase a trade');
    expect(updated[0].category).toBe('Discipline');
    expect(updated[0].order).toBe(1);
  });

  it('adds a rule without category', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TradeRulesSection tradeRules={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Rule Text'), 'Always use stops');
    await user.click(screen.getByRole('button', { name: 'Add Rule' }));

    const updated = onChange.mock.calls[0][0] as TradeRule[];
    expect(updated[0].category).toBeUndefined();
  });

  it('disables Add Rule button when text is empty', () => {
    render(<TradeRulesSection tradeRules={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add Rule' })).toBeDisabled();
  });

  it('removes a rule and reorders remaining', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(3);
    render(<TradeRulesSection tradeRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove rule: rule 2/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as TradeRule[];
    expect(updated).toHaveLength(2);
    expect(updated[0].text).toBe('Rule 1');
    expect(updated[0].order).toBe(1);
    expect(updated[1].text).toBe('Rule 3');
    expect(updated[1].order).toBe(2);
  });

  it('edits a rule text and category', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(2);
    render(<TradeRulesSection tradeRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit rule: rule 1/i }));

    const textInput = screen.getByDisplayValue('Rule 1');
    await user.clear(textInput);
    await user.type(textInput, 'Updated rule');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as TradeRule[];
    expect(updated[0].text).toBe('Updated rule');
  });

  it('cancels edit without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(1);
    render(<TradeRulesSection tradeRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit rule: rule 1/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves a rule up', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(3);
    render(<TradeRulesSection tradeRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /move rule up: rule 2/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as TradeRule[];
    expect(updated[0].text).toBe('Rule 2');
    expect(updated[0].order).toBe(1);
    expect(updated[1].text).toBe('Rule 1');
    expect(updated[1].order).toBe(2);
  });

  it('moves a rule down', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(3);
    render(<TradeRulesSection tradeRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /move rule down: rule 2/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as TradeRule[];
    expect(updated[1].text).toBe('Rule 3');
    expect(updated[1].order).toBe(2);
    expect(updated[2].text).toBe('Rule 2');
    expect(updated[2].order).toBe(3);
  });

  it('disables move up for first rule and move down for last rule', () => {
    const rules = makeRules(2);
    render(<TradeRulesSection tradeRules={rules} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /move rule up: rule 1/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move rule down: rule 2/i })).toBeDisabled();
  });

  it('shows warning and disables add when at 50 rules', () => {
    const rules = makeRules(50);
    render(<TradeRulesSection tradeRules={rules} onChange={vi.fn()} />);

    expect(screen.getByText(/maximum of 50 rules reached/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Rule' })).toBeDisabled();
  });
});
