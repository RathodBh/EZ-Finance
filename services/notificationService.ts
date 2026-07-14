import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '../store/appStore';

// Set default notification handler for native platforms
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
    });
  } catch (err) {
    console.warn('Failed to set notification handler:', err);
  }
}

export const NotificationService = {
  /**
   * Request notification permission.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const status = await window.Notification.requestPermission();
        return status === 'granted';
      }
      return true;
    }
    
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      return finalStatus === 'granted';
    } catch (e) {
      console.warn('Error requesting notification permissions:', e);
      return false;
    }
  },

  /**
   * Schedule a daily reminder notification to record transactions (at 8:00 PM local time).
   */
  async scheduleDailyReminder(): Promise<string | null> {
    if (Platform.OS === 'web') {
      console.log('Notification reminder scheduled on Web (simulation).');
      return 'web_daily_reminder';
    }

    try {
      // Cancel previous reminders first to avoid duplicate schedules
      await this.cancelAllReminders();

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Permissions not granted to schedule daily reminders.');
        return null;
      }

      // Schedule recurring daily notification
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'EZ-Finance Reminder 📝',
          body: "Don't forget to log your transactions today to keep your finances in check!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
        },
      });
      console.log('Daily reminder scheduled successfully with ID:', id);
      return id;
    } catch (e) {
      console.error('Failed to schedule daily reminder:', e);
      return null;
    }
  },

  /**
   * Send a test notification immediately (after a 2-second delay) to verify notifications work.
   */
  async sendTestNotification(): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') {
          new window.Notification('EZ-Finance Test Reminder 📝', {
            body: 'This is a test notification from EZ-Finance!',
          });
        } else {
          const status = await window.Notification.requestPermission();
          if (status === 'granted') {
            new window.Notification('EZ-Finance Test Reminder 📝', {
              body: 'This is a test notification from EZ-Finance!',
            });
          } else {
            useAppStore.getState().showToast('Test Notification: EZ-Finance Reminder works! 📝', 'success');
          }
        }
      } else {
        useAppStore.getState().showToast('Test Notification: EZ-Finance Reminder works! 📝', 'success');
      }
      return 'web_test_notification';
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        useAppStore.getState().showToast('Please grant notification permissions in settings to receive reminders.', 'error');
        return null;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'EZ-Finance Test Reminder 📝',
          body: 'This is a test notification from EZ-Finance!',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });
      console.log('Test notification scheduled successfully with ID:', id);
      return id;
    } catch (e) {
      console.error('Failed to send test notification:', e);
      return null;
    }
  },

  /**
   * Cancel all scheduled notifications.
   */
  async cancelAllReminders(): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All scheduled notification reminders cancelled.');
    } catch (e) {
      console.error('Error cancelling notification reminders:', e);
    }
  }
};
