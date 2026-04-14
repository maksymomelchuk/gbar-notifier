# GBar Booking Notifier

Telegram notifications when bookings are created, changed, or cancelled in the GBar beauty studio dashboard.

## How it works

1. Logs into `pro.gbar.com.ua` automatically via Puppeteer (or uses a manual cookie)
2. Polls the bookings page every 15 minutes (configurable)
3. Parses the HTML to extract booking data (date, time, client)
4. Compares with previous state to detect new/changed/cancelled bookings
5. Sends Telegram messages in Ukrainian with the changes
6. Sends a daily summary at 7:00 AM Kyiv time
7. Auto-refreshes session cookies when they expire

## Setup

### 1. Create a Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`, follow instructions
3. Copy the **bot token** (looks like `123456789:ABCdefGhIjKlmNoPqRsTuVwXyZ`)
4. Open the bot you just created and send it any message (e.g. "hello")
5. Get your **chat ID**: message **@userinfobot** — it replies with your ID

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
GBAR_LOGIN=your_gbar_login
GBAR_PASSWORD=your_gbar_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

That's it — cookies are managed automatically via Puppeteer login.

### 3. Install & Build

```bash
pnpm install
pnpm run build
```

### 4. Test

```bash
pnpm test
```

This will: connect to Telegram, auto-login to GBar, fetch bookings for the next 7 days, and print results.

### 5. Run

```bash
# Foreground
pnpm start

# With PM2 (recommended for VPS)
npm install -g pm2
pm2 start dist/index.js --name gbar-notifier
pm2 save
pm2 startup     # auto-start on reboot
```

## VPS / Linux deployment

Puppeteer needs a Chromium binary. On Ubuntu/Debian:

```bash
apt install chromium-browser
```

Then set in `.env`:

```
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| GBAR_LOGIN | — | GBar login (phone or email) |
| GBAR_PASSWORD | — | GBar password |
| GBAR_COOKIE_STRING | — | Manual cookie (alternative to login/password) |
| TELEGRAM_BOT_TOKEN | required | Bot token from @BotFather |
| TELEGRAM_CHAT_ID | required | Your Telegram user/chat ID |
| POLL_INTERVAL_MINUTES | 5 | How often to check (minutes) |
| DAYS_AHEAD | 7 | Days ahead to monitor |
| GBAR_BASE_URL | https://pro.gbar.com.ua | Dashboard URL |
| PUPPETEER_EXECUTABLE_PATH | — | Path to Chromium binary (for VPS) |

## Tech stack

Node.js, TypeScript, Puppeteer, axios, cheerio, node-cron
