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
  expandTabIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
