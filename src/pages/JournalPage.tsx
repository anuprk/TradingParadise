import { useState } from 'react';
import TradeJournal from '../components/journal/TradeJournal';
import CsvImporter from '../components/import/CsvImporter';
import { useAppStore } from '../stores/appStore';
import { usePortfolio } from '../hooks/usePortfolio';
import Button from '../components/ui/Button';
import { Upload } from 'lucide-react';

export default function JournalPage() {
  const [showImporter, setShowImporter] = useState(false);
  const activePlanId = useAppStore((s) => s.activePlanId);
  const { portfolios } = usePortfolio();

  // Use first portfolio as default for CSV import
  const defaultPortfolioId = portfolios[0]?.id;

  return (
    <div className="p-6">
      {showImporter && activePlanId ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Import Trades</h2>
            <Button variant="secondary" size="sm" onClick={() => setShowImporter(false)}>
              ← Back to Journal
            </Button>
          </div>
          <CsvImporter planId={activePlanId} portfolioId={defaultPortfolioId} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImporter(true)}
              disabled={!activePlanId}
            >
              <Upload size={14} className="mr-1.5" />
              Import CSV
            </Button>
          </div>
          <TradeJournal />
        </>
      )}
    </div>
  );
}
