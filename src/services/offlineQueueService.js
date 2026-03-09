import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'newsap.offline.queue';

const readQueue = async () => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const writeQueue = async (items) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

export const offlineQueueService = {
  async enqueue(type, payload) {
    const queue = await readQueue();
    queue.push({
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: Date.now(),
      retries: 0,
    });
    await writeQueue(queue);
  },

  async size() {
    const queue = await readQueue();
    return queue.length;
  },

  async flush(handlers = {}) {
    const queue = await readQueue();
    const remaining = [];

    for (const item of queue) {
      const handler = handlers[item.type];
      if (!handler) {
        remaining.push(item);
        continue;
      }

      try {
        await handler(item.payload);
      } catch (error) {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }

    await writeQueue(remaining);
    return {
      processed: queue.length - remaining.length,
      remaining: remaining.length,
    };
  },
};
