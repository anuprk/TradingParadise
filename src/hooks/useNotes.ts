import { useState, useCallback } from 'react';

/**
 * Simple hook for TipTap editor state management.
 * Manages content string, setter, and isEmpty check.
 */
export function useNotes(initialContent = '') {
  const [content, setContentState] = useState(initialContent);

  const setContent = useCallback((newContent: string) => {
    setContentState(newContent);
  }, []);

  const isEmpty = content.trim() === '' || content === '<p></p>';

  return {
    content,
    setContent,
    isEmpty,
  };
}
