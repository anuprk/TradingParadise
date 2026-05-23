import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-text-accent text-surface-primary hover:bg-sky-300 focus:ring-text-accent disabled:opacity-50',
  secondary:
    'bg-surface-tertiary text-text-primary border border-border hover:bg-surface-secondary focus:ring-text-accent disabled:opacity-50',
  danger:
    'bg-error text-white hover:bg-red-500 focus:ring-error disabled:opacity-50',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-tertiary hover:text-text-primary focus:ring-text-accent disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-primary transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
