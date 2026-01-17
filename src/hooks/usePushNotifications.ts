import { useState, useEffect, useCallback } from 'react';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('Notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(async (options: PushNotificationOptions): Promise<boolean> => {
    if (!isSupported) {
      console.log('Notifications not supported');
      return false;
    }

    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }

    try {
      // Check if service worker is available for persistent notifications
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192.png',
          badge: options.badge || '/icons/icon-192.png',
          tag: options.tag || 'default',
          requireInteraction: options.requireInteraction ?? true,
          // vibrate is supported but not in TS types
          ...(options.vibrate && { vibrate: options.vibrate }),
        } as NotificationOptions);
      } else {
        // Fallback to regular notification
        new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192.png',
          tag: options.tag || 'default',
          requireInteraction: options.requireInteraction ?? true,
        });
      }
      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [isSupported, permission]);

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
  };
}
