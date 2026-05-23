import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SectionNav, { PLAN_SECTIONS } from '../SectionNav';

describe('SectionNav', () => {
  it('renders all plan sections', () => {
    render(<SectionNav activeSection="metadata-goals" onSectionChange={() => {}} />);
    for (const section of PLAN_SECTIONS) {
      expect(screen.getByText(section.label)).toBeInTheDocument();
    }
  });

  it('highlights the active section', () => {
    render(<SectionNav activeSection="risk-management" onSectionChange={() => {}} />);
    const activeBtn = screen.getByText('Risk Management');
    expect(activeBtn).toHaveAttribute('aria-current', 'true');
    expect(activeBtn.className).toContain('bg-surface-tertiary');
  });

  it('does not highlight inactive sections', () => {
    render(<SectionNav activeSection="risk-management" onSectionChange={() => {}} />);
    const inactiveBtn = screen.getByText('Trade Rules');
    expect(inactiveBtn).not.toHaveAttribute('aria-current');
    expect(inactiveBtn.className).not.toContain('bg-surface-tertiary text-text-accent');
  });

  it('calls onSectionChange when a section is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SectionNav activeSection="metadata-goals" onSectionChange={onChange} />);

    await user.click(screen.getByText('Vacation Rules'));
    expect(onChange).toHaveBeenCalledWith('vacation-rules');
  });

  it('has correct number of sections', () => {
    expect(PLAN_SECTIONS).toHaveLength(10);
  });
});
