import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import TradeJournal from '../components/journal/TradeJournal';
import PlanViewer from '../components/plan/PlanViewer';

type PlanTab = 'plan' | 'journal';

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setActivePlanId = useAppStore((s) => s.setActivePlanId);
  const [activeTab, setActiveTab] = useState<PlanTab>('journal');

  // Set active plan for journal to use
  useEffect(() => {
    if (id) setActivePlanId(id);
  }, [id, setActivePlanId]);

  if (!id) {
    return <div className="p-6"><Link to="/plans" className="text-text-accent text-sm">← Back to Plans</Link></div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <Link to="/plans" className="text-text-accent hover:text-indigo-800 text-sm">← Back to Plans</Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'journal' ? 'border-b-2 border-text-accent text-text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Journal
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'plan' ? 'border-b-2 border-text-accent text-text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Plan
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'journal' && <TradeJournal />}
      {activeTab === 'plan' && <PlanViewer planId={id} />}
    </div>
  );
}
