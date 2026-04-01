/**
 * Date utilities for PKT (Pakistan Standard Time, UTC+5).
 */

const PKT_OFFSET_HOURS = 5;

/**
 * Format a Date or ISO string to DD-MM-YYYY display format in PKT.
 */
export function formatDatePKT(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pktDate = new Date(d.getTime() + PKT_OFFSET_HOURS * 60 * 60 * 1000);

  const day = String(pktDate.getUTCDate()).padStart(2, '0');
  const month = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
  const year = pktDate.getUTCFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Format a Date to ISO-8601 date-only string (YYYY-MM-DD) for storage.
 */
export function toISODate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Get current date in PKT timezone.
 */
export function nowPKT(): Date {
  const now = new Date();
  return new Date(now.getTime() + PKT_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Get start of day in UTC for a given date string (YYYY-MM-DD).
 */
export function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Get end of day in UTC for a given date string (YYYY-MM-DD).
 */
export function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

/**
 * Add days to a date.
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Calculate days between two dates.
 */
export function daysBetween(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  const diffMs = e.getTime() - s.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
