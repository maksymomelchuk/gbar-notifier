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

  async sendMessage(text: string, parseMode: string = 'HTML', chatId?: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId ?? this.chatId,
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

  async notifyDailySummary(dateBookings: BookingsByDate, chatId?: string): Promise<void> {
    const entries = Object.entries(dateBookings)
      .filter((entry): entry is [string, Booking[]] => entry[1] !== null && entry[1].length > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
      await this.sendMessage('📋 <b>Розклад:</b> Немає записів на найближчі дні', 'HTML', chatId);
      return;
    }

    let message = '📋 <b>Розклад на найближчі дні:</b>\n\n';

    for (const [date, bookings] of entries) {
      message += `📅 <b>${this.formatDateFull(date)}</b>\n`;

      const sorted = [...bookings].sort((a, b) => this.startMinutes(a.time) - this.startMinutes(b.time));

      for (const b of sorted) {
        message += `  ⏰ ${b.time} — ${b.client}\n`;
      }
      message += '\n';
    }

    await this.sendMessage(message, 'HTML', chatId);
  }

  async notifySessionExpired(chatId?: string): Promise<void> {
    await this.sendMessage(
      '⚠️ <b>Не вдалося увійти в GBar!</b>\n\n' +
      'Сесія закінчилась, а автоматичний вхід не спрацював.\n' +
      'Якщо змінився пароль — онови GBAR_PASSWORD у .env на сервері та виконай <code>pm2 restart gbar-notifier</code>.',
      'HTML',
      chatId
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

  private startMinutes(time: string): number {
    const m = time.match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
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
