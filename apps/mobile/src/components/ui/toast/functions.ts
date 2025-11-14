// Singleton reference for toast functions
let toastShowFunction:
  | ((toast: {
      type: 'success' | 'error' | 'promise' | 'info' | 'custom';
      title: string;
      duration?: number;
      from?: 'top' | 'bottom';
      custom?: {
        icon?: React.ReactNode;
        iconColor?: string;
        textColor?: string;
        backgroundColor?: string;
      };
    }) => string)
  | null = null;

let toastUpdateFunction:
  | ((
      id: string,
      update: {
        type?: 'success' | 'error' | 'promise' | 'info' | 'custom';
        title?: string;
        duration?: number;
      }
    ) => void)
  | null = null;

export const setToastFunctions = (
  showFn: typeof toastShowFunction,
  updateFn: typeof toastUpdateFunction
) => {
  toastShowFunction = showFn;
  toastUpdateFunction = updateFn;
};

export const getToastShowFunction = () => toastShowFunction;
export const getToastUpdateFunction = () => toastUpdateFunction;
