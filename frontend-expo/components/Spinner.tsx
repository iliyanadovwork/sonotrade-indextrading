import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface SpinnerProps {
  size?: number;
  strokeWidth?: number;
  cycleDurationMs?: number;
}

export function Spinner({ size = 24, strokeWidth = 2, cycleDurationMs = 800 }: SpinnerProps) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: cycleDurationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    return () => rotation.stopAnimation();
  }, [cycleDurationMs]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashLen = circumference * 0.75;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate: spin }] }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${circumference - dashLen}`}
        />
      </Svg>
    </Animated.View>
  );
}
