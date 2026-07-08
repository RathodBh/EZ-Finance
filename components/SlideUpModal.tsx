import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  BackHandler,
} from 'react-native';
import { Portal } from 'react-native-paper';

interface SlideUpModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  backgroundColor: string;
  indicatorColor: string;
  maxHeight?: any;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SlideUpModal({
  visible,
  onClose,
  children,
  backgroundColor,
  indicatorColor,
  maxHeight = '92%',
}: SlideUpModalProps) {
  const [render, setRender] = useState(visible);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRender(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setRender(false);
      });
    }
  }, [visible]);

  // Back handler for Android
  useEffect(() => {
    if (!visible) return;
    const backAction = () => {
      onClose();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, onClose]);

  if (!render) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
            <View style={styles.backdropPressable} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Sheet Container */}
        <View style={styles.sheetWrapper} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY }],
                maxHeight: maxHeight,
                backgroundColor: backgroundColor,
              },
            ]}
          >
            {/* Grab Handle */}
            <View style={styles.dragIndicatorContainer}>
              <View style={[styles.dragIndicator, { backgroundColor: indicatorColor }]} />
            </View>
            {children}
          </Animated.View>
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    zIndex: 999,
  },
  backdropPressable: {
    flex: 1,
  },
  sheetWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  dragIndicatorContainer: {
    width: '100%',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
});
