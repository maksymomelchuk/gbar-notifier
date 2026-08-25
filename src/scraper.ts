import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { Booking, BookingsByDate, ScraperConfig, ConnectionTestResult } from './types';

export default class GBarScraper {
  private baseUrl: string;
  private cookieString: string;
  private client: AxiosInstance;

  constructor(config: ScraperConfig) {
    this.baseUrl = config.baseUrl || 'https://pro.gbar.com.ua';
    this.cookieString = config.cookieString;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Cookie': this.cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
      },
      timeout: 15000,
      maxRedirects: 5,
    });
  }

  async fetchBookingsForDate(date: string): Promise<Booking[]> {
    try {
      const response = await this.client.get(`/issue/master?date=${date}`);

      if (response.data.includes('/login') || response.data.includes('Увійти') || response.request?.path?.includes('login')) {
        throw new Error('SESSION_EXPIRED: Cookie is no longer valid. Please update GBAR_COOKIE_STRING in .env');
      }

      return this.parseBookings(response.data, date);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('SESSION_EXPIRED')) throw error;
      console.error(`Error fetching bookings for ${date}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  parseBookings(html: string, date: string): Booking[] {
    const $ = cheerio.load(html);
    const bookings: Booking[] = [];

    $('table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 3) return;

      const idLink = $row.find('a').first();
      const id = idLink.text().trim();

      if (!id || isNaN(Number(id))) return;

      const dateTimeCell = $(cells[1]);
      const cellText = dateTimeCell.text().replace(/\s+/g, ' ').trim();
      const isoDate = cellText.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
      const dateText = isoDate ?? dateTimeCell.contents().first().text().replace(/\s+/g, ' ').trim();
      const timeText = cellText.replace(dateText, '').trim();

      const clientName = $(cells[2]).text().trim();

      if (id && clientName) {
        bookings.push({
          id,
          date: dateText || date,
          time: timeText,
          client: clientName,
          rawDate: date,
        });
      }
    });

    return bookings;
  }

  async fetchUpcomingBookings(daysAhead: number = 7): Promise<BookingsByDate> {
    const allBookings: BookingsByDate = {};
    const today = new Date();

    for (let i = 0; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      try {
        const bookings = await this.fetchBookingsForDate(dateStr);
        allBookings[dateStr] = bookings;

        if (i < daysAhead) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('SESSION_EXPIRED')) throw error;
        console.error(`Failed to fetch ${dateStr}, skipping...`);
        allBookings[dateStr] = null;
      }
    }

    return allBookings;
  }

  updateCookies(newCookieString: string): void {
    this.cookieString = newCookieString;
    this.client.defaults.headers['Cookie'] = newCookieString;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await this.client.get(`/issue/master?date=${today}`);

      if (response.data.includes('/login') || response.data.includes('Увійти')) {
        return { success: false, error: 'Session expired - need new cookies' };
      }

      const $ = cheerio.load(response.data);
      const bodyClass = $('body').attr('class') || '';

      return {
        success: true,
        message: `Connected successfully. Page title: ${$('title').text()}`,
        bodyClass,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
