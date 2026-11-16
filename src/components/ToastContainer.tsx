import React from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 shadow-xl border flex items-start gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isSuccess
                ? 'bg-emerald-950 text-white border-emerald-800'
                : isError
                ? 'bg-rose-950 text-white border-rose-800'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isError ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <Info className="w-4 h-4 text-sky-400" />
              )}
            </div>
            <div className="flex-1 leading-relaxed font-medium">{toast.message}</div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-white/60 hover:text-white p-0.5 cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
