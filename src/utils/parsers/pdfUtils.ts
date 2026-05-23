/**
 * PDF text extraction utility using pdfjs-dist.
 *
 * Uses pdfjs-dist without a web worker for maximum compatibility.
 * This runs PDF parsing on the main thread which is fine for statement-sized PDFs.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Disable the worker to avoid worker loading issues in various environments.
// For statement PDFs (typically < 5MB), main-thread parsing is fast enough.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * Extracts text content from a PDF ArrayBuffer.
 * Returns an array of strings, one per page.
 *
 * @param data - The PDF file content as an ArrayBuffer
 * @returns Array of page text strings
 */
export async function extractTextFromPDF(data: ArrayBuffer): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .filter((item): item is { str: string; transform: number[] } => 'str' in item)
      .map((item) => item.str)
      .join(' ');

    pageTexts.push(pageText);
  }

  return pageTexts;
}
