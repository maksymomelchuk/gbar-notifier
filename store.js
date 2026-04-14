const fs = require('fs');
const path = require('path');

/**
 * Simple JSON file store for tracking booking state between polls
 */
class BookingStore {
  constructor(filePath = path.join(__dirname, 'data', 'bookings.json')) {
    this.filePath = filePath;
    this.ensureDir();
  }

  ensureDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Load stored bookings
   * @returns {Object} Map of booking ID -> booking data
   */
  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading store:', error.message);
    }
    return {};
  }

  /**
   * Save bookings to store
   * @param {Object} bookings - Map of booking ID -> booking data
   */
  save(bookings) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(bookings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving store:', error.message);
    }
  }

  /**
   * Compare current bookings with stored ones and find differences
   * @param {Object} currentByDate - Map of date -> bookings array
   * @returns {Object} { newBookings, cancelledBookings, changedBookings }
   */
  diff(currentByDate) {
    const stored = this.load();

    // Flatten current bookings into a map by ID
    const currentMap = {};
    for (const [date, bookings] of Object.entries(currentByDate)) {
      if (!bookings) continue; // skip dates that errored
      for (const booking of bookings) {
        currentMap[booking.id] = booking;
      }
    }

    // Find new and changed bookings
    const newBookings = [];
    const changedBookings = [];

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

    // Find cancelled bookings (were in store but not in current)
    // Only check bookings for dates we actually fetched (don't flag as cancelled if we just didn't fetch that date)
    const fetchedDates = new Set(Object.keys(currentByDate).filter(d => currentByDate[d] !== null));
    const cancelledBookings = [];

    for (const [id, old] of Object.entries(stored)) {
      if (!currentMap[id] && fetchedDates.has(old.rawDate)) {
        cancelledBookings.push(old);
      }
    }

    return { newBookings, cancelledBookings, changedBookings };
  }

  /**
   * Update store with current bookings (only for dates we fetched)
   */
  update(currentByDate) {
    const stored = this.load();
    const fetchedDates = new Set(Object.keys(currentByDate).filter(d => currentByDate[d] !== null));

    // Remove old entries for dates we fetched
    for (const id of Object.keys(stored)) {
      if (fetchedDates.has(stored[id].rawDate)) {
        delete stored[id];
      }
    }

    // Add current entries
    for (const [date, bookings] of Object.entries(currentByDate)) {
      if (!bookings) continue;
      for (const booking of bookings) {
        stored[booking.id] = booking;
      }
    }

    // Clean up old dates (past dates)
    const today = new Date().toISOString().split('T')[0];
    for (const id of Object.keys(stored)) {
      if (stored[id].rawDate < today) {
        delete stored[id];
      }
    }

    this.save(stored);
  }
}

module.exports = BookingStore;
