/**
 * autoImportService.js
 *
 * Апп нээлттэй үед автоматаар RSS feed шалгаж,
 * шинэ мэдээ импортлох сервис.
 *
 * Foreground polling — апп нээлттэй үед setInterval (15 мин)
 * AppState listener  — апп foreground-руу буцах үед шалгах
 */

import { AppState } from 'react-native';
import { newsApiService } from './newsApiService';
import { notificationService } from './notificationService';

// ─── Тохиргоо ────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 минут

let _pollTimer = null;
let _appStateSubscription = null;
let _isRunning = false;
let _lastCheckTime = 0;

// ─── RSS импорт хийх ────────────────────────────────────────────────────
async function doAutoImport() {
  if (_isRunning) {
    console.log('[AUTO-IMPORT] Already running, skipping...');
    return null;
  }

  _isRunning = true;
  _lastCheckTime = Date.now();
  console.log('[AUTO-IMPORT] Checking for new articles...');

  try {
    const result = await newsApiService.importMongolianFeeds();
    console.log('[AUTO-IMPORT] Done:', result.imported, 'imported,', result.skipped, 'skipped');

    // Шинэ мэдээ байвал notification
    if (result.imported > 0) {
      try {
        await notificationService.notifyNewArticles(
          result.imported,
          result.firstImportedTitle || null
        );
      } catch (notifErr) {
        console.warn('[AUTO-IMPORT] notification error:', notifErr);
      }
    }

    return result;
  } catch (err) {
    console.error('[AUTO-IMPORT] error:', err);
    return null;
  } finally {
    _isRunning = false;
  }
}

// ─── Foreground polling эхлүүлэх ─────────────────────────────────────────
function startForegroundPolling() {
  if (_pollTimer) return;

  console.log('[AUTO-IMPORT] Starting foreground polling (every 15 min)');

  // Апп нээгдэхэд нэг удаа шалгах
  doAutoImport();

  // 15 минут тутам шалгах
  _pollTimer = setInterval(() => {
    if (AppState.currentState === 'active') {
      doAutoImport();
    }
  }, POLL_INTERVAL_MS);
}

// ─── Foreground polling зогсоох ──────────────────────────────────────────
function stopForegroundPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
    console.log('[AUTO-IMPORT] Foreground polling stopped');
  }
}

// ─── AppState listener (апп foreground-руу буцахад шалгах) ──────────────
function startAppStateListener() {
  if (_appStateSubscription) return;

  _appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      // Хамгийн багадаа 5 мин өнгөрсөн бол шалгах
      const elapsed = Date.now() - _lastCheckTime;
      if (elapsed > 5 * 60 * 1000) {
        console.log('[AUTO-IMPORT] App returned to foreground, checking...');
        doAutoImport();
      }
    }
  });
}

function stopAppStateListener() {
  if (_appStateSubscription) {
    _appStateSubscription.remove();
    _appStateSubscription = null;
  }
}

// ─── Бүгдийг нэг дуудлагаар эхлүүлэх ────────────────────────────────────
function startAutoImport() {
  console.log('[AUTO-IMPORT] Initializing auto-import...');
  startForegroundPolling();
  startAppStateListener();
}

// ─── Бүгдийг зогсоох ────────────────────────────────────────────────────
function stopAutoImport() {
  stopForegroundPolling();
  stopAppStateListener();
}

// ─── Гараар шалгах ──────────────────────────────────────────────────────
async function checkNow() {
  return doAutoImport();
}

// ─── Export ──────────────────────────────────────────────────────────────
export const autoImportService = {
  startAutoImport,
  stopAutoImport,
  checkNow,
};
