import { useState, type RefObject } from 'react';
import html2canvas from 'html2canvas';

interface ScreenshotCaptureProps {
  targetRef: RefObject<HTMLElement | null>;
  onCapture: (dataUrl: string) => void;
}

export default function ScreenshotCapture({ targetRef, onCapture }: ScreenshotCaptureProps) {
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    if (!targetRef.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(targetRef.current);
      const dataUrl = canvas.toDataURL('image/png');
      onCapture(dataUrl);
    } catch {
      // Silently fail — screenshot is a best-effort feature
    } finally {
      setCapturing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCapture}
      disabled={capturing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-secondary border border-border rounded-md shadow-sm hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="screenshot-capture-btn"
    >
      {capturing ? 'Capturing…' : '📷 Capture Screenshot'}
    </button>
  );
}
