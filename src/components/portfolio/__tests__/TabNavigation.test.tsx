import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabNavigation from '../TabNavigation';

describe('TabNavigation', () => {
  it('renders Holdings and Transactions tabs', () => {
    render(<TabNavigation activeTab="holdings" onTabChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Holdings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Transactions' })).toBeInTheDocument();
  });

  it('renders a tablist container', () => {
    render(<TabNavigation activeTab="holdings" onTabChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true', () => {
    render(<TabNavigation activeTab="holdings" onTabChange={() => {}} />);
    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    expect(holdingsTab).toHaveAttribute('aria-selected', 'true');
    expect(transactionsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('marks transactions tab as active when activeTab is transactions', () => {
    render(<TabNavigation activeTab="transactions" onTabChange={() => {}} />);
    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    expect(holdingsTab).toHaveAttribute('aria-selected', 'false');
    expect(transactionsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('sets tabIndex=0 on active tab and tabIndex=-1 on inactive tab', () => {
    render(<TabNavigation activeTab="holdings" onTabChange={() => {}} />);
    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    expect(holdingsTab).toHaveAttribute('tabindex', '0');
    expect(transactionsTab).toHaveAttribute('tabindex', '-1');
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="holdings" onTabChange={onTabChange} />);

    await user.click(screen.getByRole('tab', { name: 'Transactions' }));
    expect(onTabChange).toHaveBeenCalledWith('transactions');
  });

  it('calls onTabChange when Enter key is pressed on a tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="holdings" onTabChange={onTabChange} />);

    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    holdingsTab.focus();
    await user.keyboard('{Enter}');
    expect(onTabChange).toHaveBeenCalledWith('holdings');
  });

  it('calls onTabChange when Space key is pressed on a tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="holdings" onTabChange={onTabChange} />);

    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    holdingsTab.focus();
    await user.keyboard(' ');
    expect(onTabChange).toHaveBeenCalledWith('holdings');
  });

  it('navigates to next tab with ArrowRight key', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="holdings" onTabChange={onTabChange} />);

    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    holdingsTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(onTabChange).toHaveBeenCalledWith('transactions');
  });

  it('navigates to previous tab with ArrowLeft key', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="transactions" onTabChange={onTabChange} />);

    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    transactionsTab.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onTabChange).toHaveBeenCalledWith('holdings');
  });

  it('wraps around with ArrowRight from last tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="transactions" onTabChange={onTabChange} />);

    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    transactionsTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(onTabChange).toHaveBeenCalledWith('holdings');
  });

  it('wraps around with ArrowLeft from first tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="holdings" onTabChange={onTabChange} />);

    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    holdingsTab.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onTabChange).toHaveBeenCalledWith('transactions');
  });

  it('has aria-controls linking to tab panels', () => {
    render(<TabNavigation activeTab="holdings" onTabChange={() => {}} />);
    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    expect(holdingsTab).toHaveAttribute('aria-controls', 'tabpanel-holdings');
    expect(transactionsTab).toHaveAttribute('aria-controls', 'tabpanel-transactions');
  });

  it('visually distinguishes active tab with different styling', () => {
    render(<TabNavigation activeTab="holdings" onTabChange={() => {}} />);
    const holdingsTab = screen.getByRole('tab', { name: 'Holdings' });
    const transactionsTab = screen.getByRole('tab', { name: 'Transactions' });
    // Active tab has indigo styling classes
    expect(holdingsTab.className).toContain('border-indigo-600');
    expect(holdingsTab.className).toContain('font-semibold');
    // Inactive tab does not
    expect(transactionsTab.className).not.toContain('border-indigo-600');
    expect(transactionsTab.className).not.toContain('font-semibold');
  });
});
