import { useState } from 'react';
import { useDiscordAlertsStore } from '../../stores/discordAlertsStore';
import type {
  DiscordTradeAlert,
  GroupedAlerts,
} from '../../db/discordAlertsRepository';

/**
 * Displays stored Discord trade alerts grouped by Alert_Source (Community +
 * Chat_Room). The `grouped` data comes from the store already sorted
 * (reverse-chronological by submissionTimestamp with id as the deterministic
 * secondary key), so groups and alerts are rendered in the order provided.
 *
 * Requirements: 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

/** Map an Action_Type to a colored badge style (Requirement 7.6). */
const ACTION_BADGE_CLASSES: Record<DiscordTradeAlert['actionType'], string> = {
  Open: 'bg-success/20 text-success',
  Adjust: 'bg-warning/20 text-warning',
  Close: 'bg-error/20 text-error',
  Unclassified: 'bg-surface-tertiary text-text-secondary',
};

/** A single structured field row: field name + value. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary text-right break-words">{value}</span>
    </div>
  );
}

function AlertCard({
  alert,
  onDelete,
}: {
  alert: DiscordTradeAlert;
  onDelete: (id: string) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  // Only render fields that were extracted (Requirement 7.6). `amount` is
  // paired with `amountKind` (credit/debit) for context.
  const fields: { label: string; value: string }[] = [];
  if (alert.symbol != null) fields.push({ label: 'Symbol', value: alert.symbol });
  if (alert.strategy != null) fields.push({ label: 'Strategy', value: alert.strategy });
  if (alert.expiration != null) fields.push({ label: 'Expiration', value: alert.expiration });
  if (alert.strikes != null) fields.push({ label: 'Strikes', value: alert.strikes });
  if (alert.direction != null) fields.push({ label: 'Direction', value: alert.direction });
  if (alert.fillPrice != null) fields.push({ label: 'Fill Price', value: String(alert.fillPrice) });
  if (alert.amount != null) {
    const kind = alert.amountKind != null ? ` ${alert.amountKind}` : '';
    fields.push({ label: 'Amount', value: `${alert.amount}${kind}` });
  }

  return (
    <div
      data-testid="alert-card"
      className="bg-surface-secondary border border-border rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          data-testid="alert-action-badge"
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_BADGE_CLASSES[alert.actionType]}`}
        >
          {alert.actionType}
        </span>
        <button
          type="button"
          data-testid="alert-delete"
          className="text-sm text-text-secondary hover:text-error"
          onClick={() => onDelete(alert.id)}
        >
          Delete
        </button>
      </div>

      {fields.length > 0 ? (
        <div className="text-sm space-y-1">
          {fields.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">No structured fields extracted.</p>
      )}

      {alert.links.length > 0 && (
        <div className="text-sm space-y-1">
          <span className="text-text-secondary">Links</span>
          <ul className="space-y-1">
            {alert.links.map((link, i) => (
              <li key={`${link}-${i}`}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-accent hover:underline break-all"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reveal control for the full Raw_Content (Requirement 7.4). */}
      <div>
        <button
          type="button"
          data-testid="alert-raw-toggle"
          className="text-sm text-text-accent hover:underline"
          aria-expanded={showRaw}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide raw' : 'Show raw'}
        </button>
        {showRaw && (
          <pre
            data-testid="alert-raw-content"
            className="mt-2 whitespace-pre-wrap break-words rounded-md bg-surface-tertiary p-3 text-xs text-text-primary"
          >
            {alert.rawContent}
          </pre>
        )}
      </div>
    </div>
  );
}

function AlertGroup({
  group,
  onDelete,
}: {
  group: GroupedAlerts;
  onDelete: (id: string) => void;
}) {
  return (
    <section data-testid="alert-group" className="space-y-3">
      {/* Group label: community name + chat room name (Requirement 7.1). */}
      <header>
        <h3 className="text-base font-semibold text-text-primary">
          {group.source.community}
        </h3>
        <p className="text-sm text-text-secondary">{group.source.chatRoom}</p>
      </header>

      {group.alerts.length === 0 ? (
        <p data-testid="alert-empty" className="text-sm text-text-secondary">
          No alerts available for {group.source.community} / {group.source.chatRoom}.
        </p>
      ) : (
        <div className="space-y-3">
          {group.alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function AlertViewer() {
  const grouped = useDiscordAlertsStore((s) => s.grouped);
  const deleteAlert = useDiscordAlertsStore((s) => s.deleteAlert);

  return (
    <div data-testid="alert-viewer" className="space-y-6">
      {grouped.length === 0 ? (
        <p data-testid="alert-empty" className="text-sm text-text-secondary">
          No alerts available for the selected community and chat room.
        </p>
      ) : (
        grouped.map((group) => (
          <AlertGroup key={group.source.id} group={group} onDelete={deleteAlert} />
        ))
      )}
    </div>
  );
}
