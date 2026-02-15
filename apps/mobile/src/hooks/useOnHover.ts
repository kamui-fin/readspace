import { useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';

export const useOnHover = () => {
  const hovered = useSharedValue(false);

  const onHoverIn = useCallback(() => {
    hovered.value = true;
  }, [hovered]);

  const onHoverOut = useCallback(() => {
    hovered.value = false;
  }, [hovered]);

  return {
    hovered,
    onHoverIn,
    onHoverOut,
  };
};
