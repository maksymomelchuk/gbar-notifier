import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import cron from 'node-cron';
import GBarScraper from './scraper';
import TelegramBot from './telegram';
import BookingStore from './store';
import { loginAndGetCookies } from './auth';
import { AppConfig, BookingsByDate } from './types';

const rawConfig = {
  cookieString: process.env.GBAR_COOKIE_STRING || '',
  baseUrl: process.env.GBAR_BASE_URL || 'https://pro.gbar.com.ua',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  testTelegramChatId: process.env.TEST_TELEGRAM_CHAT_ID || undefined,
  pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES || '') || 5,
  daysAhead: parseInt(process.env.DAYS_AHEAD || '') || 7,
  gbarLogin: process.env.GBAR_LOGIN,
  gbarPassword: process.env.GBAR_PASSWORD,
};

function validateConfig(): AppConfig {
  const missing: string[] = [];

  const hasCookie = !!rawConfig.cookieString;
  const hasCredentials = !!rawConfig.gbarLogin && !!rawConfig.gbarPassword;

  if (!hasCookie && !hasCredentials) {
    missing.push('GBAR_COOKIE_STRING (or GBAR_LOGIN + GBAR_PASSWORD)');
  }
  if (!rawConfig.telegramToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!rawConfig.telegramChatId) missing.push('TELEGRAM_CHAT_ID');

  if (missing.length) {
    console.error(`Missing required env variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in the values');
    process.exit(1);
  }

  return rawConfig as AppConfig;
}

const config = validateConfig();

const scraper = new GBarScraper(config);
const bot = new TelegramBot(config.telegramToken, config.telegramChatId);
const store = new BookingStore();

let isFirstRun = true;
let sessionExpiredNotified = false;
let consecutiveErrors = 0;
let isRefreshing = false;

async function refreshCookies(): Promise<boolean> {
  if (!config.gbarLogin || !config.gbarPassword) {
    console.log('No GBAR_LOGIN/GBAR_PASSWORD configured — cannot auto-refresh');
    return false;
  }

  if (isRefreshing) {
    console.log('Cookie refresh already in progress, waiting...');
    while (isRefreshing) await new Promise(r => setTimeout(r, 500));
    return !!config.cookieString;
  }

  isRefreshing = true;
  try {
    console.log('Attempting automatic cookie refresh...');
    const result = await loginAndGetCookies(
      { login: config.gbarLogin, password: config.gbarPassword },
      config.baseUrl
    );

    if (result.success && result.cookieString) {
      scraper.updateCookies(result.cookieString);
      config.cookieString = result.cookieString;
      console.log('Cookie refresh successful');
      return true;
    } else {
      console.error('Cookie refresh failed:', result.error);
      return false;
    }
  } finally {
    isRefreshing = false;
  }
}

async function poll(isRetry: boolean = false): Promise<void> {
  const timestamp = new Date().toLocaleString('uk-UA');
  console.log(`[${timestamp}] Polling for booking changes...`);

  try {
    const currentBookings = await scraper.fetchUpcomingBookings(config.daysAhead);

    consecutiveErrors = 0;
    sessionExpiredNotified = false;

    if (isFirstRun) {
      store.update(currentBookings);
      isFirstRun = false;

      if (config.testTelegramChatId) {
        console.log('First run - stored initial state. Sending smoke-test summary to TEST_TELEGRAM_CHAT_ID...');
        await bot.notifyDailySummary(currentBookings, config.testTelegramChatId);
        console.log('Smoke-test summary sent!');
      } else {
        console.log('First run - stored initial state. (TEST_TELEGRAM_CHAT_ID not set, skipping smoke-test summary)');
      }
      return;
    }

    const { newBookings, cancelledBookings, changedBookings } = store.diff(currentBookings);

    if (newBookings.length > 0) {
      console.log(`Found ${newBookings.length} new booking(s)`);
      await bot.notifyNewBookings(newBookings);
    }

    if (cancelledBookings.length > 0) {
      console.log(`Found ${cancelledBookings.length} cancelled booking(s)`);
      await bot.notifyCancelledBookings(cancelledBookings);
    }

    if (changedBookings.length > 0) {
      console.log(`Found ${changedBookings.length} changed booking(s)`);
      await bot.notifyChangedBookings(changedBookings);
    }

    if (!newBookings.length && !cancelledBookings.length && !changedBookings.length) {
      console.log('No changes detected');
    }

    store.update(currentBookings);

  } catch (error) {
    consecutiveErrors++;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] Error:`, message);

    if (message.startsWith('SESSION_EXPIRED') && !isRetry) {
      const refreshed = await refreshCookies();
      if (refreshed) {
        sessionExpiredNotified = false;
        consecutiveErrors = 0;
        console.log('Retrying poll with fresh cookies...');
        return poll(true);
      }

      if (!sessionExpiredNotified) {
        await bot.notifySessionExpired();
        sessionExpiredNotified = true;
      }
      return;
    }

    if (consecutiveErrors >= 5 && consecutiveErrors % 5 === 0) {
      try {
        await bot.sendMessage(
          `⚠️ <b>Помилка скрапера</b>\n\n${consecutiveErrors} помилок поспіль.\nОстання: ${message}`
        );
      } catch {
        // ignore telegram errors here
      }
    }
  }
}

function withoutToday(bookings: BookingsByDate): BookingsByDate {
  const today = new Date().toISOString().split('T')[0];
  const { [today]: _omit, ...rest } = bookings;
  return rest;
}

async function eveningSummary(): Promise<void> {
  console.log('Sending evening summary...');
  try {
    const currentBookings = await scraper.fetchUpcomingBookings(config.daysAhead);
    await bot.notifyDailySummary(withoutToday(currentBookings));
    store.update(currentBookings);
    console.log('Evening summary sent!');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('SESSION_EXPIRED')) {
      const refreshed = await refreshCookies();
      if (refreshed) {
        console.log('Retrying evening summary with fresh cookies...');
        const currentBookings = await scraper.fetchUpcomingBookings(config.daysAhead);
        await bot.notifyDailySummary(withoutToday(currentBookings));
        store.update(currentBookings);
        console.log('Evening summary sent!');
        return;
      }
    }
    console.error('Error sending evening summary:', message);
  }
}

async function start(): Promise<void> {
  console.log('=== GBar Booking Notifier ===');
  console.log(`Polling every ${config.pollIntervalMinutes} minutes`);
  console.log(`Checking ${config.daysAhead} days ahead`);
  console.log(`Dashboard: ${config.baseUrl}`);
  console.log(`Auto-login: ${config.gbarLogin ? 'enabled' : 'disabled'}`);
  console.log('');

  console.log('Testing Telegram bot...');
  const telegramTest = await bot.testConnection();
  if (telegramTest.success) {
    console.log(`Telegram bot OK: @${telegramTest.username}`);
  } else {
    console.error('Telegram bot FAILED:', telegramTest.error);
    process.exit(1);
  }

  // If no cookie string, do initial login
  if (!config.cookieString && config.gbarLogin && config.gbarPassword) {
    console.log('No cookie string provided, logging in with credentials...');
    const loginOk = await refreshCookies();
    if (!loginOk) {
      console.error('Initial login failed. Cannot proceed.');
      process.exit(1);
    }
  }

  console.log('Testing GBar connection...');
  const gbarTest = await scraper.testConnection();
  if (gbarTest.success) {
    console.log(`GBar connection OK: ${gbarTest.message}`);
  } else {
    console.error('GBar connection FAILED:', gbarTest.error);
    console.error('Check your GBAR_COOKIE_STRING or GBAR_LOGIN/GBAR_PASSWORD in .env');
    process.exit(1);
  }

  console.log('');
  console.log('Starting initial poll...');

  await poll();

  const cronExpr = `*/${config.pollIntervalMinutes} * * * *`;
  cron.schedule(cronExpr, () => poll());
  console.log(`Scheduled polling: ${cronExpr}`);

  cron.schedule('0 20 * * *', eveningSummary, {
    timezone: 'Europe/Kyiv'
  });
  console.log('Scheduled evening summary: 8:00 PM Kyiv time');

  console.log('\nNotifier is running! Press Ctrl+C to stop.\n');
}

start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
