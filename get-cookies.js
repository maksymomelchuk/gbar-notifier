/**
 * Helper script to extract cookies from a Puppeteer/Playwright session
 *
 * If session cookies expire too often, you can use this script
 * to automate login. You'll need to install puppeteer:
 * npm install puppeteer
 *
 * Usage: node get-cookies.js <email> <password>
 */

async function getCookies() {
  console.log(`
=== How to get your GBar session cookie ===

METHOD 1: Manual (Recommended - works immediately)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open Brave/Chrome browser
2. Go to https://pro.gbar.com.ua/issue/master
3. Make sure you're logged in
4. Press F12 to open DevTools
5. Go to "Network" tab
6. Reload the page (F5)
7. Click the first request (issue/master)
8. In "Headers" section, find "Request Headers"
9. Find the "Cookie:" line
10. Copy the ENTIRE cookie value
11. Paste it as GBAR_COOKIE_STRING in your .env file

Example cookie string:
XSRF-TOKEN=eyJpdiI6...; gbar_session=eyJpdiI6...

METHOD 2: Using browser Application tab
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open DevTools (F12)
2. Go to "Application" tab
3. In left sidebar, expand "Cookies"
4. Click on "https://pro.gbar.com.ua"
5. Copy ALL cookie name=value pairs
6. Join them with "; " and paste in .env

METHOD 3: Automated with Puppeteer (for auto-refresh)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If cookies expire frequently, uncomment the code below and run:
  npm install puppeteer
  node get-cookies.js your@email.com yourpassword
`);

  // Uncomment below for automated cookie extraction:
  /*
  const puppeteer = require('puppeteer');

  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: node get-cookies.js <email> <password>');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Navigate to login
  await page.goto('https://pro.gbar.com.ua/login');

  // Fill in credentials (adjust selectors as needed)
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect
  await page.waitForNavigation();

  // Get cookies
  const cookies = await page.cookies();
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  console.log('\n=== Your cookie string ===');
  console.log(cookieString);
  console.log('\nPaste this as GBAR_COOKIE_STRING in your .env file');

  await browser.close();
  */
}

getCookies().catch(console.error);
