import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENTS_KEY = 'newsap.analytics.events';
const FLUSH_INTERVAL = 5000; // 5 seconds

// In-memory buffer — бүгдийг санах ойд хадгалаад batch-ээр бичнэ
let eventBuffer = [];
let flushTimer = null;

const flushBuffer = async () => {
  if (eventBuffer.length === 0) return;

  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [...eventBuffer, ...list].slice(0, 500);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(next));
    eventBuffer = [];
  } catch (err) {
    console.warn('analytics flush error:', err);
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer();
  }, FLUSH_INTERVAL);
};

export const analyticsService = {
  track(eventName, payload = {}) {
    const event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventName,
      payload,
      createdAt: Date.now(),
    };

    eventBuffer.push(event);
    scheduleFlush();
  },

  async getRecent(limit = 50) {
    // Flush pending events first
    await flushBuffer();
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.slice(0, limit);
  },
};
