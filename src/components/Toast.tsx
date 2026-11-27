import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toastsState: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((l) => l([...toastsState]));
}

export const toast = {
  show(message: string, type: ToastType = 'info', duration = 4000) {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast: ToastItem = { id, message, type };
    toastsState = [...toastsState, newToast];
    notify();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
  },

  success(message: string, duration = 4000) {
    toast.show(message, 'success', duration);
  },

  error(message: string, duration = 5000) {
    toast.show(message, 'error', duration);
  },

  info(message: string, duration = 4000) {
    toast.show(message, 'info', duration);
  },

  dismiss(id: string) {
    toastsState = toastsState.filter((t) => t.id !== id);
    notify();
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-dropdown transition-all animate-in slide-in-from-bottom-2 duration-200 ${
            t.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : t.type === 'error'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : 'bg-white border-[#E3EAE5] text-[#111C16]'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />}
          {t.type === 'info' && <Info className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" />}

          <div className="flex-1 text-xs font-medium leading-relaxed">{t.message}</div>

          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="text-current opacity-60 hover:opacity-100 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
