import { useRef } from 'react';
import { Animated, Dimensions } from 'react-native';

const W = Dimensions.get('window').width;

export function useDeleteAnimation(onDeleted: () => void) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animatedStyle = {
    transform: [{ translateX }],
    opacity,
  };

  const triggerDelete = () => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -W, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => onDeleted());
  };

  return { animatedStyle, triggerDelete };
}
