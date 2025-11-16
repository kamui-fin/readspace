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
    backgroundColor: 'transparent',
  },
  blurView: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  expandedMenu: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    justifyContent: 'space-evenly',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    position: 'relative',
  },
  menuItemBackground: {
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
  },
  menuIconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  floatingBar: {
    flexDirection: 'row',
    height: 50,
  },
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
    backgroundColor: 'rgba(126, 126, 126, 0.1)',
  },
  dummyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
