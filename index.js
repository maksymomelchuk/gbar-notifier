require('dotenv').config();
const cron = require('node-cron');
const GBarScraper = require('./scraper');
const TelegramBot = require('./telegram');
const BookingStore = require('./store');

// Configuration
const config = {
  cookieString: process.env.GBAR_COOKIE_STRING,
  baseUrl: process.env.GBAR_BASE_URL || 'https://pro.gbar.com.ua',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES) || 5,
  daysAhead: parseInt(process.env.DAYS_AHEAD) || 7,
};

// Validate config
function validateConfig() {
  const missing = [];
  if (!config.cookieString) missing.push('GBAR_COOKIE_STRING');
  if (!config.telegramToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!config.telegramChatId) missing.push('TELEGRAM_CHAT_ID');

  if (missing.length) {
    console.error(`Missing required env variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in the values');
    process.exit(1);
  }
}

// Initialize
validateConfig();
const scraper = new GBarScraper(config);
const bot = new TelegramBot(config.telegramToken, config.telegramChatId);
const store = new BookingStore();

let isFirstRun = true;
let sessionExpiredNotified = false;
let consecutiveErrors = 0;

/**
 * Main polling function
 */
async function poll() {
  const timestamp = new Date().toLocaleString('uk-UA');
  console.log(`[${timestamp}] Polling for booking changes...`);

  try {
    // Fetch current bookings
    const currentBookings = await scraper.fetchUpcomingBookings(config.daysAhead);

    // Reset error counter on success
    consecutiveErrors = 0;
    sessionExpiredNotified = false;

    if (isFirstRun) {
      // On first run, just store the state and send a summary
      store.update(currentBookings);
      isFirstRun = false;

      console.log('First run - stored initial state. Sending summary...');
      await bot.notifyDailySummary(currentBookings);
      console.log('Summary sent!');
      return;
    }

    // Compare with previous state
    const { newBookings, cancelledBookings, changedBookings } = store.diff(currentBookings);

    // Send notifications
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

    // Update store
    store.update(currentBookings);

  } catch (error) {
    consecutiveErrors++;
    console.error(`[${timestamp}] Error:`, error.message);

    if (error.message.startsWith('SESSION_EXPIRED') && !sessionExpiredNotified) {
      await bot.notifySessionExpired();
      sessionExpiredNotified = true;
    }

    // If too many consecutive errors, send alert
    if (consecutiveErrors >= 5 && consecutiveErrors % 5 === 0) {
      try {
        await bot.sendMessage(
          `⚠️ <b>Помилка скрапера</b>\n\n${consecutiveErrors} помилок поспіль.\nОстання: ${error.message}`
        );
      } catch (_) { /* ignore telegram errors here */ }
    }
  }
}

/**
 * Send morning summary at 7:00 AM
 */
async function morningSummary() {
  console.log('Sending morning summary...');
  try {
    const currentBookings = await scraper.fetchUpcomingBookings(config.daysAhead);
    await bot.notifyDailySummary(currentBookings);
    store.update(currentBookings);
    console.log('Morning summary sent!');
  } catch (error) {
    console.error('Error sending morning summary:', error.message);
  }
}

// Start
async function start() {
  console.log('=== GBar Booking Notifier ===');
  console.log(`Polling every ${config.pollIntervalMinutes} minutes`);
  console.log(`Checking ${config.daysAhead} days ahead`);
  console.log(`Dashboard: ${config.baseUrl}`);
  console.log('');

  // Test connections
  console.log('Testing Telegram bot...');
  const telegramTest = await bot.testConnection();
  if (telegramTest.success) {
    console.log(`Telegram bot OK: @${telegramTest.username}`);
  } else {
    console.error('Telegram bot FAILED:', telegramTest.error);
    process.exit(1);
  }

  console.log('Testing GBar connection...');
  const gbarTest = await scraper.testConnection();
  if (gbarTest.success) {
    console.log(`GBar connection OK: ${gbarTest.message}`);
  } else {
    console.error('GBar connection FAILED:', gbarTest.error);
    console.error('Check your GBAR_COOKIE_STRING in .env');
    process.exit(1);
  }

  console.log('');
  console.log('Starting initial poll...');

  // Initial poll
  await poll();

  // Schedule regular polling
  const cronExpr = `*/${config.pollIntervalMinutes} * * * *`;
  cron.schedule(cronExpr, poll);
  console.log(`Scheduled polling: ${cronExpr}`);

  // Schedule morning summary at 7:00 AM Kyiv time
  cron.schedule('0 7 * * *', morningSummary, {
    timezone: 'Europe/Kyiv'
  });
  console.log('Scheduled morning summary: 7:00 AM Kyiv time');

  console.log('\nNotifier is running! Press Ctrl+C to stop.\n');
}

start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
