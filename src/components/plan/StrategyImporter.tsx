import { useState, useMemo, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { getCategories, getTemplatesByCategory } from '../../data/strategyLibrary';
import {
  detectDuplicates,
  resolveAndInstantiate,
  type DuplicateConflict,
  type DuplicateResolution,
} from '../../utils/strategyInstantiator';
import type { Strategy } from '../../types/tradingPlan';
import type { OptionsStrategyTemplate } from '../../data/strategyLibrary';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

interface StrategyImporterProps {
  isOpen: boolean;
  onClose: () => void;
  existingStrategies: Strategy[];
  onImport: (strategies: Strategy[], replacements: Strategy[]) => void;
}

type ImportStep = 'select' | 'duplicates' | 'confirm';

export default function StrategyImporter({
  isOpen,
  onClose,
  existingStrategies,
  onImport,
}: StrategyImporterProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<DuplicateConflict[]>([]);
  const [resolutions, setResolutions] = useState<Map<string, DuplicateResolution>>(new Map());

  const categories = useMemo(() => getCategories(), []);

  const templatesByCategory = useMemo(() => {
    const map = new Map<string, OptionsStrategyTemplate[]>();
    for (const cat of categories) {
      map.set(cat.id, getTemplatesByCategory(cat.id));
    }
    return map;
  }, [categories]);

  const allTemplates = useMemo(() => {
    const all: OptionsStrategyTemplate[] = [];
    for (const templates of templatesByCategory.values()) {
      all.push(...templates);
    }
    return all;
  }, [templatesByCategory]);

  const selectedTemplates = useMemo(
    () => allTemplates.filter((t) => selectedTemplateIds.has(t.templateId)),
    [allTemplates, selectedTemplateIds],
  );

  const handleReset = useCallback(() => {
    setStep('select');
    setSelectedTemplateIds(new Set());
    setExpandedCategories(new Set());
    setConflicts([]);
    setResolutions(new Map());
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const toggleTemplate = useCallback((templateId: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (categoryId: string) => {
      const templates = templatesByCategory.get(categoryId) ?? [];
      const allSelected = templates.every((t) => selectedTemplateIds.has(t.templateId));

      setSelectedTemplateIds((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          for (const t of templates) {
            next.delete(t.templateId);
          }
        } else {
          for (const t of templates) {
            next.add(t.templateId);
          }
        }
        return next;
      });
    },
    [templatesByCategory, selectedTemplateIds],
  );

  const handleProceedFromSelect = useCallback(() => {
    const detected = detectDuplicates(selectedTemplates, existingStrategies);
    if (detected.length > 0) {
      setConflicts(detected);
      const defaultResolutions = new Map<string, DuplicateResolution>();
      for (const conflict of detected) {
        defaultResolutions.set(conflict.template.templateId, 'skip');
      }
      setResolutions(defaultResolutions);
      setStep('duplicates');
    } else {
      setConflicts([]);
      setStep('confirm');
    }
  }, [selectedTemplates, existingStrategies]);

  const handleSetResolution = useCallback((templateId: string, resolution: DuplicateResolution) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(templateId, resolution);
      return next;
    });
  }, []);

  const handleConfirmImport = useCallback(() => {
    const { toAdd, toReplace } = resolveAndInstantiate(
      selectedTemplates,
      existingStrategies,
      resolutions,
    );
    onImport(toAdd, toReplace);
    handleClose();
  }, [selectedTemplates, existingStrategies, resolutions, onImport, handleClose]);

  const summaryStats = useMemo(() => {
    if (step !== 'confirm') return { adding: 0, replacing: 0, skipping: 0 };

    const conflictIds = new Set(conflicts.map((c) => c.template.templateId));
    let adding = 0;
    let replacing = 0;
    let skipping = 0;

    for (const t of selectedTemplates) {
      if (!conflictIds.has(t.templateId)) {
        adding++;
      } else {
        const res = resolutions.get(t.templateId);
        if (res === 'skip') skipping++;
        else if (res === 'replace') replacing++;
        else if (res === 'rename') adding++;
      }
    }

    return { adding, replacing, skipping };
  }, [step, selectedTemplates, conflicts, resolutions]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Default Strategies"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
          <span className={step === 'select' ? 'text-text-accent font-medium' : ''}>
            1. Select
          </span>
          <span>→</span>
          <span className={step === 'duplicates' ? 'text-text-accent font-medium' : ''}>
            2. Resolve Duplicates
          </span>
          <span>→</span>
          <span className={step === 'confirm' ? 'text-text-accent font-medium' : ''}>
            3. Confirm
          </span>
        </div>

        {/* Step 1: Browse & Select */}
        {step === 'select' && (
          <>
            <p className="text-sm text-text-secondary">
              Select strategies to import into your plan. They are grouped by category.
            </p>
            <div className="max-h-96 overflow-y-auto space-y-1 border border-border rounded-lg">
              {categories.map((category) => {
                const templates = templatesByCategory.get(category.id) ?? [];
                const isExpanded = expandedCategories.has(category.id);
                const selectedCount = templates.filter((t) =>
                  selectedTemplateIds.has(t.templateId),
                ).length;
                const allSelected = templates.length > 0 && selectedCount === templates.length;

                return (
                  <div key={category.id} className="border-b border-border last:border-b-0">
                    {/* Category header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-tertiary hover:bg-surface-tertiary/80 cursor-pointer">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="flex items-center gap-2 flex-1 text-left"
                        aria-expanded={isExpanded}
                        aria-label={`${category.name} category`}
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-text-secondary" />
                        ) : (
                          <ChevronRight size={16} className="text-text-secondary" />
                        )}
                        <span className="text-sm font-medium text-text-primary">
                          {category.name}
                        </span>
                        <span className="text-xs text-text-secondary">
                          ({templates.length})
                        </span>
                        {selectedCount > 0 && (
                          <Badge variant="info">{selectedCount} selected</Badge>
                        )}
                      </button>
                      <button
                        onClick={() => toggleSelectAll(category.id)}
                        className="text-xs text-text-accent hover:text-text-primary px-2 py-0.5 rounded"
                        aria-label={allSelected ? `Deselect all in ${category.name}` : `Select all in ${category.name}`}
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* Template rows */}
                    {isExpanded && (
                      <div className="divide-y divide-border">
                        {templates.map((template) => {
                          const isSelected = selectedTemplateIds.has(template.templateId);
                          return (
                            <label
                              key={template.templateId}
                              className="flex items-start gap-3 px-4 py-2 hover:bg-surface-tertiary/50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleTemplate(template.templateId)}
                                className="mt-0.5 rounded border-border text-text-accent focus:ring-text-accent"
                                aria-label={`Select ${template.name}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-text-primary">
                                    {template.name}
                                  </span>
                                  <Badge
                                    variant={
                                      template.classification === 'Core' ? 'success' : 'warning'
                                    }
                                  >
                                    {template.classification}
                                  </Badge>
                                </div>
                                <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                                  {template.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-text-secondary">
                {selectedTemplateIds.size} strateg{selectedTemplateIds.size === 1 ? 'y' : 'ies'} selected
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleProceedFromSelect}
                  disabled={selectedTemplateIds.size === 0}
                >
                  Continue
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Resolve Duplicates */}
        {step === 'duplicates' && (
          <>
            <p className="text-sm text-text-secondary">
              The following strategies already exist in your plan. Choose how to handle each conflict.
            </p>
            <div className="max-h-80 overflow-y-auto space-y-3">
              {conflicts.map((conflict) => {
                const currentResolution = resolutions.get(conflict.template.templateId) ?? 'skip';
                return (
                  <div
                    key={conflict.template.templateId}
                    className="border border-border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {conflict.template.name}
                      </span>
                      <Badge variant="warning">Duplicate</Badge>
                    </div>
                    <p className="text-xs text-text-secondary">
                      A strategy named "{conflict.existingStrategy.name}" already exists in your plan.
                    </p>
                    <div className="flex gap-2">
                      {(['skip', 'rename', 'replace'] as DuplicateResolution[]).map((option) => (
                        <button
                          key={option}
                          onClick={() =>
                            handleSetResolution(conflict.template.templateId, option)
                          }
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            currentResolution === option
                              ? 'border-text-accent bg-text-accent/10 text-text-accent'
                              : 'border-border text-text-secondary hover:border-text-accent/50'
                          }`}
                          aria-pressed={currentResolution === option}
                        >
                          {option === 'skip' && 'Skip'}
                          {option === 'rename' && 'Import as Copy'}
                          {option === 'replace' && 'Replace Existing'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="secondary" size="sm" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep('confirm')}>
                Continue
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <>
            <p className="text-sm text-text-secondary">
              Review the import summary below and confirm.
            </p>
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-text-secondary uppercase">Adding</p>
                  <p className="text-xl font-bold text-success">{summaryStats.adding}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase">Replacing</p>
                  <p className="text-xl font-bold text-warning">{summaryStats.replacing}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase">Skipping</p>
                  <p className="text-xs font-bold text-text-secondary mt-1">{summaryStats.skipping}</p>
                </div>
              </div>

              {/* List of strategies being imported */}
              <div className="max-h-48 overflow-y-auto divide-y divide-border">
                {selectedTemplates.map((template) => {
                  const conflict = conflicts.find(
                    (c) => c.template.templateId === template.templateId,
                  );
                  const resolution = conflict
                    ? resolutions.get(template.templateId) ?? 'skip'
                    : null;

                  if (resolution === 'skip') return null;

                  return (
                    <div
                      key={template.templateId}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <Check size={14} className="text-success flex-shrink-0" />
                      <span className="text-sm text-text-primary">{template.name}</span>
                      <Badge
                        variant={template.classification === 'Core' ? 'success' : 'warning'}
                      >
                        {template.classification}
                      </Badge>
                      {resolution === 'rename' && (
                        <span className="text-xs text-text-secondary">(as copy)</span>
                      )}
                      {resolution === 'replace' && (
                        <span className="text-xs text-warning">(replacing existing)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => (conflicts.length > 0 ? setStep('duplicates') : setStep('select'))}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={summaryStats.adding + summaryStats.replacing === 0}
              >
                Import {summaryStats.adding + summaryStats.replacing} Strateg{summaryStats.adding + summaryStats.replacing === 1 ? 'y' : 'ies'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
