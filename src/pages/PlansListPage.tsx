import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlanStore } from '../stores/planStore';
import { FileText, Plus } from 'lucide-react';
import Button from '../components/ui/Button';

export default function PlansListPage() {
  const { plans, loadPlans, isLoading } = usePlanStore();
  const navigate = useNavigate();

  useEffect(() => { loadPlans(); }, [loadPlans]);

  if (isLoading) {
    return <div className="p-6 text-center text-text-secondary">Loading plans...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Trading Plans</h1>
        <Button size="sm" onClick={() => navigate('/plans/new')}>
          <Plus size={14} className="mr-1" /> New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 text-text-secondary mx-auto mb-3" />
          <p className="text-text-secondary">No trading plans yet.</p>
          <Button size="sm" className="mt-4" onClick={() => navigate('/plans/new')}>Create Your First Plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/plans/${plan.id}`}
              className="border border-border rounded-lg p-4 hover:bg-surface-tertiary transition-colors block"
            >
              <h3 className="text-sm font-semibold text-text-primary">{plan.name}</h3>
              <p className="text-xs text-text-secondary mt-1">{plan.author} · {plan.year}</p>
              <p className="text-[10px] text-text-secondary mt-2">
                Updated {new Date(plan.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
