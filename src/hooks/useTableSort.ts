import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

/**
 * Accessor that returns the comparable value for a given row and column key.
 * Return `null`/`undefined` for missing values (they always sort to the end).
 */
export type SortAccessor<T, K extends string> = (
  row: T,
  key: K,
) => string | number | Date | null | undefined;

export interface UseTableSortOptions<K extends string> {
  /** Column key to sort by initially. */
  initialKey: K;
  /** Initial sort direction. Defaults to 'asc'. */
  initialDir?: SortDir;
  /**
   * Direction to use when a *new* column is selected, per key.
   * Defaults to 'asc' for every column unless overridden here.
   */
  defaultDirForKey?: Partial<Record<K, SortDir>>;
}

export interface UseTableSortResult<T, K extends string> {
  sorted: T[];
  sortKey: K;
  sortDir: SortDir;
  /** Toggle direction if the same key, otherwise switch to key's default direction. */
  handleSort: (key: K) => void;
  /** Returns a ▲/▼ arrow string for the active column, empty otherwise. */
  sortIndicator: (key: K) => string;
}

function compareValues(
  a: string | number | Date,
  b: string | number | Date,
  dir: SortDir,
): number {
  let cmp: number;
  if (a instanceof Date || b instanceof Date) {
    const av = a instanceof Date ? a.getTime() : Number(a);
    const bv = b instanceof Date ? b.getTime() : Number(b);
    cmp = av - bv;
  } else if (typeof a === 'string' && typeof b === 'string') {
    cmp = a.localeCompare(b);
  } else {
    cmp = Number(a) - Number(b);
  }
  return dir === 'asc' ? cmp : -cmp;
}

/**
 * Reusable client-side table sorting hook.
 *
 * Missing values sort to the end for both directions. Clicking the active
 * column toggles direction; clicking a new column applies that column's
 * default direction (asc unless overridden).
 */
export function useTableSort<T, K extends string>(
  data: T[],
  accessor: SortAccessor<T, K>,
  options: UseTableSortOptions<K>,
): UseTableSortResult<T, K> {
  const { initialKey, initialDir = 'asc', defaultDirForKey } = options;
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const sorted = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) => {
      const av = accessor(a, sortKey);
      const bv = accessor(b, sortKey);
      // Handle missing-to-end explicitly so direction doesn't flip them.
      const aMissing = av == null || (typeof av === 'number' && Number.isNaN(av));
      const bMissing = bv == null || (typeof bv === 'number' && Number.isNaN(bv));
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return compareValues(av as string | number | Date, bv as string | number | Date, sortDir);
    });
    return rows;
  }, [data, accessor, sortKey, sortDir]);

  const handleSort = (key: K) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(defaultDirForKey?.[key] ?? 'asc');
    }
  };

  const sortIndicator = (key: K) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return { sorted, sortKey, sortDir, handleSort, sortIndicator };
}
