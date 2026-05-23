import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUpload, {
  validateFile,
  getFileExtension,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
} from '../FileUpload';

function createFile(name: string, size: number, type = 'application/octet-stream'): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('FileUpload', () => {
  describe('rendering', () => {
    it('renders the drop zone and choose file button', () => {
      render(<FileUpload onFileSelected={vi.fn()} />);
      expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument();
      expect(screen.getByText(/drag & drop your file here/i)).toBeInTheDocument();
    });

    it('renders the hidden file input with correct accept attribute', () => {
      render(<FileUpload onFileSelected={vi.fn()} />);
      const input = screen.getByTestId('file-input') as HTMLInputElement;
      expect(input).toHaveAttribute('accept', '.pdf,.csv');
      expect(input).toHaveClass('hidden');
    });

    it('does not show error message initially', () => {
      render(<FileUpload onFileSelected={vi.fn()} />);
      expect(screen.queryByTestId('file-upload-error')).not.toBeInTheDocument();
    });
  });

  describe('file input selection', () => {
    it('calls onFileSelected with a valid PDF file', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);

      const input = screen.getByTestId('file-input');
      const file = createFile('statement.pdf', 1024, 'application/pdf');
      fireEvent.change(input, { target: { files: [file] } });

      expect(onFileSelected).toHaveBeenCalledWith(file);
      expect(screen.queryByTestId('file-upload-error')).not.toBeInTheDocument();
    });

    it('calls onFileSelected with a valid CSV file', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);

      const input = screen.getByTestId('file-input');
      const file = createFile('trades.csv', 2048, 'text/csv');
      fireEvent.change(input, { target: { files: [file] } });

      expect(onFileSelected).toHaveBeenCalledWith(file);
    });

    it('shows error for invalid file extension', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);

      const input = screen.getByTestId('file-input');
      const file = createFile('image.png', 1024, 'image/png');
      fireEvent.change(input, { target: { files: [file] } });

      expect(onFileSelected).not.toHaveBeenCalled();
      expect(screen.getByTestId('file-upload-error')).toBeInTheDocument();
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });

    it('shows error for file exceeding 10MB', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);

      const input = screen.getByTestId('file-input');
      const file = createFile('large.pdf', MAX_FILE_SIZE + 1, 'application/pdf');
      fireEvent.change(input, { target: { files: [file] } });

      expect(onFileSelected).not.toHaveBeenCalled();
      expect(screen.getByTestId('file-upload-error')).toBeInTheDocument();
      expect(screen.getByText(/exceeds the 10MB limit/i)).toBeInTheDocument();
    });

    it('clears error when a valid file is selected after an invalid one', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);

      const input = screen.getByTestId('file-input');

      // First: invalid file
      const badFile = createFile('image.png', 1024);
      fireEvent.change(input, { target: { files: [badFile] } });
      expect(screen.getByTestId('file-upload-error')).toBeInTheDocument();

      // Then: valid file
      const goodFile = createFile('trades.csv', 1024, 'text/csv');
      fireEvent.change(input, { target: { files: [goodFile] } });
      expect(screen.queryByTestId('file-upload-error')).not.toBeInTheDocument();
      expect(onFileSelected).toHaveBeenCalledWith(goodFile);
    });
  });

  describe('drag and drop', () => {
    it('adds visual feedback on drag over', () => {
      render(<FileUpload onFileSelected={vi.fn()} />);
      const dropZone = screen.getByTestId('file-drop-zone');

      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone).toHaveClass('border-indigo-500');
      expect(dropZone).toHaveClass('bg-text-accent/20');
    });

    it('removes visual feedback on drag leave', () => {
      render(<FileUpload onFileSelected={vi.fn()} />);
      const dropZone = screen.getByTestId('file-drop-zone');

      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
      fireEvent.dragLeave(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone).not.toHaveClass('border-indigo-500');
    });

    it('calls onFileSelected when a valid file is dropped', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);
      const dropZone = screen.getByTestId('file-drop-zone');

      const file = createFile('statement.pdf', 5000, 'application/pdf');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(onFileSelected).toHaveBeenCalledWith(file);
    });

    it('shows error when an invalid file is dropped', () => {
      const onFileSelected = vi.fn();
      render(<FileUpload onFileSelected={onFileSelected} />);
      const dropZone = screen.getByTestId('file-drop-zone');

      const file = createFile('doc.txt', 1024, 'text/plain');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(onFileSelected).not.toHaveBeenCalled();
      expect(screen.getByTestId('file-upload-error')).toBeInTheDocument();
    });
  });

  describe('validateFile utility', () => {
    it('returns null for valid PDF file', () => {
      const file = createFile('test.pdf', 1024);
      expect(validateFile(file)).toBeNull();
    });

    it('returns null for valid CSV file', () => {
      const file = createFile('test.csv', 1024);
      expect(validateFile(file)).toBeNull();
    });

    it('returns error for unsupported extension', () => {
      const file = createFile('test.xlsx', 1024);
      expect(validateFile(file)).toContain('Invalid file type');
    });

    it('returns error for file with no extension', () => {
      const file = createFile('noextension', 1024);
      expect(validateFile(file)).toContain('Invalid file type');
    });

    it('returns error for file exceeding max size', () => {
      const file = createFile('big.pdf', MAX_FILE_SIZE + 1);
      expect(validateFile(file)).toContain('exceeds the 10MB limit');
    });

    it('accepts file exactly at max size', () => {
      const file = createFile('exact.pdf', MAX_FILE_SIZE);
      expect(validateFile(file)).toBeNull();
    });
  });

  describe('getFileExtension utility', () => {
    it('extracts .pdf extension', () => {
      expect(getFileExtension('file.pdf')).toBe('.pdf');
    });

    it('extracts .csv extension', () => {
      expect(getFileExtension('data.csv')).toBe('.csv');
    });

    it('handles uppercase extensions', () => {
      expect(getFileExtension('FILE.PDF')).toBe('.pdf');
    });

    it('returns empty string for no extension', () => {
      expect(getFileExtension('noext')).toBe('');
    });

    it('handles multiple dots', () => {
      expect(getFileExtension('my.file.csv')).toBe('.csv');
    });
  });

  describe('constants', () => {
    it('accepts pdf and csv extensions', () => {
      expect(ACCEPTED_EXTENSIONS).toContain('.pdf');
      expect(ACCEPTED_EXTENSIONS).toContain('.csv');
    });

    it('max file size is 10MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
  });
});
