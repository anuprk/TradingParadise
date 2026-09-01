import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useDiscordAlertsStore } from '../../stores/discordAlertsStore';
import {
  isValidSourceName,
  isDuplicateSource,
} from '../../stores/discordAlertsHelpers';
import type { DiscordAlertSource } from '../../db/discordAlertsRepository';

/**
 * AlertSourceManager
 *
 * Lists configured Discord alert sources (Community + Chat_Room) and lets the
 * user create, edit, and delete them.
 *
 * Validation is performed inline BEFORE calling the store so the user gets
 * immediate feedback: names must be 1..100 characters after trimming
 * (`isValidSourceName`), and a case-insensitive / trim-insensitive duplicate is
 * rejected (`isDuplicateSource`). The store re-validates internally as a second
 * line of defense.
 *
 * Delete is a confirm-then-act flow: the confirmation shows the count of
 * associated alerts (derived from `grouped`) and warns that they will be
 * deleted too. Nothing is removed until the user confirms.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7
 */

interface FormErrors {
  community?: string;
  chatRoom?: string;
}

export default function AlertSourceManager() {
  const sources = useDiscordAlertsStore((s) => s.sources);
  const grouped = useDiscordAlertsStore((s) => s.grouped);
  const createSource = useDiscordAlertsStore((s) => s.createSource);
  const updateSource = useDiscordAlertsStore((s) => s.updateSource);
  const deleteSource = useDiscordAlertsStore((s) => s.deleteSource);

  // Create/edit form modal state.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiscordAlertSource | null>(null);
  const [community, setCommunity] = useState('');
  const [chatRoom, setChatRoom] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Delete confirmation state (retain until confirm — Requirement 2.7).
  const [pendingDelete, setPendingDelete] = useState<DiscordAlertSource | null>(
    null,
  );

  useEffect(() => {
    if (isFormOpen) {
      setCommunity(editing?.community ?? '');
      setChatRoom(editing?.chatRoom ?? '');
      setErrors({});
    }
  }, [isFormOpen, editing]);

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (source: DiscordAlertSource) => {
    setEditing(source);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
  };

  /** Count of alerts associated with a source, derived from `grouped`. */
  const associatedAlertCount = (sourceId: string): number => {
    const group = grouped.find((g) => g.source.id === sourceId);
    return group ? group.alerts.length : 0;
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};

    // Requirements 2.1/2.3: 1..100 chars trimmed; empty is rejected.
    if (!isValidSourceName(community)) {
      next.community = 'Community must be 1-100 characters';
    }
    if (!isValidSourceName(chatRoom)) {
      next.chatRoom = 'Chat room must be 1-100 characters';
    }

    // Requirement 2.5: case-insensitive, trim-insensitive duplicate rejection.
    // When editing, exclude the row being edited from the comparison set so a
    // no-op edit is not flagged as a duplicate of itself.
    if (!next.community && !next.chatRoom) {
      const others = editing
        ? sources.filter((s) => s.id !== editing.id)
        : sources;
      if (isDuplicateSource({ community, chatRoom }, others)) {
        next.chatRoom = 'That community and chat room already exists';
      }
    }

    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editing) {
      await updateSource(editing.id, {
        community: community.trim(),
        chatRoom: chatRoom.trim(),
      });
    } else {
      await createSource(community.trim(), chatRoom.trim());
    }
    closeForm();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteSource(pendingDelete.id);
    setPendingDelete(null);
  };

  const deleteCount = pendingDelete
    ? associatedAlertCount(pendingDelete.id)
    : 0;

  return (
    <section
      data-testid="source-manager"
      className="rounded-lg border border-border bg-surface-secondary p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          Alert Sources
        </h2>
        <Button
          size="sm"
          onClick={openCreate}
          data-testid="add-source-button"
        >
          <Plus size={16} className="mr-1" />
          Add Source
        </Button>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-text-secondary" data-testid="no-sources">
          No sources configured yet. Add a community and chat room to start
          capturing alerts.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="source-list">
          {sources.map((source) => (
            <li
              key={source.id}
              data-testid={`source-item-${source.id}`}
              className="flex items-center justify-between rounded-md border border-border bg-surface-secondary px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {source.community}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {source.chatRoom}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(source)}
                  aria-label={`Edit ${source.community} / ${source.chatRoom}`}
                  data-testid={`edit-source-${source.id}`}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(source)}
                  aria-label={`Delete ${source.community} / ${source.chatRoom}`}
                  data-testid={`delete-source-${source.id}`}
                >
                  <Trash2 size={16} className="text-error" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / edit form */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editing ? 'Edit Alert Source' : 'Add Alert Source'}
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="source-form"
        >
          <Input
            label="Community"
            name="community"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            error={errors.community}
            placeholder="e.g. Mak's Money Maker Club"
            data-testid="community-input"
          />
          <Input
            label="Chat Room"
            name="chatRoom"
            value={chatRoom}
            onChange={(e) => setChatRoom(e.target.value)}
            error={errors.chatRoom}
            placeholder="e.g. elite-trade-alerts"
            data-testid="chat-room-input"
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" data-testid="save-source-button">
              {editing ? 'Update Source' : 'Create Source'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation (retain until confirm — Requirement 2.7) */}
      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete Alert Source"
      >
        {pendingDelete && (
          <div className="space-y-4" data-testid="delete-confirm">
            <p className="text-sm text-text-primary">
              Delete{' '}
              <span className="font-medium text-text-accent">
                {pendingDelete.community}
              </span>{' '}
              /{' '}
              <span className="font-medium text-text-accent">
                {pendingDelete.chatRoom}
              </span>
              ?
            </p>
            <p className="text-sm text-text-secondary" data-testid="delete-count">
              {deleteCount === 0
                ? 'This source has no associated alerts.'
                : `This source has ${deleteCount} associated alert${
                    deleteCount === 1 ? '' : 's'
                  }, which will also be deleted. This cannot be undone.`}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDelete}
                data-testid="confirm-delete-button"
              >
                Delete Source
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
