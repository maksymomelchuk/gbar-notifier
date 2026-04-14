export interface Booking {
  id: string;
  date: string;
  time: string;
  client: string;
  rawDate: string;
}

/**
 * Map of ISO date string -> bookings array.
 * null means fetch failed for that date; empty array means no bookings.
 */
export type BookingsByDate = Record<string, Booking[] | null>;

export type BookingMap = Record<string, Booking>;

export interface BookingChange {
  id: string;
  oldTime: string;
  newTime: string;
  oldDate: string;
  newDate: string;
  oldClient: string;
  newClient: string;
}

export interface DiffResult {
  newBookings: Booking[];
  cancelledBookings: Booking[];
  changedBookings: BookingChange[];
}

export interface AppConfig {
  cookieString: string;
  baseUrl: string;
  telegramToken: string;
  telegramChatId: string;
  pollIntervalMinutes: number;
  daysAhead: number;
  gbarLogin?: string;
  gbarPassword?: string;
}

export interface ScraperConfig {
  cookieString: string;
  baseUrl?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  message?: string;
  username?: string;
  botName?: string;
  bodyClass?: string;
}
