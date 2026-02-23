import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

// ─── Base skeleton box ────────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 700 }),
        withTiming(0.6, { duration: 700 }),
      ),
      -1,
      true,
    );
    return () => { cancelAnimation(opacity); };
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: '#D1D9CC' },
        animStyle,
        style,
      ]}
    />
  );
}

// ─── Inventory list skeleton (6 rows) ────────────────────────────────────────

export function InventoryListSkeleton() {
  return (
    <View style={skStyles.container}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={skStyles.row}>
          <SkeletonBox width={10} height={10} borderRadius={5} style={skStyles.dot} />
          <View style={skStyles.textBlock}>
            <SkeletonBox width="60%" height={14} borderRadius={6} />
            <SkeletonBox width="40%" height={11} borderRadius={5} style={skStyles.sub} />
          </View>
          <SkeletonBox width={36} height={22} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <View style={skStyles.container}>
      {[3, 2].map((count, si) => (
        <View key={si}>
          <View style={skStyles.sectionHeader}>
            <SkeletonBox width={120} height={13} borderRadius={5} />
            <SkeletonBox width={20} height={13} borderRadius={5} />
          </View>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={skStyles.row}>
              <View style={skStyles.textBlock}>
                <SkeletonBox width="55%" height={14} borderRadius={6} />
                <SkeletonBox width="35%" height={11} borderRadius={5} style={skStyles.sub} />
              </View>
              <SkeletonBox width={36} height={22} borderRadius={8} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  container:     { paddingTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#E8ECE5' },
  row:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8ECE5' },
  dot:           { marginRight: 12 },
  textBlock:     { flex: 1 },
  sub:           { marginTop: 6 },
});
