import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from './ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  show: (type: ToastType, title: string, message?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const hide = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);

  const show = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [
      ...prev.slice(-2),
      { id, type, title, ...(message !== undefined ? { message } : {}) },
    ]);
    const timer = setTimeout(() => { hide(id); }, 3500);
    timers.current.set(id, timer);
  }, [hide]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hide} />
    </ToastContext.Provider>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 12 }]} pointerEvents="box-none">
      {toasts.map(toast => (
        <ToastBubble key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// ─── Single toast ─────────────────────────────────────────────────────────────

function toastConfig(t: Theme): Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> {
  return {
    success: { bg: t.primaryLight, border: '#22C9BF', icon: '✓', iconColor: t.primary },
    error:   { bg: t.coralBg,      border: t.coral,   icon: '✕', iconColor: t.coral },
    warning: { bg: t.amberBg,      border: t.amber,   icon: '!', iconColor: t.amber },
    info:    { bg: t.surfaceAlt,   border: t.textMuted, icon: 'i', iconColor: t.textSub },
  };
}

function ToastBubble({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const theme = useTheme();
  const cfg = toastConfig(theme)[toast.type];

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18).stiffness(200)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.springify()}
      style={[styles.bubble, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: cfg.border + '20' }]}>
        <Text style={[styles.iconText, { color: cfg.iconColor }]}>{cfg.icon}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.toastTitle, { color: theme.text }]} numberOfLines={1}>{toast.title}</Text>
        {Boolean(toast.message) && (
          <Text style={[styles.toastMsg, { color: theme.textSub }]} numberOfLines={2}>{toast.message}</Text>
        )}
      </View>
      <Pressable onPress={() => { onDismiss(toast.id); }} hitSlop={8} style={styles.closeBtn}>
        <Text style={[styles.closeText, { color: theme.textMuted }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    pointerEvents: 'box-none',
  } as ReturnType<typeof StyleSheet.create>[string],
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText:  { fontSize: 13, fontWeight: '800' },
  textWrap:  { flex: 1 },
  toastTitle:{ fontSize: 14, fontWeight: '700' },
  toastMsg:  { fontSize: 12, marginTop: 2 },
  closeBtn:  { paddingLeft: 4, flexShrink: 0 },
  closeText: { fontSize: 18, lineHeight: 20 },
});
