import React, { useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useDiscordAlertsStore } from '../../stores/discordAlertsStore';
import type { SubmitOutcome } from '../../stores/discordAlertsStore';
import type {
  ParsedTradeAlert,
  AlertActionType,
  AlertDirection,
  AmountKind,
} from '../../utils/parsers/discordAlertParser';

/**
 * Parse-then-review alert submission form.
 *
 * The user pastes raw alert text and submits it; the store parses it
 * synchronously and stages a `pendingReview`. The user then reviews and edits
 * the extracted fields before confirming, at which point the alert is
 * persisted. Outcomes (invalid/duplicate/not-open/stored) are surfaced inline
 * near the paste box.
 *
 * Requirements: 3.1, 3.3, 3.5, 4.4, 4.5, 5.1
 */

/** Editable subset of a ParsedTradeAlert, held as strings for the inputs. */
interface EditableFields {
  symbol: string;
  strategy: string;
  expiration: string;
  strikes: string;
  direction: '' | AlertDirection;
  fillPrice: string;
  amount: string;
  amountKind: '' | AmountKind;
  actionType: AlertActionType;
}

function seedEditable(review: ParsedTradeAlert): EditableFields {
  return {
    symbol: review.symbol ?? '',
    strategy: review.strategy ?? '',
    expiration: review.expiration ?? '',
    strikes: review.strikes ?? '',
    direction: review.direction ?? '',
    fillPrice: review.fillPrice === null ? '' : String(review.fillPrice),
    amount: review.amount === null ? '' : String(review.amount),
    amountKind: review.amountKind ?? '',
    actionType: review.actionType,
  };
}

/** Parse a string number field back to number | null. */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

/** Trim a string field back to string | null. */
function toStringOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export default function AlertSubmissionForm() {
  const currentSourceId = useDiscordAlertsStore((s) => s.currentSourceId);
  const pendingReview = useDiscordAlertsStore((s) => s.pendingReview);
  const submitAlert = useDiscordAlertsStore((s) => s.submitAlert);
  const confirmSaveAlert = useDiscordAlertsStore((s) => s.confirmSaveAlert);
  const selectSource = useDiscordAlertsStore((s) => s.selectSource);

  const [rawContent, setRawContent] = useState('');
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [edited, setEdited] = useState<EditableFields | null>(null);

  // A review is active when the store has a pendingReview and we have seeded
  // local editable state for it.
  const reviewing = pendingReview !== null && edited !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = submitAlert(rawContent);
    if (result.status === 'review') {
      const review = useDiscordAlertsStore.getState().pendingReview;
      if (review) {
        setEdited(seedEditable(review));
      }
      setOutcome(null);
    } else {
      setEdited(null);
      setOutcome(result);
    }
  };

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setEdited((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleConfirm = async () => {
    if (!pendingReview || !edited) return;
    // Preserve non-edited fields from pendingReview; take edited fields from
    // local state.
    const merged: ParsedTradeAlert = {
      ...pendingReview,
      symbol: toStringOrNull(edited.symbol),
      strategy: toStringOrNull(edited.strategy),
      expiration: toStringOrNull(edited.expiration),
      strikes: toStringOrNull(edited.strikes),
      direction: edited.direction === '' ? null : edited.direction,
      fillPrice: toNumberOrNull(edited.fillPrice),
      amount: toNumberOrNull(edited.amount),
      amountKind: edited.amountKind === '' ? null : edited.amountKind,
      actionType: edited.actionType,
    };
    const result = await confirmSaveAlert(merged);
    setEdited(null);
    setOutcome(result);
    if (result.status === 'stored') {
      setRawContent('');
    }
  };

  const handleCancel = () => {
    // Reset local editable state and clear the store's pendingReview by
    // re-selecting the current source (per store semantics).
    setEdited(null);
    setOutcome(null);
    selectSource(currentSourceId);
  };

  const outcomeText = (o: SubmitOutcome): string => {
    switch (o.status) {
      case 'invalid':
        return o.message ?? 'Invalid alert';
      case 'duplicate':
        return o.message ?? 'This alert is already saved';
      case 'not-open':
        return o.message ?? 'Only Open alerts are stored in this build';
      case 'stored':
        return 'Alert saved';
      default:
        return o.message ?? '';
    }
  };

  const outcomeClass = (o: SubmitOutcome): string =>
    o.status === 'stored' ? 'text-success' : 'text-error';

  return (
    <div className="space-y-4" data-testid="alert-submission-form">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="w-full">
          <label
            htmlFor="alert-paste-box"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Paste alert text
          </label>
          <textarea
            id="alert-paste-box"
            data-testid="alert-paste-box"
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={5}
            className="block w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent placeholder-text-secondary"
            placeholder="Paste a Discord trade alert here..."
          />
        </div>

        {currentSourceId === null && (
          <p className="text-sm text-text-secondary" data-testid="alert-source-hint">
            Select a source before submitting an alert.
          </p>
        )}

        <Button
          type="submit"
          data-testid="alert-submit"
          disabled={currentSourceId === null}
        >
          Parse alert
        </Button>
      </form>

      {outcome && (
        <p
          data-testid="alert-outcome"
          className={`text-sm ${outcomeClass(outcome)}`}
        >
          {outcomeText(outcome)}
        </p>
      )}

      {reviewing && pendingReview && edited && (
        <div
          className="space-y-4 rounded-md border border-border bg-surface-secondary p-4"
          data-testid="alert-review"
        >
          <h3 className="text-sm font-semibold text-text-primary">
            Review parsed alert
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Symbol"
              name="symbol"
              value={edited.symbol}
              onChange={handleFieldChange}
              data-testid="alert-field-symbol"
            />
            <Input
              label="Strategy"
              name="strategy"
              value={edited.strategy}
              onChange={handleFieldChange}
              data-testid="alert-field-strategy"
            />
            <Input
              label="Expiration"
              name="expiration"
              value={edited.expiration}
              onChange={handleFieldChange}
              data-testid="alert-field-expiration"
            />
            <Input
              label="Strikes"
              name="strikes"
              value={edited.strikes}
              onChange={handleFieldChange}
              data-testid="alert-field-strikes"
            />

            <div className="w-full">
              <label
                htmlFor="alert-field-direction"
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Direction
              </label>
              <select
                id="alert-field-direction"
                name="direction"
                value={edited.direction}
                onChange={handleFieldChange}
                data-testid="alert-field-direction"
                className="block w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent"
              >
                <option value="">—</option>
                <option value="buy">buy</option>
                <option value="sell">sell</option>
              </select>
            </div>

            <Input
              label="Fill price"
              name="fillPrice"
              type="number"
              step="0.01"
              value={edited.fillPrice}
              onChange={handleFieldChange}
              data-testid="alert-field-fillPrice"
            />
            <Input
              label="Amount"
              name="amount"
              type="number"
              step="0.01"
              value={edited.amount}
              onChange={handleFieldChange}
              data-testid="alert-field-amount"
            />

            <div className="w-full">
              <label
                htmlFor="alert-field-amountKind"
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Amount kind
              </label>
              <select
                id="alert-field-amountKind"
                name="amountKind"
                value={edited.amountKind}
                onChange={handleFieldChange}
                data-testid="alert-field-amountKind"
                className="block w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent"
              >
                <option value="">—</option>
                <option value="credit">credit</option>
                <option value="debit">debit</option>
              </select>
            </div>

            <div className="w-full">
              <label
                htmlFor="alert-field-actionType"
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Action type
              </label>
              <select
                id="alert-field-actionType"
                name="actionType"
                value={edited.actionType}
                onChange={handleFieldChange}
                data-testid="alert-field-actionType"
                className="block w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent"
              >
                <option value="Open">Open</option>
                <option value="Adjust">Adjust</option>
                <option value="Close">Close</option>
                <option value="Unclassified">Unclassified</option>
              </select>
            </div>
          </div>

          <div className="w-full">
            <span className="block text-sm font-medium text-text-secondary mb-1">
              Raw content
            </span>
            <pre
              data-testid="alert-review-raw"
              className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-primary p-2 text-xs text-text-secondary"
            >
              {pendingReview.rawContent}
            </pre>
          </div>

          {pendingReview.links.length > 0 && (
            <div className="w-full">
              <span className="block text-sm font-medium text-text-secondary mb-1">
                Links
              </span>
              <ul
                data-testid="alert-review-links"
                className="list-inside list-disc space-y-1 text-xs text-text-accent"
              >
                {pendingReview.links.map((link) => (
                  <li key={link} className="break-all">
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              data-testid="alert-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              data-testid="alert-confirm"
            >
              Confirm &amp; save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
