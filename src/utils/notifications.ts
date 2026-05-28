// src/utils/notifications.ts
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
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

  if (Platform.OS === 'android') {
    const isExpoGo = Constants.appOwnership === 'expo';
    Alert.alert(
      '⚠️ Important for reliable reminders',
      'Android may delay notifications to save battery.\n\n' +
      'To ensure on‑time reminders:\n' +
      '• Go to Settings → Apps → Calendar Notes → Battery\n' +
      '• Select "Unrestricted" or "Don\'t optimize"\n\n' +
      (isExpoGo ? '(Expo Go cannot open battery settings directly)' : 'Tap "Open Settings" below to change it now.'),
      isExpoGo
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openBatterySettings() }
          ]
    );
  }

  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    console.log('Skipping push token registration in Expo Go');
    return true;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    console.log('Push token:', token.data);
  } catch (e) {
    console.warn('Push token failed', e);
  }

  return true;
};

const openBatterySettings = async () => {
  try {
    await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch (error) {
    console.warn('Failed to open battery settings', error);
    Alert.alert('Manual Action Required', 'Please go to Settings → Apps → Calendar Notes → Battery and select "Unrestricted".');
  }
};

const MIN_FUTURE_SECONDS = 15;

const isValidTriggerTime = (timestamp: number): boolean => {
  const now = Date.now();
  const minTime = now + MIN_FUTURE_SECONDS * 1000;
  if (timestamp < minTime) {
    const diff = Math.round((timestamp - now) / 1000);
    console.warn(`⏰ Time too close: ${diff}s (need at least ${MIN_FUTURE_SECONDS}s)`);
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
  reminderType: ReminderType = 'both'
) => {
  if (!isValidTriggerTime(timestamp)) {
    return null;
  }

  await cancelNotification(dateString);

  const soundSetting = (reminderType === 'alarm' || reminderType === 'both')
    ? 'default'
    : false;

  const triggerDate = new Date(timestamp);
  console.log(`📅 Scheduling ${reminderType} for ${triggerDate.toString()} with message: "${customMessage}"`);

  const channelId = reminderType === 'notification' ? 'silent_reminders' : 'alarm_reminders';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: reminderType === 'notification' ? 'Silent Reminders' : 'Alarm Reminders',
      importance: reminderType === 'notification'
        ? Notifications.AndroidImportance.DEFAULT
        : Notifications.AndroidImportance.MAX,
      sound: soundSetting === 'default' ? 'default' : null,
      vibrationPattern: [0, 500, 500, 500],
      enableVibrate: true,
      bypassDnd: reminderType !== 'notification',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  // Use type assertion to bypass TypeScript error for channelId (works at runtime)
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} Calendar Note`,
      body: customMessage || 'Reminder for your note',
      data: { date: dateString, reminderType, message: customMessage },
      sound: soundSetting,
      channelId, // Runtime works; TypeScript error suppressed via 'as any' below
    } as any, // <-- Type assertion to avoid TS error
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  console.log(`✅ Notification scheduled, ID: ${identifier}, channel: ${channelId}`);
  Alert.alert('Reminder Set', `"${customMessage || 'Reminder'}" at ${triggerDate.toLocaleString()}`);
  return identifier;
};

export const cancelNotification = async (dateString: string) => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(n => n.content.data?.date === dateString);
  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
    console.log(`Cancelled ${n.identifier} for ${dateString}`);
  }
};

export const listScheduledNotifications = async () => {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`\n=== Pending (${all.length}) ===`);
  all.forEach(n => {
    console.log(`- ${n.identifier}: ${n.content.title} - "${n.content.body}" @ ${JSON.stringify(n.trigger)}`);
  });
  return all;
};

export const sendTestNotification = async (reminderType: ReminderType = 'both') => {
  const testTime = Date.now() + 20_000;
  const testDate = new Date(testTime);
  const dateStr = testDate.toISOString().split('T')[0];
  await scheduleNotification(
    dateStr,
    testTime,
    'This is a custom reminder message! 📝',
    '🔔',
    reminderType
  );
};