// src/utils/notifications.ts
import { Alert, Platform } from 'react-native';

export type ReminderType = 'notification' | 'alarm' | 'both';

// expo-notifications was removed from Expo Go in SDK 53+: a top-level import
// crashes the whole app there (and cascades into expo-router route errors).
// Load it lazily instead — the app runs in Expo Go with reminders disabled,
// and works fully in a development build. MARKER: expoGoSafeNotifications
let Notifications: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

export const isNotificationsAvailable = () => Notifications !== null;

// NOTE: guards below are deliberately silent. The "needs a dev build"
// message is shown by the UI at the moment the user taps "Set reminder"
// (see App.tsx), not on app launch or during background re-scheduling.

export const setupNotificationHandler = () => {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

export const registerForNotifications = async (): Promise<boolean> => {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please enable notifications to receive reminders.');
    return false;
  }
  return true;
};

const MIN_FUTURE_SECONDS = 15;

const isValidTriggerTime = (timestamp: number): boolean => {
  const now = Date.now();
  const minTime = now + MIN_FUTURE_SECONDS * 1000;
  if (timestamp < minTime) {
    const diff = Math.round((timestamp - now) / 1000);
    console.warn(`Time too close: ${diff}s (need at least ${MIN_FUTURE_SECONDS}s)`);
    Alert.alert('Time Too Close', `Please set reminder at least ${MIN_FUTURE_SECONDS} seconds in the future.`);
    return false;
  }
  return true;
};

export const scheduleNotification = async (
  dateString: string,
  timestamp: number,
  customMessage: string,
  icon: string,
  reminderType: ReminderType = 'both',
) => {
  if (!Notifications) return null;
  if (!isValidTriggerTime(timestamp)) {
    return null;
  }

  await cancelNotification(dateString);

  const soundSetting = reminderType === 'alarm' || reminderType === 'both' ? 'default' : false;

  const triggerDate = new Date(timestamp);

  const channelId = reminderType === 'notification' ? 'silent_reminders' : 'alarm_reminders';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: reminderType === 'notification' ? 'Silent Reminders' : 'Alarm Reminders',
      importance:
        reminderType === 'notification'
          ? Notifications.AndroidImportance.DEFAULT
          : Notifications.AndroidImportance.MAX,
      sound: soundSetting === 'default' ? 'default' : null,
      vibrationPattern: [0, 500, 500, 500],
      enableVibrate: true,
      bypassDnd: reminderType !== 'notification',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} Calendar Note`,
      body: customMessage || 'Reminder for your note',
      data: { date: dateString, reminderType, message: customMessage },
      sound: soundSetting,
      // channelId is Android-only; cast keeps TS happy on all platforms
      channelId,
    } as any,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  Alert.alert('Reminder Set', `"${customMessage || 'Reminder'}" at ${triggerDate.toLocaleString()}`);
  return identifier;
};

export const cancelNotification = async (dateString: string) => {
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(n => n.content.data?.date === dateString);
  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
};
