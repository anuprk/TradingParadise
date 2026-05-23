import { useState, useEffect, useCallback } from 'react';
import { usePlanStore } from '../../stores/planStore';
import SectionNav, { PLAN_SECTIONS } from './SectionNav';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import StrategyImporter from './StrategyImporter';
import { formatCurrency, formatPercentage, formatProfitLoss } from '../../utils/formatters';
import { filterJournalEntries } from '../../db/journalRepository';
import type {
  TradingPlan,
  Strategy,
} from '../../types/tradingPlan';
import type { TradeJournalEntry } from '../../types/journal';

interface PlanViewerProps {
  planId: string;
}

export default function PlanViewer({ planId }: PlanViewerProps) {
  const [activeSection, setActiveSection] = useState(PLAN_SECTIONS[0].id);
  const { currentPlan, isLoading, loadPlan } = usePlanStore();

  useEffect(() => {
    loadPlan(planId);
  }, [planId, loadPlan]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Loading plan…</p>
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Plan not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <aside className="lg:w-56 shrink-0">
        <div className="sticky top-4">
          <SectionNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 bg-surface-secondary rounded-lg shadow border border-border px-6 py-3 mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary truncate">
              {currentPlan.name}
            </h1>
            <p className="text-sm text-text-secondary">
              {currentPlan.author} · {currentPlan.year}
            </p>
          </div>
        </div>

        <div className="bg-surface-secondary rounded-lg shadow border border-border p-6">
          <SectionContent plan={currentPlan} activeSection={activeSection} />
        </div>
      </main>
    </div>
  );
}

/* ── Section Router ──────────────────────────────────────────── */

function SectionContent({ plan, activeSection }: { plan: TradingPlan; activeSection: string }) {
  switch (activeSection) {
    case 'metadata-goals':
      return <GoalsView plan={plan} />;
    case 'greeks-targets':
      return <GreeksView plan={plan} />;
    case 'risk-management':
      return <RiskManagementView plan={plan} />;
    case 'trade-rules':
      return <TradeRulesView plan={plan} />;
    case 'daily-management':
      return <DailyManagementView plan={plan} />;
    case 'vacation-rules':
      return <VacationRulesView plan={plan} />;
    case 'market-regime':
      return <MarketRegimeView plan={plan} />;
    case 'account-sizing':
      return <AccountSizingView plan={plan} />;
    case 'core-strategies':
      return <StrategiesView strategies={plan.coreStrategies} title="Core Strategies" planId={plan.id} />;
    case 'speculative-strategies':
      return <StrategiesView strategies={plan.speculativeStrategies} title="Speculative Strategies" planId={plan.id} />;
    default:
      return null;
  }
}

/* ── Goals ────────────────────────────────────────────────────── */

function GoalsView({ plan }: { plan: TradingPlan }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Goals</h2>
      {plan.goals.length === 0 ? (
        <p className="text-sm text-text-secondary">No goals defined.</p>
      ) : (
        <ol className="space-y-2">
          {plan.goals.map((goal, idx) => (
            <li key={goal.id} className="flex gap-3 p-3 bg-surface-tertiary rounded-md">
              <span className="text-sm font-semibold text-text-accent shrink-0">{idx + 1}.</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{goal.description}</p>
                <p className="text-sm text-text-secondary">Target: {goal.targetValue}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Greeks Targets ───────────────────────────────────────────── */

function GreeksView({ plan }: { plan: TradingPlan }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Portfolio Greeks Targets</h2>
      {plan.greeksTargets.length === 0 ? (
        <p className="text-sm text-text-secondary">No Greeks targets defined.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-text-primary">Metric</th>
                <th className="text-left py-2 pr-4 font-medium text-text-primary">Description</th>
                <th className="text-left py-2 font-medium text-text-primary">Range</th>
              </tr>
            </thead>
            <tbody>
              {plan.greeksTargets.map((t) => (
                <tr key={t.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-medium text-text-primary">{t.metricName}</td>
                  <td className="py-2 pr-4 text-text-secondary">{t.targetDescription}</td>
                  <td className="py-2 text-text-secondary">
                    {t.minValue !== undefined || t.maxValue !== undefined
                      ? `${t.minValue ?? '—'} to ${t.maxValue ?? '—'}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Risk Management ──────────────────────────────────────────── */

function RiskManagementView({ plan }: { plan: TradingPlan }) {
  const { bpThresholds, positionLimits, maxLossPerTrade, maxLossPerPortfolio } = plan.riskManagement;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Risk Management</h2>

      {/* BP Thresholds */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Buying Power Thresholds</h3>
        {bpThresholds.length === 0 ? (
          <p className="text-sm text-text-secondary">No BP thresholds defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-text-primary">BP Usage</th>
                  <th className="text-left py-2 font-medium text-text-primary">Action</th>
                </tr>
              </thead>
              <tbody>
                {bpThresholds.map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="py-2 pr-4 font-medium text-text-primary">{t.percentage}%</td>
                    <td className="py-2 text-text-secondary">{t.actionDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Position Limits */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Position Limits</h3>
        {positionLimits.length === 0 ? (
          <p className="text-sm text-text-secondary">No position limits defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-text-primary">Strategy</th>
                  <th className="text-left py-2 pr-4 font-medium text-text-primary">Max Positions</th>
                  <th className="text-left py-2 font-medium text-text-primary">Max Per Underlying</th>
                </tr>
              </thead>
              <tbody>
                {positionLimits.map((l) => (
                  <tr key={l.id} className="border-b border-border">
                    <td className="py-2 pr-4 font-medium text-text-primary">{l.strategyName}</td>
                    <td className="py-2 pr-4 text-text-secondary">{l.maxPositions}</td>
                    <td className="py-2 text-text-secondary">{l.maxPerUnderlying}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Max Loss */}
      {(maxLossPerTrade !== undefined || maxLossPerPortfolio !== undefined) && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Maximum Loss Thresholds</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {maxLossPerTrade !== undefined && (
              <div className="p-3 bg-surface-tertiary rounded-md">
                <p className="text-xs text-text-secondary">Max Loss Per Trade</p>
                <p className="text-sm font-medium text-text-primary">{formatCurrency(maxLossPerTrade)}</p>
              </div>
            )}
            {maxLossPerPortfolio !== undefined && (
              <div className="p-3 bg-surface-tertiary rounded-md">
                <p className="text-xs text-text-secondary">Max Loss Per Portfolio</p>
                <p className="text-sm font-medium text-text-primary">{formatCurrency(maxLossPerPortfolio)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Trade Rules ──────────────────────────────────────────────── */

function TradeRulesView({ plan }: { plan: TradingPlan }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Trade Rules</h2>
      {plan.tradeRules.length === 0 ? (
        <p className="text-sm text-text-secondary">No trade rules defined.</p>
      ) : (
        <ol className="space-y-2">
          {plan.tradeRules.map((rule, idx) => (
            <li key={rule.id} className="flex gap-3 p-3 bg-surface-tertiary rounded-md">
              <span className="text-sm font-semibold text-text-accent shrink-0">{idx + 1}.</span>
              <div className="min-w-0">
                <p className="text-sm text-text-primary">{rule.text}</p>
                {rule.category && (
                  <Badge variant="neutral" className="mt-1">{rule.category}</Badge>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Daily Management ─────────────────────────────────────────── */

function DailyManagementView({ plan }: { plan: TradingPlan }) {
  const { nightlyReview, morningReview } = plan.dailyManagement;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Daily Portfolio Management</h2>

      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Nightly Review</h3>
        {nightlyReview.length === 0 ? (
          <p className="text-sm text-text-secondary">No nightly review items.</p>
        ) : (
          <ol className="space-y-1">
            {nightlyReview.map((item, idx) => (
              <li key={item.id} className="flex gap-3 p-2 bg-surface-tertiary rounded-md">
                <span className="text-sm font-semibold text-text-accent shrink-0">{idx + 1}.</span>
                <p className="text-sm text-text-primary">{item.description}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Morning Review</h3>
        {morningReview.length === 0 ? (
          <p className="text-sm text-text-secondary">No morning review items.</p>
        ) : (
          <ol className="space-y-1">
            {morningReview.map((item, idx) => (
              <li key={item.id} className="flex gap-3 p-2 bg-surface-tertiary rounded-md">
                <span className="text-sm font-semibold text-text-accent shrink-0">{idx + 1}.</span>
                <p className="text-sm text-text-primary">{item.description}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/* ── Vacation Rules ───────────────────────────────────────────── */

function VacationRulesView({ plan }: { plan: TradingPlan }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Vacation Trade Management</h2>
      {plan.vacationRules.length === 0 ? (
        <p className="text-sm text-text-secondary">No vacation rules defined.</p>
      ) : (
        <ol className="space-y-2">
          {plan.vacationRules.map((rule, idx) => (
            <li key={rule.id} className="flex gap-3 p-3 bg-surface-tertiary rounded-md">
              <span className="text-sm font-semibold text-text-accent shrink-0">{idx + 1}.</span>
              <p className="text-sm text-text-primary">{rule.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Market Regime Framework ──────────────────────────────────── */

function MarketRegimeView({ plan }: { plan: TradingPlan }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Market Regime Framework</h2>
      {plan.marketRegimes.length === 0 ? (
        <p className="text-sm text-text-secondary">No market regimes defined.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.marketRegimes.map((regime) => (
            <Card key={regime.id} className="border border-border">
              <h4 className="text-sm font-semibold text-text-primary mb-2">{regime.name}</h4>
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Conditions</p>
                  <p className="text-sm text-text-primary mt-0.5">{regime.conditions}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Strategy Adjustments</p>
                  <p className="text-sm text-text-primary mt-0.5">{regime.strategyAdjustments}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Account Sizing & Allocation ──────────────────────────────── */

function AccountSizingView({ plan }: { plan: TradingPlan }) {
  const { totalAccountSize, allocations } = plan.accountSizing;
  const totalAllocation = allocations.reduce((sum, a) => sum + a.allocationPercentage, 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Account Sizing & Strategy Allocation</h2>

      <div className="p-4 bg-text-accent/20 rounded-lg">
        <p className="text-xs font-medium text-text-accent uppercase tracking-wide">Total Account Size</p>
        <p className="text-xl font-bold text-text-accent">{formatCurrency(totalAccountSize)}</p>
      </div>

      {allocations.length === 0 ? (
        <p className="text-sm text-text-secondary">No allocations defined.</p>
      ) : (
        <>
          {totalAllocation !== 100 && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-md">
              <p className="text-sm text-warning">
                Total allocation is {formatPercentage(totalAllocation)} (expected 100%).
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-text-primary">Category</th>
                  <th className="text-right py-2 pr-4 font-medium text-text-primary">Allocation</th>
                  <th className="text-right py-2 pr-4 font-medium text-text-primary">Dollar Amount</th>
                  <th className="text-right py-2 pr-4 font-medium text-text-primary">Positions</th>
                  <th className="text-left py-2 font-medium text-text-primary">Sizing</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-2 pr-4 font-medium text-text-primary">{a.categoryName}</td>
                    <td className="py-2 pr-4 text-right text-text-secondary">{formatPercentage(a.allocationPercentage)}</td>
                    <td className="py-2 pr-4 text-right text-text-primary font-medium">
                      {formatCurrency((a.allocationPercentage / 100) * totalAccountSize)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary">{a.numberOfPositions ?? '—'}</td>
                    <td className="py-2 text-text-secondary">{a.positionSizing ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Strategies (Core / Speculative) ──────────────────────────── */

function StrategiesView({ strategies, title, planId }: { strategies: Strategy[]; title: string; planId: string }) {
  const [importerOpen, setImporterOpen] = useState(false);
  const { currentPlan, updatePlan, savePlan } = usePlanStore();

  const existingStrategies = currentPlan
    ? [...currentPlan.coreStrategies, ...currentPlan.speculativeStrategies]
    : [];

  const handleImport = useCallback(
    (toAdd: Strategy[], toReplace: Strategy[]) => {
      if (!currentPlan) return;

      let coreStrategies = [...currentPlan.coreStrategies];
      let speculativeStrategies = [...currentPlan.speculativeStrategies];

      // Replace existing strategies in-place
      for (const replacement of toReplace) {
        const coreIdx = coreStrategies.findIndex((s) => s.id === replacement.id);
        if (coreIdx !== -1) {
          coreStrategies[coreIdx] = replacement;
          continue;
        }
        const specIdx = speculativeStrategies.findIndex((s) => s.id === replacement.id);
        if (specIdx !== -1) {
          speculativeStrategies[specIdx] = replacement;
        }
      }

      // Add new strategies to the appropriate array based on classification
      for (const strategy of toAdd) {
        if (strategy.classification === 'Core') {
          coreStrategies.push(strategy);
        } else {
          speculativeStrategies.push(strategy);
        }
      }

      updatePlan({ coreStrategies, speculativeStrategies });
      savePlan();
    },
    [currentPlan, updatePlan, savePlan],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <Button variant="secondary" size="sm" onClick={() => setImporterOpen(true)}>
          Import Default Strategies
        </Button>
      </div>
      {strategies.length === 0 ? (
        <p className="text-sm text-text-secondary">No strategies defined.</p>
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy) => (
            <StrategyDetailCard key={strategy.id} strategy={strategy} planId={planId} />
          ))}
        </div>
      )}

      <StrategyImporter
        isOpen={importerOpen}
        onClose={() => setImporterOpen(false)}
        existingStrategies={existingStrategies}
        onImport={handleImport}
      />
    </div>
  );
}

function StrategyDetailCard({ strategy, planId }: { strategy: Strategy; planId: string }) {
  return (
    <Card className="border border-border">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-base font-semibold text-text-primary">{strategy.name}</h3>
        <Badge variant={strategy.classification === 'Core' ? 'info' : 'warning'}>
          {strategy.classification}
        </Badge>
      </div>

      {strategy.description && (
        <p className="text-sm text-text-secondary mb-4">{strategy.description}</p>
      )}

      {strategy.variants && strategy.variants.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Variants</h4>
          <div className="flex flex-wrap gap-2">
            {strategy.variants.map((v) => (
              <Badge key={v.id} variant="neutral">{v.name}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Entry Criteria */}
        <div>
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Entry Criteria</h4>
          {strategy.entryCriteria.length === 0 ? (
            <p className="text-sm text-text-secondary">None</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 pr-3 font-medium text-text-secondary">Parameter</th>
                    <th className="text-left py-1 font-medium text-text-secondary">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.entryCriteria.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="py-1 pr-3 text-text-primary">{c.parameterName}</td>
                      <td className="py-1 text-text-primary font-medium">{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Management Rules */}
        <div>
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Management Rules</h4>
          {strategy.managementRules.length === 0 ? (
            <p className="text-sm text-text-secondary">None</p>
          ) : (
            <ul className="space-y-1">
              {strategy.managementRules.map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="text-text-primary font-medium">{r.triggerCondition}:</span>{' '}
                  <span className="text-text-secondary">{r.actionDescription}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Profit Targets */}
        <div>
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Profit Targets</h4>
          {strategy.profitTargets.length === 0 ? (
            <p className="text-sm text-text-secondary">None</p>
          ) : (
            <ul className="space-y-1">
              {strategy.profitTargets.map((pt) => (
                <li key={pt.id} className="text-sm">
                  <span className="text-success font-medium">{pt.targetValue}</span>{' '}
                  <span className="text-text-secondary">→ {pt.action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stop Losses */}
        <div>
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Stop Losses</h4>
          {strategy.stopLosses.length === 0 ? (
            <p className="text-sm text-text-secondary">None</p>
          ) : (
            <ul className="space-y-1">
              {strategy.stopLosses.map((sl) => (
                <li key={sl.id} className="text-sm">
                  <span className="text-error font-medium">{sl.stopValue}</span>{' '}
                  <span className="text-text-secondary">→ {sl.action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <StrategyRecentTrades strategyId={strategy.id} planId={planId} />
    </Card>
  );
}


/* ── Strategy Recent Trades ───────────────────────────────────── */

const MAX_RECENT_TRADES = 5;

function StrategyRecentTrades({ strategyId, planId }: { strategyId: string; planId: string }) {
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    filterJournalEntries({ strategyId, planId })
      .then((result) => {
        if (!cancelled) {
          setEntries(result.entries.slice(0, MAX_RECENT_TRADES));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [strategyId, planId]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">Recent Trades</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-text-secondary">No trades recorded for this strategy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 pr-3 font-medium text-text-secondary">Symbol</th>
                <th className="text-left py-1 pr-3 font-medium text-text-secondary">Date</th>
                <th className="text-left py-1 pr-3 font-medium text-text-secondary">Status</th>
                <th className="text-right py-1 font-medium text-text-secondary">P/L</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50">
                  <td className="py-1 pr-3 font-medium text-text-primary">{entry.stockSymbol}</td>
                  <td className="py-1 pr-3 text-text-secondary">
                    {new Date(entry.openDate).toLocaleDateString()}
                  </td>
                  <td className="py-1 pr-3">
                    <Badge
                      variant={
                        entry.tradeStatus === 'Closed'
                          ? entry.winLoss === 'Win' ? 'success' : 'danger'
                          : entry.tradeStatus === 'Open' ? 'info' : 'neutral'
                      }
                    >
                      {entry.tradeStatus}
                    </Badge>
                  </td>
                  <td className={`py-1 text-right font-medium ${
                    (entry.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'
                  }`}>
                    {entry.profitLoss != null ? formatProfitLoss(entry.profitLoss) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
