const axios = require('axios');
const cheerio = require('cheerio');

class GBarScraper {
  constructor(config) {
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

  /**
   * Fetch bookings for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} Array of booking objects
   */
  async fetchBookingsForDate(date) {
    try {
      const response = await this.client.get(`/issue/master?date=${date}`);

      // Check if we got redirected to login
      if (response.data.includes('/login') || response.data.includes('Увійти') || response.request?.path?.includes('login')) {
        throw new Error('SESSION_EXPIRED: Cookie is no longer valid. Please update GBAR_COOKIE_STRING in .env');
      }

      return this.parseBookings(response.data, date);
    } catch (error) {
      if (error.message.startsWith('SESSION_EXPIRED')) throw error;
      console.error(`Error fetching bookings for ${date}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse HTML and extract booking data
   */
  parseBookings(html, date) {
    const $ = cheerio.load(html);
    const bookings = [];

    $('table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 3) return;

      // Extract booking ID from the link
      const idLink = $row.find('a').first();
      const id = idLink.text().trim();

      if (!id || isNaN(id)) return;

      // Extract date and time
      const dateTimeCell = $(cells[1]);
      const dateText = dateTimeCell.contents().first().text().trim();
      const timeText = dateTimeCell.find('br').length > 0
        ? dateTimeCell.html().split('<br>').pop().replace(/<[^>]+>/g, '').trim()
        : dateTimeCell.text().replace(dateText, '').trim();

      // Extract client name
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

  /**
   * Fetch bookings for multiple days ahead
   * @param {number} daysAhead - Number of days to check
   * @returns {Object} Map of date -> bookings array
   */
  async fetchUpcomingBookings(daysAhead = 7) {
    const allBookings = {};
    const today = new Date();

    for (let i = 0; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      try {
        const bookings = await this.fetchBookingsForDate(dateStr);
        allBookings[dateStr] = bookings;

        // Small delay between requests to be polite
        if (i < daysAhead) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        if (error.message.startsWith('SESSION_EXPIRED')) throw error;
        console.error(`Failed to fetch ${dateStr}, skipping...`);
        allBookings[dateStr] = null; // null means error, [] means no bookings
      }
    }

    return allBookings;
  }

  /**
   * Test the connection
   */
  async testConnection() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await this.client.get(`/issue/master?date=${today}`);

      if (response.data.includes('/login') || response.data.includes('Увійти')) {
        return { success: false, error: 'Session expired - need new cookies' };
      }

      // Try to find the user name
      const $ = cheerio.load(response.data);
      const userName = $('body').attr('class') || '';

      return {
        success: true,
        message: `Connected successfully. Page title: ${$('title').text()}`,
        bodyClass: userName,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = GBarScraper;
