import { useEffect } from 'react';
import { useDiscordAlertsStore } from '../stores/discordAlertsStore';
import AlertSourceManager from '../components/discordAlerts/AlertSourceManager';
import AlertSubmissionForm from '../components/discordAlerts/AlertSubmissionForm';
import AlertViewer from '../components/discordAlerts/AlertViewer';

/**
 * DiscordAlertsPage — active section content for the Discord Alerts feature.
 *
 * On mount it loads the configured sources and stored alerts. It renders a
 * source selector bound to `currentSourceId`, the source manager, the
 * parse-then-review submission form, and the grouped alert viewer. If the
 * store reports a load failure, an error banner is shown near the viewer.
 *
 * Requirements: 1.2, 1.4, 1.5, 6.5
 */
export default function DiscordAlertsPage() {
  const sources = useDiscordAlertsStore((s) => s.sources);
  const currentSourceId = useDiscordAlertsStore((s) => s.currentSourceId);
  const loadError = useDiscordAlertsStore((s) => s.loadError);
  const loadSources = useDiscordAlertsStore((s) => s.loadSources);
  const loadAlerts = useDiscordAlertsStore((s) => s.loadAlerts);
  const selectSource = useDiscordAlertsStore((s) => s.selectSource);

  useEffect(() => {
    void loadSources();
    void loadAlerts();
  }, [loadSources, loadAlerts]);

  return (
    <div className="p-6 space-y-6" data-testid="discord-alerts-page">
      <h1 className="text-2xl font-bold text-text-primary">Discord Alerts</h1>

      <div className="w-full max-w-md">
        <label
          htmlFor="source-selector"
          className="block text-sm font-medium text-text-secondary mb-1"
        >
          Source
        </label>
        <select
          id="source-selector"
          data-testid="source-selector"
          value={currentSourceId ?? ''}
          onChange={(e) =>
            selectSource(e.target.value === '' ? null : e.target.value)
          }
          className="block w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent"
        >
          <option value="">Select a source…</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.community} / {source.chatRoom}
            </option>
          ))}
        </select>
      </div>

      <AlertSourceManager />

      <AlertSubmissionForm />

      {loadError && (
        <div
          data-testid="load-error"
          role="alert"
          className="rounded-md border border-error bg-error/10 px-4 py-3 text-sm text-error"
        >
          Failed to load alerts
        </div>
      )}

      <AlertViewer />
    </div>
  );
}
