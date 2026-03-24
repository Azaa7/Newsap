/**
 * Notification Service — expo-notifications (Development Build)
 *
 * Push token бүртгэх, local notification илгээх, daily reminder,
 * listener тохируулах зэрэг бүрэн функц.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { firestoreDb as db } from '../config/firebase';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';

// ─── Foreground дээр notification харагдах тохиргоо ───────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// ─── Notification channel (Android 8+) ───────────────────────────────────
async function setupChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E88E5',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('news', {
      name: 'Мэдээний мэдэгдэл',
      description: 'Шинэ мэдээ импортлогдсон үед',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('reminder', {
      name: 'Өдөр тутмын сануулга',
      description: 'Мэдээ уншихыг сануулах',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

// Апп ачаалах үед channel үүсгэх
setupChannels();

// ─── Firestore-д notification хадгалах ───────────────────────────────────
async function saveNotification({ userId, title, body, data = {} }) {
  try {
    const notifRef = collection(db, 'notifications');
    await addDoc(notifRef, {
      userId,
      title,
      body,
      data,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('saveNotification error:', err);
  }
}

// ─── Push token авах & Firestore-д хадгалах ──────────────────────────────
async function registerForPushNotifications(userId) {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications need a physical device');
      return null;
    }

    // Зөвшөөрөл авах
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Мэдэгдэл', 'Push notification зөвшөөрөл олгогдоогүй байна.');
      return null;
    }

    // Push token авах
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('EAS projectId not found');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenResponse.data;
    console.log('Push token:', pushToken);

    // Firestore-д хадгалах
    if (userId) {
      const tokenDocRef = doc(db, 'pushTokens', userId);
      await setDoc(
        tokenDocRef,
        {
          token: pushToken,
          platform: Platform.OS,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return pushToken;
  } catch (err) {
    console.warn('registerForPushNotifications error:', err);
    return null;
  }
}

// ─── Local notification илгээх ───────────────────────────────────────────
async function sendLocalNotification({ title, body, data = {}, channelId = 'default' }) {
  console.log('[NOTIF] sendLocalNotification called:', title, body);

  try {
    // Зөвшөөрөл шалгах
    const { status } = await Notifications.getPermissionsAsync();
    console.log('[NOTIF] current permission:', status);

    if (status !== 'granted') {
      console.log('[NOTIF] requesting permission...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      console.log('[NOTIF] new permission:', newStatus);
      if (newStatus !== 'granted') {
        console.warn('[NOTIF] permission denied');
        return null;
      }
    }

    // Notification илгээх
    const content = {
      title,
      body,
      data,
      sound: 'default',
    };

    // Android 8+ requires channelId in content
    if (Platform.OS === 'android' && channelId) {
      content.channelId = channelId;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });

    console.log('[NOTIF] notification scheduled, id:', id);
    return id;
  } catch (err) {
    console.error('[NOTIF] sendLocalNotification error:', err);
    return null;
  }
}

// ─── Шинэ мэдээ импортлогдсон notification ──────────────────────────────
async function notifyNewArticles(count, firstTitle = null) {
  console.log('[NOTIF] notifyNewArticles called, count:', count);
  if (!count || count <= 0) return;

  const title = 'NEWSAP — Шинэ мэдээ';
  const body =
    count === 1 && firstTitle
      ? firstTitle
      : `${count} шинэ мэдээ нэмэгдлээ. Одоо уншаарай!`;

  const result = await sendLocalNotification({
    title,
    body,
    data: { type: 'new_articles', count },
    channelId: 'news',
  });
  console.log('[NOTIF] notifyNewArticles result:', result);
}

// ─── Өдөр тутмын сануулга (Daily Reminder) ───────────────────────────────
async function scheduleDailyReminder(enabled = true) {
  // Хуучин сануулгуудыг цуцлах
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content?.data?.type === 'daily_reminder') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (!enabled) return;

  // Өдөр бүр өглөөний 9:00 цагт
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'NEWSAP',
        body: 'Өнөөдрийн мэдээг уншсан уу?',
        data: { type: 'daily_reminder' },
        sound: 'default',
      },
      trigger: {
        type: 'daily',
        hour: 9,
        minute: 0,
      },
    });
  } catch (err) {
    console.warn('scheduleDailyReminder trigger error, trying calendar:', err);
    // Fallback: calendar trigger
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NEWSAP',
          body: 'Өнөөдрийн мэдээг уншсан уу?',
          data: { type: 'daily_reminder' },
          sound: 'default',
        },
        trigger: {
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });
    } catch (err2) {
      console.warn('scheduleDailyReminder fallback also failed:', err2);
    }
  }

  console.log('Daily reminder scheduled at 09:00');
}

// ─── Notification listener-ууд ───────────────────────────────────────────
function addNotificationListeners({ onNotificationReceived, onNotificationTapped } = {}) {
  // Foreground дээр ирсэн notification
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification.request.content.title);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Notification дээр дарсан үед
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    console.log('Notification tapped, data:', data);
    if (onNotificationTapped) {
      onNotificationTapped(data);
    }
  });

  // Cleanup function
  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ─── Firestore-оос notification-ууд авах ─────────────────────────────────
async function getNotifications(userId, maxCount = 30) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('getNotifications error:', err);
    return [];
  }
}

// ─── Уншсан гэж тэмдэглэх ──────────────────────────────────────────────
async function markAsRead(notificationId) {
  try {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, { read: true });
  } catch (err) {
    console.warn('markAsRead error:', err);
  }
}

// ─── Уншаагүй тоо ──────────────────────────────────────────────────────
async function getUnreadCount(userId) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    console.warn('getUnreadCount error:', err);
    return 0;
  }
}

// ─── Бүх notification цуцлах ─────────────────────────────────────────────
async function cancelAll() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All scheduled notifications cancelled');
  } catch (err) {
    console.warn('cancelAll error:', err);
  }
}

// ─── Badge тоо тохируулах ────────────────────────────────────────────────
async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (err) {
    console.warn('setBadgeCount error:', err);
  }
}

// ─── Export ──────────────────────────────────────────────────────────────
export const notificationService = {
  registerForPushNotifications,
  sendLocalNotification,
  notifyNewArticles,
  scheduleDailyReminder,
  addNotificationListeners,
  saveNotification,
  getNotifications,
  markAsRead,
  getUnreadCount,
  cancelAll,
  setBadgeCount,
};
