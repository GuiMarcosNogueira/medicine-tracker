import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  destructive  = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const backdropOpacity = useSharedValue(0);
  const cardScale       = useSharedValue(0.85);
  const cardOpacity     = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value       = withSpring(1, { damping: 18, stiffness: 260 });
      cardOpacity.value     = withTiming(1, { duration: 150 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      cardScale.value       = withTiming(0.88, { duration: 160 });
      cardOpacity.value     = withTiming(0, { duration: 160 });
    }
  }, [visible, backdropOpacity, cardScale, cardOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle     = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  if (!visible) return null;

  const confirmColor = destructive ? '#F0735A' : '#1A9E96';

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.title}>{title}</Text>
          {Boolean(message) && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  title:      { fontSize: 18, fontWeight: '700', color: '#1A1D1A', marginBottom: 8, letterSpacing: -0.3 },
  message:    { fontSize: 14, color: '#5A625A', lineHeight: 21, marginBottom: 24 },
  actions:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:  { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D1D9CC', backgroundColor: '#F6F8F5' },
  cancelText: { color: '#5A625A', fontWeight: '600', fontSize: 15 },
  confirmBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  confirmText:{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
