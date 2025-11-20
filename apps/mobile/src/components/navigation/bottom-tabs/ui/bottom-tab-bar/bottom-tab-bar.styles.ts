import { COLORS } from '@lib/constants/colors';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  gestureContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  container: {},
  floatingBarWrapper: {
    overflow: 'hidden',
    backgroundColor: COLORS.transparent,
  },
  blurView: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: COLORS.transparent,
  },
  floatingBar: {
    flexDirection: 'row',
    height: 50,
  },
});
