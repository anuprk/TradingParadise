import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useAppStore, type Toast as ToastType } from '../../stores/appStore';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colorMap = {
  success: 'bg-surface-secondary text-success border-success/30',
  error: 'bg-surface-secondary text-error border-error/30',
  info: 'bg-surface-secondary text-text-accent border-text-accent/30',
};

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useAppStore((s) => s.removeToast);
  const Icon = iconMap[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md ${colorMap[toast.type]}`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 hover:opacity-70 focus:outline-none"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function Toast() {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
