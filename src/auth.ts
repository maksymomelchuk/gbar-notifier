import puppeteer from 'puppeteer';

export interface AuthCredentials {
  login: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  cookieString?: string;
  error?: string;
}

export async function loginAndGetCookies(
  credentials: AuthCredentials,
  baseUrl: string = 'https://pro.gbar.com.ua'
): Promise<AuthResult> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage();

    // Navigate to login page
    console.log('Navigating to login page...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Check if we're on the login page
    const loginForm = await page.$('input[name="login"]');
    if (!loginForm) {
      // Maybe already logged in, check by going to bookings page
      await page.goto(`${baseUrl}/issue/master`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const content = await page.content();
      if (!content.includes('Увійти') && !content.includes('/login')) {
        const cookies = await page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        return { success: true, cookieString };
      }
      return { success: false, error: 'Could not find login form' };
    }

    // Fill credentials and submit
    console.log('Logging in...');
    await page.type('input[name="login"]', credentials.login);
    await page.type('input[name="password"]', credentials.password);

    // Set up navigation wait before clicking to avoid race condition
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.click('input[type="submit"]'),
    ]);

    // Check if login failed (still on auth/login page)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      return { success: false, error: 'Login failed — check GBAR_LOGIN and GBAR_PASSWORD' };
    }

    // After login, navigate to the bookings page to ensure session is established
    console.log('Login successful, navigating to bookings page...');
    await page.goto(`${baseUrl}/issue/master`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Verify we're not redirected to login
    const content = await page.content();
    if (content.includes('Увійти')) {
      return { success: false, error: 'Session not established after login' };
    }

    // Extract cookies
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    if (!cookieString) {
      return { success: false, error: 'No cookies received after login' };
    }

    console.log('Cookies extracted successfully');
    return { success: true, cookieString };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Auth error: ${message}` };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
