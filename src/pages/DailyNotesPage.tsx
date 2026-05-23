import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Trash2, Plus } from 'lucide-react';
import { marked } from 'marked';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAppStore } from '../stores/appStore';
import { listNotes, upsertNote, deleteNote, type DailyNote } from '../db/notesRepository';

/**
 * Daily Notes — single scrollable page showing all notes (newest first).
 * Today's note is always at the top with an editor.
 * Previous days are shown as rendered markdown for easy reference.
 */

export default function DailyNotesPage() {
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [todayContent, setTodayContent] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const addToast = useAppStore((s) => s.addToast);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Load all notes
  useEffect(() => {
    setIsLoading(true);
    listNotes()
      .then((loaded) => {
        setNotes(loaded);
        const todayNote = loaded.find((n) => n.noteDate === today);
        if (todayNote) setTodayContent(todayNote.content);
      })
      .catch((err) => addToast(err.message, 'error'))
      .finally(() => setIsLoading(false));
  }, [today, addToast]);

  // Auto-save today's note with debounce
  const handleTodayChange = useCallback((value: string) => {
    setTodayContent(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await upsertNote(today, value);
        // Update local state
        setNotes((prev) => {
          const existing = prev.find((n) => n.noteDate === today);
          if (existing) {
            return prev.map((n) => n.noteDate === today ? { ...n, content: value, updatedAt: new Date() } : n);
          }
          return [{ id: '', noteDate: today, content: value, createdAt: new Date(), updatedAt: new Date() }, ...prev];
        });
      } catch {}
    }, 1000);
  }, [today]);

  // Edit a previous day's note
  const startEdit = useCallback((note: DailyNote) => {
    setEditingDate(note.noteDate);
    setEditContent(note.content);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingDate) return;
    try {
      await upsertNote(editingDate, editContent);
      setNotes((prev) => prev.map((n) => n.noteDate === editingDate ? { ...n, content: editContent, updatedAt: new Date() } : n));
      setEditingDate(null);
      addToast('Note saved', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    }
  }, [editingDate, editContent, addToast]);

  const handleDelete = useCallback(async (noteDate: string) => {
    try {
      await deleteNote(noteDate);
      setNotes((prev) => prev.filter((n) => n.noteDate !== noteDate));
      if (noteDate === today) setTodayContent('');
      addToast('Note deleted', 'info');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  }, [today, addToast]);

  const renderMarkdown = (content: string) => {
    try {
      return marked(content, { async: false }) as string;
    } catch {
      return content;
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-text-secondary">Loading notes...</div>;
  }

  const previousNotes = notes.filter((n) => n.noteDate !== today && n.content.trim());

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Daily Notes</h1>
        <p className="text-sm text-text-secondary">Auto-saves as you type</p>
      </div>

      {/* Today's Note — always editable */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-accent">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} — Today
          </h2>
          {todayContent.trim() && (
            <button onClick={() => handleDelete(today)} className="p-1 rounded text-text-secondary hover:text-error" title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <textarea
          value={todayContent}
          onChange={(e) => handleTodayChange(e.target.value)}
          placeholder={`## Market Outlook\n- \n\n## Planned Trades\n- \n\n## End of Day Review\n- `}
          className="w-full min-h-[200px] font-mono text-sm text-text-primary bg-transparent resize-y outline-none leading-relaxed placeholder-text-secondary/40 border border-border rounded-lg p-3"
          spellCheck={false}
        />
      </Card>

      {/* Previous Notes — rendered markdown, click to edit */}
      {previousNotes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide">Previous Notes</h3>
          {previousNotes.map((note) => (
            <Card key={note.noteDate}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-text-primary">
                  {format(new Date(note.noteDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                </h4>
                <div className="flex items-center gap-1">
                  {editingDate !== note.noteDate && (
                    <button onClick={() => startEdit(note)} className="px-2 py-0.5 text-[10px] font-medium text-text-accent hover:bg-text-accent/10 rounded">
                      Edit
                    </button>
                  )}
                  <button onClick={() => handleDelete(note.noteDate)} className="p-1 rounded text-text-secondary hover:text-error" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {editingDate === note.noteDate ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[150px] font-mono text-sm text-text-primary bg-transparent resize-y outline-none leading-relaxed border border-border rounded-lg p-3"
                    spellCheck={false}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingDate(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="prose prose-sm prose-invert max-w-none text-text-primary
                    prose-headings:font-bold prose-h2:text-sm prose-h3:text-xs
                    prose-p:my-1 prose-li:my-0.5 prose-ul:my-1"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      {previousNotes.length === 0 && !todayContent.trim() && (
        <div className="text-center py-12">
          <p className="text-text-secondary">No notes yet. Start writing above!</p>
        </div>
      )}
    </div>
  );
}
