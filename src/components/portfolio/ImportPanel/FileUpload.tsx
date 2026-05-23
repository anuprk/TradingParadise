import { useState, useRef, useCallback } from 'react';
import Button from '../../ui/Button';

const ACCEPTED_EXTENSIONS = ['.pdf', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadProps {
  onFileSelected: (file: File) => void;
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filename.slice(dotIndex).toLowerCase();
}

function validateFile(file: File): string | null {
  const extension = getFileExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `Invalid file type "${extension || 'none'}". Only PDF and CSV files are accepted.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB limit.`;
  }
  return null;
}

export default function FileUpload({ onFileSelected }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-3">
      <div
        data-testid="file-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-indigo-500 bg-text-accent/20'
            : 'border-border bg-surface-tertiary hover:border-gray-400'
        }`}
      >
        <div className="text-3xl mb-3">📁</div>
        <p className="text-sm font-medium text-text-primary mb-1">
          Drag & drop your file here
        </p>
        <p className="text-xs text-text-secondary mb-4">
          Supports PDF (tastytrade, Fidelity) and CSV files up to 10MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="Select PDF or CSV file"
          data-testid="file-input"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose File
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-error/10 border border-error/30 rounded-md p-3"
          data-testid="file-upload-error"
        >
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
    </div>
  );
}

export { validateFile, getFileExtension, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE };
