const axios = require('axios');

class TelegramBot {
  constructor(token, chatId) {
    this.token = token;
    this.chatId = chatId;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(text, parseMode = 'HTML') {
    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      });
      return response.data;
    } catch (error) {
      console.error('Telegram send error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Format and send a notification about new bookings
   */
  async notifyNewBookings(bookings) {
    if (!bookings.length) return;

    const header = `🆕 <b>Нові записи (${bookings.length}):</b>\n`;
    const lines = bookings.map(b =>
      `📅 <b>${this.formatDate(b.date)}</b> ⏰ ${b.time}\n👤 ${b.client} (ID: ${b.id})`
    );

    await this.sendMessage(header + '\n' + lines.join('\n\n'));
  }

  /**
   * Format and send a notification about cancelled bookings
   */
  async notifyCancelledBookings(bookings) {
    if (!bookings.length) return;

    const header = `❌ <b>Скасовані записи (${bookings.length}):</b>\n`;
    const lines = bookings.map(b =>
      `📅 <b>${this.formatDate(b.date)}</b> ⏰ ${b.time}\n👤 ${b.client} (ID: ${b.id})`
    );

    await this.sendMessage(header + '\n' + lines.join('\n\n'));
  }

  /**
   * Format and send a notification about changed bookings
   */
  async notifyChangedBookings(changes) {
    if (!changes.length) return;

    const header = `✏️ <b>Змінені записи (${changes.length}):</b>\n`;
    const lines = changes.map(c => {
      const parts = [`ID: ${c.id}`];
      if (c.oldTime !== c.newTime) parts.push(`⏰ ${c.oldTime} → ${c.newTime}`);
      if (c.oldDate !== c.newDate) parts.push(`📅 ${this.formatDate(c.oldDate)} → ${this.formatDate(c.newDate)}`);
      if (c.oldClient !== c.newClient) parts.push(`👤 ${c.oldClient} → ${c.newClient}`);
      return parts.join('\n');
    });

    await this.sendMessage(header + '\n' + lines.join('\n\n'));
  }

  /**
   * Send daily summary
   */
  async notifyDailySummary(dateBookings) {
    const entries = Object.entries(dateBookings)
      .filter(([_, bookings]) => bookings && bookings.length > 0);

    if (entries.length === 0) {
      await this.sendMessage('📋 <b>Розклад:</b> Немає записів на найближчі дні');
      return;
    }

    let message = '📋 <b>Розклад на найближчі дні:</b>\n\n';

    for (const [date, bookings] of entries) {
      const dayName = this.getDayName(date);
      message += `📅 <b>${this.formatDate(date)} (${dayName})</b>\n`;

      for (const b of bookings) {
        message += `  ⏰ ${b.time} — ${b.client}\n`;
      }
      message += '\n';
    }

    await this.sendMessage(message);
  }

  /**
   * Send session expired alert
   */
  async notifySessionExpired() {
    await this.sendMessage(
      '⚠️ <b>Сесія закінчилась!</b>\n\n' +
      'Потрібно оновити cookie в .env файлі.\n' +
      'Відкрий панель GBar в браузері та скопіюй нові cookie.'
    );
  }

  /**
   * Test the bot connection
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);
      return {
        success: true,
        botName: response.data.result.first_name,
        username: response.data.result.username,
      };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  }

  getDayName(dateStr) {
    const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
    return days[new Date(dateStr).getDay()];
  }
}

module.exports = TelegramBot;
