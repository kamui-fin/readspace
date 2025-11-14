import { useEffect } from 'react';
import { useToast as useToastContext } from '@contexts/toast-provider';
import { getToastShowFunction, getToastUpdateFunction, setToastFunctions } from './functions';

export type {
  ToastData,
  ToastType,
  CustomToastConfig,
} from '@components/ui/toast/container';

type ToastOptions = {
  duration?: number;
  from?: 'top' | 'bottom';
};

const createToast = (
  type: 'success' | 'error' | 'promise' | 'info' | 'custom',
  title: string,
  options?: ToastOptions
) => {
  const toastShowFunction = getToastShowFunction();
  if (toastShowFunction) {
    toastShowFunction({
      type,
      title,
      duration: options?.duration,
      from: options?.from || 'bottom',
    });
  } else {
    console.warn('Toast not initialized. Wrap your app with ToastProvider.');
  }
};

export const toast = {
  success: (title: string, options?: ToastOptions) => {
    createToast('success', title, options);
  },
  error: (title: string, options?: ToastOptions) => {
    createToast('error', title, options);
  },
  info: (title: string, options?: ToastOptions) => {
    createToast('info', title, options);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    },
    options?: ToastOptions
  ): Promise<T> => {
    const toastShowFunction = getToastShowFunction();
    const toastUpdateFunction = getToastUpdateFunction();

    if (!toastShowFunction || !toastUpdateFunction) {
      console.warn('Toast not initialized. Wrap your app with ToastProvider.');
      return promise;
    }

    // Show loading toast
    const toastId = toastShowFunction({
      type: 'promise',
      title: messages.loading,
      duration: 999999, // Keep it visible until promise resolves
      from: options?.from || 'bottom',
    });

    // Handle promise resolution
    promise
      .then(() => {
        const updateFn = getToastUpdateFunction();
        if (updateFn) {
          updateFn(toastId, {
            type: 'success',
            title: messages.success,
            duration: options?.duration || 3000,
          });
        }
      })
      .catch(() => {
        const updateFn = getToastUpdateFunction();
        if (updateFn) {
          updateFn(toastId, {
            type: 'error',
            title: messages.error,
            duration: options?.duration || 3000,
          });
        }
      });

    return promise;
  },
  custom: (
    title: string,
    config: {
      icon?: React.ReactNode;
      iconColor?: string;
      textColor?: string;
      backgroundColor?: string;
    },
    options?: ToastOptions
  ) => {
    const toastShowFunction = getToastShowFunction();
    if (toastShowFunction) {
      toastShowFunction({
        type: 'custom',
        title,
        duration: options?.duration,
        from: options?.from || 'bottom',
        custom: config,
      });
    } else {
      console.warn('Toast not initialized. Wrap your app with ToastProvider.');
    }
  },
};

// Hook to initialize toast in the provider
export const useToastInit = () => {
  const { showToast, updateToast } = useToastContext();

  useEffect(() => {
    setToastFunctions(showToast, updateToast);
    return () => {
      setToastFunctions(null, null);
    };
  }, [showToast, updateToast]);
};
