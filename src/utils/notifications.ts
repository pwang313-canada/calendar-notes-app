// src/utils/notifications.ts
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

export type ReminderType = 'notification' | 'alarm' | 'both';

export const setupNotificationHandler = () => {
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
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(n => n.content.data?.date === dateString);
  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
};
