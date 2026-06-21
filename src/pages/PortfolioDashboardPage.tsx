import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePortfolioStore } from '../stores/portfolioStore';
import TabNavigation, { type PortfolioTab } from '../components/portfolio/TabNavigation';
import HoldingsTab from '../components/portfolio/HoldingsTab';
import DividendSummary from '../components/portfolio/DividendSummary';

export default function PortfolioDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { currentPortfolio, isLoading: portfolioLoading, selectPortfolio } = usePortfolioStore();
  const [activeTab, setActiveTab] = useState<PortfolioTab>('holdings');

  useEffect(() => {
    if (id) selectPortfolio(id);
  }, [id, selectPortfolio]);

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">No portfolio selected.</p>
        <Link to="/portfolios" className="text-text-accent hover:text-indigo-800 text-sm mt-2 inline-block">← Back to Portfolios</Link>
      </div>
    );
  }

  if (portfolioLoading) {
    return <div className="p-6 flex items-center justify-center py-12"><p className="text-text-secondary">Loading portfolio...</p></div>;
  }

  if (!currentPortfolio) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-text-primary text-lg font-medium">Portfolio not found</p>
          <Link to="/portfolios" className="text-text-accent text-sm mt-4 inline-block">← Back to Portfolios</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/portfolios" className="text-text-accent hover:text-indigo-800 text-sm">← Back to Portfolios</Link>
        <h2 className="text-xl font-bold text-text-primary mt-2">{currentPortfolio.name}</h2>
        {currentPortfolio.description && <p className="mt-1 text-sm text-text-secondary">{currentPortfolio.description}</p>}
      </div>

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'holdings' && <HoldingsTab portfolioId={id} />}
        {activeTab === 'dividends' && <DividendSummary portfolioId={id} />}
      </div>
    </div>
  );
}
