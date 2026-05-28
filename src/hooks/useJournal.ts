import { useEffect, useCallback } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAppStore } from '../stores/appStore';
import type { TradeJournalEntry } from '../types/journal';
import type { JournalFilters } from '../db/journalRepository';
import {
  calculateDTE,
  calculateDITC,
  calculateBreakEvenPrice,
  calculateAnnualizedROR,
  calculateMarginAnnualizedROR,
  calculateProfitLoss,
  calculateWinLoss,
  calculateDaysHeld,
} from '../utils/calculations';
import type { OptionType, TradeDirection } from '../types/journal';

/**
 * Custom hook wrapping the journal store with filtering and auto-calculations.
 *
 * Requirements: 13.4, 13.5, 13.9
 */
export function useJournal() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const {
    entries,
    filters,
    sortField,
    sortDirection,
    isLoading,
    totalCount,
    currentPage,
    stats,
    loadEntries,
    loadStats,
    addEntry,
    updateEntry,
    deleteEntry,
    setFilters,
    setSort,
    setPage,
    assignDefaultStrategies,
    getSummary,
  } = useJournalStore();

  // Load entries when planId changes or component mounts
  useEffect(() => {
    if (activePlanId) {
      loadEntries(activePlanId);
    }
  }, [activePlanId, loadEntries]);

  // Force reload when hook mounts (handles navigation back to journal)
  useEffect(() => {
    if (activePlanId) {
      loadEntries(activePlanId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = useCallback(
    async (newFilters: JournalFilters) => {
      await setFilters({ ...newFilters, planId: activePlanId ?? undefined });
    },
    [setFilters, activePlanId],
  );

  /**
   * Auto-calculate fields for a trade entry based on its current data.
   * Returns a partial with all computed fields filled in.
   */
  const autoCalculate = useCallback(
    (entry: Partial<TradeJournalEntry>): Partial<TradeJournalEntry> => {
      const computed: Partial<TradeJournalEntry> = {};

      // DTE: calendar days between openDate and expirationDate
      if (entry.openDate && entry.expirationDate) {
        computed.dte = calculateDTE(
          new Date(entry.openDate),
          new Date(entry.expirationDate),
        );
      }

      // DITC: calendar days from openDate to now (open trades)
      if (entry.openDate && entry.tradeStatus === 'Open') {
        computed.ditc = calculateDITC(new Date(entry.openDate));
      }

      // Break-even price
      if (
        entry.strikePrice != null &&
        entry.premium != null &&
        entry.optionType
      ) {
        computed.breakEvenPrice = calculateBreakEvenPrice(
          entry.strikePrice,
          entry.premium,
          entry.optionType as OptionType,
        );
      }

      // Days held (closed trades)
      if (entry.openDate && entry.closeDate) {
        computed.daysHeld = calculateDaysHeld(
          new Date(entry.openDate),
          new Date(entry.closeDate),
        );
      }

      const daysForROR =
        computed.daysHeld ??
        entry.daysHeld ??
        (entry.openDate ? calculateDITC(new Date(entry.openDate)) : 0);

      // Annualized ROR
      if (entry.premium != null && entry.cashReserve != null && daysForROR > 0) {
        computed.annualizedROR = calculateAnnualizedROR(
          entry.premium,
          entry.cashReserve,
          daysForROR,
        );
      }

      // Margin Annualized ROR
      if (
        entry.premium != null &&
        entry.marginCashReserve != null &&
        daysForROR > 0
      ) {
        computed.marginAnnualizedROR = calculateMarginAnnualizedROR(
          entry.premium,
          entry.marginCashReserve,
          daysForROR,
        );
      }

      // P/L and Win/Loss on close
      if (
        entry.exitPrice != null &&
        entry.premium != null &&
        entry.direction &&
        entry.fees != null
      ) {
        computed.profitLoss = calculateProfitLoss(
          entry.premium,
          entry.exitPrice,
          entry.direction as TradeDirection,
          entry.fees,
        );
        computed.winLoss = calculateWinLoss(computed.profitLoss);
      }

      return computed;
    },
    [],
  );

  return {
    entries,
    filters,
    sortField,
    sortDirection,
    isLoading,
    totalCount,
    currentPage,
    stats,
    summary: getSummary(),
    addEntry,
    updateEntry,
    deleteEntry,
    setFilters: applyFilters,
    setSort,
    setPage,
    assignDefaultStrategies,
    autoCalculate,
  };
}
