import { describe, it, expect, vi } from 'vitest';

// Mock pdfjs-dist before importing the module under test
vi.mock('pdfjs-dist', () => {
  const mockGetTextContent = vi.fn();
  const mockGetPage = vi.fn();
  const mockGetDocument = vi.fn();

  return {
    version: '5.7.284',
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: mockGetDocument,
    __mockGetDocument: mockGetDocument,
    __mockGetPage: mockGetPage,
    __mockGetTextContent: mockGetTextContent,
  };
});

import { extractTextFromPDF } from '../pdfUtils';
import * as pdfjsLib from 'pdfjs-dist';

describe('pdfUtils', () => {
  describe('extractTextFromPDF', () => {
    it('should extract text from a single-page PDF', async () => {
      const mockTextContent = {
        items: [
          { str: 'Hello', transform: [1, 0, 0, 1, 0, 0] },
          { str: 'World', transform: [1, 0, 0, 1, 50, 0] },
        ],
      };

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue(mockTextContent),
      };

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await extractTextFromPDF(new ArrayBuffer(10));

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Hello World');
    });

    it('should extract text from a multi-page PDF', async () => {
      const page1Content = {
        items: [
          { str: 'Page', transform: [1, 0, 0, 1, 0, 0] },
          { str: '1', transform: [1, 0, 0, 1, 30, 0] },
        ],
      };

      const page2Content = {
        items: [
          { str: 'Page', transform: [1, 0, 0, 1, 0, 0] },
          { str: '2', transform: [1, 0, 0, 1, 30, 0] },
        ],
      };

      const mockPdf = {
        numPages: 2,
        getPage: vi.fn()
          .mockResolvedValueOnce({ getTextContent: vi.fn().mockResolvedValue(page1Content) })
          .mockResolvedValueOnce({ getTextContent: vi.fn().mockResolvedValue(page2Content) }),
      };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await extractTextFromPDF(new ArrayBuffer(10));

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('Page 1');
      expect(result[1]).toBe('Page 2');
    });

    it('should return empty array for a PDF with no pages', async () => {
      const mockPdf = {
        numPages: 0,
        getPage: vi.fn(),
      };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await extractTextFromPDF(new ArrayBuffer(10));

      expect(result).toHaveLength(0);
    });

    it('should handle pages with empty text content', async () => {
      const mockTextContent = { items: [] };

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue(mockTextContent),
        }),
      };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await extractTextFromPDF(new ArrayBuffer(10));

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('');
    });

    it('should filter out non-text items from text content', async () => {
      const mockTextContent = {
        items: [
          { str: 'Text item', transform: [1, 0, 0, 1, 0, 0] },
          { height: 10, width: 50 }, // non-text item (e.g., image marker)
          { str: 'Another text', transform: [1, 0, 0, 1, 0, 20] },
        ],
      };

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue(mockTextContent),
        }),
      };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await extractTextFromPDF(new ArrayBuffer(10));

      expect(result[0]).toBe('Text item Another text');
    });
  });

  describe('worker configuration', () => {
    it('should disable the worker by setting workerSrc to empty string', () => {
      expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('');
    });
  });
});
