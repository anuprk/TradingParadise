import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import VacationSection from '../VacationSection';
import type { VacationRule } from '../../../types/tradingPlan';

function makeRules(count: number): VacationRule[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    order: i + 1,
    text: `Rule ${i + 1}`,
  }));
}

describe('VacationSection', () => {
  it('renders empty state when no rules exist', () => {
    render(<VacationSection vacationRules={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no vacation rules defined yet/i)).toBeInTheDocument();
  });

  it('renders existing rules as a numbered list', () => {
    const rules = makeRules(3);
    render(<VacationSection vacationRules={rules} onChange={vi.fn()} />);
    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(screen.getByText('Rule 2')).toBeInTheDocument();
    expect(screen.getByText('Rule 3')).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });

  it('adds a new vacation rule', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VacationSection vacationRules={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Rule Text'), 'Close speculative positions');
    await user.click(screen.getByRole('button', { name: 'Add Rule' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as VacationRule[];
    expect(updated).toHaveLength(1);
    expect(updated[0].text).toBe('Close speculative positions');
    expect(updated[0].order).toBe(1);
  });

  it('disables Add Rule button when text is empty', () => {
    render(<VacationSection vacationRules={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add Rule' })).toBeDisabled();
  });

  it('removes a rule and reorders remaining', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(3);
    render(<VacationSection vacationRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove rule: rule 2/i }));

    const updated = onChange.mock.calls[0][0] as VacationRule[];
    expect(updated).toHaveLength(2);
    expect(updated[0].text).toBe('Rule 1');
    expect(updated[0].order).toBe(1);
    expect(updated[1].text).toBe('Rule 3');
    expect(updated[1].order).toBe(2);
  });

  it('edits a rule text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(1);
    render(<VacationSection vacationRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit rule: rule 1/i }));
    const input = screen.getByDisplayValue('Rule 1');
    await user.clear(input);
    await user.type(input, 'Updated rule');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const updated = onChange.mock.calls[0][0] as VacationRule[];
    expect(updated[0].text).toBe('Updated rule');
  });

  it('cancels edit without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(1);
    render(<VacationSection vacationRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit rule: rule 1/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves a rule up', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(3);
    render(<VacationSection vacationRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /move rule up: rule 2/i }));

    const updated = onChange.mock.calls[0][0] as VacationRule[];
    expect(updated[0].text).toBe('Rule 2');
    expect(updated[0].order).toBe(1);
    expect(updated[1].text).toBe('Rule 1');
    expect(updated[1].order).toBe(2);
  });

  it('moves a rule down', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = makeRules(3);
    render(<VacationSection vacationRules={rules} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /move rule down: rule 2/i }));

    const updated = onChange.mock.calls[0][0] as VacationRule[];
    expect(updated[1].text).toBe('Rule 3');
    expect(updated[1].order).toBe(2);
    expect(updated[2].text).toBe('Rule 2');
    expect(updated[2].order).toBe(3);
  });

  it('disables move up for first rule and move down for last rule', () => {
    const rules = makeRules(2);
    render(<VacationSection vacationRules={rules} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /move rule up: rule 1/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move rule down: rule 2/i })).toBeDisabled();
  });
});
