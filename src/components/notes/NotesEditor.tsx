import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

interface NotesEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  label,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className={`px-2 py-1 text-sm rounded ${
        isActive
          ? 'bg-text-accent/20 text-text-accent font-semibold'
          : 'text-text-secondary hover:bg-surface-tertiary'
      }`}
    >
      {children}
    </button>
  );
}

export default function NotesEditor({ content, onChange, placeholder }: NotesEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none px-3 py-2 min-h-[100px] focus:outline-none',
        'data-placeholder': placeholder ?? 'Trade rationale, market conditions, lessons learned...',
      },
    },
  });

  // Sync external content changes (e.g. form reset)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div
      className="rounded-md border border-border shadow-sm focus-within:ring-2 focus-within:ring-text-accent focus-within:border-text-accent"
      data-testid="notes-editor"
    >
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1 bg-surface-tertiary rounded-t-md" data-testid="notes-toolbar">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          label="Bold"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          label="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          label="Heading"
        >
          H
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          label="Bullet List"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          label="Ordered List"
        >
          1. List
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
