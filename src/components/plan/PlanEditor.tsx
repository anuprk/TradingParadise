import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBlocker } from 'react-router-dom';
import { marked } from 'marked';
import { usePlanStore } from '../../stores/planStore';
import { useAppStore } from '../../stores/appStore';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import StrategyImporter from './StrategyImporter';
import { v4 as uuidv4 } from 'uuid';
import type { TradingPlan, Strategy } from '../../types/tradingPlan';
import { getAllTemplates } from '../../data/strategyLibrary';
import { instantiateTemplates } from '../../utils/strategyInstantiator';

interface PlanEditorProps {
  planId?: string;
}

type EditorMode = 'edit' | 'preview' | 'locked';
type ActiveTab = 'plan' | 'strategies' | 'options-strategies';

interface StrategyRow {
  id: string;
  strategy: string;
  sizing: string;
  frequency: string;
  entry: string;
  exit: string;
  riskManagement: string;
}

const PLAN_TEMPLATE = `# Trading Plan

## Goals
- 

## Portfolio Greeks Targets
| Metric | Target | Min | Max |
|--------|--------|-----|-----|
| Delta  |        |     |     |
| Theta  |        |     |     |
| Vega   |        |     |     |

## Risk Management

### Buying Power Thresholds
| BP Usage | Action |
|----------|--------|
| 50%      |        |
| 75%      |        |

### Position Limits
- 

### Max Loss
- Per Trade: $
- Per Portfolio: $

## Trade Rules
1. 
2. 
3. 

## Daily Portfolio Management

### Nightly Review
- [ ] 

### Morning Review
- [ ] 

## Vacation Trade Management
1. 

## Market Regime Framework

### Bullish
- **Conditions:** 
- **Adjustments:** 

### Neutral
- **Conditions:** 
- **Adjustments:** 

### Bearish
- **Conditions:** 
- **Adjustments:** 

## Account Sizing & Strategy Allocation
- **Total Account Size:** $

| Category | Allocation | Positions | Sizing |
|----------|-----------|-----------|--------|
|          |           |           |        |
`;

const EMPTY_STRATEGY_ROW: () => StrategyRow = () => ({
  id: uuidv4(),
  strategy: '',
  sizing: '',
  frequency: '',
  entry: '',
  exit: '',
  riskManagement: '',
});

function createEmptyPlan(): TradingPlan {
  const now = new Date();
  return {
    id: uuidv4(), name: '', author: '', year: now.getFullYear(),
    createdAt: now, updatedAt: now, goals: [], greeksTargets: [],
    riskManagement: { bpThresholds: [], positionLimits: [] },
    tradeRules: [],
    dailyManagement: { nightlyReview: [], morningReview: [] },
    vacationRules: [], marketRegimes: [],
    accountSizing: { totalAccountSize: 0, allocations: [] },
    coreStrategies: [], speculativeStrategies: [],
  };
}

export default function PlanEditor({ planId }: PlanEditorProps) {
  const [mode, setMode] = useState<EditorMode>('edit');
  const [activeTab, setActiveTab] = useState<ActiveTab>('plan');
  const [markdown, setMarkdown] = useState(PLAN_TEMPLATE);
  const [strategies, setStrategies] = useState<StrategyRow[]>([EMPTY_STRATEGY_ROW()]);
  const [planName, setPlanName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isNewPlan, setIsNewPlan] = useState(!planId);
  const [showDefaultStrategiesPrompt, setShowDefaultStrategiesPrompt] = useState(!planId);
  const [showStrategiesAdded, setShowStrategiesAdded] = useState(false);

  const {
    currentPlan, isDirty, isLoading, loadPlan,
    setCurrentPlan, updatePlan, savePlan, createPlan, setDirty,
  } = usePlanStore();
  const addToast = useAppStore((s) => s.addToast);
  const setActivePlanId = useAppStore((s) => s.setActivePlanId);

  useEffect(() => {
    if (planId) { setActivePlanId(planId); setIsNewPlan(false); loadPlan(planId); }
    else if (!currentPlan) { setIsNewPlan(true); setCurrentPlan(createEmptyPlan()); }
  }, [planId, loadPlan, setActivePlanId, setCurrentPlan, currentPlan]);

  useEffect(() => {
    if (currentPlan) {
      const ext = currentPlan as TradingPlan & { markdownContent?: string; strategyTable?: StrategyRow[]; isLocked?: boolean };
      if (ext.markdownContent) setMarkdown(ext.markdownContent);
      if (ext.strategyTable && ext.strategyTable.length > 0) setStrategies(ext.strategyTable);
      if (currentPlan.name) setPlanName(currentPlan.name);
      if (ext.isLocked) setMode('locked');
    }
  }, [currentPlan]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty],
  );
  useBlocker(shouldBlock);

  const renderedHtml = useMemo(() => {
    try { return marked(markdown, { async: false }) as string; }
    catch { return '<p>Error rendering markdown</p>'; }
  }, [markdown]);

  const handleMarkdownChange = (value: string) => { setMarkdown(value); setDirty(true); };
  const handleNameChange = (value: string) => { setPlanName(value); updatePlan({ name: value }); };

  const updateStrategyRow = (id: string, field: keyof StrategyRow, value: string) => {
    setStrategies((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const addStrategyRow = () => {
    setStrategies((prev) => [...prev, EMPTY_STRATEGY_ROW()]);
    setDirty(true);
  };

  const removeStrategyRow = (id: string) => {
    setStrategies((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    if (!currentPlan) return;
    setIsSaving(true);
    try {
      const planData = {
        ...currentPlan,
        name: planName || 'Untitled Plan',
        markdownContent: markdown,
        strategyTable: strategies,
      } as TradingPlan & { markdownContent: string; strategyTable: StrategyRow[] };

      if (isNewPlan) { await createPlan(planData); setIsNewPlan(false); }
      else { updatePlan({ name: planName, markdownContent: markdown, strategyTable: strategies } as Partial<TradingPlan>); await savePlan(); }
      addToast('Plan saved.', 'success');
    } catch { addToast('Failed to save.', 'error'); }
    finally { setIsSaving(false); }
  }, [currentPlan, planName, markdown, strategies, isNewPlan, createPlan, updatePlan, savePlan, addToast]);

  const handleLock = () => { setMode('locked'); updatePlan({ isLocked: true } as Partial<TradingPlan>); addToast('Plan locked.', 'info'); };
  const handleUnlock = () => { setMode('edit'); updatePlan({ isLocked: false } as Partial<TradingPlan>); };

  const handleIncludeDefaults = () => {
    const templates = getAllTemplates();
    const instantiated = instantiateTemplates(templates);
    const core = instantiated.filter((s) => s.classification === 'Core');
    const speculative = instantiated.filter((s) => s.classification === 'Speculative');
    updatePlan({ coreStrategies: core, speculativeStrategies: speculative });
    setShowDefaultStrategiesPrompt(false);
    setShowStrategiesAdded(true);
    setActiveTab('options-strategies');
  };

  const handleStartEmpty = () => {
    setShowDefaultStrategiesPrompt(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-text-secondary">Loading…</p></div>;
  }

  const isLocked = mode === 'locked';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-surface-secondary border-b border-border px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <input
            type="text"
            value={planName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Plan name…"
            disabled={isLocked}
            className="text-lg font-semibold text-text-primary bg-transparent border-none outline-none placeholder-text-secondary min-w-0"
          />
          {/* Section tabs */}
          <div className="flex border border-border rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-3 py-1.5 font-medium transition-colors ${
                activeTab === 'plan' ? 'bg-surface-tertiary text-text-primary' : 'text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              📄 Plan
            </button>
            <button
              onClick={() => setActiveTab('strategies')}
              className={`px-3 py-1.5 font-medium transition-colors border-l border-border ${
                activeTab === 'strategies' ? 'bg-surface-tertiary text-text-primary' : 'text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              📊 Strategy Table
            </button>
            <button
              onClick={() => setActiveTab('options-strategies')}
              className={`px-3 py-1.5 font-medium transition-colors border-l border-border ${
                activeTab === 'options-strategies' ? 'bg-surface-tertiary text-text-primary' : 'text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              📋 Options Strategies
              {currentPlan && (currentPlan.coreStrategies.length + currentPlan.speculativeStrategies.length) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-text-accent/20 text-text-accent rounded-full text-[10px] font-bold">
                  {currentPlan.coreStrategies.length + currentPlan.speculativeStrategies.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'plan' && (
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setMode('edit')}
                disabled={isLocked}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  mode === 'edit' ? 'bg-text-accent/20 text-text-accent' : 'text-text-secondary hover:bg-surface-tertiary'
                } ${isLocked ? 'opacity-50' : ''}`}
              >
                Edit
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-border ${
                  mode === 'preview' || isLocked ? 'bg-text-accent/20 text-text-accent' : 'text-text-secondary hover:bg-surface-tertiary'
                }`}
              >
                Preview
              </button>
            </div>
          )}

          {isLocked ? (
            <Button size="sm" variant="secondary" onClick={handleUnlock}>🔓 Unlock</Button>
          ) : (
            <>
              {mode === 'preview' && activeTab === 'plan' && (
                <Button size="sm" variant="danger" onClick={handleLock}>🔒 Lock</Button>
              )}
              {isDirty && <span className="text-[11px] text-warning font-medium">● Unsaved</span>}
              <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Default Strategies Prompt */}
      {isNewPlan && showDefaultStrategiesPrompt && (
        <div className="mx-4 mt-4 p-4 bg-surface-tertiary border border-border rounded-lg flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Start with default options strategies?
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Pre-populate your plan with 20 common options strategies organized by classification.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={handleStartEmpty}>
              Start Empty
            </Button>
            <Button size="sm" onClick={handleIncludeDefaults}>
              Include Default Strategies
            </Button>
          </div>
        </div>
      )}

      {/* Strategies Added Confirmation */}
      {showStrategiesAdded && currentPlan && (
        <div className="mx-4 mt-4 p-4 bg-success/10 border border-success/30 rounded-lg">
          <p className="text-sm font-medium text-success">
            ✓ {currentPlan.coreStrategies.length + currentPlan.speculativeStrategies.length} default strategies added
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {currentPlan.coreStrategies.length} Core strategies · {currentPlan.speculativeStrategies.length} Speculative strategies.
            Save the plan to persist them. You can view and edit strategies in the Plan Viewer after saving.
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'plan' ? (
          <PlanSection
            mode={mode}
            markdown={markdown}
            renderedHtml={renderedHtml}
            onMarkdownChange={handleMarkdownChange}
            isLocked={isLocked}
          />
        ) : activeTab === 'strategies' ? (
          <StrategyTableSection
            strategies={strategies}
            onUpdate={updateStrategyRow}
            onAdd={addStrategyRow}
            onRemove={removeStrategyRow}
            isLocked={isLocked}
          />
        ) : (
          <OptionsStrategiesSection
            coreStrategies={currentPlan?.coreStrategies ?? []}
            speculativeStrategies={currentPlan?.speculativeStrategies ?? []}
            existingStrategies={[...(currentPlan?.coreStrategies ?? []), ...(currentPlan?.speculativeStrategies ?? [])]}
            onImport={(toAdd, toReplace) => {
              if (!currentPlan) return;
              let core = [...currentPlan.coreStrategies];
              let spec = [...currentPlan.speculativeStrategies];
              for (const r of toReplace) {
                const ci = core.findIndex((s) => s.id === r.id);
                if (ci !== -1) { core[ci] = r; continue; }
                const si = spec.findIndex((s) => s.id === r.id);
                if (si !== -1) { spec[si] = r; }
              }
              for (const s of toAdd) {
                if (s.classification === 'Core') core.push(s);
                else spec.push(s);
              }
              updatePlan({ coreStrategies: core, speculativeStrategies: spec });
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Plan Section (Markdown) ─────────────────────────────────── */

function PlanSection({
  mode, markdown, renderedHtml, onMarkdownChange, isLocked,
}: {
  mode: EditorMode;
  markdown: string;
  renderedHtml: string;
  onMarkdownChange: (v: string) => void;
  isLocked: boolean;
}) {
  if (mode === 'edit' && !isLocked) {
    return (
      <textarea
        value={markdown}
        onChange={(e) => onMarkdownChange(e.target.value)}
        className="w-full h-full min-h-[calc(100vh-120px)] p-6 font-mono text-sm text-text-primary bg-surface-primary resize-none outline-none leading-relaxed"
        placeholder="Write your trading plan in markdown…"
        spellCheck={false}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {isLocked && (
        <div className="mb-4 px-3 py-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning flex items-center gap-2">
          <span>🔒</span>
          <span>This plan is locked. Click <strong>Unlock</strong> to edit.</span>
        </div>
      )}
      <div
        className="prose prose-sm prose-invert max-w-none
          prose-headings:font-bold prose-headings:text-text-primary
          prose-h1:text-2xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-border
          prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2
          prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1
          prose-p:my-1 prose-p:text-text-primary prose-li:my-0.5 prose-li:text-text-primary
          prose-table:text-sm prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5
          prose-table:border prose-table:border-border prose-th:border prose-th:border-border prose-td:border prose-td:border-border prose-th:bg-surface-tertiary
          prose-a:text-text-accent prose-strong:text-text-primary"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}

/* ── Strategy Table Section ──────────────────────────────────── */

const STRATEGY_COLUMNS: { key: keyof StrategyRow; label: string; placeholder: string }[] = [
  { key: 'strategy', label: 'Strategy', placeholder: 'Strategy name & description…' },
  { key: 'sizing', label: 'Sizing', placeholder: 'Position size, # contracts…' },
  { key: 'frequency', label: 'Frequency', placeholder: 'Weekly, monthly, on signal…' },
  { key: 'entry', label: 'Entry', placeholder: 'Entry criteria, DTE, delta…' },
  { key: 'exit', label: 'Exit', placeholder: 'Profit target, stop loss, roll rules…' },
  { key: 'riskManagement', label: 'Risk Management', placeholder: 'Max loss, adjustments, hedging…' },
];

function StrategyTableSection({
  strategies, onUpdate, onAdd, onRemove, isLocked,
}: {
  strategies: StrategyRow[];
  onUpdate: (id: string, field: keyof StrategyRow, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  isLocked: boolean;
}) {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Trade Strategy Table</h2>
        {!isLocked && (
          <Button size="sm" variant="secondary" onClick={onAdd}>+ Add Strategy</Button>
        )}
      </div>

      <div className="space-y-4">
        {strategies.map((row, idx) => (
          <div key={row.id} className="border border-border rounded-lg overflow-hidden">
            {/* Row header */}
            <div className="bg-surface-tertiary px-4 py-2 flex items-center justify-between border-b border-border">
              <span className="text-sm font-semibold text-text-primary">
                Strategy {idx + 1}{row.strategy ? `: ${row.strategy.split('\n')[0].slice(0, 40)}` : ''}
              </span>
              {!isLocked && strategies.length > 1 && (
                <button
                  onClick={() => onRemove(row.id)}
                  className="text-xs text-error hover:text-red-300 font-medium"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              {STRATEGY_COLUMNS.map((col) => (
                <div key={col.key} className="p-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-1">
                    {col.label}
                  </label>
                  <textarea
                    value={row[col.key]}
                    onChange={(e) => onUpdate(row.id, col.key, e.target.value)}
                    disabled={isLocked}
                    placeholder={col.placeholder}
                    rows={3}
                    className="w-full text-sm text-text-primary bg-transparent border-none outline-none resize-none placeholder-text-secondary leading-relaxed disabled:text-text-secondary disabled:bg-surface-tertiary"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {strategies.length === 0 && (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-sm">No strategies defined yet.</p>
          {!isLocked && (
            <Button size="sm" variant="secondary" onClick={onAdd} className="mt-3">+ Add Strategy</Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Options Strategies Section ───────────────────────────────── */

function OptionsStrategiesSection({
  coreStrategies,
  speculativeStrategies,
  existingStrategies,
  onImport,
}: {
  coreStrategies: Strategy[];
  speculativeStrategies: Strategy[];
  existingStrategies: Strategy[];
  onImport: (toAdd: Strategy[], toReplace: Strategy[]) => void;
}) {
  const [importerOpen, setImporterOpen] = useState(false);

  const total = coreStrategies.length + speculativeStrategies.length;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Options Strategies</h2>
        <Button size="sm" variant="secondary" onClick={() => setImporterOpen(true)}>
          Import Default Strategies
        </Button>
      </div>

      {total === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-sm">No options strategies added yet.</p>
          <p className="text-xs mt-1">Use the "Import Default Strategies" button to add pre-built strategies.</p>
        </div>
      ) : (
        <>
          {/* Core Strategies */}
          {coreStrategies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                Core Strategies
                <Badge variant="info">{coreStrategies.length}</Badge>
              </h3>
              <div className="space-y-3">
                {coreStrategies.map((strategy) => (
                  <StrategyCard key={strategy.id} strategy={strategy} />
                ))}
              </div>
            </div>
          )}

          {/* Speculative Strategies */}
          {speculativeStrategies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                Speculative Strategies
                <Badge variant="warning">{speculativeStrategies.length}</Badge>
              </h3>
              <div className="space-y-3">
                {speculativeStrategies.map((strategy) => (
                  <StrategyCard key={strategy.id} strategy={strategy} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <StrategyImporter
        isOpen={importerOpen}
        onClose={() => setImporterOpen(false)}
        existingStrategies={existingStrategies}
        onImport={onImport}
      />
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-surface-tertiary hover:bg-surface-tertiary/80 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate">{strategy.name}</span>
          <Badge variant={strategy.classification === 'Core' ? 'info' : 'warning'}>
            {strategy.classification}
          </Badge>
        </div>
        <span className="text-xs text-text-secondary shrink-0">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-border">
          <p className="text-sm text-text-secondary">{strategy.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-text-primary uppercase tracking-wide mb-1">Entry Criteria</p>
              <ul className="space-y-0.5">
                {strategy.entryCriteria.map((c) => (
                  <li key={c.id} className="text-text-secondary">
                    <span className="text-text-primary">{c.parameterName}:</span> {c.value}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary uppercase tracking-wide mb-1">Management Rules</p>
              <ul className="space-y-0.5">
                {strategy.managementRules.map((r) => (
                  <li key={r.id} className="text-text-secondary">
                    <span className="text-text-primary">{r.triggerCondition}:</span> {r.actionDescription}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary uppercase tracking-wide mb-1">Profit Targets</p>
              <ul className="space-y-0.5">
                {strategy.profitTargets.map((pt) => (
                  <li key={pt.id} className="text-text-secondary">
                    <span className="text-success">{pt.targetValue}</span> → {pt.action}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary uppercase tracking-wide mb-1">Stop Losses</p>
              <ul className="space-y-0.5">
                {strategy.stopLosses.map((sl) => (
                  <li key={sl.id} className="text-text-secondary">
                    <span className="text-error">{sl.stopValue}</span> → {sl.action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
