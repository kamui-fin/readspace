import { Dimensions } from 'react-native';

export const WIDTH: number = Dimensions.get('window').width;
export const ANIMATION_DURATION = 400;
export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 190,
  mass: 0.8,
};
