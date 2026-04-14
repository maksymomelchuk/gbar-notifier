import fs from 'fs';
import path from 'path';
import { Booking, BookingsByDate, BookingMap, BookingChange, DiffResult } from './types';

export default class BookingStore {
  private filePath: string;

  constructor(filePath: string = path.join(__dirname, '..', 'data', 'bookings.json')) {
    this.filePath = filePath;
    this.ensureDir();
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): BookingMap {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading store:', error instanceof Error ? error.message : error);
    }
    return {};
  }

  save(bookings: BookingMap): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(bookings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving store:', error instanceof Error ? error.message : error);
    }
  }

  diff(currentByDate: BookingsByDate): DiffResult {
    const stored = this.load();

    const currentMap: BookingMap = {};
    for (const [, bookings] of Object.entries(currentByDate)) {
      if (!bookings) continue;
      for (const booking of bookings) {
        currentMap[booking.id] = booking;
      }
    }

    const newBookings: Booking[] = [];
    const changedBookings: BookingChange[] = [];

    for (const [id, current] of Object.entries(currentMap)) {
      if (!stored[id]) {
        newBookings.push(current);
      } else {
        const old = stored[id];
        if (old.time !== current.time || old.date !== current.date || old.client !== current.client) {
          changedBookings.push({
            id,
            oldTime: old.time,
            newTime: current.time,
            oldDate: old.date,
            newDate: current.date,
            oldClient: old.client,
            newClient: current.client,
          });
        }
      }
    }

    const fetchedDates = new Set(Object.keys(currentByDate).filter(d => currentByDate[d] !== null));
    const cancelledBookings: Booking[] = [];

    for (const [id, old] of Object.entries(stored)) {
      if (!currentMap[id] && fetchedDates.has(old.rawDate)) {
        cancelledBookings.push(old);
      }
    }

    return { newBookings, cancelledBookings, changedBookings };
  }

  update(currentByDate: BookingsByDate): void {
    const stored = this.load();
    const fetchedDates = new Set(Object.keys(currentByDate).filter(d => currentByDate[d] !== null));

    for (const id of Object.keys(stored)) {
      if (fetchedDates.has(stored[id].rawDate)) {
        delete stored[id];
      }
    }

    for (const [, bookings] of Object.entries(currentByDate)) {
      if (!bookings) continue;
      for (const booking of bookings) {
        stored[booking.id] = booking;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    for (const id of Object.keys(stored)) {
      if (stored[id].rawDate < today) {
        delete stored[id];
      }
    }

    this.save(stored);
  }
}
