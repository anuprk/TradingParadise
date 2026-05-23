import React from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export default function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  className = '',
  onRowClick,
}: TableProps<T>) {
  return (
    <>
      {/* Desktop table */}
      <div className={`hidden md:block overflow-x-auto ${className}`}>
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-tertiary">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface-secondary divide-y divide-border">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-surface-tertiary' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-text-primary whitespace-nowrap"
                  >
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-text-secondary"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className={`md:hidden space-y-3 ${className}`}>
        {data.length === 0 && (
          <p className="text-center text-sm text-text-secondary py-8">
            No data available
          </p>
        )}
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            className={`bg-surface-secondary rounded-lg shadow border border-border p-4 space-y-2 ${
              onRowClick ? 'cursor-pointer active:bg-surface-tertiary' : ''
            }`}
            onClick={() => onRowClick?.(row)}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between text-sm">
                <span className="font-medium text-text-secondary">{col.header}</span>
                <span className="text-text-primary">
                  {col.render
                    ? col.render(row)
                    : (row[col.key] as React.ReactNode)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
