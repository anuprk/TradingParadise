import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Card({ title, children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-surface-secondary rounded-lg shadow p-4 sm:p-6 border border-border ${className}`}
    >
      {title && (
        <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
