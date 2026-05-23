import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotesEditor from '../NotesEditor';

// Mock TipTap since jsdom doesn't support contentEditable well
const mockChain = {
  focus: vi.fn().mockReturnThis(),
  toggleBold: vi.fn().mockReturnThis(),
  toggleItalic: vi.fn().mockReturnThis(),
  toggleHeading: vi.fn().mockReturnThis(),
  toggleBulletList: vi.fn().mockReturnThis(),
  toggleOrderedList: vi.fn().mockReturnThis(),
  run: vi.fn(),
};

const mockEditor = {
  getHTML: vi.fn(() => '<p>test</p>'),
  isActive: vi.fn(() => false),
  chain: vi.fn(() => mockChain),
  commands: { setContent: vi.fn() },
};

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => mockEditor),
  EditorContent: ({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="editor-content">Editor Content</div> : null,
}));

describe('NotesEditor', () => {
  it('renders the editor with toolbar', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    expect(screen.getByTestId('notes-editor')).toBeInTheDocument();
    expect(screen.getByTestId('notes-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('renders all formatting buttons', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading')).toBeInTheDocument();
    expect(screen.getByLabelText('Bullet List')).toBeInTheDocument();
    expect(screen.getByLabelText('Ordered List')).toBeInTheDocument();
  });

  it('calls editor chain for bold toggle', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Bold'));
    expect(mockChain.toggleBold).toHaveBeenCalled();
    expect(mockChain.run).toHaveBeenCalled();
  });

  it('calls editor chain for italic toggle', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Italic'));
    expect(mockChain.toggleItalic).toHaveBeenCalled();
  });

  it('calls editor chain for heading toggle', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Heading'));
    expect(mockChain.toggleHeading).toHaveBeenCalledWith({ level: 3 });
  });

  it('calls editor chain for bullet list toggle', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Bullet List'));
    expect(mockChain.toggleBulletList).toHaveBeenCalled();
  });

  it('calls editor chain for ordered list toggle', () => {
    render(<NotesEditor content="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Ordered List'));
    expect(mockChain.toggleOrderedList).toHaveBeenCalled();
  });
});
