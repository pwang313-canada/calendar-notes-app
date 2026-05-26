// src/utils/notifications.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

export const registerForNotifications = async () => {
  // Request local notification permissions (required for alarms/reminders)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permissions not granted');
    return;
  }

  // SKIP remote push token registration in Expo Go on Android (SDK 53+)
  // Local notifications (scheduleNotificationAsync) do NOT need a push token
  if (Platform.OS === 'android') {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      console.log('Skipping remote push registration in Expo Go Android');
      return;
    }
  }

  // Only run this if you are in a development build or on iOS
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    console.log('Expo push token:', token.data);
    // Send token to your backend if needed
  } catch (error) {
    console.warn('Failed to get push token:', error);
  }
};

export const scheduleNotification = async (
  dateString: string,
  timestamp: number,
  text: string,
  icon: string
) => {
  // Cancel any existing notification for this date first
  await cancelNotification(dateString);

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} Calendar Note`,
      body: text || 'Reminder for your note',
      data: { date: dateString },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(timestamp),
    },
  });

  // Store the identifier so we can cancel it later
  // You can use AsyncStorage if you need to persist across sessions
  return identifier;
};

export const cancelNotification = async (dateString: string) => {
  // If you stored the notification identifier, cancel by ID:
  // await Notifications.cancelScheduledNotificationAsync(storedId);

  // Alternatively, cancel all scheduled notifications for this date
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(
    (n) => n.content.data?.date === dateString
  );

  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
};