import { useState, useCallback } from 'react';
import type { ParseResult, DuplicateReport, PortfolioTransaction } from '../../../types/transaction';
import { detectAndParse } from '../../../utils/parsers';
import { findDuplicates } from '../../../utils/deduplication';
import { getTransactionsByPortfolio } from '../../../db/transactionRepository';
import { useTransactionStore } from '../../../stores/transactionStore';
import FileUpload from './FileUpload';
import ImportPreview from './ImportPreview';
import Button from '../../ui/Button';

type ImportState = 'upload' | 'parsing' | 'preview' | 'importing' | 'success' | 'error';

interface ImportPanelProps {
  portfolioId: string;
  planId: string;
  onImportComplete?: () => void;
}

export default function ImportPanel({ portfolioId, planId, onImportComplete }: ImportPanelProps) {
  const [state, setState] = useState<ImportState>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<DuplicateReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successCount, setSuccessCount] = useState<number>(0);

  const addTransactions = useTransactionStore((s) => s.addTransactions);

  const resetToUpload = useCallback(() => {
    setState('upload');
    setParseResult(null);
    setDuplicateReport(null);
    setErrorMessage('');
    setSuccessCount(0);
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setState('parsing');
      setErrorMessage('');

      try {
        // Parse the file
        const result = await detectAndParse(file, portfolioId, planId);

        // If parsing returned only errors and no transactions, show error state
        if (result.transactions.length === 0 && result.errors.length > 0) {
          setState('error');
          setErrorMessage(result.errors[0].reason);
          return;
        }

        // Get existing transactions for de-duplication
        const existingTransactions = await getTransactionsByPortfolio(portfolioId);

        // Run de-duplication
        const dupReport = findDuplicates(result.transactions, existingTransactions);

        setParseResult(result);
        setDuplicateReport(dupReport);
        setState('preview');
      } catch (err) {
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during parsing.',
        );
      }
    },
    [portfolioId, planId],
  );

  const handleConfirm = useCallback(
    async (overriddenIds: string[]) => {
      if (!duplicateReport || !parseResult) return;

      setState('importing');

      // Collect transactions to save: unique + overridden duplicates
      const overriddenSet = new Set(overriddenIds);
      const transactionsToSave: PortfolioTransaction[] = [
        ...duplicateReport.unique,
        ...duplicateReport.duplicates
          .filter((d) => overriddenSet.has(d.transaction.id))
          .map((d) => d.transaction),
      ];

      if (transactionsToSave.length === 0) {
        setSuccessCount(0);
        setState('success');
        return;
      }

      try {
        await addTransactions(portfolioId, transactionsToSave);
        setSuccessCount(transactionsToSave.length);
        setState('success');
        onImportComplete?.();
      } catch (err) {
        // Handle partial save failures
        setState('error');
        const savedCount = 0; // In a bulk operation failure, we report what we know
        setErrorMessage(
          `Import failed. ${savedCount} transactions were saved before the error occurred. ${
            err instanceof Error ? err.message : 'Unknown error.'
          }`,
        );
      }
    },
    [duplicateReport, parseResult, portfolioId, addTransactions, onImportComplete],
  );

  const handleCancel = useCallback(() => {
    resetToUpload();
  }, [resetToUpload]);

  return (
    <div className="space-y-4" data-testid="import-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Import Transactions</h3>
        {state !== 'upload' && state !== 'parsing' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToUpload}
            data-testid="import-reset-btn"
          >
            ← Back to Upload
          </Button>
        )}
      </div>

      {/* Upload State */}
      {state === 'upload' && <FileUpload onFileSelected={handleFileSelected} />}

      {/* Parsing State */}
      {state === 'parsing' && (
        <div className="flex flex-col items-center justify-center py-12" data-testid="import-parsing">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4" />
          <p className="text-sm text-text-secondary">Parsing file and detecting duplicates...</p>
        </div>
      )}

      {/* Preview State */}
      {state === 'preview' && parseResult && duplicateReport && (
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Importing State */}
      {state === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12" data-testid="import-importing">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4" />
          <p className="text-sm text-text-secondary">Saving transactions...</p>
        </div>
      )}

      {/* Success State */}
      {state === 'success' && (
        <div
          className="bg-success/10 border border-success/30 rounded-lg p-6 text-center"
          data-testid="import-success"
        >
          <div className="text-3xl mb-3">✓</div>
          <p className="text-lg font-medium text-success">
            Successfully imported {successCount} transactions
          </p>
          <div className="mt-4">
            <Button type="button" variant="primary" size="sm" onClick={resetToUpload}>
              Import More
            </Button>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div
          className="bg-error/10 border border-error/30 rounded-lg p-6 text-center"
          data-testid="import-error"
        >
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm font-medium text-error mb-2">Import Error</p>
          <p className="text-sm text-error">{errorMessage}</p>
          <div className="mt-4">
            <Button type="button" variant="secondary" size="sm" onClick={resetToUpload}>
              Try Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
