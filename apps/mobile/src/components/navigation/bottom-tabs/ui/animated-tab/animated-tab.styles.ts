import { StyleSheet } from 'react-native';
import { COLORS } from '@lib/constants/colors';

export const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 200,
    margin: 5,
    position: 'relative',
  },
  tabBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 200,
    // Note: This is a default fallback; components override with theme-aware colors
    backgroundColor: COLORS.white_extra_low_opacity,
  },
});
