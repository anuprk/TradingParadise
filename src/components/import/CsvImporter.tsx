import { useState, useRef, useCallback } from 'react';
import { parseCsvToEntries, type CsvParseResult } from '../../utils/csvImport';
import { useJournalStore } from '../../stores/journalStore';
import { useAppStore } from '../../stores/appStore';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { formatCurrency } from '../../utils/formatters';
import type { TradeJournalEntry } from '../../types/journal';

interface CsvImporterProps {
  planId: string;
  portfolioId?: string;
}

type ImportStep = 'upload' | 'preview' | 'done';

function parseGoogleSheetsUrl(url: string): { spreadsheetId: string; gid: string } | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const gidMatch = url.match(/gid=(\d+)/);
  return { spreadsheetId: match[1], gid: gidMatch ? gidMatch[1] : '0' };
}

export default function CsvImporter({ planId, portfolioId }: CsvImporterProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addEntry = useJournalStore((s) => s.addEntry);
  const addToast = useAppStore((s) => s.addToast);

  if (!portfolioId) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📁</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Portfolio Available</h3>
          <p className="text-sm text-text-secondary">
            Create a portfolio first before importing trades. Go to the Portfolios page to set one up.
          </p>
        </div>
      </Card>
    );
  }

  const processCsvText = useCallback((text: string) => {
    const result = parseCsvToEntries(text, planId, portfolioId);
    setParseResult(result);
    setStep('preview');
  }, [planId, portfolioId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) processCsvText(text);
    };
    reader.readAsText(file);
  }, [processCsvText]);

  const handleGoogleSheetsImport = useCallback(async () => {
    setFetchError('');
    const parsed = parseGoogleSheetsUrl(sheetsUrl.trim());
    if (!parsed) {
      setFetchError('Invalid Google Sheets URL. Paste the full URL from your browser.');
      return;
    }
    setIsFetching(true);
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/export?format=csv&gid=${parsed.gid}`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error(`Failed to fetch (${response.status}). Make sure the sheet is shared as "Anyone with the link".`);
      const text = await response.text();
      if (text.includes('<!DOCTYPE html>') || text.includes('Page Not Found')) {
        throw new Error('Could not access the spreadsheet. Ensure sharing is "Anyone with the link → Viewer".');
      }
      processCsvText(text);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch spreadsheet.');
    } finally {
      setIsFetching(false);
    }
  }, [sheetsUrl, processCsvText]);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;
    if (!portfolioId) {
      addToast('Please create a portfolio before importing trades.', 'error');
      return;
    }
    setIsImporting(true);
    let count = 0;
    try {
      for (const entry of parseResult.entries) {
        await addEntry(entry);
        count++;
      }
      setImportedCount(count);
      setStep('done');
      addToast(`Imported ${count} trades successfully.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Imported ${count} trades before error: ${message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  }, [parseResult, addEntry, addToast, portfolioId]);

  const handleReset = () => {
    setStep('upload');
    setParseResult(null);
    setImportedCount(0);
    setSheetsUrl('');
    setFetchError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stats = parseResult ? computeStats(parseResult.entries) : null;

  return (
    <div className="space-y-4">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option A: Google Sheets URL */}
          <Card>
            <div className="py-4">
              <div className="text-2xl mb-2 text-center">🔗</div>
              <h3 className="text-sm font-semibold text-text-primary mb-1 text-center">Import from Google Sheets</h3>
              <p className="text-xs text-text-secondary mb-3 text-center">
                Paste your Google Sheets URL (must be shared as "Anyone with the link")
              </p>
              <div className="space-y-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetsUrl}
                  onChange={(e) => { setSheetsUrl(e.target.value); setFetchError(''); }}
                />
                {fetchError && <p className="text-xs text-error">{fetchError}</p>}
                <Button size="sm" onClick={handleGoogleSheetsImport} disabled={!sheetsUrl.trim() || isFetching} className="w-full">
                  {isFetching ? 'Fetching…' : 'Fetch & Import'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Option B: CSV File */}
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl mb-2">📄</div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Upload CSV File</h3>
              <p className="text-xs text-text-secondary mb-3">
                Export from Google Sheets (File → Download → CSV) or any broker
              </p>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" aria-label="Select CSV file" />
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose CSV File
              </Button>
              <p className="text-[10px] text-text-secondary mt-2">Supports: Google Sheets, Tastytrade, Fidelity</p>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && parseResult && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">Import Preview</h3>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleReset}>Cancel</Button>
                <Button size="sm" onClick={handleImport} disabled={isImporting || parseResult.entries.length === 0}>
                  {isImporting ? 'Importing…' : `Import ${parseResult.entries.length} Trades`}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatBox label="Parsed" value={parseResult.entries.length} />
              <StatBox label="Skipped" value={parseResult.skipped} color="gray" />
              <StatBox label="Errors" value={parseResult.errors.length} color="red" />
              <StatBox label="Total Rows" value={parseResult.total} color="gray" />
            </div>
            {parseResult.errors.length > 0 && (
              <div className="bg-error/10 border border-error/30 rounded p-3 max-h-32 overflow-auto">
                {parseResult.errors.slice(0, 10).map((err, i) => <p key={i} className="text-xs text-error">{err}</p>)}
                {parseResult.errors.length > 10 && <p className="text-xs text-error mt-1">...and {parseResult.errors.length - 10} more</p>}
              </div>
            )}
          </Card>

          {stats && (
            <Card title="Quick Report">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="Total Trades" value={String(stats.totalTrades)} />
                <Stat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
                <Stat label="Total P/L" value={formatCurrency(stats.totalPL)} color={stats.totalPL >= 0 ? 'green' : 'red'} />
                <Stat label="Avg P/L" value={formatCurrency(stats.avgPL)} color={stats.avgPL >= 0 ? 'green' : 'red'} />
                <Stat label="Best Trade" value={formatCurrency(stats.bestTrade)} color="green" />
                <Stat label="Worst Trade" value={formatCurrency(stats.worstTrade)} color="red" />
              </div>
            </Card>
          )}

          <Card title="Trades Preview">
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-surface-tertiary sticky top-0">
                  <tr>
                    {['Symbol','Type','Dir','Open','Strike','Premium','P/L','Status','W/L'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-text-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parseResult.entries.slice(0, 50).map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-tertiary">
                      <td className="px-2 py-1.5 font-medium text-text-primary">{entry.stockSymbol}</td>
                      <td className="px-2 py-1.5"><Badge variant={entry.optionType === 'Call' ? 'info' : 'warning'}>{entry.optionType}</Badge></td>
                      <td className="px-2 py-1.5 text-text-secondary">{entry.direction}</td>
                      <td className="px-2 py-1.5 text-text-secondary">{entry.openDate.toLocaleDateString()}</td>
                      <td className="px-2 py-1.5 text-right">${entry.strikePrice}</td>
                      <td className="px-2 py-1.5 text-right">${entry.premium.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right font-medium ${(entry.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {entry.profitLoss != null ? formatCurrency(entry.profitLoss) : '—'}
                      </td>
                      <td className="px-2 py-1.5"><Badge variant={entry.tradeStatus === 'Open' ? 'info' : 'neutral'}>{entry.tradeStatus}</Badge></td>
                      <td className="px-2 py-1.5">{entry.winLoss ? <Badge variant={entry.winLoss === 'Win' ? 'success' : 'danger'}>{entry.winLoss}</Badge> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.entries.length > 50 && <p className="text-xs text-text-secondary text-center py-2">Showing 50 of {parseResult.entries.length}</p>}
            </div>
          </Card>
        </>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Import Complete</h3>
            <p className="text-sm text-text-secondary mb-4">Imported {importedCount} trades into your journal.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={handleReset}>Import More</Button>
              <Button onClick={() => window.location.href = '/journal'}>View Journal</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  const textColor = color === 'red' ? 'text-error' : color === 'gray' ? 'text-text-secondary' : 'text-text-primary';
  return (
    <div className="bg-surface-tertiary rounded-lg p-3 text-center">
      <p className="text-xs text-text-secondary uppercase">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold ${color === 'green' ? 'text-success' : color === 'red' ? 'text-error' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function computeStats(entries: TradeJournalEntry[]) {
  const closed = entries.filter((e) => e.profitLoss != null);
  const totalTrades = closed.length;
  if (totalTrades === 0) return { totalTrades: 0, winRate: 0, totalPL: 0, avgPL: 0, bestTrade: 0, worstTrade: 0 };
  const wins = closed.filter((e) => (e.profitLoss ?? 0) > 0).length;
  const totalPL = closed.reduce((s, e) => s + (e.profitLoss ?? 0), 0);
  const pls = closed.map((e) => e.profitLoss ?? 0);
  return { totalTrades, winRate: (wins / totalTrades) * 100, totalPL, avgPL: totalPL / totalTrades, bestTrade: Math.max(...pls), worstTrade: Math.min(...pls) };
}
