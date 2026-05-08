import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import GBarScraper from "./scraper";
import TelegramBot from "./telegram";
import { loginAndGetCookies } from "./auth";

async function test(): Promise<void> {
  console.log("=== GBar Notifier - Connection Test ===\n");

  // 1. Test Telegram
  console.log("1. Testing Telegram Bot...");
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TEST_TELEGRAM_CHAT_ID) {
    console.log("   SKIP: TELEGRAM_BOT_TOKEN or TEST_TELEGRAM_CHAT_ID not set");
  } else {
    const bot = new TelegramBot(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TEST_TELEGRAM_CHAT_ID
    );
    const result = await bot.testConnection();
    if (result.success) {
      console.log(`   OK: Bot @${result.username} (${result.botName})`);

      try {
        await bot.sendMessage(
          "🔔 <b>Тестове повідомлення</b>\n\nGBar Notifier працює!"
        );
        console.log("   OK: Test message sent to Telegram (test chat)");
      } catch (e) {
        console.log(
          `   WARN: Bot works but cant send message: ${
            e instanceof Error ? e.message : e
          }`
        );
        console.log(
          "   Make sure you sent a message to the bot first, and TEST_TELEGRAM_CHAT_ID is correct"
        );
      }
    } else {
      console.log(`   FAIL: ${JSON.stringify(result.error)}`);
    }
  }

  // 2. Get cookie string (from env or auto-login)
  let cookieString = process.env.GBAR_COOKIE_STRING;
  const baseUrl = process.env.GBAR_BASE_URL || "https://pro.gbar.com.ua";

  if (!cookieString && process.env.GBAR_LOGIN && process.env.GBAR_PASSWORD) {
    console.log("\n2. Testing auto-login with Puppeteer...");
    const authResult = await loginAndGetCookies(
      { login: process.env.GBAR_LOGIN, password: process.env.GBAR_PASSWORD },
      baseUrl
    );
    if (authResult.success && authResult.cookieString) {
      console.log("   OK: Login successful, got cookies");
      cookieString = authResult.cookieString;
    } else {
      console.log(`   FAIL: ${authResult.error}`);
      console.log("\n=== Test Complete ===");
      return;
    }
  } else if (!cookieString) {
    console.log(
      "\n2. Testing GBar Dashboard...\n   SKIP: GBAR_COOKIE_STRING and GBAR_LOGIN/GBAR_PASSWORD not set"
    );
    console.log("\n=== Test Complete ===");
    return;
  } else {
    console.log("\n2. Using manual cookie string...");
  }

  // 3. Test GBar connection
  console.log("\n3. Testing GBar Dashboard...");
  const scraper = new GBarScraper({ cookieString, baseUrl });

  const result = await scraper.testConnection();
  if (result.success) {
    console.log(`   OK: ${result.message}`);
  } else {
    console.log(`   FAIL: ${result.error}`);
    console.log("\n=== Test Complete ===");
    return;
  }

  // 4. Fetch today's bookings
  console.log("\n4. Fetching today's bookings...");
  try {
    const today = new Date().toISOString().split("T")[0];
    const bookings = await scraper.fetchBookingsForDate(today);
    console.log(`   OK: Found ${bookings.length} booking(s) for today`);
    bookings.forEach((b) => {
      console.log(`   - ${b.time} | ${b.client} (ID: ${b.id})`);
    });
  } catch (e) {
    console.log(`   FAIL: ${e instanceof Error ? e.message : e}`);
  }

  // 5. Fetch next 7 days
  console.log("\n5. Fetching next 7 days...");
  try {
    const allBookings = await scraper.fetchUpcomingBookings(7);
    for (const [date, bookings] of Object.entries(allBookings)) {
      if (bookings && bookings.length > 0) {
        console.log(`   ${date}: ${bookings.length} booking(s)`);
        bookings.forEach((b) => {
          console.log(`     - ${b.time} | ${b.client} (ID: ${b.id})`);
        });
      } else {
        console.log(`   ${date}: no bookings`);
      }
    }
  } catch (e) {
    console.log(`   FAIL: ${e instanceof Error ? e.message : e}`);
  }

  console.log("\n=== Test Complete ===");
}

test().catch(console.error);
