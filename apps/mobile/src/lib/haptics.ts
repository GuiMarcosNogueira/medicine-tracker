import * as Haptics from 'expo-haptics';

export const hapticLight   = (): void => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
export const hapticMedium  = (): void => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
export const hapticSuccess = (): void => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
export const hapticError   = (): void => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); };
