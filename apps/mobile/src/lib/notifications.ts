import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { InventoryRow } from '../stores/inventory.store';
import type { TreatmentRow } from '../stores/treatment.store';
import { computeScheduledDoses, formatDoseTime } from '../utils/treatment';

// Configure how notifications behave when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const THRESHOLDS_DAYS = [30, 15, 7, 0] as const;

// Maximum treatment notifications to schedule (iOS limit is 64 total; leave room for expiry)
const MAX_TREATMENT_NOTIFS = 40;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cancelByPrefix(prefix: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all.filter(notif => notif.identifier.startsWith(prefix))) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

// ─── Push token registration ──────────────────────────────────────────────────

/**
 * Requests notification permission, gets the Expo push token,
 * and upserts it in the device_tokens table.
 * Safe to call multiple times; no-op on web.
 */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;

  // Android requires an explicit channel before posting notifications
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiry-alerts', {
      name: 'Alertas de vencimento',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Physical device check — simulators don't receive push tokens
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    token = result.data;
  } catch {
    // getExpoPushTokenAsync can fail in dev without a project ID — ignore
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  await supabase.from('device_tokens').upsert(
    { user_id: userId, token, platform: Platform.OS },
    { onConflict: 'token' },
  );
}

// ─── Expiry notifications ─────────────────────────────────────────────────────

/**
 * Cancels all previously scheduled expiry notifications, then re-schedules
 * new ones for 30/15/7/0 days before each item's expiry date.
 * Uses identifier prefix 'expiry-' so treatment notifications are unaffected.
 * Safe to call on every inventory refresh.
 */
export async function scheduleExpiryNotifications(items: InventoryRow[]): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelByPrefix('expiry-');

  const now = Date.now();

  for (const item of items) {
    const expiryMs = new Date(item.expiry_date).getTime();
    const name = item.product_name ?? item.custom_name ?? 'Medicamento';

    for (const days of THRESHOLDS_DAYS) {
      const triggerMs = expiryMs - days * 24 * 60 * 60 * 1000;
      if (triggerMs <= now) continue; // already past

      const title = days === 0
        ? `${name} vence hoje!`
        : `${name} vence em ${days} dia${days > 1 ? 's' : ''}`;

      await Notifications.scheduleNotificationAsync({
        identifier: `expiry-${item.id}-${days}`,
        content: {
          title,
          body: 'Verifique seu estoque e renove se necessário.',
          data: { itemId: item.id },
          ...(Platform.OS === 'android' ? { channelId: 'expiry-alerts' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          channelId: 'expiry-alerts',
        },
      });
    }
  }
}

// ─── Treatment dose notifications ────────────────────────────────────────────

/**
 * Cancels all previously scheduled treatment notifications, then re-schedules
 * upcoming dose reminders for the next 7 days.
 * Uses identifier prefix 'treatment-' so expiry notifications are unaffected.
 * No-op on web.
 */
export async function scheduleTreatmentNotifications(treatments: TreatmentRow[]): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelByPrefix('treatment-');

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let count = 0;

  const activeTreatments = treatments.filter(t => t.status === 'active');

  for (const treatment of activeTreatments) {
    if (count >= MAX_TREATMENT_NOTIFS) break;

    const upcomingDoses = computeScheduledDoses(treatment, now, sevenDaysLater);

    for (const doseTime of upcomingDoses) {
      if (count >= MAX_TREATMENT_NOTIFS) break;
      if (doseTime <= now) continue;

      const timeLabel = formatDoseTime(doseTime);
      const title = `Hora do remédio: ${treatment.medication_name}`;
      const body = `${treatment.dose_quantity} ${treatment.dose_unit} — ${treatment.person_name} às ${timeLabel}`;
      const identifier = `treatment-${treatment.id}-${doseTime.toISOString()}`;

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          data: { treatmentId: treatment.id, scheduledAt: doseTime.toISOString() },
          ...(Platform.OS === 'android' ? { channelId: 'expiry-alerts' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: doseTime,
          channelId: 'expiry-alerts',
        },
      });

      count++;
    }
  }
}
