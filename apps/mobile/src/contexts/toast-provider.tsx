import type React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { ToastItem, type ToastData } from '../components/ui/toast/container';
import { setToastFunctions } from '../components/ui/toast/functions';

interface ToastContextType {
  showToast: (toast: Omit<ToastData, 'id'>) => string;
  updateToast: (id: string, toast: Partial<Omit<ToastData, 'id'>>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: ToastData = { ...toast, id };

    setToasts(() => {
      // Only allow one toast at a time, replace existing
      return [newToast];
    });

    return id;
  }, []);

  const updateToast = useCallback((id: string, update: Partial<Omit<ToastData, 'id'>>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initialize toast functions for the singleton toast API
  useEffect(() => {
    setToastFunctions(showToast, updateToast);
    return () => {
      setToastFunctions(null, null);
    };
  }, [showToast, updateToast]);

  return (
    <ToastContext.Provider value={{ showToast, updateToast, dismissToast }}>
      {children}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'box-none',
        }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
