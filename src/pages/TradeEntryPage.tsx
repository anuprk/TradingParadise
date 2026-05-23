import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import TradeEntryForm from '../components/journal/TradeEntryForm';
import { useTradingPlan } from '../hooks/useTradingPlan';
import { useJournal } from '../hooks/useJournal';
import { usePortfolio } from '../hooks/usePortfolio';
import { useAppStore } from '../stores/appStore';
import type { TradeJournalEntry } from '../types/journal';

export default function TradeEntryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const activePlanId = useAppStore((s) => s.activePlanId);
  const addToast = useAppStore((s) => s.addToast);
  const { plan } = useTradingPlan();
  const { entries, addEntry, updateEntry } = useJournal();
  const { portfolios } = usePortfolio();
  const [existingEntry, setExistingEntry] = useState<TradeJournalEntry | undefined>();

  // Load existing entry for edit mode
  useEffect(() => {
    if (id) {
      const found = entries.find((e) => e.id === id);
      setExistingEntry(found);
    } else {
      setExistingEntry(undefined);
    }
  }, [id, entries]);

  const strategies = useMemo(() => {
    if (!plan) return [];
    return [...(plan.coreStrategies ?? []), ...(plan.speculativeStrategies ?? [])];
  }, [plan]);

  const handleSave = async (entry: TradeJournalEntry) => {
    if (id) {
      await updateEntry(id, entry);
      addToast('Trade entry updated', 'success');
    } else {
      await addEntry(entry);
      addToast('Trade entry created', 'success');
    }
    navigate('/journal');
  };

  const handleCancel = () => {
    navigate('/journal');
  };

  if (!activePlanId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Trade Entry</h1>
        <p className="mt-2 text-text-secondary">Please select a trading plan first.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">
        {id ? 'Edit Trade Entry' : 'New Trade Entry'}
      </h1>
      <TradeEntryForm
        entry={existingEntry}
        strategies={strategies}
        portfolios={portfolios}
        planId={activePlanId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
