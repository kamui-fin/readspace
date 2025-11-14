import { useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';

export const useOnFocus = () => {
  const focused = useSharedValue(false);

  const onFocus = useCallback(() => {
    focused.value = true;
  }, [focused]);

  const onBlur = useCallback(() => {
    focused.value = false;
  }, [focused]);

  return {
    focused,
    onFocus,
    onBlur,
  };
};
