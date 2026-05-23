import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import ScreenshotCapture from '../ScreenshotCapture';

// Mock html2canvas
const mockCanvas = {
  toDataURL: vi.fn(() => 'data:image/png;base64,fakedata'),
};

vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve(mockCanvas)),
}));

describe('ScreenshotCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the capture button', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <>
        <div ref={ref}>Target</div>
        <ScreenshotCapture targetRef={ref} onCapture={vi.fn()} />
      </>,
    );
    expect(screen.getByTestId('screenshot-capture-btn')).toBeInTheDocument();
    expect(screen.getByText('📷 Capture Screenshot')).toBeInTheDocument();
  });

  it('calls html2canvas and onCapture with data URL on click', async () => {
    const ref = createRef<HTMLDivElement>();
    const onCapture = vi.fn();
    const html2canvas = (await import('html2canvas')).default;

    render(
      <>
        <div ref={ref}>Target</div>
        <ScreenshotCapture targetRef={ref} onCapture={onCapture} />
      </>,
    );

    fireEvent.click(screen.getByTestId('screenshot-capture-btn'));

    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalledWith(ref.current);
      expect(onCapture).toHaveBeenCalledWith('data:image/png;base64,fakedata');
    });
  });

  it('does nothing when targetRef is null', () => {
    const ref = createRef<HTMLDivElement>();
    const onCapture = vi.fn();

    render(<ScreenshotCapture targetRef={ref} onCapture={onCapture} />);
    fireEvent.click(screen.getByTestId('screenshot-capture-btn'));

    expect(onCapture).not.toHaveBeenCalled();
  });
});
