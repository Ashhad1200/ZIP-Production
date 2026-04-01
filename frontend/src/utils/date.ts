import { format, differenceInDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const PKT_TIMEZONE = 'Asia/Karachi';

function toPKT(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, PKT_TIMEZONE);
}

/** Format as DD-MM-YYYY in PKT */
export function formatDatePKT(date: Date | string): string {
  return format(toPKT(date), 'dd-MM-yyyy');
}

/** Format as DD-MM-YYYY HH:mm in PKT */
export function formatDateTimePKT(date: Date | string): string {
  return format(toPKT(date), 'dd-MM-yyyy HH:mm');
}

/** Convert to ISO date string YYYY-MM-DD */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Number of days between two dates */
export function daysBetween(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  return Math.abs(differenceInDays(e, s));
}
