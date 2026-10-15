import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, description?: string, duration = 4500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, [dismiss]);

  const toast = {
    success: (title: string, description?: string) => addToast('success', title, description),
    error: (title: string, description?: string) => addToast('error', title, description, 6000),
    warning: (title: string, description?: string) => addToast('warning', title, description),
    info: (title: string, description?: string) => addToast('info', title, description),
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast Notification Viewport */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const config = {
            success: {
              Icon: CheckCircle2,
              border: 'border-emerald-500/30 dark:border-emerald-500/40',
              bg: 'bg-white/95 dark:bg-slate-900/95',
              iconColor: 'text-emerald-500',
              bar: 'bg-emerald-500',
            },
            error: {
              Icon: AlertTriangle,
              border: 'border-rose-500/30 dark:border-rose-500/40',
              bg: 'bg-white/95 dark:bg-slate-900/95',
              iconColor: 'text-rose-500',
              bar: 'bg-rose-500',
            },
            warning: {
              Icon: AlertCircle,
              border: 'border-amber-500/30 dark:border-amber-500/40',
              bg: 'bg-white/95 dark:bg-slate-900/95',
              iconColor: 'text-amber-500',
              bar: 'bg-amber-500',
            },
            info: {
              Icon: Info,
              border: 'border-sky-500/30 dark:border-sky-500/40',
              bg: 'bg-white/95 dark:bg-slate-900/95',
              iconColor: 'text-sky-500',
              bar: 'bg-sky-500',
            },
          }[item.type];

          const IconComponent = config.Icon;

          return (
            <div
              key={item.id}
              role="alert"
              className={`pointer-events-auto relative overflow-hidden rounded-xl border shadow-xl backdrop-blur-md p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${config.bg} ${config.border}`}
            >
              <div className="flex items-start gap-3">
                <IconComponent className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} aria-hidden="true" />
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Subtle bottom progress bar */}
              <div
                className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-60 ${config.bar}`}
                style={{
                  animation: `toast-progress ${item.duration || 4500}ms linear forwards`,
                }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
