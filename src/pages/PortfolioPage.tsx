import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Plus, Briefcase } from 'lucide-react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useAppStore } from '../stores/appStore';
import PortfolioForm from '../components/portfolio/PortfolioForm';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import type { Portfolio } from '../types/portfolio';

/**
 * Portfolio list page — displays all portfolios for the active plan.
 * Supports create, edit, delete with confirmation when journal entries exist.
 *
 * Requirements: 17.1, 17.2, 17.10
 */
export default function PortfolioPage() {
  const navigate = useNavigate();
  const addToast = useAppStore((s) => s.addToast);
  const { portfolios, isLoading, createPortfolio, updatePortfolio, deletePortfolio } =
    usePortfolio();

  const [formOpen, setFormOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Portfolio | null>(null);
  const [deleteMessage, setDeleteMessage] = useState('');

  const handleCreate = useCallback(() => {
    setEditingPortfolio(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((portfolio: Portfolio) => {
    setEditingPortfolio(portfolio);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(
    async (portfolio: Portfolio) => {
      if (editingPortfolio) {
        await updatePortfolio(portfolio.id, {
          name: portfolio.name,
          description: portfolio.description,
          initialBalance: portfolio.initialBalance,
        });
        addToast('Portfolio updated', 'success');
      } else {
        await createPortfolio(portfolio);
        addToast('Portfolio created', 'success');
      }
      setFormOpen(false);
      setEditingPortfolio(null);
    },
    [editingPortfolio, createPortfolio, updatePortfolio, addToast],
  );

  const handleDeleteClick = useCallback(async (portfolio: Portfolio) => {
    setDeleteMessage(
      `Are you sure you want to delete "${portfolio.name}"? This will also delete all holdings. This action cannot be undone.`,
    );
    setDeleteTarget(portfolio);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deletePortfolio(deleteTarget.id);
    addToast('Portfolio deleted', 'success');
    setDeleteTarget(null);
  }, [deleteTarget, deletePortfolio, addToast]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Portfolios</h1>
        <Button onClick={handleCreate} data-testid="create-portfolio-btn">
          <Plus size={16} className="mr-1.5" />
          Create Portfolio
        </Button>
      </div>

      {isLoading ? (
        <p className="text-text-secondary">Loading portfolios…</p>
      ) : portfolios.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <Briefcase size={48} className="text-text-secondary mb-4" />
            <p className="text-text-secondary mb-2">No portfolios yet</p>
            <p className="text-sm text-text-secondary mb-4">
              Create a portfolio to start tracking your brokerage accounts.
            </p>
            <Button onClick={handleCreate} size="sm">
              <Plus size={14} className="mr-1" />
              Create Portfolio
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio) => (
            <Card key={portfolio.id} className="flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <h3
                  className="text-lg font-semibold text-text-primary cursor-pointer hover:text-text-accent transition-colors"
                  onClick={() => navigate(`/portfolios/${portfolio.id}`)}
                  data-testid={`portfolio-name-${portfolio.id}`}
                >
                  {portfolio.name}
                </h3>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button
                    onClick={() => handleEdit(portfolio)}
                    className="p-1.5 text-text-secondary hover:text-text-accent rounded-md hover:bg-surface-tertiary transition-colors"
                    aria-label={`Edit ${portfolio.name}`}
                    data-testid={`edit-portfolio-${portfolio.id}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(portfolio)}
                    className="p-1.5 text-text-secondary hover:text-error rounded-md hover:bg-surface-tertiary transition-colors"
                    aria-label={`Delete ${portfolio.name}`}
                    data-testid={`delete-portfolio-${portfolio.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {portfolio.description && (
                <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                  {portfolio.description}
                </p>
              )}
              <div className="mt-auto pt-3 border-t border-border">
                <span className="text-sm text-text-secondary">Initial Balance</span>
                <p className="text-lg font-medium text-text-primary">
                  {formatCurrency(portfolio.initialBalance)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PortfolioForm
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingPortfolio(null);
        }}
        onSave={handleSave}
        portfolio={editingPortfolio}
        planId=""
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Portfolio"
        message={deleteMessage}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
