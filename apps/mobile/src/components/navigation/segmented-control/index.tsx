import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

import RNSegmentedControl, {
  NativeSegmentedControlIOSChangeEvent,
} from '@react-native-segmented-control/segmented-control';
import { useCallback } from 'react';
import { NativeSyntheticEvent, View } from 'react-native';

type SegmentedControlProps = {
  values: string[];
  selectedIndex: number;
  onChange: (newIndex: number) => void;
};

export const SegmentedControl = (props: SegmentedControlProps) => {
  const isDark = useIsDarkMode();
  const { values, selectedIndex, onChange } = props;
  const handleChange = useCallback(
    (e: NativeSyntheticEvent<NativeSegmentedControlIOSChangeEvent>) => {
      onChange?.(e.nativeEvent.selectedSegmentIndex);
    },
    [onChange]
  );

  return (
    <View style={{ overflow: 'hidden', borderRadius: 9999 }}>
      <RNSegmentedControl
        values={values}
        selectedIndex={selectedIndex}
        onChange={handleChange}
        backgroundColor={isDark ? COLORS.dark.grey6 : COLORS.light.grey5}
        tintColor={isDark ? COLORS.white : COLORS.light.black}
        fontStyle={{
          color: isDark ? COLORS.dark.grey2 : COLORS.light.grey,
          fontWeight: 'bold',
        }}
        activeFontStyle={{
          color: isDark ? COLORS.dark.black : COLORS.white,
          fontWeight: 'bold',
        }}
      />
    </View>
  );
};
