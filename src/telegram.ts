import axios from 'axios';
import { Booking, BookingChange, BookingsByDate, ConnectionTestResult } from './types';

export default class TelegramBot {
  private token: string;
  private chatId: string;
  private apiUrl: string;

  constructor(token: string, chatId: string) {
    this.token = token;
    this.chatId = chatId;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(text: string, parseMode: string = 'HTML'): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Telegram send error:', error.response?.data || error.message);
      } else {
        console.error('Telegram send error:', error);
      }
      throw error;
    }
  }

  async notifyNewBookings(bookings: Booking[]): Promise<void> {
    if (!bookings.length) return;

    const header = `🆕 <b>Нові записи (${bookings.length}):</b>\n`;
    const lines = bookings.map(b =>
      `📅 <b>${this.formatDateFull(b.rawDate)}</b>\n⏰ ${b.time}\n👤 ${b.client}`
    );

    await this.sendMessage(header + '\n' + lines.join('\n\n'));
  }

  async notifyCancelledBookings(bookings: Booking[]): Promise<void> {
    if (!bookings.length) return;

    const header = `❌ <b>Скасовані записи (${bookings.length}):</b>\n`;
    const lines = bookings.map(b =>
      `📅 <b>${this.formatDateFull(b.rawDate)}</b>\n⏰ ${b.time}\n👤 ${b.client}`
    );

    await this.sendMessage(header + '\n' + lines.join('\n\n'));
  }

  async notifyChangedBookings(changes: BookingChange[]): Promise<void> {
    if (!changes.length) return;

    const header = `✏️ <b>Змінені записи (${changes.length}):</b>\n`;
    const lines = changes.map(c => {
      let line = `👤 ${c.newClient}`;
      if (c.oldDate !== c.newDate) {
        line += `\n📅 ${this.formatDateFull(c.oldDate)} → ${this.formatDateFull(c.newDate)}`;
      } else {
        line += `\n📅 ${this.formatDateFull(c.newDate)}`;
      }
      if (c.oldTime !== c.newTime) {
        line += `\n⏰ ${c.oldTime} → ${c.newTime}`;
      }
      if (c.oldClient !== c.newClient) {
        line += `\n👤 ${c.oldClient} → ${c.newClient}`;
      }
      return line;
    });

    await this.sendMessage(header + '\n' + lines.join('\n\n'));
  }

  async notifyDailySummary(dateBookings: BookingsByDate): Promise<void> {
    const entries = Object.entries(dateBookings)
      .filter((entry): entry is [string, Booking[]] => entry[1] !== null && entry[1].length > 0);

    if (entries.length === 0) {
      await this.sendMessage('📋 <b>Розклад:</b> Немає записів на найближчі дні');
      return;
    }

    let message = '📋 <b>Розклад на найближчі дні:</b>\n\n';

    for (const [date, bookings] of entries) {
      message += `📅 <b>${this.formatDateFull(date)}</b>\n`;

      for (const b of bookings) {
        message += `  ⏰ ${b.time} — ${b.client}\n`;
      }
      message += '\n';
    }

    await this.sendMessage(message);
  }

  async notifySessionExpired(): Promise<void> {
    await this.sendMessage(
      '⚠️ <b>Сесія закінчилась!</b>\n\n' +
      'Потрібно оновити cookie в .env файлі.\n' +
      'Відкрий панель GBar в браузері та скопіюй нові cookie.'
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);
      return {
        success: true,
        botName: response.data.result.first_name,
        username: response.data.result.username,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return { success: false, error: String(error.response?.data || error.message) };
      }
      return { success: false, error: String(error) };
    }
  }

  private formatDateFull(dateStr: string): string {
    const months = [
      'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
    ];
    const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];

    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
  }
}
