import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import type {
  Strategy,
  StrategyVariant,
  EntryCriterion,
  ManagementRule,
  ProfitTarget,
  StopLoss,
} from '../../types/tradingPlan';

interface StrategyEditorProps {
  strategy: Strategy | null;
  classification: 'Core' | 'Speculative';
  onSave: (strategy: Strategy) => void;
  onCancel: () => void;
}

function createEmptyStrategy(classification: 'Core' | 'Speculative'): Strategy {
  return {
    id: uuidv4(),
    name: '',
    classification,
    description: '',
    variants: [],
    entryCriteria: [],
    managementRules: [],
    profitTargets: [],
    stopLosses: [],
  };
}

export default function StrategyEditor({
  strategy,
  classification,
  onSave,
  onCancel,
}: StrategyEditorProps) {
  const [form, setForm] = useState<Strategy>(
    strategy ? { ...strategy, variants: [...(strategy.variants ?? [])], entryCriteria: [...strategy.entryCriteria], managementRules: [...strategy.managementRules], profitTargets: [...strategy.profitTargets], stopLosses: [...strategy.stopLosses] }
      : createEmptyStrategy(classification),
  );
  const [errors, setErrors] = useState<string[]>([]);

  // --- Variant helpers ---
  const addVariant = () =>
    setForm((f) => ({
      ...f,
      variants: [...(f.variants ?? []), { id: uuidv4(), name: '', description: '' }],
    }));
  const updateVariant = (id: string, field: keyof StrategyVariant, value: string) =>
    setForm((f) => ({
      ...f,
      variants: (f.variants ?? []).map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    }));
  const removeVariant = (id: string) =>
    setForm((f) => ({ ...f, variants: (f.variants ?? []).filter((v) => v.id !== id) }));

  // --- Entry Criteria helpers ---
  const addEntryCriterion = () =>
    setForm((f) => ({
      ...f,
      entryCriteria: [...f.entryCriteria, { id: uuidv4(), parameterName: '', value: '' }],
    }));
  const updateEntryCriterion = (id: string, field: keyof EntryCriterion, value: string) =>
    setForm((f) => ({
      ...f,
      entryCriteria: f.entryCriteria.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }));
  const removeEntryCriterion = (id: string) =>
    setForm((f) => ({ ...f, entryCriteria: f.entryCriteria.filter((c) => c.id !== id) }));

  // --- Management Rules helpers ---
  const addManagementRule = () =>
    setForm((f) => ({
      ...f,
      managementRules: [
        ...f.managementRules,
        { id: uuidv4(), triggerCondition: '', actionDescription: '' },
      ],
    }));
  const updateManagementRule = (id: string, field: keyof ManagementRule, value: string) =>
    setForm((f) => ({
      ...f,
      managementRules: f.managementRules.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  const removeManagementRule = (id: string) =>
    setForm((f) => ({ ...f, managementRules: f.managementRules.filter((r) => r.id !== id) }));

  // --- Profit Targets helpers ---
  const addProfitTarget = () =>
    setForm((f) => ({
      ...f,
      profitTargets: [...f.profitTargets, { id: uuidv4(), targetValue: '', action: '' }],
    }));
  const updateProfitTarget = (id: string, field: keyof ProfitTarget, value: string) =>
    setForm((f) => ({
      ...f,
      profitTargets: f.profitTargets.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    }));
  const removeProfitTarget = (id: string) =>
    setForm((f) => ({ ...f, profitTargets: f.profitTargets.filter((t) => t.id !== id) }));

  // --- Stop Losses helpers ---
  const addStopLoss = () =>
    setForm((f) => ({
      ...f,
      stopLosses: [...f.stopLosses, { id: uuidv4(), stopValue: '', action: '' }],
    }));
  const updateStopLoss = (id: string, field: keyof StopLoss, value: string) =>
    setForm((f) => ({
      ...f,
      stopLosses: f.stopLosses.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  const removeStopLoss = (id: string) =>
    setForm((f) => ({ ...f, stopLosses: f.stopLosses.filter((s) => s.id !== id) }));

  const handleSave = () => {
    const validationErrors: string[] = [];
    if (!form.name.trim()) validationErrors.push('Strategy name is required.');
    if (form.entryCriteria.length === 0)
      validationErrors.push('At least one entry criterion is required.');
    if (form.managementRules.length === 0)
      validationErrors.push('At least one management rule is required.');
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onSave(form);
  };

  const title = strategy ? `Edit Strategy` : `Add Strategy`;

  return (
    <Modal isOpen onClose={onCancel} title={title} className="max-w-2xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {errors.length > 0 && (
          <div className="bg-error/10 border border-error/30 rounded-md p-3">
            <ul className="list-disc list-inside text-sm text-error space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Basic fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Strategy Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g., 11x Bear Trap"
            id="strategy-name"
          />
          <Select
            label="Classification"
            value={form.classification}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                classification: e.target.value as 'Core' | 'Speculative',
              }))
            }
            options={[
              { value: 'Core', label: 'Core' },
              { value: 'Speculative', label: 'Speculative' },
            ]}
            id="strategy-classification"
          />
        </div>
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Brief description of the strategy"
          id="strategy-description"
        />

        {/* Variants */}
        <SubListSection title="Variants" onAdd={addVariant}>
          {(form.variants ?? []).map((v) => (
            <div key={v.id} className="flex gap-2 items-start">
              <Input
                value={v.name}
                onChange={(e) => updateVariant(v.id, 'name', e.target.value)}
                placeholder="Variant name"
                id={`variant-name-${v.id}`}
              />
              <Input
                value={v.description}
                onChange={(e) => updateVariant(v.id, 'description', e.target.value)}
                placeholder="Description"
                id={`variant-desc-${v.id}`}
              />
              <Button variant="danger" size="sm" onClick={() => removeVariant(v.id)}>
                ✕
              </Button>
            </div>
          ))}
        </SubListSection>

        {/* Entry Criteria */}
        <SubListSection title="Entry Criteria" onAdd={addEntryCriterion}>
          {form.entryCriteria.map((c) => (
            <div key={c.id} className="flex gap-2 items-start">
              <Input
                value={c.parameterName}
                onChange={(e) => updateEntryCriterion(c.id, 'parameterName', e.target.value)}
                placeholder="Parameter (e.g., DTE)"
                id={`ec-param-${c.id}`}
              />
              <Input
                value={c.value}
                onChange={(e) => updateEntryCriterion(c.id, 'value', e.target.value)}
                placeholder="Value (e.g., 45 DTE)"
                id={`ec-value-${c.id}`}
              />
              <Button variant="danger" size="sm" onClick={() => removeEntryCriterion(c.id)}>
                ✕
              </Button>
            </div>
          ))}
        </SubListSection>

        {/* Management Rules */}
        <SubListSection title="Management Rules" onAdd={addManagementRule}>
          {form.managementRules.map((r) => (
            <div key={r.id} className="flex gap-2 items-start">
              <Input
                value={r.triggerCondition}
                onChange={(e) => updateManagementRule(r.id, 'triggerCondition', e.target.value)}
                placeholder="Trigger condition"
                id={`mr-trigger-${r.id}`}
              />
              <Input
                value={r.actionDescription}
                onChange={(e) => updateManagementRule(r.id, 'actionDescription', e.target.value)}
                placeholder="Action"
                id={`mr-action-${r.id}`}
              />
              <Button variant="danger" size="sm" onClick={() => removeManagementRule(r.id)}>
                ✕
              </Button>
            </div>
          ))}
        </SubListSection>

        {/* Profit Targets */}
        <SubListSection title="Profit Targets" onAdd={addProfitTarget}>
          {form.profitTargets.map((t) => (
            <div key={t.id} className="flex gap-2 items-start">
              <Input
                value={t.targetValue}
                onChange={(e) => updateProfitTarget(t.id, 'targetValue', e.target.value)}
                placeholder="Target (e.g., 50%)"
                id={`pt-value-${t.id}`}
              />
              <Input
                value={t.action}
                onChange={(e) => updateProfitTarget(t.id, 'action', e.target.value)}
                placeholder="Action (e.g., Close position)"
                id={`pt-action-${t.id}`}
              />
              <Button variant="danger" size="sm" onClick={() => removeProfitTarget(t.id)}>
                ✕
              </Button>
            </div>
          ))}
        </SubListSection>

        {/* Stop Losses */}
        <SubListSection title="Stop Losses" onAdd={addStopLoss}>
          {form.stopLosses.map((s) => (
            <div key={s.id} className="flex gap-2 items-start">
              <Input
                value={s.stopValue}
                onChange={(e) => updateStopLoss(s.id, 'stopValue', e.target.value)}
                placeholder="Stop (e.g., 200%)"
                id={`sl-value-${s.id}`}
              />
              <Input
                value={s.action}
                onChange={(e) => updateStopLoss(s.id, 'action', e.target.value)}
                placeholder="Action (e.g., Roll or close)"
                id={`sl-action-${s.id}`}
              />
              <Button variant="danger" size="sm" onClick={() => removeStopLoss(s.id)}>
                ✕
              </Button>
            </div>
          ))}
        </SubListSection>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Strategy</Button>
      </div>
    </Modal>
  );
}

function SubListSection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-text-primary">{title}</h4>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          + Add
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
