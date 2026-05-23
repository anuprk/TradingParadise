import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DailyManagementSection from '../DailyManagementSection';
import type { DailyManagement, ChecklistItem } from '../../../types/tradingPlan';

function makeItem(
  id: string,
  order: number,
  description: string,
  reviewType: 'nightly' | 'morning',
): ChecklistItem {
  return { id, order, description, reviewType };
}

function makeDM(
  nightly: ChecklistItem[] = [],
  morning: ChecklistItem[] = [],
): DailyManagement {
  return { nightlyReview: nightly, morningReview: morning };
}

describe('DailyManagementSection', () => {
  it('renders empty state for both review types', () => {
    render(<DailyManagementSection dailyManagement={makeDM()} onChange={vi.fn()} />);
    expect(screen.getByText(/no nightly review items defined yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no morning review items defined yet/i)).toBeInTheDocument();
  });

  it('renders existing nightly and morning items', () => {
    const dm = makeDM(
      [makeItem('n1', 1, 'Check positions', 'nightly')],
      [makeItem('m1', 1, 'Review market', 'morning')],
    );
    render(<DailyManagementSection dailyManagement={dm} onChange={vi.fn()} />);
    expect(screen.getByText('Check positions')).toBeInTheDocument();
    expect(screen.getByText('Review market')).toBeInTheDocument();
  });

  it('adds a nightly review item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DailyManagementSection dailyManagement={makeDM()} onChange={onChange} />);

    const inputs = screen.getAllByLabelText('Description');
    // First description input is for nightly
    await user.type(inputs[0], 'Review P/L');
    const addButtons = screen.getAllByRole('button', { name: 'Add Item' });
    await user.click(addButtons[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as DailyManagement;
    expect(updated.nightlyReview).toHaveLength(1);
    expect(updated.nightlyReview[0].description).toBe('Review P/L');
    expect(updated.nightlyReview[0].reviewType).toBe('nightly');
    expect(updated.nightlyReview[0].order).toBe(1);
    expect(updated.morningReview).toHaveLength(0);
  });

  it('adds a morning review item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DailyManagementSection dailyManagement={makeDM()} onChange={onChange} />);

    const inputs = screen.getAllByLabelText('Description');
    // Second description input is for morning
    await user.type(inputs[1], 'Check futures');
    const addButtons = screen.getAllByRole('button', { name: 'Add Item' });
    await user.click(addButtons[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as DailyManagement;
    expect(updated.morningReview).toHaveLength(1);
    expect(updated.morningReview[0].description).toBe('Check futures');
    expect(updated.morningReview[0].reviewType).toBe('morning');
  });

  it('removes an item and reorders', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const dm = makeDM([
      makeItem('n1', 1, 'Item A', 'nightly'),
      makeItem('n2', 2, 'Item B', 'nightly'),
      makeItem('n3', 3, 'Item C', 'nightly'),
    ]);
    render(<DailyManagementSection dailyManagement={dm} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove item: item b/i }));

    const updated = onChange.mock.calls[0][0] as DailyManagement;
    expect(updated.nightlyReview).toHaveLength(2);
    expect(updated.nightlyReview[0].description).toBe('Item A');
    expect(updated.nightlyReview[0].order).toBe(1);
    expect(updated.nightlyReview[1].description).toBe('Item C');
    expect(updated.nightlyReview[1].order).toBe(2);
  });

  it('edits an item description', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const dm = makeDM([makeItem('n1', 1, 'Old desc', 'nightly')]);
    render(<DailyManagementSection dailyManagement={dm} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit item: old desc/i }));
    const input = screen.getByDisplayValue('Old desc');
    await user.clear(input);
    await user.type(input, 'New desc');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const updated = onChange.mock.calls[0][0] as DailyManagement;
    expect(updated.nightlyReview[0].description).toBe('New desc');
  });

  it('cancels edit without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const dm = makeDM([makeItem('n1', 1, 'Keep me', 'nightly')]);
    render(<DailyManagementSection dailyManagement={dm} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit item: keep me/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves an item up within its review type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const dm = makeDM([
      makeItem('n1', 1, 'First', 'nightly'),
      makeItem('n2', 2, 'Second', 'nightly'),
    ]);
    render(<DailyManagementSection dailyManagement={dm} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /move item up: second/i }));

    const updated = onChange.mock.calls[0][0] as DailyManagement;
    expect(updated.nightlyReview[0].description).toBe('Second');
    expect(updated.nightlyReview[0].order).toBe(1);
    expect(updated.nightlyReview[1].description).toBe('First');
    expect(updated.nightlyReview[1].order).toBe(2);
  });

  it('moves an item down within its review type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const dm = makeDM([
      makeItem('n1', 1, 'First', 'nightly'),
      makeItem('n2', 2, 'Second', 'nightly'),
    ]);
    render(<DailyManagementSection dailyManagement={dm} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /move item down: first/i }));

    const updated = onChange.mock.calls[0][0] as DailyManagement;
    expect(updated.nightlyReview[0].description).toBe('Second');
    expect(updated.nightlyReview[1].description).toBe('First');
  });

  it('disables move up for first item and move down for last item', () => {
    const dm = makeDM([
      makeItem('n1', 1, 'Only', 'nightly'),
    ]);
    render(<DailyManagementSection dailyManagement={dm} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /move item up: only/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move item down: only/i })).toBeDisabled();
  });

  it('disables add button when description is empty', () => {
    render(<DailyManagementSection dailyManagement={makeDM()} onChange={vi.fn()} />);
    const addButtons = screen.getAllByRole('button', { name: 'Add Item' });
    expect(addButtons[0]).toBeDisabled();
    expect(addButtons[1]).toBeDisabled();
  });
});
