/**
 * Zustand store for Discord trade alerts.
 *
 * Follows `portfolioStore.ts` conventions: `create<State>((set, get) => ({...}))`,
 * an `isLoading` flag, async actions that call the repository and route errors
 * to `useAppStore.getState().addToast(message, 'error')`, toggling `isLoading`
 * in a `finally`.
 *
 * This slice implements source and alert loading/CRUD actions (task 6.1). The
 * parse-then-review actions `submitAlert` and `confirmSaveAlert` are declared
 * in the interface with placeholder implementations that task 6.4 replaces.
 */

import { create } from 'zustand';
import * as repo from '../db/discordAlertsRepository';
import type {
  DiscordAlertSource,
  GroupedAlerts,
} from '../db/discordAlertsRepository';
import type { ParsedTradeAlert } from '../utils/parsers/discordAlertParser';
import { parseDiscordAlert } from '../utils/parsers/discordAlertParser';
import { ManualPasteSource } from '../utils/ingestion/manualPasteSource';
import {
  isValidSourceName,
  isDuplicateSource,
  isPersistableInInitialBuild,
} from './discordAlertsHelpers';
import { useAppStore } from './appStore';

/** Outcome of a submit/confirm attempt (used by task 6.4). */
export interface SubmitOutcome {
  status: 'review' | 'stored' | 'duplicate' | 'invalid' | 'not-open';
  message?: string;
}

interface DiscordAlertsState {
  sources: DiscordAlertSource[];
  grouped: GroupedAlerts[];
  currentSourceId: string | null;
  pendingReview: ParsedTradeAlert | null;
  isLoading: boolean;
  loadError: boolean;

  loadSources: () => Promise<void>;
  createSource: (community: string, chatRoom: string) => Promise<void>;
  updateSource: (
    id: string,
    changes: Partial<Pick<DiscordAlertSource, 'community' | 'chatRoom'>>,
  ) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  selectSource: (id: string | null) => void;
  loadAlerts: () => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;

  // Parse-then-review actions — fully implemented in task 6.4. Placeholder
  // stubs here so the store interface is complete.
  submitAlert: (rawContent: string) => SubmitOutcome;
  confirmSaveAlert: (edited: ParsedTradeAlert) => Promise<SubmitOutcome>;
}

export const useDiscordAlertsStore = create<DiscordAlertsState>((set, get) => ({
  sources: [],
  grouped: [],
  currentSourceId: null,
  pendingReview: null,
  isLoading: false,
  loadError: false,

  loadSources: async () => {
    set({ isLoading: true });
    try {
      const sources = await repo.listSources();
      set({ sources });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load sources',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  createSource: async (community, chatRoom) => {
    if (!isValidSourceName(community) || !isValidSourceName(chatRoom)) {
      useAppStore
        .getState()
        .addToast('Community and chat room must be 1-100 characters', 'error');
      return;
    }
    if (isDuplicateSource({ community, chatRoom }, get().sources)) {
      useAppStore.getState().addToast('That source already exists', 'error');
      return;
    }
    set({ isLoading: true });
    try {
      await repo.createSource(community, chatRoom);
      const [sources, grouped] = await Promise.all([
        repo.listSources(),
        repo.listAlertsGrouped(),
      ]);
      set({ sources, grouped });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to create source',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  updateSource: async (id, changes) => {
    set({ isLoading: true });
    try {
      await repo.updateSource(id, changes);
      const [sources, grouped] = await Promise.all([
        repo.listSources(),
        repo.listAlertsGrouped(),
      ]);
      set({ sources, grouped });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to update source',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  deleteSource: async (id) => {
    set({ isLoading: true });
    try {
      await repo.deleteSource(id);
      const [sources, grouped] = await Promise.all([
        repo.listSources(),
        repo.listAlertsGrouped(),
      ]);
      set({ sources, grouped });
      if (get().currentSourceId === id) {
        set({ currentSourceId: null });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete source',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  selectSource: (id) => {
    // Switching sources discards any in-flight review (design: pendingReview
    // clears on cancel/source switch).
    set({ currentSourceId: id, pendingReview: null });
  },

  loadAlerts: async () => {
    set({ isLoading: true });
    try {
      const grouped = await repo.listAlertsGrouped();
      set({ grouped, loadError: false });
    } catch (err) {
      set({ loadError: true });
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load alerts',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  deleteAlert: async (id) => {
    set({ isLoading: true });
    try {
      await repo.deleteAlert(id);
      const grouped = await repo.listAlertsGrouped();
      set({ grouped });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete alert',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  // Parse-then-review flow (task 6.4).

  submitAlert: (rawContent) => {
    // Requirement 3.1/3.3: a source must be selected before parsing.
    const currentSourceId = get().currentSourceId;
    if (currentSourceId === null) {
      return { status: 'invalid', message: 'Select a source first' };
    }
    const source = get().sources.find((s) => s.id === currentSourceId);
    if (!source) {
      return { status: 'invalid', message: 'Select a source first' };
    }

    // Normalize through the swappable ingestion source (applies the 10,000-char
    // cap). Manual paste yields exactly one submission.
    const [submission] = new ManualPasteSource().toRawSubmissions(rawContent, {
      community: source.community,
      chatRoom: source.chatRoom,
    });

    // Requirement 3.3: reject empty/whitespace-only content without persisting
    // or setting pendingReview.
    if (submission.rawContent.trim() === '') {
      return { status: 'invalid', message: 'Alert text is empty' };
    }

    // Parse and stage the result for user review (synchronous, no I/O).
    const parsed = parseDiscordAlert(submission.rawContent, {
      community: source.community,
      chatRoom: source.chatRoom,
    });
    set({ pendingReview: parsed });
    return { status: 'review' };
  },

  confirmSaveAlert: async (edited) => {
    const currentSourceId = get().currentSourceId;
    if (currentSourceId === null) {
      return { status: 'invalid', message: 'No source selected' };
    }

    // Requirements 4.4/4.5: the initial build stores only Open alerts.
    if (!isPersistableInInitialBuild(edited)) {
      set({ pendingReview: null });
      return {
        status: 'not-open',
        message: 'Only Open alerts are stored in this build',
      };
    }

    set({ isLoading: true });
    try {
      const result = await repo.createAlert(edited, currentSourceId);
      if (result.status === 'duplicate') {
        return { status: 'duplicate', message: 'This alert is already saved' };
      }
      // Stored: refresh the grouped view and clear the pending review.
      const grouped = await repo.listAlertsGrouped();
      set({ grouped, pendingReview: null });
      return { status: 'stored' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save alert';
      useAppStore.getState().addToast(message, 'error');
      return { status: 'invalid', message };
    } finally {
      set({ isLoading: false });
    }
  },
}));
