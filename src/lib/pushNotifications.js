import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { appClient } from '@/api/backendClient';
import { toast } from '@/components/ui/use-toast';
import { queueNotificationRoute } from '@/lib/notificationNavigation';

const ALERT_CHANNEL_ID = 'offside_alerts';

let listenersReady = false;
let registeredUserId = null;
let currentToken = null;

const isNativePushAvailable = () => (
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
);

const navigateFromNotification = (data = {}) => {
  queueNotificationRoute(data);
};

const ensureNotificationChannel = async () => {
  try {
    await PushNotifications.createChannel({
      id: ALERT_CHANNEL_ID,
      name: 'Offside Alerts',
      description: 'Game updates, stat reminders, and MVP results.',
      importance: 4,
      visibility: 1,
      lights: true,
      lightColor: '#22c55e',
      vibration: true,
    });
  } catch (error) {
    console.warn('Could not create push notification channel:', error);
  }
};

const ensureListeners = async () => {
  if (listenersReady) return;

  await PushNotifications.addListener('registration', async (token) => {
    currentToken = token.value;
    try {
      await appClient.push.registerToken({
        token: token.value,
        platform: Capacitor.getPlatform(),
      });
    } catch (error) {
      console.warn('Could not save push token:', error);
    }
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.warn('Push notification registration failed:', error);
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    if (!notification.title && !notification.body) return;
    toast({
      title: notification.title || 'Offside alert',
      description: notification.body || '',
    });
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    navigateFromNotification(action.notification?.data || {});
  });

  listenersReady = true;
};

export const registerPushNotifications = async (user) => {
  if (!user?.id || !isNativePushAvailable()) return false;
  if (registeredUserId === user.id && currentToken) return true;

  try {
    await ensureNotificationChannel();
    await ensureListeners();

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== 'granted') {
      console.info('Push notifications permission not granted.');
      return false;
    }

    registeredUserId = user.id;
    await PushNotifications.register();
    return true;
  } catch (error) {
    console.warn('Could not register push notifications:', error);
    return false;
  }
};

export const unregisterPushNotifications = async () => {
  if (!isNativePushAvailable()) return;

  try {
    if (currentToken) {
      await appClient.push.deactivateToken(currentToken);
    }
  } catch (error) {
    console.warn('Could not deactivate push token:', error);
  }

  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.warn('Could not unregister native push token:', error);
  }

  currentToken = null;
  registeredUserId = null;
};

export { ALERT_CHANNEL_ID };
