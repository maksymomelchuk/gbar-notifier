# GBar Booking Notifier

Telegram notifications when bookings are created, changed, or cancelled in the GBar beauty studio dashboard.

## How it works

1. Polls `pro.gbar.com.ua/issue/master` every 5 minutes (configurable)
2. Parses the HTML to extract booking data (ID, date, time, client)
3. Compares with previous state to detect new/changed/cancelled bookings
4. Sends Telegram messages with the changes
5. Sends a daily summary at 7:00 AM Kyiv time

## Setup

### 1. Create a Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`, follow instructions
3. Copy the **bot token** (looks like `123456789:ABCdefGhIjKlmNoPqRsTuVwXyZ`)
4. Open the bot you just created and send it any message (e.g. "hello")
5. Get your **chat ID**: visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in browser, find `"chat":{"id":XXXXXX}`

### 2. Get GBar Session Cookie

1. Open Brave/Chrome, go to https://pro.gbar.com.ua/issue/master
2. Log in if needed
3. Press **F12** (DevTools) → **Network** tab
4. Reload the page
5. Click the first request → **Headers** → **Request Headers** → **Cookie**
6. Copy the entire cookie value

Or run `node get-cookies.js` for detailed instructions.

### 3. Configure

```bash
cp .env.example .env
# Edit .env and fill in:
# - GBAR_COOKIE_STRING
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_CHAT_ID
```

### 4. Install & Test

```bash
npm install
node test.js    # verify everything works
```

### 5. Run

```bash
# Foreground
npm start

# With PM2 (recommended for VPS)
npm install -g pm2
pm2 start index.js --name gbar-notifier
pm2 save
pm2 startup     # auto-start on reboot
```

## Cookie Refresh

Session cookies expire periodically. When they do:
- You'll get a Telegram alert: "Сесія закінчилась!"
- Repeat step 2 above and update `.env`
- Restart: `pm2 restart gbar-notifier`

## Configuration

| Variable | Default | Description |
|---|---|---|
| GBAR_COOKIE_STRING | required | Session cookie from browser |
| TELEGRAM_BOT_TOKEN | required | Bot token from @BotFather |
| TELEGRAM_CHAT_ID | required | Your Telegram user/chat ID |
| POLL_INTERVAL_MINUTES | 5 | How often to check (minutes) |
| DAYS_AHEAD | 7 | Days ahead to monitor |
| GBAR_BASE_URL | https://pro.gbar.com.ua | Dashboard URL |
