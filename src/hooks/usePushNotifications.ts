import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
  data?: Record<string, unknown>;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
      fetchVapidKey();
    }
  }, []);

  const fetchVapidKey = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        body: { action: 'get-vapid-key' }
      });
      if (!error && data?.vapidPublicKey) {
        setVapidPublicKey(data.vapidPublicKey);
      }
    } catch (e) {
      console.error('Error fetching VAPID key:', e);
    }
  };

  const checkSubscription = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (e) {
      console.error('Error checking subscription:', e);
    }
  };

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

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !vapidPublicKey) {
      console.log('Push not supported or VAPID key not available');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      // Send subscription to server
      const { error } = await supabase.functions.invoke('manage-push-subscription', {
        body: {
          action: 'subscribe',
          subscription: subscription.toJSON()
        }
      });

      if (error) {
        console.error('Error saving subscription:', error);
        return false;
      }

      setIsSubscribed(true);
      console.log('Push subscription successful');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  }, [isSupported, vapidPublicKey]);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from server
      await supabase.functions.invoke('manage-push-subscription', {
        body: { action: 'unsubscribe' }
      });

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, []);

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
          data: options.data,
        });
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

  // Send notification via service worker (works even in background)
  const sendBackgroundNotification = useCallback(async (options: PushNotificationOptions): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: options.title,
          body: options.body,
          data: options.data
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sending background notification:', error);
      return false;
    }
  }, [isSupported]);

  return {
    permission,
    isSupported,
    isSubscribed,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    showNotification,
    sendBackgroundNotification,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
  };
}
