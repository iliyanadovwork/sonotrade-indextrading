import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface UndoToastProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
  bottom?: number;
}

export function UndoToast({ visible, message, onUndo, bottom = 8 }: UndoToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.container, { bottom, opacity, transform: [{ translateY }] }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={onUndo} activeOpacity={0.7}>
        <Text style={styles.undo}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  message: {
    color: '#fff',
    fontSize: 14,
  },
  undo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
