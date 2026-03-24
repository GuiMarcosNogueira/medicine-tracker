import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme, type Theme } from './ThemeContext';

// ─── Base skeleton box ────────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const theme = useTheme();
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
        { width: width as number, height, borderRadius, backgroundColor: theme.borderSub },
        animStyle,
        style,
      ]}
    />
  );
}

// ─── Inventory list skeleton (6 rows) ────────────────────────────────────────

export function InventoryListSkeleton() {
  const theme = useTheme();
  const s = useMemo(() => skStyles(theme), [theme]);

  return (
    <View style={s.container}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={s.row}>
          <SkeletonBox width={10} height={10} borderRadius={5} style={s.dot} />
          <View style={s.textBlock}>
            <SkeletonBox width="60%" height={14} borderRadius={6} />
            <SkeletonBox width="40%" height={11} borderRadius={5} style={s.sub} />
          </View>
          <SkeletonBox width={36} height={22} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

export function DashboardSkeleton() {
  const theme = useTheme();
  const s = useMemo(() => skStyles(theme), [theme]);

  return (
    <View style={s.container}>
      {[3, 2].map((count, si) => (
        <View key={si}>
          <View style={s.sectionHeader}>
            <SkeletonBox width={120} height={13} borderRadius={5} />
            <SkeletonBox width={20} height={13} borderRadius={5} />
          </View>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={s.row}>
              <View style={s.textBlock}>
                <SkeletonBox width="55%" height={14} borderRadius={6} />
                <SkeletonBox width="35%" height={11} borderRadius={5} style={s.sub} />
              </View>
              <SkeletonBox width={36} height={22} borderRadius={8} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function skStyles(t: Theme) {
  return StyleSheet.create({
    container:     { paddingTop: 8 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.surfaceAlt },
    row:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.surfaceAlt },
    dot:           { marginRight: 12 },
    textBlock:     { flex: 1 },
    sub:           { marginTop: 6 },
  });
}
