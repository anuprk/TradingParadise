/**
 * Trade monitoring hook.
 *
 * Watches for changes in open trades and generates notifications
 * when plan compliance rules are violated or require attention.
 *
 * Polls journal entries periodically and compares against previous state.
 */

import { useEffect, useRef, useCallback } from 'react';
import { filterJournalEntries } from '../db/journalRepository';
import { evaluatePlanCompliance } from '../utils/planCompliance';
import { usePlanStore } from '../stores/planStore';
import { useAppStore } from '../stores/appStore';

const POLL_INTERVAL_MS = 60_000; // Check every 60 seconds

interface MonitorState {
  lastTradeIds: Set<string>;
  lastViolationIds: Set<string>;
}

/**
 * Monitors open trades for a plan and fires toast notifications
 * when compliance violations appear or new trades arrive that cause issues.
 */
export function useTradeMonitor(planId: string | undefined) {
  const { currentPlan } = usePlanStore();
  const { addToast } = useAppStore();
  const stateRef = useRef<MonitorState>({
    lastTradeIds: new Set(),
    lastViolationIds: new Set(),
  });

  const checkCompliance = useCallback(async () => {
    if (!planId || !currentPlan || currentPlan.id !== planId) return;

    try {
      const { entries } = await filterJournalEntries(
        { planId, tradeStatus: 'Open' },
        0,
        500,
      );

      const currentTradeIds = new Set(entries.map((e) => e.id));
      const prev = stateRef.current;

      // Detect new trades
      const newTrades = entries.filter((e) => !prev.lastTradeIds.has(e.id));
      // Detect closed/removed trades
      const removedIds = [...prev.lastTradeIds].filter((id) => !currentTradeIds.has(id));

      // Run compliance check
      const report = evaluatePlanCompliance(entries, currentPlan);
      const currentViolationIds = new Set(
        report.checks
          .filter((c) => c.severity === 'violation')
          .map((c) => c.id),
      );

      // Notify on new violations that weren't present before
      const newViolations = report.checks.filter(
        (c) => c.severity === 'violation' && !prev.lastViolationIds.has(c.id),
      );

      for (const violation of newViolations) {
        addToast(
          `⚠️ Plan violation: ${violation.label} — ${violation.description}`,
          'error',
        );
      }

      // Notify when new trades are detected (if they contribute to violations)
      if (newTrades.length > 0 && newViolations.length > 0) {
        addToast(
          `${newTrades.length} new trade(s) triggered compliance alert`,
          'warning',
        );
      }

      // Notify when trades close and compliance improves
      if (removedIds.length > 0) {
        const resolvedViolations = [...prev.lastViolationIds].filter(
          (id) => !currentViolationIds.has(id),
        );
        if (resolvedViolations.length > 0) {
          addToast(
            `✓ ${resolvedViolations.length} compliance issue(s) resolved`,
            'success',
          );
        }
      }

      // Update state
      stateRef.current = {
        lastTradeIds: currentTradeIds,
        lastViolationIds: currentViolationIds,
      };
    } catch {
      // Silently fail on monitoring — don't disrupt the user
    }
  }, [planId, currentPlan, addToast]);

  useEffect(() => {
    if (!planId) return;

    // Initial check
    checkCompliance();

    // Set up polling
    const interval = setInterval(checkCompliance, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [planId, checkCompliance]);
}
