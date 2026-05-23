import { useState, useCallback, useRef } from 'react';

/**
 * Hook for resizable table columns.
 * Returns column widths and a resize handle component generator.
 */
export function useColumnResize(columnCount: number, defaultWidth = 80) {
  const [widths, setWidths] = useState<number[]>(new Array(columnCount).fill(defaultWidth));
  const startX = useRef(0);
  const startWidth = useRef(0);
  const resizingCol = useRef(-1);

  const onMouseDown = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startWidth.current = widths[colIndex];
    resizingCol.current = colIndex;

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      const newWidth = Math.max(30, startWidth.current + diff);
      setWidths((prev) => {
        const next = [...prev];
        next[colIndex] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizingCol.current = -1;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [widths]);

  return { widths, onMouseDown };
}
