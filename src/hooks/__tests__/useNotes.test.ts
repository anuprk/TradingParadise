import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useNotes } from '../useNotes';

describe('useNotes', () => {
  it('initializes with default empty content', () => {
    const { result } = renderHook(() => useNotes());
    expect(result.current.content).toBe('');
    expect(result.current.isEmpty).toBe(true);
  });

  it('initializes with provided content', () => {
    const { result } = renderHook(() => useNotes('<p>Hello</p>'));
    expect(result.current.content).toBe('<p>Hello</p>');
    expect(result.current.isEmpty).toBe(false);
  });

  it('updates content via setContent', () => {
    const { result } = renderHook(() => useNotes());
    act(() => {
      result.current.setContent('<p>New content</p>');
    });
    expect(result.current.content).toBe('<p>New content</p>');
    expect(result.current.isEmpty).toBe(false);
  });

  it('treats empty paragraph as empty', () => {
    const { result } = renderHook(() => useNotes('<p></p>'));
    expect(result.current.isEmpty).toBe(true);
  });

  it('treats whitespace-only content as empty', () => {
    const { result } = renderHook(() => useNotes('   '));
    expect(result.current.isEmpty).toBe(true);
  });
});
