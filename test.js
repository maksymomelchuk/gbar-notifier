/**
 * Quick test script to verify configuration and connectivity
 * Run: node test.js
 */
require('dotenv').config();
const GBarScraper = require('./scraper');
const TelegramBot = require('./telegram');

async function test() {
  console.log('=== GBar Notifier - Connection Test ===\n');

  // 1. Test Telegram
  console.log('1. Testing Telegram Bot...');
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log('   SKIP: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
  } else {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID);
    const result = await bot.testConnection();
    if (result.success) {
      console.log(`   OK: Bot @${result.username} (${result.botName})`);

      // Send test message
      try {
        await bot.sendMessage('🔔 <b>Тестове повідомлення</b>\n\nGBar Notifier працює!');
        console.log('   OK: Test message sent to Telegram');
      } catch (e) {
        console.log(`   WARN: Bot works but cant send message: ${e.message}`);
        console.log('   Make sure you sent a message to the bot first, and TELEGRAM_CHAT_ID is correct');
      }
    } else {
      console.log(`   FAIL: ${JSON.stringify(result.error)}`);
    }
  }

  // 2. Test GBar
  console.log('\n2. Testing GBar Dashboard...');
  if (!process.env.GBAR_COOKIE_STRING) {
    console.log('   SKIP: GBAR_COOKIE_STRING not set');
  } else {
    const scraper = new GBarScraper({
      cookieString: process.env.GBAR_COOKIE_STRING,
      baseUrl: process.env.GBAR_BASE_URL || 'https://pro.gbar.com.ua',
    });

    const result = await scraper.testConnection();
    if (result.success) {
      console.log(`   OK: ${result.message}`);
    } else {
      console.log(`   FAIL: ${result.error}`);
    }

    // Try to fetch today's bookings
    console.log('\n3. Fetching today\'s bookings...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const bookings = await scraper.fetchBookingsForDate(today);
      console.log(`   OK: Found ${bookings.length} booking(s) for today`);
      bookings.forEach(b => {
        console.log(`   - ${b.time} | ${b.client} (ID: ${b.id})`);
      });
    } catch (e) {
      console.log(`   FAIL: ${e.message}`);
    }

    // Fetch next 3 days
    console.log('\n4. Fetching next 3 days...');
    try {
      const allBookings = await scraper.fetchUpcomingBookings(3);
      for (const [date, bookings] of Object.entries(allBookings)) {
        if (bookings && bookings.length > 0) {
          console.log(`   ${date}: ${bookings.length} booking(s)`);
          bookings.forEach(b => {
            console.log(`     - ${b.time} | ${b.client} (ID: ${b.id})`);
          });
        } else {
          console.log(`   ${date}: no bookings`);
        }
      }
    } catch (e) {
      console.log(`   FAIL: ${e.message}`);
    }
  }

  console.log('\n=== Test Complete ===');
}

test().catch(console.error);
